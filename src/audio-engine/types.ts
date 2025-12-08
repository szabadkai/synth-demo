import type { ExpressionTarget } from './expressionTargets'
export type { ExpressionTarget }

export type ExpressionAxis = 'x' | 'y'
export const EXPRESSION_AXES: ExpressionAxis[] = ['x', 'y']
export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise' | 'sample'

export type ADSR = {
  attack: number
  decay: number
  sustain: number
  release: number
}

export type MacroModel =
  | 'va'
  | 'fold'
  | 'pluck'
  | 'supersaw'
  | 'pwm'
  | 'fm2op'
  | 'wavetable'
  | 'harmonic'
  | 'chord'
  | 'dirichlet'
  | 'formant'

export type LfoWave = Exclude<WaveType, 'sample'>

export type SamplerSettings = {
  id: string | null
  name: string
  dataUrl: string | null
  rootMidi: number
  loop: boolean
  recordedAt?: number
  durationSec?: number
  trimStartSec?: number
  trimEndSec?: number
}

export type MacroSettings = {
  model: MacroModel
  harmonics: number
  timbre: number
  morph: number
  level: number
}

export type OscillatorMode = 'analog' | 'macro' | 'sampler'

export type EngineMode = 'classic' | 'macro' | 'sampler'

export type OscillatorConfig = {
  wave: WaveType
  detune: number
  detuneFine?: number
  octave?: number
  mode?: OscillatorMode
  macro?: MacroSettings
  sampler?: SamplerSettings
}

export type ModSource = 'lfo1' | 'lfo2' | 'exprX' | 'exprY' | 'seqStep' | 'velocity' | 'gate'

export type ModTarget =
  | 'filter.cutoff'
  | 'filter.q'
  | 'master.gain'
  | 'macro.harmonics'
  | 'macro.timbre'
  | 'macro.morph'
  | 'macro.level'
  | 'fm.amount'
  | 'mix'
  | 'envelope.attack'
  | 'envelope.release'

export type ModMatrixRow = {
  id: string
  source: ModSource
  target: ModTarget
  amount: number
  enabled: boolean
}

export type SequencerStep = {
  on: boolean
  offset: number
  velocity: number
}

export type Patch = {
  osc1: OscillatorConfig
  osc2: OscillatorConfig
  mix: number // 0 = osc1 only, 1 = osc2 only
  fm: { enabled: boolean; ratio: number; amount: number } // amount in Hz added to carrier freq
  sub: { enabled: boolean; octave: 1 | 2; level: number; wave?: Exclude<WaveType, 'noise' | 'sample'> }
  ring: { enabled: boolean; amount: number } // amount 0..1 crossfade between normal and ring product
  filter: { type: BiquadFilterType; cutoff: number; q: number }
  envelope: ADSR
  master: { gain: number }
  sampler: SamplerSettings
  // Macro (Plaits-like) engine
  engineMode?: EngineMode
  macro?: {
    model: MacroModel
    harmonics: number // 0..1
    timbre: number // 0..1
    morph: number // 0..1
    level: number // 0..1
  }
  effects?: {
    delay: { enabled: boolean; time: number; feedback: number; mix: number }
    reverb: { enabled: boolean; size: number; decay: number; mix: number }
  }
  lfo1?: { enabled: boolean; wave: LfoWave; rateHz: number; amount: number; dest: 'pitch' | 'filter' | 'amp' }
  lfo2?: { enabled: boolean; wave: LfoWave; rateHz: number; amount: number; dest: 'pitch' | 'filter' | 'amp' }
  arp?: {
    enabled: boolean
    // Free-rate mode
    rateHz: number
    // Tempo-sync
    bpmSync: boolean
    bpm: number
    division: '1/4' | '1/8' | '1/8T' | '1/16' | '1/16T'
    // Playback
    gate: number
    chordSource?: 'preset' | 'sequencer'
    mode: 'up' | 'down' | 'updown' | 'random' | 'asplayed' | 'sequence'
    octaves: number
    chord?: 'none' | 'power' | 'major' | 'minor' | 'sus2' | 'sus4' | 'maj7' | 'min7'
    latch: boolean
    swingPct?: number // 0..1, 0 = straight, 1 = extreme swing
    repeats?: number // 1..4
    patternLen?: number // 0 = auto (pool length), else limit steps
  }
  sequencer?: {
    enabled: boolean
    playing: boolean
    bpm: number
    division: '1/4' | '1/8' | '1/8T' | '1/16' | '1/16T'
    swingPct?: number
    gate: number
    rootMidi: number
    length: number
    steps: SequencerStep[]
    autoGroove?: boolean
    autoGrooveRepeat?: number
    grooveStyle?: string
    grooveChord?: string
    progressionMode?: string
    grooveBaseMidi?: number
    spiceAmount?: number // 0..1, blend between original and randomized
    spiceSeed?: string // seed for deterministic randomization
  }
  expression?: {
    x: ExpressionTarget
    y: ExpressionTarget
  }
  modMatrix?: ModMatrixRow[]
}

