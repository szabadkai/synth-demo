import React, { useEffect, useRef, useState } from 'react'
import { useStore, type State } from '../state/store'
import { Slider } from './controls/Slider'

export function Oscilloscope() {
  const engine = useStore((s: State) => s.engine)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef<number>()
  // Persist a smoothed trigger location across frames for automatic lock
  const lastTriggerRef = useRef(0)
  // Float trigger for sub-sample alignment
  const lastFloatTriggerRef = useRef(0)
  // Estimated period in samples (smoothed), helps phase-consistent locking
  const estPeriodRef = useRef<number>(0)
  // Hold-off counter to avoid jittery re-triggering every frame
  const holdCounterRef = useRef<number>(0)
  // User-adjustable lock parameters
  const [lock, setLock] = useState({
    highPct: 2, // % of full-scale for high threshold (0.02)
    lowPct: 2, // % of full-scale magnitude for low threshold -> -0.02
    windowPct: 25, // % of period around expected phase to consider
    holdOff: 3, // frames
    corrRefresh: 0.5, // min correlation to avoid template refresh
    enableTemplate: true,
    fft: 4096 as 1024 | 2048 | 4096 | 8192,
  })
  // Template of one period (normalized) for correlation-based trigger selection
  const templateRef = useRef<Float32Array | null>(null)
  const templateLenRef = useRef<number>(128)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !engine || typeof (engine as any).getAnalyser !== 'function') return
  const ctx = canvas.getContext('2d')!
    const analyser = (engine as any).getAnalyser() as AnalyserNode
    analyser.fftSize = lock.fft

    const render = () => {
      const getWave = (engine as any).getWaveform
      const data: Uint8Array = typeof getWave === 'function' ? getWave.call(engine) : new Uint8Array(analyser.fftSize)
      // Handle high-DPI rendering by aligning canvas pixel size to CSS size * dpr
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.clientWidth || 600
      const cssH = canvas.clientHeight || 160
      if (canvas.width !== Math.floor(cssW * dpr) || canvas.height !== Math.floor(cssH * dpr)) {
        canvas.width = Math.floor(cssW * dpr)
        canvas.height = Math.floor(cssH * dpr)
      }
      const width = canvas.width
      const height = canvas.height

      // Clear and paint background
      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--viz-bg') || '#05070b'
      ctx.fillRect(0, 0, width, height)

      // Draw zero/center line and faint vertical divisions for readability
      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      // Center line
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()
      // Vertical divisions
      const divisions = 6
      for (let i = 1; i < divisions; i++) {
        const x = (i * width) / divisions
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      ctx.restore()

  // Auto-lock (improved): Schmitt-triggered zero crossings + robust median period estimate + template correlation
      // Convert to centered float [-1, 1] and remove DC offset
      const N = data.length
      const f = new Float32Array(N)
      let mean = 0
      for (let i = 0; i < N; i++) mean += data[i]
      mean /= N
      let energy = 0
      for (let i = 0; i < N; i++) {
        const v = (data[i] - mean) / 128
        f[i] = v
        energy += v * v
      }
      let newTrigger = lastTriggerRef.current || 0
      if (energy > 1e-3) {
  // Schmitt thresholds to get clean rising crossings
  const high = Math.max(0.001, lock.highPct / 100)
  const low = -Math.max(0.001, lock.lowPct / 100)
        let armed = false
        const crossings: number[] = []
        for (let i = 1; i < N; i++) {
          const prev = f[i - 1]
          const curr = f[i]
          if (!armed && prev < low) armed = true
          if (armed && prev < high && curr >= high) {
            crossings.push(i)
            armed = false
          }
        }
        if (crossings.length >= 2) {
          // Compute intervals and robust period (median with outlier rejection)
          const intervals: number[] = []
          for (let i = 1; i < crossings.length; i++) intervals.push(crossings[i] - crossings[i - 1])
          intervals.sort((a, b) => a - b)
          const median = intervals[Math.floor(intervals.length / 2)]
          // Reject outliers deviating >20% from median
          let sum = 0, count = 0
          for (const d of intervals) {
            if (Math.abs(d - median) <= 0.2 * median) { sum += d; count++ }
          }
          const robustPeriod = count > 0 ? sum / count : median
          // Smooth estimated period and clamp
          const prevPeriod = estPeriodRef.current || robustPeriod
          const smoothedPeriod = Math.max(6, Math.min(N, prevPeriod * 0.6 + robustPeriod * 0.4))
          estPeriodRef.current = smoothedPeriod
          // Choose among candidates near expected phase using correlation to template for rock-solid lock
          const expected = ((lastTriggerRef.current || crossings[0]) + smoothedPeriod) % N
          const window = Math.max(6, Math.floor((lock.windowPct / 100) * smoothedPeriod))
          const cand: number[] = []
          for (const c of crossings) {
            const dist = Math.abs(c - expected)
            if (dist <= window) cand.push(c)
          }
          if (cand.length === 0) cand.push(Math.round(expected))

          // Ensure we have a template; if not, bootstrap from the first candidate
          const L = Math.max(32, Math.min(256, Math.floor(smoothedPeriod)))
          templateLenRef.current = L
          if (!templateRef.current) {
            const t = new Float32Array(L)
            for (let i = 0; i < L; i++) t[i] = f[(cand[0] + i) % N]
            // Normalize template
            let m = 0
            for (let i = 0; i < L; i++) m += t[i]
            m /= L
            let norm = 0
            for (let i = 0; i < L; i++) { t[i] = t[i] - m; norm += t[i] * t[i] }
            norm = Math.sqrt(Math.max(norm, 1e-12))
            for (let i = 0; i < L; i++) t[i] /= norm
            templateRef.current = t
          }
          if (lock.enableTemplate) {
            // Score candidates by correlation with template
            let bestIdx = cand[0]
            let bestScore = -Infinity
            const T = templateRef.current!
            for (const c of cand) {
              // Segment at c
              let m = 0
              for (let i = 0; i < L; i++) m += f[(c + i) % N]
              m /= L
              let norm = 0
              let dot = 0
              for (let i = 0; i < L; i++) {
                const v = f[(c + i) % N] - m
                norm += v * v
              }
              norm = Math.sqrt(Math.max(norm, 1e-12))
              for (let i = 0; i < L; i++) {
                const v = (f[(c + i) % N] - m) / norm
                dot += v * T[i]
              }
              if (dot > bestScore) { bestScore = dot; bestIdx = c }
            }
            newTrigger = bestIdx
            // If correlation is poor, rebuild template from the chosen candidate to adapt quickly
            if (bestScore < lock.corrRefresh) {
              const t = new Float32Array(L)
              for (let i = 0; i < L; i++) t[i] = f[(newTrigger + i) % N]
              let m2 = 0
              for (let i = 0; i < L; i++) m2 += t[i]
              m2 /= L
              let norm2 = 0
              for (let i = 0; i < L; i++) { t[i] = t[i] - m2; norm2 += t[i] * t[i] }
              norm2 = Math.sqrt(Math.max(norm2, 1e-12))
              for (let i = 0; i < L; i++) t[i] /= norm2
              templateRef.current = t
            }
          } else {
            // Without template, choose nearest to expected phase only
            let bestIdx = cand[0]
            let bestDist = Math.abs(bestIdx - expected)
            for (const c of cand) {
              const dist = Math.abs(c - expected)
              if (dist < bestDist) { bestDist = dist; bestIdx = c }
            }
            newTrigger = bestIdx
          }
        } else if (crossings.length === 1) {
          newTrigger = crossings[0]
        } else {
          // Fallback: point of maximum positive slope
          let bestSlope = 0
          let slopeIdx = 0
          for (let i = 1; i < N; i++) {
            const s = f[i] - f[i - 1]
            if (s > bestSlope) { bestSlope = s; slopeIdx = i }
          }
          newTrigger = slopeIdx
        }
        // Hold-off and smoothing
        const prevTrig = lastTriggerRef.current || 0
        const period = estPeriodRef.current || 0
        const expected = period ? (prevTrig + period) % N : prevTrig
        const dist = Math.abs(newTrigger - expected)
        const farOutlier = period && dist > 0.6 * period
        if (farOutlier || holdCounterRef.current >= lock.holdOff) {
          const smoothed = Math.round(prevTrig * 0.4 + newTrigger * 0.6)
          lastTriggerRef.current = smoothed
          holdCounterRef.current = 0
        } else {
          holdCounterRef.current += 1
        }
        // Fractional refinement using threshold interpolation near the chosen trigger
        let floatTrig = lastTriggerRef.current
        const search = 12
        for (let k = -search; k <= search; k++) {
          const i0 = (floatTrig + k + N) % N
          const i1 = (i0 + 1) % N
          const v0 = f[i0]
          const v1 = f[i1]
          if (v0 < high && v1 >= high) {
            const frac = (high - v0) / Math.max(v1 - v0, 1e-6)
            floatTrig = i0 + frac
            break
          }
        }
        lastFloatTriggerRef.current = floatTrig
        // Update template from the new phase-aligned start
        const L = templateLenRef.current
        const t = new Float32Array(L)
        for (let i = 0; i < L; i++) {
          const idx = (floatTrig + i) % N
          const i0 = Math.floor(idx)
          const i1 = (i0 + 1) % N
          const a = idx - i0
          const sample = f[i0] * (1 - a) + f[i1] * a
          t[i] = sample
        }
        // Normalize template
        let m = 0
        for (let i = 0; i < L; i++) m += t[i]
        m /= L
        let norm = 0
        for (let i = 0; i < L; i++) { t[i] = t[i] - m; norm += t[i] * t[i] }
        norm = Math.sqrt(Math.max(norm, 1e-12))
        for (let i = 0; i < L; i++) t[i] /= norm
        templateRef.current = t
      }
      const trigger = lastFloatTriggerRef.current || lastTriggerRef.current || 0

      // Draw waveform starting at trigger index so it appears stationary
      const slice = width / N
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--viz-stroke') || '#00ffd5'
      ctx.lineWidth = 2
      ctx.shadowColor = ctx.strokeStyle
      ctx.shadowBlur = 8
      ctx.beginPath()
      // Interpolated sampling from f for sub-sample start offset
      for (let i = 0; i < N; i++) {
        const idx = (i + trigger) % N
        const i0 = Math.floor(idx)
        const i1 = (i0 + 1) % N
        const a = idx - i0
        const sample = f[i0] * (1 - a) + f[i1] * a
        const y = (sample * 0.5 + 0.5) * height
        const x = i * slice
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.shadowBlur = 0

      raf.current = requestAnimationFrame(render)
    }
    raf.current = requestAnimationFrame(render)
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current)
    }
  }, [engine, lock])

  return (
    <div>
      <canvas ref={canvasRef} width={600} height={300} style={{ width: '100%', height: 300, borderRadius: 8, border: '1px solid #222631' }} />
      <div className="row" style={{ marginTop: 8, flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={lock.enableTemplate}
            onChange={(e) => setLock((l) => ({ ...l, enableTemplate: e.target.checked }))}
          />
          <span className="label">Template correlation</span>
        </label>
        <label style={{ minWidth: 140 }}>
          <div className="label">High threshold (%)</div>
          <input type="range" min={0.5} max={10} step={0.1} value={lock.highPct} onChange={(e) => setLock((l) => ({ ...l, highPct: Number(e.target.value) }))} />
        </label>
        <label style={{ minWidth: 140 }}>
          <div className="label">Low threshold (%)</div>
          <input type="range" min={0.5} max={10} step={0.1} value={lock.lowPct} onChange={(e) => setLock((l) => ({ ...l, lowPct: Number(e.target.value) }))} />
        </label>
        <label style={{ minWidth: 160 }}>
          <div className="label">Window (% of period)</div>
          <input type="range" min={10} max={50} step={1} value={lock.windowPct} onChange={(e) => setLock((l) => ({ ...l, windowPct: Number(e.target.value) }))} />
        </label>
        <label style={{ minWidth: 140 }}>
          <div className="label">Hold-off (frames)</div>
          <input type="range" min={0} max={10} step={1} value={lock.holdOff} onChange={(e) => setLock((l) => ({ ...l, holdOff: Number(e.target.value) }))} />
        </label>
        <label style={{ minWidth: 160 }}>
          <div className="label">Correlation refresh</div>
          <input type="range" min={0} max={0.95} step={0.05} value={lock.corrRefresh} onChange={(e) => setLock((l) => ({ ...l, corrRefresh: Number(e.target.value) }))} />
        </label>
        <label>
          <div className="label">FFT Size</div>
          <select value={lock.fft} onChange={(e) => setLock((l) => ({ ...l, fft: Number(e.target.value) as any }))}>
            <option value={1024}>1024</option>
            <option value={2048}>2048</option>
            <option value={4096}>4096</option>
            <option value={8192}>8192</option>
          </select>
        </label>
        <button onClick={() => setLock({ highPct: 2, lowPct: 2, windowPct: 25, holdOff: 3, corrRefresh: 0.5, enableTemplate: true, fft: 4096 })}>
          Reset
        </button>
        <button
          onClick={() => {
            templateRef.current = null
            lastTriggerRef.current = 0
            lastFloatTriggerRef.current = 0
            estPeriodRef.current = 0
            holdCounterRef.current = 0
          }}
        >
          Relearn Lock
        </button>
      </div>
    </div>
  )
}
