import React from 'react'
import { useStore, type State } from '../state/store'
import { Knob } from './controls/Knob'

export function MasterPanel() {
  const patch = useStore((s: State) => s.patch)
  const updatePatch = useStore((s: State) => s.updatePatch)
  return (
    <div className="controls-grid">
      <Knob label="Gain" min={0} max={1} step={0.01} value={patch.master.gain} onChange={(v) => updatePatch({ master: { gain: v } })} />
    </div>
  )
}
