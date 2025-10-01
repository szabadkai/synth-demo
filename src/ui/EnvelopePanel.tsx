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
        <Knob label="Attack" min={0} max={2} step={0.01} value={e.attack} onChange={(v) => updatePatch({ envelope: { ...e, attack: v } })} />
        <Knob label="Decay" min={0} max={2} step={0.01} value={e.decay} onChange={(v) => updatePatch({ envelope: { ...e, decay: v } })} />
        <Knob label="Sustain" min={0} max={1} step={0.01} value={e.sustain} onChange={(v) => updatePatch({ envelope: { ...e, sustain: v } })} />
        <Knob label="Release" min={0} max={3} step={0.01} value={e.release} onChange={(v) => updatePatch({ envelope: { ...e, release: v } })} />
      </div>
    </div>
  )
}
