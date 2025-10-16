import React from 'react'
import { useStore, type State } from '../state/store'
import { Knob } from './controls/Knob'
import { defaultPatch, type EngineMode } from '../audio-engine/engine'
import { SamplerControls } from './SamplerControls'

export function OscillatorPanel() {
  const patch = useStore((s: State) => s.patch)
  const updatePatch = useStore((s: State) => s.updatePatch)
  const engineMode = patch.engineMode ?? 'classic'
  const setEngineMode = (mode: EngineMode) => updatePatch({ engineMode: mode })
  const setMacro = (changes: Partial<NonNullable<State['patch']['macro']>>) => {
    const base = patch.macro ?? defaultPatch.macro!
    updatePatch({ macro: { ...base, ...changes } })
  }

  React.useEffect(() => {
    if (
      engineMode !== 'sampler' &&
      (patch.osc1.wave === 'sample' || patch.osc2.wave === 'sample')
    ) {
      updatePatch({ engineMode: 'sampler' })
    }
  }, [engineMode, patch.osc1.wave, patch.osc2.wave, updatePatch])

  if (engineMode === 'macro') {
    return (
      <div className="controls-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <label style={{ gridColumn: '1 / -1' }}>
          <div className="label">Mode</div>
          <select
            value={engineMode}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEngineMode(e.target.value as EngineMode)}
          >
            <option value="classic">Classic (Osc 1 + Osc 2)</option>
            <option value="macro">Macro (Plaits/MF-like)</option>
            <option value="sampler">Sampler (one-shot/loop)</option>
          </select>
        </label>
        <label>
          <div className="label">Model</div>
          <select
            value={patch.macro?.model ?? 'va'}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setMacro({ model: e.target.value as any })}
          >
            <option value="va">VA (analog blend)</option>
            <option value="fold">Wavefolder</option>
            <option value="pluck">Pluck (Karplus–Strong)</option>
            <option value="supersaw">SuperSaw</option>
            <option value="pwm">PWM</option>
            <option value="fm2op">FM 2-Op</option>
            <option value="wavetable">Wavetable (blend)</option>
            <option value="harmonic">Harmonic (additive)</option>
            <option value="chord">Chord (stack)</option>
          </select>
        </label>
        <Knob
          label="Harmonics"
          min={0}
          max={1}
          step={0.001}
          value={patch.macro?.harmonics ?? 0.6}
          onChange={(v: number) => setMacro({ harmonics: v })}
        />
        <Knob
          label="Timbre"
          min={0}
          max={1}
          step={0.001}
          value={patch.macro?.timbre ?? 0.5}
          onChange={(v: number) => setMacro({ timbre: v })}
        />
        <Knob
          label="Morph"
          min={0}
          max={1}
          step={0.001}
          value={patch.macro?.morph ?? 0.5}
          onChange={(v: number) => setMacro({ morph: v })}
        />
        <Knob
          label="Level"
          min={0}
          max={1}
          step={0.001}
          value={patch.macro?.level ?? 1}
          onChange={(v: number) => setMacro({ level: v })}
        />
      </div>
    )
  }

  if (engineMode === 'sampler') {
    return (
      <div className="controls-grid" style={{ gridTemplateColumns: '1fr' }}>
        <label>
          <div className="label">Mode</div>
          <select
            value={engineMode}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEngineMode(e.target.value as EngineMode)}
          >
            <option value="classic">Classic (Osc 1 + Osc 2)</option>
            <option value="macro">Macro (Plaits/MF-like)</option>
            <option value="sampler">Sampler (one-shot/loop)</option>
          </select>
        </label>
        <div style={{ gridColumn: '1 / -1' }}>
          <SamplerControls />
        </div>
      </div>
    )
  }

  return (
    <div className="controls-grid">
      <label style={{ gridColumn: '1 / -1' }}>
        <div className="label">Mode</div>
        <select
          value={engineMode}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEngineMode(e.target.value as EngineMode)}
        >
          <option value="classic">Classic (Osc 1 + Osc 2)</option>
          <option value="macro">Macro (Plaits/MF-like)</option>
          <option value="sampler">Sampler (one-shot/loop)</option>
        </select>
      </label>
      {/* Column headers */}
      <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Osc 1</div>
      <div style={{ fontSize: 12, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Osc 2</div>

      {/* Row: Wave selects */}
      <label>
        <div className="label">Wave</div>
        <select
          value={patch.osc1.wave}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            updatePatch({ osc1: { ...patch.osc1, wave: e.target.value as any } })
          }
        >
          <option value="sine">Sine</option>
          <option value="square">Square</option>
          <option value="sawtooth">Saw</option>
          <option value="triangle">Triangle</option>
          <option value="noise">Noise</option>
        </select>
      </label>
      <label>
        <div className="label">Wave</div>
        <select
          value={patch.osc2.wave}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            updatePatch({ osc2: { ...patch.osc2, wave: e.target.value as any } })
          }
        >
          <option value="sine">Sine</option>
          <option value="square">Square</option>
          <option value="sawtooth">Saw</option>
          <option value="triangle">Triangle</option>
          <option value="noise">Noise</option>
        </select>
      </label>

      {/* Osc 1 controls row */}
      <div className="osc-knob-row" style={{ gridColumn: '1 / 2' }}>
        <div className="knob-group">
          <span className="label">Detune</span>
          <Knob label={undefined} min={-1200} max={1200} step={1} value={patch.osc1.detune} onChange={(v: number) => updatePatch({ osc1: { ...patch.osc1, detune: v } })} />
        </div>
        <div className="knob-group">
          <span className="label">Fine %</span>
          <Knob label={undefined} min={-100} max={100} step={1} value={patch.osc1.finePct ?? 0} onChange={(v: number) => updatePatch({ osc1: { ...patch.osc1, finePct: v } })} />
        </div>
      </div>
      <div className="osc-knob-row" style={{ gridColumn: '2 / 3', justifyContent: 'flex-end' }}>
        <div className="knob-group">
          <span className="label">Mix</span>
          <Knob label={undefined} min={0} max={1} step={0.01} value={patch.mix} onChange={(v: number) => updatePatch({ mix: v })} />
        </div>
      </div>

      {/* Row: FM Controls spanning both columns */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          gridTemplateColumns: 'auto auto auto',
          justifyItems: 'start',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
          <input
            type="checkbox"
            checked={patch.fm?.enabled ?? false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePatch({ fm: { ...patch.fm, enabled: e.target.checked } })}
          />
          <span className="label">FM</span>
        </label>
        <Knob
          label="Ratio"
          min={0.1}
          max={8}
          step={0.1}
          value={patch.fm?.ratio ?? 2}
          onChange={(v: number) => updatePatch({ fm: { ...patch.fm, ratio: v } })}
          disabled={!(patch.fm?.enabled ?? false)}
        />
        <Knob
          label="Amount (Hz)"
          min={0}
          max={1000}
          step={1}
          value={patch.fm?.amount ?? 0}
          onChange={(v: number) => updatePatch({ fm: { ...patch.fm, amount: v } })}
          disabled={!(patch.fm?.enabled ?? false)}
        />
      </div>

      {/* Row: Ring Modulation Controls spanning both columns */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          gridTemplateColumns: 'auto auto',
          justifyItems: 'start',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
          <input
            type="checkbox"
            checked={patch.ring?.enabled ?? false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePatch({ ring: { ...patch.ring, enabled: e.target.checked } })}
          />
          <span className="label">Ring</span>
        </label>
        <Knob
          label="Amount"
          min={0}
          max={1}
          step={0.01}
          value={patch.ring?.amount ?? 1}
          onChange={(v: number) => updatePatch({ ring: { ...patch.ring, amount: v } })}
          disabled={!(patch.ring?.enabled ?? false)}
        />
      </div>
    </div>
  )
}