export const MAX_SEQUENCER_STEPS = 64
export const createEmptySequencerStep = (): SequencerStep => ({ on: false, offset: 0, velocity: 1 })

export type SequencerProgression = {
  id: string
  label: string
  offsets: number[]
}

export const SEQUENCER_PROGRESSIONS: SequencerProgression[] = [
  { id: 'static', label: 'Static', offsets: [0] },
  { id: 'i-iv-v', label: 'I - IV - V', offsets: [0, 5, 7] },
  { id: 'i-v-vi-iv', label: 'I - V - vi - IV', offsets: [0, 7, 9, 5] },
  { id: 'ii-v-i', label: 'ii - V - I', offsets: [2, 7, 0] },
  { id: 'vi-iv-i-v', label: 'vi - IV - I - V', offsets: [9, 5, 0, 7] },
  { id: 'blues', label: 'Blues I - IV - V', offsets: [0, 5, 7, 0] },
  { id: 'modal-dorian', label: 'Modal Dorian', offsets: [0, 2, 3, 5] },
  { id: 'chromatic-rise', label: 'Chromatic Rise', offsets: [0, 1, 2, 3, 4, 5] },
]

export const DEFAULT_OSCILLATOR_MACRO: MacroSettings = {
  model: 'va',
  harmonics: 0.6,
  timbre: 0.5,
  morph: 0.5,
  level: 1.0,
}

export const DEFAULT_OSCILLATOR_SAMPLER: SamplerSettings = {
  id: null,
  name: 'Empty',
  dataUrl: null,
  rootMidi: 60,
  loop: true,
  recordedAt: undefined,
  durationSec: 0,
  trimStartSec: 0,
  trimEndSec: 0,
}

export const normalizeOscillatorConfig = (osc: OscillatorConfig): OscillatorConfig => ({
  ...osc,
  mode: osc.mode ?? 'analog',
  macro: { ...DEFAULT_OSCILLATOR_MACRO, ...(osc.macro ?? {}) },
  sampler: { ...DEFAULT_OSCILLATOR_SAMPLER, ...(osc.sampler ?? {}) },
})

export const defaultPatch: Patch = {
  osc1: {
    wave: 'sawtooth',
    detune: 0,
    detuneFine: 0,
    octave: 0,
    mode: 'analog',
    macro: { ...DEFAULT_OSCILLATOR_MACRO },
    sampler: { ...DEFAULT_OSCILLATOR_SAMPLER },
  },
  osc2: {
    wave: 'square',
    detune: 0,
    detuneFine: 0,
    octave: 0,
    mode: 'analog',
    macro: { ...DEFAULT_OSCILLATOR_MACRO },
    sampler: { ...DEFAULT_OSCILLATOR_SAMPLER },
  },
  mix: 0.0,
  fm: { enabled: false, ratio: 2.0, amount: 0 },
  sub: { enabled: false, octave: 1, level: 0.0, wave: 'square' },
  ring: { enabled: false, amount: 1.0 },
  filter: { type: 'lowpass', cutoff: 1200, q: 0.8 },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
  master: { gain: 0.2 },
  sampler: { ...DEFAULT_OSCILLATOR_SAMPLER },
  engineMode: 'classic',
  macro: { ...DEFAULT_OSCILLATOR_MACRO },
  effects: {
    delay: { enabled: false, time: 0.25, feedback: 0.3, mix: 0.2 },
    reverb: { enabled: false, size: 0.5, decay: 0.5, mix: 0.25 },
  },
  lfo1: { enabled: false, wave: 'sine', rateHz: 5, amount: 0.2, dest: 'pitch' },
  lfo2: { enabled: false, wave: 'triangle', rateHz: 0.5, amount: 0.4, dest: 'filter' },
  arp: { enabled: false, rateHz: 8, bpmSync: false, bpm: 120, division: '1/8', gate: 0.6, chordSource: 'preset', mode: 'up', octaves: 1, chord: 'none', latch: false, swingPct: 0, repeats: 1, patternLen: 0 },
  sequencer: {
    enabled: false,
    playing: false,
    bpm: 120,
    division: '1/16',
    swingPct: 0,
    gate: 0.6,
    rootMidi: 60,
    length: 16,
    steps: Array.from({ length: MAX_SEQUENCER_STEPS }, () => createEmptySequencerStep()),
    progressionMode: 'static',
    grooveBaseMidi: 60,
    spiceAmount: 0,
    spiceSeed: undefined,
  },
  expression: { x: 'osc1.detune', y: 'filter.cutoff' },
  modMatrix: [],
}


