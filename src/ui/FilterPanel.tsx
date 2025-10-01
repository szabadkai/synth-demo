import React from 'react'
import { useStore, type State } from '../state/store'
import { Knob } from './controls/Knob'
export function FilterPanel() {
  const patch = useStore((s: State) => s.patch)
  const updatePatch = useStore((s: State) => s.updatePatch)

  const handleFilterChange = (changes: Partial<State['patch']['filter']>) => {
    updatePatch({ filter: { ...patch.filter, ...changes } })
  }

  const masterGain = patch.master.gain

  return (
    <div className="filter-panel">
      <label className="filter-type">
        <span className="label">Type</span>
        <select value={patch.filter.type} onChange={(e) => handleFilterChange({ type: e.target.value as BiquadFilterType })}>
          <option value="lowpass">Low-pass</option>
          <option value="highpass">High-pass</option>
          <option value="bandpass">Band-pass</option>
          <option value="notch">Notch</option>
        </select>
      </label>
      <div className="filter-knobs">
        <Knob label="Cutoff" min={40} max={8000} step={10} value={patch.filter.cutoff} onChange={(v) => handleFilterChange({ cutoff: v })} />
        <Knob label="Resonance" min={0.1} max={10} step={0.1} value={patch.filter.q} onChange={(v) => handleFilterChange({ q: v })} />
        <Knob label="Master" min={0} max={1} step={0.01} value={masterGain} onChange={(v) => updatePatch({ master: { ...patch.master, gain: v } })} />
      </div>
    </div>
  )
}
