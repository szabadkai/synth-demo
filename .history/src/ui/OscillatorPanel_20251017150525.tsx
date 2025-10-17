import React from 'react'
import { useStore } from '../state/store'
import { Knob } from './controls/Knob'
import { SamplerControls } from './SamplerControls'
import type { Patch, OscillatorMode, WaveType } from '../audio-engine/engine'
import { DEFAULT_OSCILLATOR_MACRO } from '../audio-engine/engine'

const MODE_OPTIONS: Array<{ value: OscillatorMode; label: string }> = [
  { value: 'analog', label: 'Analog' },
  { value: 'macro', label: 'Macro' },
  { value: 'sampler', label: 'Sampler' },
]

const WAVE_OPTIONS: Array<{ value: Exclude<WaveType, 'sample'>; label: string }> = [
  { value: 'sine', label: 'Sine' },
  { value: 'square', label: 'Square' },
  { value: 'sawtooth', label: 'Saw' },
  { value: 'triangle', label: 'Triangle' },
  { value: 'noise', label: 'Noise' },
]

const OSC_NAMES: Record<'osc1' | 'osc2', string> = {
  osc1: 'ENG1',
  osc2: 'ENG2',
}

type OscillatorKey = 'osc1' | 'osc2'

type OscConfig = Patch['osc1']

export function OscillatorPanel() {
  const patch = useStore((s) => s.patch)
  const updatePatch = useStore((s) => s.updatePatch)

  const setOsc = React.useCallback(
    (which: OscillatorKey, changes: Partial<OscConfig>) => {
      updatePatch({ [which]: changes } as Partial<Patch>)
    },
    [updatePatch],
  )

  const setOscMode = React.useCallback(
    (which: OscillatorKey, mode: OscillatorMode) => {
      setOsc(which, { mode })
    },
    [setOsc],
  )

  const setMacro = React.useCallback(
    (which: OscillatorKey, changes: Partial<NonNullable<OscConfig['macro']>>) => {
      const current = patch[which].macro ?? DEFAULT_OSCILLATOR_MACRO
      setOsc(which, { macro: { ...current, ...changes } })
    },
    [patch, setOsc],
  )

  const renderOscillator = (which: OscillatorKey) => {
    const osc = patch[which]
    const mode: OscillatorMode = osc.mode ?? 'analog'
    const macro = osc.macro ?? DEFAULT_OSCILLATOR_MACRO

    return (
      <div key={which} className="osc-section" style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <h4 className="settings-heading" style={{ margin: 0 }}>{OSC_NAMES[which]}</h4>
          <select value={mode} onChange={(event) => setOscMode(which, event.target.value as OscillatorMode)}>
            {MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        {mode === 'analog' && (
          <>
            <label>
              <div className="label">Wave</div>
              <select
                value={(osc.wave as Exclude<WaveType, 'sample'>) ?? 'sawtooth'}
                onChange={(event) => setOsc(which, { wave: event.target.value as WaveType })}
              >
                {WAVE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <div className="osc-knob-row">
              <div className="knob-group">
                <Knob
                  label="Octave"
                  min={-2}
                  max={2}
                  step={1}
                  value={osc.octave ?? 0}
                  onChange={(value) => setOsc(which, { octave: Math.round(value) })}
                  formatValue={(value) => `${Math.round(value)}`}
                />
              </div>
              <div className="knob-group">
                <Knob
                  label="Detune"
                  min={-1200}
                  max={1200}
                  step={1}
                  value={osc.detune}
                  onChange={(value) => setOsc(which, { detune: value })}
                  formatValue={(value) => `${Math.round(value)}¢`}
                />
              </div>
              <div className="knob-group">
                <Knob
                  label="Fine"
                  min={-10}
                  max={10}
                  step={0.1}
                  value={osc.detuneFine ?? 0}
                  onChange={(value) => setOsc(which, { detuneFine: Number(value.toFixed(1)) })}
                  formatValue={(value) => `${value.toFixed(1)}¢`}
                />
              </div>
            </div>
          </>
        )}

        {mode === 'macro' && (
          <>
            <label>
              <div className="label">Model</div>
              <select
                value={macro.model ?? 'va'}
                onChange={(event) => setMacro(which, { model: event.target.value as NonNullable<OscConfig['macro']>['model'] })}
              >
                {['va', 'fold', 'pluck', 'supersaw', 'pwm', 'fm2op', 'wavetable', 'harmonic', 'chord'].map((model) => (
                  <option key={model} value={model}>{model.toUpperCase()}</option>
                ))}
              </select>
            </label>
            <div className="osc-knob-row">
              <Knob label="Harmonics" min={0} max={1} step={0.001} value={macro.harmonics ?? 0.6} onChange={(value) => setMacro(which, { harmonics: value })} />
              <Knob label="Timbre" min={0} max={1} step={0.001} value={macro.timbre ?? 0.5} onChange={(value) => setMacro(which, { timbre: value })} />
              <Knob label="Morph" min={0} max={1} step={0.001} value={macro.morph ?? 0.5} onChange={(value) => setMacro(which, { morph: value })} />
              <Knob label="Level" min={0} max={1} step={0.001} value={macro.level ?? 1} onChange={(value) => setMacro(which, { level: value })} />
            </div>
          </>
        )}

        {mode === 'sampler' && <SamplerControls oscillator={which} />}
      </div>
    )
  }

  const osc1Mode = patch.osc1.mode ?? 'analog'
  const osc2Mode = patch.osc2.mode ?? 'analog'
  const fmAvailable = osc1Mode === 'analog' && osc2Mode === 'analog'
  const ringAvailable = fmAvailable

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="controls-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
        {(['osc1', 'osc2'] as const).map(renderOscillator)}
      </div>

      <div className="osc-knob-row" style={{ justifyContent: 'flex-start' }}>
        <div className="knob-group">
          <Knob
            label="Mix"
            min={0}
            max={1}
            step={0.01}
            value={patch.mix}
            onChange={(value) => updatePatch({ mix: value })}
            formatValue={(value) => `${Math.round(value * 100)}%`}
          />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120, opacity: fmAvailable ? 1 : 0.5 }}>
          <input
            type="checkbox"
            checked={patch.fm.enabled && fmAvailable}
            disabled={!fmAvailable}
            onChange={(event) => updatePatch({ fm: { ...patch.fm, enabled: event.target.checked } })}
          />
          <span className="label">FM</span>
        </label>
        <Knob
          label="Ratio"
          min={0.1}
          max={8}
          step={0.1}
          value={patch.fm.ratio}
          onChange={(value) => updatePatch({ fm: { ...patch.fm, ratio: value } })}
          disabled={!fmAvailable || !patch.fm.enabled}
        />
        <Knob
          label="Amount (Hz)"
          min={0}
          max={1000}
          step={1}
          value={patch.fm.amount}
          onChange={(value) => updatePatch({ fm: { ...patch.fm, amount: value } })}
          disabled={!fmAvailable || !patch.fm.enabled}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120, opacity: ringAvailable ? 1 : 0.5 }}>
          <input
            type="checkbox"
            checked={patch.ring.enabled && ringAvailable}
            disabled={!ringAvailable}
            onChange={(event) => updatePatch({ ring: { ...patch.ring, enabled: event.target.checked } })}
          />
          <span className="label">Ring</span>
        </label>
        <Knob
          label="Amount"
          min={0}
          max={1}
          step={0.01}
          value={patch.ring.amount}
          onChange={(value) => updatePatch({ ring: { ...patch.ring, amount: value } })}
          disabled={!ringAvailable || !patch.ring.enabled}
        />
      </div>
    </div>
  )
}
