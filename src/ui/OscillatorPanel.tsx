import React from 'react'
import { useStore } from '../state/store'
import { Knob } from './controls/Knob'
import { SamplerControls } from './SamplerControls'
import type { Patch, OscillatorMode, WaveType, MacroModel } from '../audio-engine/engine'
import { DEFAULT_OSCILLATOR_MACRO } from '../audio-engine/engine'

const MODE_OPTIONS: Array<{ value: OscillatorMode; label: string }> = [
  { value: 'analog', label: 'Analog' },
  { value: 'macro', label: 'Macro' },
  { value: 'sampler', label: 'Sampler' },
]

const MACRO_MODEL_LABELS: Record<MacroModel, string> = {
  va: 'VA',
  fold: 'Wavefold',
  pluck: 'Pluck',
  supersaw: 'Supersaw',
  pwm: 'PWM',
  fm2op: 'FM 2-Op',
  wavetable: 'Wavetable',
  harmonic: 'Harmonic',
  chord: 'Chord Stack',
  dirichlet: 'Dirichlet Pulse',
  formant: 'Formant',
}

const MACRO_MODEL_LINKS: Record<MacroModel, string> = {
  va: 'https://en.wikipedia.org/wiki/Subtractive_synthesis',
  fold: 'https://en.wikipedia.org/wiki/Waveshaping',
  pluck: 'https://en.wikipedia.org/wiki/Karplus%E2%80%93Strong_string_synthesis',
  supersaw: 'https://en.wikipedia.org/wiki/Supersaw_(synthesizer)',
  pwm: 'https://en.wikipedia.org/wiki/Pulse-width_modulation',
  fm2op: 'https://en.wikipedia.org/wiki/Frequency_modulation_synthesis',
  wavetable: 'https://en.wikipedia.org/wiki/Wavetable_synthesis',
  harmonic: 'https://en.wikipedia.org/wiki/Additive_synthesis',
  chord: 'https://en.wikipedia.org/wiki/Chord_(music)',
  dirichlet: 'https://en.wikipedia.org/wiki/Dirichlet_kernel',
  formant: 'https://en.wikipedia.org/wiki/Formant',
}

const MACRO_MODEL_ORDER: MacroModel[] = [
  'va',
  'fold',
  'pluck',
  'supersaw',
  'pwm',
  'fm2op',
  'wavetable',
  'harmonic',
  'chord',
  'dirichlet',
  'formant',
]

type MacroControlMeta = {
  summary: string
  harmonics: { label: string; hint: string }
  timbre: { label: string; hint: string }
  morph: { label: string; hint: string }
}

