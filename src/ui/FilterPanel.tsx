import React from 'react'
import { useStore, type State } from '../state/store'
import { Knob } from './controls/Knob'
import { Slider } from './controls/Slider'

export function FilterPanel() {
  const patch = useStore((s: State) => s.patch)
  const updatePatch = useStore((s: State) => s.updatePatch)
  return (
    <div className="controls-grid">
      <label>
        <div className="label">Type</div>
        <select
          value={patch.filter.type}
          onChange={(e) => updatePatch({ filter: { ...patch.filter, type: e.target.value as BiquadFilterType } })}
        >
          <option value="lowpass">Low-pass</option>
          <option value="highpass">High-pass</option>
          <option value="bandpass">Band-pass</option>
          <option value="notch">Notch</option>
        </select>
      </label>
      <Knob
        label="Cutoff (Hz)"
        min={40}
        max={8000}
        step={10}
        value={patch.filter.cutoff}
        onChange={(v) => updatePatch({ filter: { ...patch.filter, cutoff: v } })}
      />
      <Slider
        label="Resonance (Q)"
        min={0.1}
        max={10}
        step={0.1}
        value={patch.filter.q}
        onChange={(v) => updatePatch({ filter: { ...patch.filter, q: v } })}
      />
    </div>
  )
}
