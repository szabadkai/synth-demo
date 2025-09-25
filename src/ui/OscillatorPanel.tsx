import React from 'react'
import { useStore, type State } from '../state/store'
import { Knob } from './controls/Knob'
import { Slider } from './controls/Slider'
import { defaultPatch } from '../audio-engine/engine'

export function OscillatorPanel() {
  const patch = useStore((s: State) => s.patch)
  const updatePatch = useStore((s: State) => s.updatePatch)
  const engineMode = patch.engineMode ?? 'classic'
  const setEngineMode = (m: 'classic' | 'macro') => updatePatch({ engineMode: m })
  const setMacro = (changes: Partial<NonNullable<State['patch']['macro']>>) => {
    const base = patch.macro ?? defaultPatch.macro!
    updatePatch({ macro: { ...base, ...changes } })
  }

  if (engineMode === 'macro') {
    return (
      <div className="controls-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <label style={{ gridColumn: '1 / -1' }}>
          <div className="label">Mode</div>
          <select
            value={engineMode}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEngineMode(e.target.value as any)}
          >
            <option value="classic">Classic (Osc 1 + Osc 2)</option>
            <option value="macro">Macro (Plaits-like)</option>
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
          </select>
        </label>
        <Slider
          label="Harmonics"
          min={0}
          max={1}
          step={0.001}
          value={patch.macro?.harmonics ?? 0.6}
          onChange={(v: number) => setMacro({ harmonics: v })}
        />
        <Slider
          label="Timbre"
          min={0}
          max={1}
          step={0.001}
          value={patch.macro?.timbre ?? 0.5}
          onChange={(v: number) => setMacro({ timbre: v })}
        />
        <Slider
          label="Morph"
          min={0}
          max={1}
          step={0.001}
          value={patch.macro?.morph ?? 0.5}
          onChange={(v: number) => setMacro({ morph: v })}
        />
        <Slider
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

  return (
    <div className="controls-grid">
      <label style={{ gridColumn: '1 / -1' }}>
        <div className="label">Mode</div>
        <select
          value={engineMode}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setEngineMode(e.target.value as any)}
        >
          <option value="classic">Classic (Osc 1 + Osc 2)</option>
          <option value="macro">Macro (Plaits-like)</option>
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

      {/* Row: Detune (only Osc 1) */}
      <Knob
        label="Detune (c)"
        min={-1200}
        max={1200}
        step={1}
        value={patch.osc1.detune}
        onChange={(v: number) => updatePatch({ osc1: { ...patch.osc1, detune: v } })}
      />
      <div />

      {/* Row: Fine (only Osc 1) */}
      <Slider
        label="Fine (% of detune)"
        min={-100}
        max={100}
        step={1}
        value={patch.osc1.finePct ?? 0}
        onChange={(v: number) => updatePatch({ osc1: { ...patch.osc1, finePct: v } })}
      />
      <div />

      {/* Row: Mix spanning both columns */}
      <div style={{ gridColumn: '1 / -1' }}>
        <Slider
          label="Mix (1↔2)"
          min={0}
          max={1}
          step={0.01}
          value={patch.mix}
          onChange={(v: number) => updatePatch({ mix: v })}
        />
      </div>

      {/* Row: FM Controls spanning both columns */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr 1fr',
          gap: 12,
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
        <Slider
          label="Ratio"
          min={0.1}
          max={8}
          step={0.1}
          value={patch.fm?.ratio ?? 2}
          onChange={(v: number) => updatePatch({ fm: { ...patch.fm, ratio: v } })}
          disabled={!(patch.fm?.enabled ?? false)}
        />
        <Slider
          label="Amount (Hz)"
          min={0}
          max={1000}
          step={1}
          value={patch.fm?.amount ?? 0}
          onChange={(v: number) => updatePatch({ fm: { ...patch.fm, amount: v } })}
          disabled={!(patch.fm?.enabled ?? false)}
        />
      </div>

      {/* Row: Sub Oscillator Controls spanning both columns */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'auto auto 1fr 1fr',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 }}>
          <input
            type="checkbox"
            checked={patch.sub?.enabled ?? false}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updatePatch({ sub: { ...patch.sub, enabled: e.target.checked } })}
          />
          <span className="label">Sub</span>
        </label>
        <label>
          <div className="label">Octave</div>
          <select
            value={patch.sub?.octave ?? 1}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updatePatch({ sub: { ...patch.sub, octave: Number(e.target.value) as 1 | 2 } })}
            disabled={!(patch.sub?.enabled ?? false)}
          >
            <option value={1}>-1</option>
            <option value={2}>-2</option>
          </select>
        </label>
        <label>
          <div className="label">Wave</div>
          <select
            value={patch.sub?.wave ?? 'square'}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updatePatch({ sub: { ...patch.sub, wave: e.target.value as any } })}
            disabled={!(patch.sub?.enabled ?? false)}
          >
            <option value="sine">Sine</option>
            <option value="square">Square</option>
            <option value="sawtooth">Saw</option>
            <option value="triangle">Triangle</option>
          </select>
        </label>
        <Slider
          label="Level"
          min={0}
          max={1}
          step={0.01}
          value={patch.sub?.level ?? 0}
          onChange={(v: number) => updatePatch({ sub: { ...patch.sub, level: v } })}
          disabled={!(patch.sub?.enabled ?? false)}
        />
      </div>

      {/* Row: Ring Modulation Controls spanning both columns */}
      <div
        style={{
          gridColumn: '1 / -1',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr',
          gap: 12,
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
        <Slider
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
