import React from 'react'
import { useStore, type State } from '../state/store'
import type { ModMatrixRow, ModSource, ModTarget } from '../audio-engine/engine'

const SOURCE_OPTIONS: Array<{ value: ModSource; label: string }> = [
  { value: 'lfo1', label: 'LFO 1 (Audio)' },
  { value: 'lfo2', label: 'LFO 2 (Audio)' },
  { value: 'exprX', label: 'Expression X (CapsLock X)' },
  { value: 'exprY', label: 'Expression Y (CapsLock Y)' },
  { value: 'seqStep', label: 'Sequencer Step' },
  { value: 'velocity', label: 'Note Velocity' },
  { value: 'gate', label: 'Note Gate' },
]

const TARGET_OPTIONS: Array<{ value: ModTarget; label: string; description: string }> = [
  { value: 'filter.cutoff', label: 'Filter Cutoff', description: 'Modulate the primary filter frequency' },
  { value: 'filter.q', label: 'Filter Resonance', description: 'Modulate filter resonance (Q)' },
  { value: 'master.gain', label: 'Master Gain', description: 'Trim the overall output level' },
  { value: 'macro.harmonics', label: 'Macro Harmonics', description: 'Shape the macro engine harmonic content' },
  { value: 'macro.timbre', label: 'Macro Timbre', description: 'Tilt the macro tone or brightness' },
  { value: 'macro.morph', label: 'Macro Morph', description: 'Sweep the macro engine model position' },
  { value: 'macro.level', label: 'Macro Level', description: 'Adjust macro oscillator output level' },
  { value: 'fm.amount', label: 'FM Amount', description: 'Scale frequency modulation depth' },
  { value: 'mix', label: 'Osc Mix', description: 'Crossfade between oscillator 1 and 2' },
  { value: 'envelope.attack', label: 'Env Attack', description: 'Modulate the envelope attack time' },
  { value: 'envelope.release', label: 'Env Release', description: 'Modulate the envelope release time' },
]

const formatAmount = (value: number) => `${(value >= 0 ? '+' : '')}${(value * 100).toFixed(0)}%`

export function ModMatrixPanel() {
  const routes = useStore((s: State) => s.patch.modMatrix ?? [])
  const addRoute = useStore((s: State) => s.addModRoute)
  const updateRoute = useStore((s: State) => s.updateModRoute)
  const removeRoute = useStore((s: State) => s.removeModRoute)

  const handleSourceChange = (route: ModMatrixRow, source: ModSource) => {
    updateRoute(route.id, { source })
  }

  const handleTargetChange = (route: ModMatrixRow, target: ModTarget) => {
    updateRoute(route.id, { target })
  }

  const handleAmountChange = (route: ModMatrixRow, nextAmount: number) => {
    updateRoute(route.id, { amount: nextAmount })
  }

  const handleToggle = (route: ModMatrixRow, enabled: boolean) => {
    updateRoute(route.id, { enabled })
  }

  return (
    <div className="mod-matrix-panel">
      <div className="mod-matrix-header">
        <button type="button" onClick={addRoute} className="mod-matrix-add">
          + Add Route
        </button>
        <span className="mod-matrix-count">{routes.length} routings</span>
      </div>
      {routes.length === 0 ? (
        <p className="hint-text" style={{ marginTop: 8 }}>
          Add routes to patch LFOs into filter or master parameters. More sources will arrive in future revisions.
        </p>
      ) : (
        <div className="mod-matrix-list">
          {routes.map((route) => (
            <div key={route.id} className={`mod-matrix-row${route.enabled ? '' : ' disabled'}`}>
              <div className="mod-matrix-col">
                <label>
                  <div className="label">Source</div>
                  <select
                    value={route.source}
                    onChange={(event) => handleSourceChange(route, event.target.value as ModSource)}
                  >
                    {SOURCE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="mod-matrix-col">
                <label>
                  <div className="label">Target</div>
                  <select
                    value={route.target}
                    onChange={(event) => handleTargetChange(route, event.target.value as ModTarget)}
                  >
                    {TARGET_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="mod-matrix-hint">
                  {TARGET_OPTIONS.find((option) => option.value === route.target)?.description ?? ''}
                </span>
              </div>
              <div className="mod-matrix-col amount">
                <label>
                  <div className="label">Amount</div>
                  <input
                    type="range"
                    min={-1}
                    max={1}
                    step={0.01}
                    value={route.amount}
                    onChange={(event) => handleAmountChange(route, Number(event.target.value))}
                  />
                </label>
                <div className="mod-matrix-amount">{formatAmount(route.amount)}</div>
              </div>
              <div className="mod-matrix-actions">
                <label className="mod-matrix-toggle">
                  <input
                    type="checkbox"
                    checked={route.enabled}
                    onChange={(event) => handleToggle(route, event.target.checked)}
                  />
                  <span>Enabled</span>
                </label>
                <button
                  type="button"
                  className="mod-matrix-remove"
                  onClick={() => removeRoute(route.id)}
                  aria-label="Remove route"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
