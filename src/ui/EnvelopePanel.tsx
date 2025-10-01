import React from 'react'
import { useStore, type State } from '../state/store'
import { Knob } from './controls/Knob'

export function EnvelopePanel() {
  const patch = useStore((s: State) => s.patch)
  const updatePatch = useStore((s: State) => s.updatePatch)
  const e = patch.envelope
  return (
    <div className="envelope-panel">
      <div className="envelope-knobs">
        <div className="knob-group">
          <span className="label">Attack</span>
          <Knob label={undefined} min={0} max={2} step={0.01} value={e.attack} onChange={(v) => updatePatch({ envelope: { ...e, attack: v } })} />
        </div>
        <div className="knob-group">
          <span className="label">Decay</span>
          <Knob label={undefined} min={0} max={2} step={0.01} value={e.decay} onChange={(v) => updatePatch({ envelope: { ...e, decay: v } })} />
        </div>
        <div className="knob-group">
          <span className="label">Sustain</span>
          <Knob label={undefined} min={0} max={1} step={0.01} value={e.sustain} onChange={(v) => updatePatch({ envelope: { ...e, sustain: v } })} />
        </div>
        <div className="knob-group">
          <span className="label">Release</span>
          <Knob label={undefined} min={0} max={3} step={0.01} value={e.release} onChange={(v) => updatePatch({ envelope: { ...e, release: v } })} />
        </div>
      </div>
    </div>
  )
}
