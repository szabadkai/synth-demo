import React from 'react'
import { useStore, type State } from '../state/store'
import { defaultPatch } from '../audio-engine/engine'
import { Slider } from './controls/Slider'

export function ArpPanel() {
  const patch = useStore((s: State) => s.patch)
  const update = useStore((s: State) => s.updatePatch)
  const engine = useStore((s: State) => s.engine)
  const arp = (patch.arp ?? defaultPatch.arp)!

  // Poll engine for current step/length to render a simple indicator
  const [status, setStatus] = React.useState<{ enabled: boolean; stepIndex: number; length: number }>({ enabled: false, stepIndex: 0, length: 0 })
  React.useEffect(() => {
    if (!engine) return
    const id = setInterval(() => {
      const s = (engine as any).getArpStatus?.()
      if (s) setStatus(s)
    }, 100)
    return () => clearInterval(id)
  }, [engine])

  return (
    <div className="controls-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {/* Row 1: toggles + clear + mode */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={arp.enabled}
          onChange={(e) => update({ arp: { ...arp, enabled: e.target.checked } })}
        />
        <span className="label">Enabled</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={arp.latch || false}
          onChange={(e) => update({ arp: { ...arp, latch: e.target.checked } })}
          disabled={!arp.enabled}
        />
        <span className="label">Latch</span>
      </label>
      <button
        onClick={() => engine?.arpClear()}
        disabled={!arp.enabled}
        style={{
          justifySelf: 'start', alignSelf: 'end',
          padding: '6px 10px', fontSize: 12, borderRadius: 6,
          background: 'transparent', border: '1px solid var(--border, #2a3040)', color: 'var(--text)'
        }}
      >
        Clear
      </button>
      <label>
        <div className="label">Mode</div>
        <select value={arp.mode} onChange={(e) => update({ arp: { ...arp, mode: e.target.value as any } })} disabled={!arp.enabled}>
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="updown">Up-Down</option>
          <option value="random">Random</option>
          <option value="asplayed">As Played</option>
        </select>
      </label>

      {/* Row 2: octaves + sync + division/rate + bpm */}
      <label>
        <div className="label">Octaves</div>
        <select value={arp.octaves} onChange={(e) => update({ arp: { ...arp, octaves: Number(e.target.value) } })} disabled={!arp.enabled}>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={arp.bpmSync || false}
          onChange={(e) => update({ arp: { ...arp, bpmSync: e.target.checked } })}
          disabled={!arp.enabled}
        />
        <span className="label">Sync to BPM</span>
      </label>
      {arp.bpmSync ? (
        <label>
          <div className="label">Division</div>
          <select value={arp.division} onChange={(e) => update({ arp: { ...arp, division: e.target.value as any } })} disabled={!arp.enabled}>
            <option value="1/4">1/4</option>
            <option value="1/8">1/8</option>
            <option value="1/8T">1/8T</option>
            <option value="1/16">1/16</option>
            <option value="1/16T">1/16T</option>
          </select>
        </label>
      ) : (
        <Slider label="Rate (Hz)" min={0.1} max={20} step={0.1} value={arp.rateHz} onChange={(v) => update({ arp: { ...arp, rateHz: v } })} disabled={!arp.enabled} />
      )}
      <Slider label="BPM" min={40} max={240} step={1} value={arp.bpm || 120} onChange={(v) => update({ arp: { ...arp, bpm: v } })} disabled={!arp.enabled || !arp.bpmSync} format={(v) => `${Math.round(v)}`} />

      {/* Row 3: gate across */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Slider label="Gate" min={0.05} max={1} step={0.01} value={arp.gate} onChange={(v) => update({ arp: { ...arp, gate: v } })} disabled={!arp.enabled} format={(v) => `${Math.round(v * 100)}%`} />
      </div>

      {/* Row 4: swing + repeats + pattern length */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
        <Slider label="Swing" min={0} max={0.75} step={0.01} value={arp.swingPct ?? 0} onChange={(v) => update({ arp: { ...arp, swingPct: v } })} disabled={!arp.enabled || !(arp.bpmSync)} format={(v) => `${Math.round(v * 100)}%`} />
        <label>
          <div className="label">Repeats</div>
          <select value={arp.repeats ?? 1} onChange={(e) => update({ arp: { ...arp, repeats: Number(e.target.value) } })} disabled={!arp.enabled}>
            {[1,2,3,4].map(n => <option key={n} value={n}>{n}x</option>)}
          </select>
        </label>
        <label>
          <div className="label">Length</div>
          <select value={arp.patternLen ?? 0} onChange={(e) => update({ arp: { ...arp, patternLen: Number(e.target.value) } })} disabled={!arp.enabled}>
            <option value={0}>Auto</option>
            {Array.from({ length: 16 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {/* Row 5: Step indicator */}
      {status.enabled && status.length > 0 && (
        <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 6, alignItems: 'center' }}>
          <div className="label" style={{ minWidth: 64 }}>Pattern</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Array.from({ length: Math.min(status.length, 16) }).map((_, i) => (
              <span
                key={i}
                title={`Step ${i + 1}`}
                style={{
                  width: 8, height: 8, borderRadius: 999,
                  background: i === (status.stepIndex % Math.min(status.length, 16)) ? 'var(--accent)' : '#2a3040',
                  display: 'inline-block'
                }}
              />
            ))}
            {status.length > 16 && <span className="value">+{status.length - 16}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
