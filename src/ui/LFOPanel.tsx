import React from 'react'
import { useStore, type State } from '../state/store'
import { Knob } from './controls/Knob'

function LfoRow({ idx }: { idx: 1 | 2 }) {
  const patch = useStore((s: State) => s.patch)
  const update = useStore((s: State) => s.updatePatch)
  const key = idx === 1 ? 'lfo1' : 'lfo2'
  const lfo = (patch as any)[key] || { enabled: false, wave: 'sine', rateHz: 5, amount: 0.2, dest: 'pitch' }

  return (
    <div className="lfo-row">
      <label className="lfo-toggle">
        <input type="checkbox" checked={lfo.enabled} onChange={(e) => update({ [key]: { ...lfo, enabled: e.target.checked } } as any)} />
        <span className="label">LFO {idx}</span>
      </label>
      <label className="lfo-select">
        <span className="label">Wave</span>
        <select value={lfo.wave} onChange={(e) => update({ [key]: { ...lfo, wave: e.target.value } } as any)}>
          <option value="sine">Sine</option>
          <option value="triangle">Triangle</option>
          <option value="square">Square</option>
          <option value="sawtooth">Saw</option>
          <option value="noise">Noise</option>
        </select>
      </label>
      <label className="lfo-select">
        <span className="label">Dest</span>
        <select value={lfo.dest} onChange={(e) => update({ [key]: { ...lfo, dest: e.target.value } } as any)}>
          <option value="pitch">Pitch</option>
          <option value="filter">Filter</option>
          <option value="amp">Amp</option>
        </select>
      </label>
      <div className="knob-group">
        <Knob label="Rate" min={0.01} max={20} step={0.01} value={lfo.rateHz} onChange={(v) => update({ [key]: { ...lfo, rateHz: v } } as any)} disabled={!lfo.enabled} formatValue={(v) => `${v.toFixed(2)} Hz`} />
      </div>
      <div className="knob-group">
        <Knob label="Amount" min={0} max={1} step={0.01} value={lfo.amount} onChange={(v) => update({ [key]: { ...lfo, amount: v } } as any)} disabled={!lfo.enabled} formatValue={(v) => `${Math.round(v * 100)}%`} />
      </div>
    </div>
  )
}

export function LFOPanel() {
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <LfoRow idx={1} />
      <LfoRow idx={2} />
    </div>
  )
}
