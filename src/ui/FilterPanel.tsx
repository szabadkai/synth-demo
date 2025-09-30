import React from 'react'
import { useStore, type State } from '../state/store'
import { Knob } from './controls/Knob'
import { Slider } from './controls/Slider'

export function FilterPanel() {
  const patch = useStore((s: State) => s.patch)
  const updatePatch = useStore((s: State) => s.updatePatch)

  const handleFilterChange = (changes: Partial<State['patch']['filter']>) => {
    updatePatch({ filter: { ...patch.filter, ...changes } })
  }

  const masterGain = patch.master.gain

  return (
    <div className="controls-grid" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
      <label style={{ gridColumn: '1 / -1' }}>
        <div className="label">Type</div>
        <select value={patch.filter.type} onChange={(e) => handleFilterChange({ type: e.target.value as BiquadFilterType })}>
          <option value="lowpass">Low-pass</option>
          <option value="highpass">High-pass</option>
          <option value="bandpass">Band-pass</option>
          <option value="notch">Notch</option>
        </select>
      </label>
      <Knob label="Cutoff (Hz)" min={40} max={8000} step={10} value={patch.filter.cutoff} onChange={(v) => handleFilterChange({ cutoff: v })} />
      <Slider label="Resonance (Q)" min={0.1} max={10} step={0.1} value={patch.filter.q} onChange={(v) => handleFilterChange({ q: v })} />
      <div style={{ gridColumn: '1 / -1', marginTop: 12 }}>
        <Knob
          label="Master Gain"
          min={0}
          max={1}
          step={0.01}
          value={masterGain}
          onChange={(v) => updatePatch({ master: { ...patch.master, gain: v } })}
        />
      </div>
    </div>
  )
}
