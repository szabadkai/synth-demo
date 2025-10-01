import React, { useEffect, useRef, useState } from 'react'
import { useStore, type State } from '../state/store'

const LOCK = {
  highPct: 2,
  lowPct: 2,
  windowPct: 25,
  holdOff: 3,
  corrRefresh: 0.5,
  enableTemplate: true,
}

export function Oscilloscope() {
  const engine = useStore((s: State) => s.engine)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const raf = useRef<number>()
  const lastTriggerRef = useRef(0)
  const lastFloatTriggerRef = useRef(0)
  const estPeriodRef = useRef<number>(0)
  const holdCounterRef = useRef<number>(0)
  const templateRef = useRef<Float32Array | null>(null)
  const templateLenRef = useRef<number>(128)
  const [fftSize, setFftSize] = useState<1024 | 2048 | 4096 | 8192>(4096)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !engine || typeof (engine as any).getAnalyser !== 'function') return
    const ctx = canvas.getContext('2d')!
    const analyser = (engine as any).getAnalyser() as AnalyserNode
    analyser.fftSize = fftSize
    analyser.smoothingTimeConstant = 0

    const render = () => {
      const getWave = (engine as any).getWaveform
      const data: Uint8Array = typeof getWave === 'function' ? getWave.call(engine) : new Uint8Array(analyser.fftSize)
      const dpr = window.devicePixelRatio || 1
      const cssW = canvas.clientWidth || 600
      const cssH = canvas.clientHeight || 160
      const targetW = Math.floor(cssW * dpr)
      const targetH = Math.floor(cssH * dpr)
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW
        canvas.height = targetH
      }
      const width = canvas.width
      const height = canvas.height

      ctx.clearRect(0, 0, width, height)
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--viz-bg') || '#05070b'
      ctx.fillRect(0, 0, width, height)

      ctx.save()
      ctx.strokeStyle = 'rgba(255,255,255,0.06)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()
      const divisions = 6
      for (let i = 1; i < divisions; i++) {
        const x = (i * width) / divisions
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, height)
        ctx.stroke()
      }
      ctx.restore()

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
        const high = Math.max(0.001, LOCK.highPct / 100)
        const low = -Math.max(0.001, LOCK.lowPct / 100)
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
          const intervals: number[] = []
          for (let i = 1; i < crossings.length; i++) intervals.push(crossings[i] - crossings[i - 1])
          intervals.sort((a, b) => a - b)
          const median = intervals[Math.floor(intervals.length / 2)]
          let sum = 0, count = 0
          for (const d of intervals) {
            if (Math.abs(d - median) <= 0.2 * median) { sum += d; count++ }
          }
          const robustPeriod = count > 0 ? sum / count : median
          const prevPeriod = estPeriodRef.current || robustPeriod
          const smoothedPeriod = Math.max(6, Math.min(N, prevPeriod * 0.6 + robustPeriod * 0.4))
          estPeriodRef.current = smoothedPeriod
          const expected = ((lastTriggerRef.current || crossings[0]) + smoothedPeriod) % N
          const window = Math.max(6, Math.floor((LOCK.windowPct / 100) * smoothedPeriod))
          const cand: number[] = []
          for (const c of crossings) {
            const dist = Math.abs(c - expected)
            if (dist <= window) cand.push(c)
          }
          if (cand.length === 0) cand.push(Math.round(expected))

          const L = Math.max(32, Math.min(256, Math.floor(smoothedPeriod)))
          templateLenRef.current = L
          if (!templateRef.current) {
            const t = new Float32Array(L)
            for (let i = 0; i < L; i++) t[i] = f[(cand[0] + i) % N]
            let m = 0
            for (let i = 0; i < L; i++) m += t[i]
            m /= L
            let norm = 0
            for (let i = 0; i < L; i++) { t[i] = t[i] - m; norm += t[i] * t[i] }
            norm = Math.sqrt(Math.max(norm, 1e-12))
            for (let i = 0; i < L; i++) t[i] /= norm
            templateRef.current = t
          }
          if (LOCK.enableTemplate) {
            let bestIdx = cand[0]
            let bestScore = -Infinity
            const T = templateRef.current!
            for (const c of cand) {
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
            if (bestScore < LOCK.corrRefresh) {
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
          let bestSlope = 0
          let slopeIdx = 0
          for (let i = 1; i < N; i++) {
            const s = f[i] - f[i - 1]
            if (s > bestSlope) { bestSlope = s; slopeIdx = i }
          }
          newTrigger = slopeIdx
        }
        const prevTrig = lastTriggerRef.current || 0
        const period = estPeriodRef.current || 0
        const expected = period ? (prevTrig + period) % N : prevTrig
        const dist = Math.abs(newTrigger - expected)
        const farOutlier = period && dist > 0.6 * period
        if (farOutlier || holdCounterRef.current >= LOCK.holdOff) {
          const smoothed = Math.round(prevTrig * 0.4 + newTrigger * 0.6)
          lastTriggerRef.current = smoothed
          holdCounterRef.current = 0
        } else {
          holdCounterRef.current += 1
        }
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

      const slice = width / N
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue('--viz-stroke') || '#00ffd5'
      ctx.lineWidth = 2
      ctx.shadowColor = ctx.strokeStyle
      ctx.shadowBlur = 8
      ctx.beginPath()
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
  }, [engine, fftSize])

  return (
    <div>
      <canvas ref={canvasRef} width={600} height={300} style={{ width: '100%', height: 300, borderRadius: 8, border: '1px solid #222631' }} />
      <div className="row" style={{ marginTop: 8, gap: 12, alignItems: 'center' }}>
        <label>
          <div className="label">FFT Size</div>
          <select value={fftSize} onChange={(e) => setFftSize(Number(e.target.value) as 1024 | 2048 | 4096 | 8192)}>
            <option value={1024}>1024</option>
            <option value={2048}>2048</option>
            <option value={4096}>4096</option>
            <option value={8192}>8192</option>
          </select>
        </label>
      </div>
    </div>
  )
}