const MACRO_CONTROL_META: Record<MacroModel, MacroControlMeta> = {
  va: {
    summary: 'Triangle/saw hybrid with simple low-pass tone control.',
    harmonics: { label: 'Tone', hint: 'Sets low-pass cutoff; higher adds brightness.' },
    timbre: { label: 'Blend', hint: 'Crossfades triangle ↔ sawtooth balance.' },
    morph: { label: 'Shape', hint: 'Reserved for future tweaks; minimal impact today.' },
  },
  fold: {
    summary: 'Wavefolder voice with controllable drive and symmetry.',
    harmonics: { label: 'Drive', hint: 'Increase folding depth to add upper harmonics.' },
    timbre: { label: 'Brightness', hint: 'Post-filter to tame or open the highs.' },
    morph: { label: 'Symmetry', hint: 'Offset folding symmetry for odd/even emphasis.' },
  },
  pluck: {
    summary: 'Karplus-Strong burst with damped feedback.',
    harmonics: { label: 'Decay', hint: 'Feedback amount controlling sustain length.' },
    timbre: { label: 'Damping', hint: 'Low-pass filter inside the loop for darker plucks.' },
    morph: { label: 'Body HP', hint: 'Pre high-pass to thin or warm the attack.' },
  },
  supersaw: {
    summary: 'Six detuned saws with tone and stereo spread.',
    harmonics: { label: 'Spread', hint: 'Detune range distributed across the stack.' },
    timbre: { label: 'Brightness', hint: 'Low-pass the swarm to soften or brighten.' },
    morph: { label: 'Stereo', hint: 'Pan spread from narrow mono to wide field.' },
  },
  pwm: {
    summary: 'Pulse made from tanh-shaped saw for animated PWM tones.',
    harmonics: { label: 'Edge', hint: 'Tanh drive for sharper edges and richer harmonics.' },
    timbre: { label: 'Brightness', hint: 'Low-pass shaper output to control fizz.' },
    morph: { label: 'Pulse Width', hint: 'Duty cycle sweep from roughly 10% to 90%.' },
  },
  fm2op: {
    summary: 'Sine carrier with modulator FM for glassy to harsh tones.',
    harmonics: { label: 'Ratio', hint: 'Modulator:carrier ratio from 0.25× up to 8×.' },
    timbre: { label: 'Amount', hint: 'FM depth adds sidebands and grit.' },
    morph: { label: 'Tone', hint: 'Low-pass filter to smooth bright spectra.' },
  },
  wavetable: {
    summary: 'Morph between sine, triangle, saw, and square.',
    harmonics: { label: 'Brightness', hint: 'Low-pass cutoff governing top-end energy.' },
    timbre: { label: 'Resonance', hint: 'Boost Q for a sharper or flatter peak.' },
    morph: { label: 'Shape Blend', hint: 'Scan through the wavetable continuum.' },
  },
  harmonic: {
    summary: 'Additive bank with controllable partial count and tilt.',
    harmonics: { label: 'Partials', hint: 'Number of sine partials mixed together.' },
    timbre: { label: 'Tilt', hint: 'Shift energy toward darker or brighter spectra.' },
    morph: { label: 'Odd / Even', hint: 'Bias emphasis toward odd or even harmonics.' },
  },
  chord: {
    summary: 'Voicing generator stacking detuned chord tones.',
    harmonics: { label: 'Chord Set', hint: 'Selects the chord recipe around the played note.' },
    timbre: { label: 'Brightness', hint: 'Low-pass filter across the chord stack.' },
    morph: { label: 'Spread', hint: 'Detune and stereo spread amount.' },
  },
  dirichlet: {
    summary: 'Dirichlet pulse oscillator with adjustable width and skew.',
    harmonics: { label: 'Partials', hint: 'Upper harmonic count while staying anti-aliased.' },
    timbre: { label: 'Width', hint: 'Pulse width from narrow hollow tones to square-like.' },
    morph: { label: 'Skew', hint: 'Phase skew for asymmetry and transient emphasis.' },
  },
  formant: {
    summary: 'Stacked, phase-aligned formants for vowel pads and choirs.',
    harmonics: { label: 'Spacing', hint: 'Scales formant frequency spacing and height.' },
    timbre: { label: 'Resonance', hint: 'Boosts formant Q for sharper vowels.' },
    morph: { label: 'Vowel Sweep', hint: 'Blend between stored vowel targets.' },
  },
}

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

const MACRO_LEVEL_HINT = 'Adjusts macro output gain before it mixes with the other voices.'

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
                {MACRO_MODEL_ORDER.map((model) => (
                  <option key={model} value={model}>{MACRO_MODEL_LABELS[model]}</option>
                ))}
              </select>
            </label>
            {(() => {
              const macroModel = (macro.model ?? 'va') as MacroModel
              const ui = MACRO_CONTROL_META[macroModel]
              const modelLabel = MACRO_MODEL_LABELS[macroModel]
              return (
                <>
                  <div className="osc-knob-row">
                    <Knob
                      label={ui.harmonics.label}
                      hint={ui.harmonics.hint}
                      min={0}
                      max={1}
                      step={0.001}
                      value={macro.harmonics ?? 0.6}
                      onChange={(value) => setMacro(which, { harmonics: value })}
                    />
                    <Knob
                      label={ui.timbre.label}
                      hint={ui.timbre.hint}
                      min={0}
                      max={1}
                      step={0.001}
                      value={macro.timbre ?? 0.5}
                      onChange={(value) => setMacro(which, { timbre: value })}
                    />
                    <Knob
                      label={ui.morph.label}
                      hint={ui.morph.hint}
                      min={0}
                      max={1}
                      step={0.001}
                      value={macro.morph ?? 0.5}
                      onChange={(value) => setMacro(which, { morph: value })}
                    />
                    <Knob
                      label="Level"
                      hint={MACRO_LEVEL_HINT}
                      min={0}
                      max={1}
                      step={0.001}
                      value={macro.level ?? 1}
                      onChange={(value) => setMacro(which, { level: value })}
                    />
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    <strong style={{ fontSize: 11, letterSpacing: 0.4 }}>
                      <a
                        className="macro-model-link"
                        href={MACRO_MODEL_LINKS[macroModel]}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span>{modelLabel}</span>
                        <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
                          <path d="M4 3.25a.75.75 0 0 1 .75-.75H9a.75.75 0 0 1 .75.75v4.25a.75.75 0 0 1-1.5 0V4.81l-4.22 4.22a.75.75 0 0 1-1.06-1.06L7.19 3.75H4.75A.75.75 0 0 1 4 3.25Z" />
                        </svg>
                      </a>
                    </strong>
                    {' – '}
                    {ui.summary}
                  </div>
                </>
              )
            })()}
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
