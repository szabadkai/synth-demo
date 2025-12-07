import type { ExpressionTarget } from './expressionTargets'
import { phaseVocoderPitchShift } from './phaseVocoder'

// Seeded random number generator (xorshift32) for deterministic spice randomization
function seededRandom(seed: string): () => number {
  let state = 0
  for (let i = 0; i < seed.length; i++) {
    state = (state << 5) - state + seed.charCodeAt(i)
    state |= 0
  }
  if (state === 0) state = 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) / 0xffffffff)
  }
}

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

const normalizeOscillatorConfig = (osc: OscillatorConfig): OscillatorConfig => ({
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

type ExpressionTargetDefinition = {
  getBase: (engine: SynthEngine) => number
  range: (engine: SynthEngine, base: number) => { min: number; max: number }
  apply: (engine: SynthEngine, value: number) => void
}

const ensureFinite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

type ManagedSourceNode = AudioScheduledSourceNode & {
  _autoStarted?: boolean
  _started?: boolean
  _managedLifecycleAttached?: boolean
}

const ensureManagedSource = <T extends AudioScheduledSourceNode>(source: T): T & ManagedSourceNode => {
  const managed = source as T & ManagedSourceNode
  if (!managed._managedLifecycleAttached) {
    managed._managedLifecycleAttached = true
    const handleEnded = () => {
      managed._started = false
    }
    if (typeof managed.addEventListener === 'function') {
      managed.addEventListener('ended', handleEnded as EventListener)
    } else {
      const previous = (managed as any).onended
      ;(managed as any).onended = (event: Event) => {
        handleEnded()
        if (typeof previous === 'function') previous.call(managed, event)
      }
    }
  }
  if (managed._started == null) managed._started = !!managed._autoStarted
  return managed
}

const markSourceStarted = (source: AudioScheduledSourceNode) => {
  const managed = ensureManagedSource(source)
  managed._started = true
}

const markSourceAutoStarted = (source: AudioScheduledSourceNode) => {
  const managed = ensureManagedSource(source)
  managed._autoStarted = true
  managed._started = true
}

const isAudioSource = (source: ModSource) => source === 'lfo1' || source === 'lfo2'

const isAudioTarget = (target: ModTarget) =>
  target === 'filter.cutoff' ||
  target === 'filter.q' ||
  target === 'master.gain' ||
  target === 'mix'

const isControlSource = (source: ModSource) => source === 'exprX' || source === 'exprY' || source === 'seqStep' || source === 'velocity' || source === 'gate'

const getLfoPatch = (engine: SynthEngine, which: 'lfo1' | 'lfo2') => engine.patch[which] ?? defaultPatch[which]!

const getMacroPatch = (engine: SynthEngine) => engine.patch.macro ?? defaultPatch.macro!

const EXPRESSION_RUNTIME_TARGETS: Record<ExpressionTarget, ExpressionTargetDefinition> = {
  'filter.cutoff': {
    getBase: (engine) => ensureFinite(engine.patch.filter.cutoff, defaultPatch.filter.cutoff),
    range: (_engine, base) => {
      const min = clampValue(base * 0.25, 80, 12000)
      const max = clampValue(base * 4, min + 20, 14000)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ filter: { cutoff: value } }, { fromExpression: true }),
  },
  'filter.q': {
    getBase: (engine) => ensureFinite(engine.patch.filter.q, defaultPatch.filter.q),
    range: (_engine, base) => {
      const min = clampValue(base * 0.5, 0.1, 20)
      const max = clampValue(base * 2.5, min + 0.1, 20)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ filter: { q: value } }, { fromExpression: true }),
  },
  'master.gain': {
    getBase: (engine) => ensureFinite(engine.patch.master.gain, defaultPatch.master.gain),
    range: (_engine, base) => {
      const min = clampValue(base * 0.4, 0.01, 1)
      const max = clampValue(base * 1.6, min + 0.01, 1)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ master: { gain: value } }, { fromExpression: true }),
  },
  mix: {
    getBase: (engine) => ensureFinite(engine.patch.mix, defaultPatch.mix),
    range: () => ({ min: 0, max: 1 }),
    apply: (engine, value) => engine.applyPatch({ mix: clampValue(value, 0, 1) }, { fromExpression: true }),
  },
  'osc1.detune': {
    getBase: (engine) => ensureFinite(engine.patch.osc1.detune, defaultPatch.osc1.detune),
    range: (_engine, base) => {
      const min = clampValue(base - 120, -2400, 2400)
      const max = clampValue(base + 120, min + 1, 2400)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ osc1: { detune: value } }, { fromExpression: true }),
  },
  'osc2.detune': {
    getBase: (engine) => ensureFinite(engine.patch.osc2.detune, defaultPatch.osc2.detune),
    range: (_engine, base) => {
      const min = clampValue(base - 120, -2400, 2400)
      const max = clampValue(base + 120, min + 1, 2400)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ osc2: { detune: value } }, { fromExpression: true }),
  },
  'fm.amount': {
    getBase: (engine) => ensureFinite(engine.patch.fm.amount, defaultPatch.fm.amount),
    range: (_engine, base) => {
      const min = clampValue(base * 0.5, 0, 4000)
      const max = clampValue(Math.max(base + 400, 400), min + 10, 4000)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ fm: { amount: clampValue(value, 0, 4000) } }, { fromExpression: true }),
  },
  'envelope.attack': {
    getBase: (engine) => ensureFinite(engine.patch.envelope.attack, defaultPatch.envelope.attack),
    range: (_engine, base) => {
      const min = clampValue(base * 0.2, 0.001, 4)
      const max = clampValue(base * 3, min + 0.01, 4)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ envelope: { attack: value } }, { fromExpression: true }),
  },
  'envelope.release': {
    getBase: (engine) => ensureFinite(engine.patch.envelope.release, defaultPatch.envelope.release),
    range: (_engine, base) => {
      const min = clampValue(base * 0.5, 0.03, 6)
      const max = clampValue(base * 3, min + 0.05, 6)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ envelope: { release: value } }, { fromExpression: true }),
  },
  'macro.harmonics': {
    getBase: (engine) => ensureFinite(getMacroPatch(engine).harmonics, defaultPatch.macro!.harmonics),
    range: () => ({ min: 0, max: 1 }),
    apply: (engine, value) => engine.applyPatch({ macro: { harmonics: clampValue(value, 0, 1) } }, { fromExpression: true }),
  },
  'macro.timbre': {
    getBase: (engine) => ensureFinite(getMacroPatch(engine).timbre, defaultPatch.macro!.timbre),
    range: () => ({ min: 0, max: 1 }),
    apply: (engine, value) => engine.applyPatch({ macro: { timbre: clampValue(value, 0, 1) } }, { fromExpression: true }),
  },
  'macro.morph': {
    getBase: (engine) => ensureFinite(getMacroPatch(engine).morph, defaultPatch.macro!.morph),
    range: () => ({ min: 0, max: 1 }),
    apply: (engine, value) => engine.applyPatch({ macro: { morph: clampValue(value, 0, 1) } }, { fromExpression: true }),
  },
  'macro.level': {
    getBase: (engine) => ensureFinite(getMacroPatch(engine).level, defaultPatch.macro!.level),
    range: () => ({ min: 0, max: 1 }),
    apply: (engine, value) => engine.applyPatch({ macro: { level: clampValue(value, 0, 1) } }, { fromExpression: true }),
  },
  'lfo1.rateHz': {
    getBase: (engine) => ensureFinite(getLfoPatch(engine, 'lfo1').rateHz, defaultPatch.lfo1!.rateHz),
    range: (_engine, base) => {
      const min = clampValue(base * 0.25, 0.05, 30)
      const max = clampValue(base * 4, min + 0.05, 40)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ lfo1: { rateHz: value } }, { fromExpression: true }),
  },
  'lfo1.amount': {
    getBase: (engine) => ensureFinite(getLfoPatch(engine, 'lfo1').amount, defaultPatch.lfo1!.amount),
    range: () => ({ min: 0, max: 1 }),
    apply: (engine, value) => engine.applyPatch({ lfo1: { amount: clampValue(value, 0, 1) } }, { fromExpression: true }),
  },
  'lfo2.rateHz': {
    getBase: (engine) => ensureFinite(getLfoPatch(engine, 'lfo2').rateHz, defaultPatch.lfo2!.rateHz),
    range: (_engine, base) => {
      const min = clampValue(base * 0.25, 0.02, 20)
      const max = clampValue(base * 4, min + 0.05, 30)
      return { min, max }
    },
    apply: (engine, value) => engine.applyPatch({ lfo2: { rateHz: value } }, { fromExpression: true }),
  },
  'lfo2.amount': {
    getBase: (engine) => ensureFinite(getLfoPatch(engine, 'lfo2').amount, defaultPatch.lfo2!.amount),
    range: () => ({ min: 0, max: 1 }),
    apply: (engine, value) => engine.applyPatch({ lfo2: { amount: clampValue(value, 0, 1) } }, { fromExpression: true }),
  },
}

const CONTROL_TARGET_DEFINITIONS: Partial<Record<ModTarget, ExpressionTargetDefinition>> = {
  'filter.cutoff': EXPRESSION_RUNTIME_TARGETS['filter.cutoff'],
  'filter.q': EXPRESSION_RUNTIME_TARGETS['filter.q'],
  'master.gain': EXPRESSION_RUNTIME_TARGETS['master.gain'],
  'macro.harmonics': EXPRESSION_RUNTIME_TARGETS['macro.harmonics'],
  'macro.timbre': EXPRESSION_RUNTIME_TARGETS['macro.timbre'],
  'macro.morph': EXPRESSION_RUNTIME_TARGETS['macro.morph'],
  'macro.level': EXPRESSION_RUNTIME_TARGETS['macro.level'],
  'fm.amount': EXPRESSION_RUNTIME_TARGETS['fm.amount'],
  mix: EXPRESSION_RUNTIME_TARGETS.mix,
  'envelope.attack': EXPRESSION_RUNTIME_TARGETS['envelope.attack'],
  'envelope.release': EXPRESSION_RUNTIME_TARGETS['envelope.release'],
}

type ExpressionAxis = 'x' | 'y'

type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T

const EXPRESSION_AXES: ExpressionAxis[] = ['x', 'y']

const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

function createNoiseBuffer(ctx: AudioContext) {
  const bufferSize = ctx.sampleRate * 1
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}

type ActiveVoice = {
  stop: (t: number) => void
  osc1Detune?: AudioParam
  osc2Detune?: AudioParam
  mixControl?: ConstantSourceNode
  mixBias?: ConstantSourceNode
  mixConnections: Array<{ sourceIndex: number; gain: GainNode }>
}

export class SynthEngine {
  private ctx: AudioContext
  private master: GainNode
  private filter: BiquadFilterNode
  private analyser: AnalyserNode
  private noiseBuffer?: AudioBuffer
  private activeVoices = new Map<number, ActiveVoice>()
  private fxInput: GainNode
  private fxOutput: GainNode
  private currentFxTap: AudioNode | null = null
  private lfos: Array<{
    osc: OscillatorNode | null
    noise: AudioBufferSourceNode | null
    noiseFilter: BiquadFilterNode | null
    gain: GainNode
    dest: 'pitch' | 'filter' | 'amp' | 'none'
    wave: LfoWave
  }>
  private expression2D: { active: boolean; x: number; y: number } = { active: false, x: 0.5, y: 0.5 }
  private expressionAxisTargets: Record<ExpressionAxis, ExpressionTarget> = {
    x: defaultPatch.expression!.x,
    y: defaultPatch.expression!.y,
  }
  private expressionSnapshot: Record<ExpressionAxis, number | null> = { x: null, y: null }
  private expressionApplying = false
  private samplerBuffer: AudioBuffer | null = null
  private samplerMeta: SamplerSettings = { ...defaultPatch.sampler }
  private samplerLoadToken = 0
  private samplerPitchCache = new Map<string, AudioBuffer>()
  private modMatrixConnections = new Map<string, { sourceIndex: number; tap: GainNode; target: ModTarget }>()
  private controlSourceValues: Record<'exprX' | 'exprY' | 'seqStep' | 'velocity' | 'gate', number> = {
    exprX: 0,
    exprY: 0,
    seqStep: 0,
    velocity: -1,
    gate: -1,
  }
  private controlModRows: ModMatrixRow[] = []
  private controlModSnapshots = new Map<ModTarget, number>()
  private mixAudioAmounts: [number, number] = [0, 0]
  private activeNoteVelocities = new Map<number, number>()
  patch: Patch

  // Arpeggiator state
  private arpHeld = new Set<number>()
  private arpIndex = 0
  private arpTimer: number | null = null
  private arpLastNote: number | null = null
  private arpBypass = false
  private arpPhase = 0 // 0=onbeat, 1=offbeat for swing
  private arpRepeatCounter = 0
  private arpCurrentStepMs = 0

  // Sequencer state
  private seqTimer: number | null = null
  private seqPhase = 0
  private seqCurrentStepMs = 0
  private seqStepIndex = 0
  private seqLastNote: number | null = null
  private seqControlToken = 0
  private seqCurrentRoot = defaultPatch.sequencer?.rootMidi ?? 60
  private seqProgressionIndex = 0

  private getModSourceIndex(source: ModSource): number {
    switch (source) {
      case 'lfo1':
        return 0
      case 'lfo2':
        return 1
      default:
        return -1
    }
  }

  private getModTargetInfo(target: ModTarget) {
    switch (target) {
      case 'filter.cutoff':
        return { param: this.filter.frequency, type: 'param' as const, scale: (amount: number) => amount * 2000 }
      case 'filter.q':
        return { param: this.filter.Q, type: 'param' as const, scale: (amount: number) => amount * 5 }
      case 'master.gain':
        return { param: this.master.gain, type: 'param' as const, scale: (amount: number) => amount * 0.5 }
      default:
        return null
    }
  }

  // Record destination
  private recordDestination: MediaStreamAudioDestinationNode

  public getRecordDestination() {
    return this.recordDestination
  }

  private getLfoConfig(source: 'lfo1' | 'lfo2'): NonNullable<Patch['lfo1']> {
    return source === 'lfo2'
      ? (this.patch.lfo2 ?? defaultPatch.lfo2!)
      : (this.patch.lfo1 ?? defaultPatch.lfo1!)
  }

  private removeModConnection(id: string) {
    const existing = this.modMatrixConnections.get(id)
    if (!existing) return
    const sourceNode = this.lfos[existing.sourceIndex]?.gain
    if (sourceNode) {
      try { sourceNode.disconnect(existing.tap) } catch {}
    }
    try { existing.tap.disconnect() } catch {}
    this.modMatrixConnections.delete(id)
  }

  applyModMatrix(rows: ModMatrixRow[] = []) {
    const activeRows = rows.filter((row) => row && row.enabled)
    const audioRows = activeRows.filter((row) => isAudioSource(row.source) && isAudioTarget(row.target))
    const seen = new Set<string>()
    const mixAudio: [number, number] = [0, 0]
    for (const row of audioRows) {
      const sourceIndex = this.getModSourceIndex(row.source)
      if (sourceIndex < 0) continue
      if (row.target === 'mix') {
        const sourceNode = this.lfos[sourceIndex]?.gain
        const lfoSource = row.source === 'lfo2' ? 'lfo2' : 'lfo1'
        const lfoConfig = this.getLfoConfig(lfoSource)
        const fallbackScale = Math.max(0, lfoConfig.amount ?? 0)
        const baseScaleRaw = sourceNode ? Math.abs(sourceNode.gain.value) : 0
        const scale = baseScaleRaw > 1e-6 ? baseScaleRaw : fallbackScale > 1e-6 ? fallbackScale : 1
        mixAudio[sourceIndex] += row.amount / scale
        continue
      }
      const sourceNode = this.lfos[sourceIndex]?.gain
      if (!sourceNode) continue
      const info = this.getModTargetInfo(row.target)
      if (!info) continue

      const desired = info.scale(row.amount)
      const lfoSource = row.source === 'lfo2' ? 'lfo2' : 'lfo1'
      const lfoConfig = this.getLfoConfig(lfoSource)
      const fallbackScale = Math.max(0, lfoConfig.amount ?? 0)
      const baseScaleRaw = Math.abs(sourceNode.gain.value)
      const sourceScale = baseScaleRaw > 0 ? baseScaleRaw : fallbackScale
      const targetGain = sourceScale > 0 ? desired / sourceScale : 0
      const existing = this.modMatrixConnections.get(row.id)
      if (existing && (existing.sourceIndex !== sourceIndex || existing.target !== row.target)) {
        this.removeModConnection(row.id)
      }
      let conn = this.modMatrixConnections.get(row.id)
      if (!conn) {
        const tap = this.ctx.createGain()
        tap.gain.value = targetGain
        sourceNode.connect(tap)
        tap.connect(info.param)
        conn = { sourceIndex, tap, target: row.target }
        this.modMatrixConnections.set(row.id, conn)
      } else {
        conn.tap.gain.setValueAtTime(targetGain, this.ctx.currentTime)
        conn.target = row.target
      }
      seen.add(row.id)
    }
    for (const [id] of this.modMatrixConnections) {
      if (!seen.has(id)) {
        this.removeModConnection(id)
      }
    }

    this.resetControlTargets()
    this.controlModRows = activeRows.filter((row) => isControlSource(row.source))
    this.applyControlModMatrix()
    this.mixAudioAmounts = [clampValue(mixAudio[0], -1, 1), clampValue(mixAudio[1], -1, 1)]
    this.refreshMixAudioConnections()
  }

  private refreshMixAudioConnections() {
    const now = this.ctx.currentTime
    const lfoConfigs: Array<NonNullable<Patch['lfo1']>> = [
      this.patch.lfo1 ?? defaultPatch.lfo1!,
      this.patch.lfo2 ?? defaultPatch.lfo2!,
    ]
    const lfoCount = Math.min(this.lfos.length, this.mixAudioAmounts.length)
    for (const voice of this.activeVoices.values()) {
      if (!voice.mixControl) continue
      if (!voice.mixConnections) voice.mixConnections = []
      for (let i = 0; i < lfoCount; i++) {
        const amount = this.mixAudioAmounts[i]
        const enabled = !!lfoConfigs[i]?.enabled
        const shouldEnable = enabled && Math.abs(amount) > 1e-4
        let connIndex = voice.mixConnections.findIndex((c) => c.sourceIndex === i)
        if (shouldEnable) {
          if (connIndex === -1) {
            const gain = this.ctx.createGain()
            gain.gain.value = amount
            const sourceNode = this.lfos[i]?.gain
            if (!sourceNode) continue
            sourceNode.connect(gain)
            gain.connect(voice.mixControl.offset)
            voice.mixConnections.push({ sourceIndex: i, gain })
          } else {
            voice.mixConnections[connIndex].gain.gain.setValueAtTime(amount, now)
          }
        } else if (connIndex !== -1) {
          const entry = voice.mixConnections[connIndex]
          const sourceNode = this.lfos[entry.sourceIndex]?.gain
          if (sourceNode) {
            try { sourceNode.disconnect(entry.gain) } catch {}
          }
          try { entry.gain.disconnect() } catch {}
          voice.mixConnections.splice(connIndex, 1)
        }
      }
    }
  }

  private getControlSourceValue(source: ModSource) {
    if (source === 'exprX') return this.controlSourceValues.exprX
    if (source === 'exprY') return this.controlSourceValues.exprY
    if (source === 'seqStep') return this.controlSourceValues.seqStep
    if (source === 'velocity') return this.controlSourceValues.velocity
    if (source === 'gate') return this.controlSourceValues.gate
    return 0
  }

  private updateControlSource(source: 'exprX' | 'exprY' | 'seqStep' | 'velocity' | 'gate', value: number) {
    const clamped = clampValue(value, -1, 1)
    if (this.controlSourceValues[source] === clamped) return
    this.controlSourceValues[source] = clamped
    this.applyControlModMatrix()
  }

  private resetControlTargets() {
    if (this.controlModSnapshots.size === 0) return
    for (const [target, base] of this.controlModSnapshots) {
      const def = CONTROL_TARGET_DEFINITIONS[target]
      if (!def) continue
      def.apply(this, base)
    }
    this.controlModSnapshots.clear()
  }

  private applyControlModMatrix() {
    if (this.controlModRows.length === 0) {
      this.resetControlTargets()
      return
    }

    const sums = new Map<ModTarget, { base: number; sum: number }>()
    for (const row of this.controlModRows) {
      const def = CONTROL_TARGET_DEFINITIONS[row.target]
      if (!def) continue
      const sourceValue = this.getControlSourceValue(row.source)
      if (!Number.isFinite(sourceValue)) continue
      let data = sums.get(row.target)
      if (!data) {
        const base = this.controlModSnapshots.get(row.target) ?? def.getBase(this)
        const finiteBase = Number.isFinite(base) ? base : 0
        this.controlModSnapshots.set(row.target, finiteBase)
        data = { base: finiteBase, sum: 0 }
        sums.set(row.target, data)
      }
      data.sum += row.amount * sourceValue
    }

    const activeTargets = new Set(sums.keys())
    for (const [target, base] of [...this.controlModSnapshots]) {
      if (!activeTargets.has(target)) {
        const def = CONTROL_TARGET_DEFINITIONS[target]
        if (def) {
          def.apply(this, base)
        }
        this.controlModSnapshots.delete(target)
      }
    }

    for (const [target, data] of sums) {
      const def = CONTROL_TARGET_DEFINITIONS[target]
      if (!def) continue
      const { base, sum } = data
      const range = def.range(this, base)
      const span = range.max - range.min
      const scaledDelta = span > 0 ? sum * span : 0
      const value = clampValue(base + scaledDelta, range.min, range.max)
      def.apply(this, value)
    }
  }

  private refreshVelocitySignals() {
    if (this.activeNoteVelocities.size === 0) {
      this.updateControlSource('velocity', -1)
      this.updateControlSource('gate', -1)
      return
    }
    let sum = 0
    for (const vel of this.activeNoteVelocities.values()) sum += vel
    const avg = sum / this.activeNoteVelocities.size
    this.updateControlSource('velocity', clampValue(avg * 2 - 1, -1, 1))
    this.updateControlSource('gate', 1)
  }

  constructor(ctx?: AudioContext) {
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
    this.master = this.ctx.createGain()
    // Initialize recording destination
    this.recordDestination = this.ctx.createMediaStreamDestination()
    this.master.connect(this.ctx.destination)
    this.master.connect(this.recordDestination)
    
    this.filter = this.ctx.createBiquadFilter()
    this.analyser = this.ctx.createAnalyser()

    this.fxInput = this.ctx.createGain()
    this.fxOutput = this.ctx.createGain()
    this.filter.connect(this.fxInput)
    // initialize pass-through
    this.fxInput.connect(this.fxOutput)
    this.fxOutput.connect(this.master)
    // Audio to speakers
    this.master.connect(this.ctx.destination)
    // Scope tap: pre-FX (stable, periodic signal for standing waves)
    try { this.filter.connect(this.analyser) } catch {}
    // Configure analyser for stable time-domain reads; smoothing doesn't affect time-domain, but set explicitly
    this.analyser.smoothingTimeConstant = 0

    this.lfos = []
    // Init two LFOs
    for (let i = 0; i < 2; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = 5
      const g = this.ctx.createGain()
      g.gain.value = 0
      osc.connect(g)
      // start immediately; routing is handled separately
      osc.start()
      this.lfos.push({ osc, noise: null, noiseFilter: null, gain: g, dest: 'none', wave: 'sine' })
    }

    this.patch = { ...defaultPatch }
    this.applyPatch()
    this.samplerMeta = this.normalizeSamplerMeta(this.patch.sampler, null)
  }

  get audioContext() {
    return this.ctx
  }

  getAnalyser() {
    return this.analyser
  }

  getWaveform() {
    const len = this.analyser.fftSize
    const buffer = new Uint8Array(len)
    // Cast for compatibility across TS DOM lib versions
    ;(this.analyser as any).getByteTimeDomainData(buffer)
    return buffer
  }

  async resume() {
    if (this.ctx.state !== 'running') await this.ctx.resume()
  }

  private normalizeSamplerMeta(meta: SamplerSettings, buffer: AudioBuffer | null): SamplerSettings {
    const duration = buffer?.duration ?? (Number.isFinite(meta.durationSec) ? (meta.durationSec as number) : 0)
    if (!(duration > 0)) {
      return { ...meta, durationSec: 0, trimStartSec: 0, trimEndSec: 0 }
    }
    const epsilon = 0.005
    const maxStart = Math.max(0, duration - epsilon)
    const rawStart = Number(meta.trimStartSec)
    const start = clampValue(Number.isFinite(rawStart) ? rawStart : 0, 0, maxStart)
    const rawEnd = Number(meta.trimEndSec)
    let end = Number.isFinite(rawEnd) ? rawEnd : duration
    end = clampValue(end, start + epsilon, duration)
    if (end - start < epsilon) {
      end = Math.min(duration, start + epsilon)
    }
    return {
      ...meta,
      durationSec: duration,
      trimStartSec: start,
      trimEndSec: end,
    }
  }

  private async updateSamplerBuffer(settings: SamplerSettings) {
    const isSameSource = this.samplerMeta.id === settings.id && this.samplerMeta.dataUrl === settings.dataUrl
    this.samplerMeta = this.normalizeSamplerMeta({ ...settings }, isSameSource ? this.samplerBuffer : null)
    if (!settings.dataUrl) {
      this.samplerBuffer = null
      this.samplerMeta = this.normalizeSamplerMeta(this.samplerMeta, null)
      this.samplerPitchCache.clear()
      return
    }
    if (isSameSource && this.samplerBuffer) return
    const token = ++this.samplerLoadToken
    try {
      const response = await fetch(settings.dataUrl)
      const arrayBuffer = await response.arrayBuffer()
      const decoded = await this.ctx.decodeAudioData(arrayBuffer.slice(0))
      if (token === this.samplerLoadToken) {
        this.samplerBuffer = decoded
        this.samplerMeta = this.normalizeSamplerMeta(this.samplerMeta, decoded)
        this.samplerPitchCache.clear()
      }
    } catch (error) {
      if (token === this.samplerLoadToken) {
        this.samplerBuffer = null
        this.samplerMeta = this.normalizeSamplerMeta(this.samplerMeta, null)
        this.samplerPitchCache.clear()
      }
      console.warn('Failed to decode sampler buffer', error)
    }
  }

  private getSamplerBaseFrequency() {
    const rootMidi = Number.isFinite(this.samplerMeta.rootMidi) ? this.samplerMeta.rootMidi : 60
    return 440 * Math.pow(2, (rootMidi - 69) / 12)
  }

  private getDetuneCents(which: 'osc1' | 'osc2') {
    if (which === 'osc1') {
      const coarse = this.patch.osc1.detune || 0
      const fine = this.patch.osc1.detuneFine ?? 0
      return coarse + fine
    }
    return this.patch.osc2.detune || 0
  }

  private mapNoiseLfoCutoff(rateHz: number) {
    const rate = clampValue(rateHz, 0.01, 20)
    const hz = clampValue(rate * 12, 0.5, 600)
    return hz
  }

  private updateLfoSource(index: number, settings: NonNullable<Patch['lfo1']>) {
    const node = this.lfos[index]
    if (!node) return
    const now = this.ctx.currentTime
    const wave = settings.wave
    if (wave === 'noise') {
      if (!this.noiseBuffer) this.noiseBuffer = createNoiseBuffer(this.ctx)
      if (node.osc) {
        try { node.osc.stop(now) } catch {}
        try { node.osc.disconnect() } catch {}
        node.osc = null
      }
      if (!node.noise) {
        const noise = this.ctx.createBufferSource()
        noise.buffer = this.noiseBuffer!
        noise.loop = true
        const filter = this.ctx.createBiquadFilter()
        filter.type = 'lowpass'
        filter.Q.value = 0.0001
        noise.connect(filter)
        filter.connect(node.gain)
        noise.start()
        node.noise = noise
        node.noiseFilter = filter
      }
      if (node.noiseFilter) {
        const cutoff = this.mapNoiseLfoCutoff(settings.rateHz)
        node.noiseFilter.frequency.setTargetAtTime(cutoff, now, 0.05)
      }
    } else {
      if (!node.osc) {
        const osc = this.ctx.createOscillator()
        osc.type = wave as OscillatorType
        osc.frequency.value = Math.max(0.01, settings.rateHz)
        osc.connect(node.gain)
        osc.start()
        node.osc = osc
      } else {
        node.osc.type = wave as OscillatorType
        node.osc.frequency.setValueAtTime(Math.max(0.01, settings.rateHz), now)
      }
      if (node.noise) {
        try { node.noise.stop(now) } catch {}
        try { node.noise.disconnect() } catch {}
        node.noise = null
      }
      if (node.noiseFilter) {
        try { node.noiseFilter.disconnect() } catch {}
        node.noiseFilter = null
      }
    }
    node.wave = wave
  }

  private getPitchedSamplerBuffer(pitchRatio: number) {
    if (!this.samplerBuffer) return null
    const sampleRate = this.samplerBuffer.sampleRate
    const startSec = this.samplerMeta.trimStartSec ?? 0
    const endSec = this.samplerMeta.trimEndSec ?? this.samplerBuffer.duration
    const clampedStart = clampValue(startSec, 0, this.samplerBuffer.duration)
    const clampedEnd = clampValue(endSec, clampedStart + 0.005, this.samplerBuffer.duration)
    const startSample = Math.max(0, Math.floor(clampedStart * sampleRate))
    const endSample = Math.max(startSample + 1, Math.min(this.samplerBuffer.length, Math.floor(clampedEnd * sampleRate)))
    const frameLength = endSample - startSample
    if (frameLength <= 0) return null
    const id = this.samplerMeta.id ?? 'inline'
    const sourceKey = `${id}|${this.samplerMeta.dataUrl ?? 'data'}|${startSample}|${endSample}`
    const ratio = Number.isFinite(pitchRatio) && pitchRatio > 0 ? pitchRatio : 1
    const ratioKey = ratio.toFixed(6)
    const cacheKey = `${sourceKey}|${ratioKey}|${sampleRate}|${this.samplerBuffer.numberOfChannels}`
    const cached = this.samplerPitchCache.get(cacheKey)
    if (cached) return cached

    const channelCount = this.samplerBuffer.numberOfChannels
    const channels: Float32Array[] = []
    for (let ch = 0; ch < channelCount; ch++) {
      const source = this.samplerBuffer.getChannelData(ch)
      const segment = source.subarray(startSample, endSample)
      channels.push(new Float32Array(segment))
    }

    const shifted = Math.abs(ratio - 1) < 1e-4 ? channels : phaseVocoderPitchShift({ channels, pitchRatio: ratio })

    if (!shifted.length || shifted[0].length === 0) return null

    const buffer = this.ctx.createBuffer(shifted.length, shifted[0].length, sampleRate)
    for (let ch = 0; ch < shifted.length; ch++) {
      buffer.copyToChannel(shifted[ch], ch, 0)
    }
    this.samplerPitchCache.set(cacheKey, buffer)
    return buffer
  }

  private createSamplerSource(
    freq: number,
    which: 'osc1' | 'osc2',
    options: { autoStart?: boolean; allowLoop?: boolean } = {},
  ): AudioBufferSourceNode | null {
    const { autoStart = true, allowLoop = true } = options
    if (!this.samplerBuffer) return null
    this.samplerMeta = this.normalizeSamplerMeta(this.samplerMeta, this.samplerBuffer)
    const baseFreq = this.getSamplerBaseFrequency()
    const detuneCents = this.getDetuneCents(which)
    const detuneRatio = Math.pow(2, detuneCents / 1200)
    const ratio = baseFreq > 0 ? (freq / baseFreq) * detuneRatio : detuneRatio
    const pitchedBuffer = this.getPitchedSamplerBuffer(ratio)
    if (!pitchedBuffer) return null
    const playbackWindow = pitchedBuffer.duration
    const loopEnabled = allowLoop && !!this.samplerMeta.loop && playbackWindow > 0.01
    const src = ensureManagedSource(this.ctx.createBufferSource())
    src.buffer = pitchedBuffer
    src.loop = loopEnabled
    if (loopEnabled) {
      src.loopStart = 0
      src.loopEnd = playbackWindow
    }
    if (autoStart) {
      if (loopEnabled) {
        src.start(0)
      } else {
        const duration = Math.max(0.005, playbackWindow)
        src.start(0, 0, duration)
      }
      markSourceAutoStarted(src)
    }
    return src
  }

  applyPatch(p: DeepPartial<Patch> = {}, options: { fromExpression?: boolean } = {}) {
    const { fromExpression = false } = options
    const prev = this.patch
    const incomingOsc1 = (p.osc1 ?? {}) as Partial<OscillatorConfig>
    const incomingOsc2 = (p.osc2 ?? {}) as Partial<OscillatorConfig>
    const incomingModMatrix = Array.isArray((p as any).modMatrix)
      ? ((p as any).modMatrix as ModMatrixRow[]).map((row) => ({
          ...row,
          amount: Number.isFinite(row.amount) ? row.amount : 0,
          enabled: row.enabled !== false,
        }))
      : undefined
    const prevModMatrix = (this.patch.modMatrix ?? []).map((row) => ({ ...row }))

    const mergedOsc1 = normalizeOscillatorConfig({
      ...this.patch.osc1,
      ...incomingOsc1,
    })
    const mergedOsc2 = normalizeOscillatorConfig({
      ...this.patch.osc2,
      ...incomingOsc2,
    })

    const next: Patch = {
      ...this.patch,
      ...p,
      osc1: mergedOsc1,
      osc2: mergedOsc2,
      fm: { ...this.patch.fm, ...(p.fm ?? {}) },
      sub: { ...this.patch.sub, ...(p.sub ?? {}) },
      ring: { ...this.patch.ring, ...(p.ring ?? {}) },
      filter: { ...this.patch.filter, ...(p.filter ?? {}) },
      envelope: { ...this.patch.envelope, ...(p.envelope ?? {}) },
      master: { ...this.patch.master, ...(p.master ?? {}) },
      mix: p.mix != null ? clampValue(p.mix, 0, 1) : this.patch.mix,
      engineMode: p.engineMode ?? this.patch.engineMode ?? 'classic',
      sampler: { ...(this.patch.sampler ?? defaultPatch.sampler), ...(p.sampler ?? {}) },
      macro: { ...(this.patch.macro ?? DEFAULT_OSCILLATOR_MACRO), ...(p.macro ?? {}) },
      effects: {
        ...(this.patch.effects ?? defaultPatch.effects!),
        ...(p.effects ?? {}),
      } as Patch['effects'],
      lfo1: { ...(this.patch.lfo1 ?? defaultPatch.lfo1!), ...(p.lfo1 ?? {}) },
      lfo2: { ...(this.patch.lfo2 ?? defaultPatch.lfo2!), ...(p.lfo2 ?? {}) },
      arp: { ...(this.patch.arp ?? defaultPatch.arp!), ...(p.arp ?? {}) },
      sequencer: {
        ...(this.patch.sequencer ?? defaultPatch.sequencer!),
        ...(p.sequencer ?? {}),
      } as Patch['sequencer'],
      expression: { ...(this.patch.expression ?? defaultPatch.expression!), ...(p.expression ?? {}) },
      modMatrix: incomingModMatrix ?? prevModMatrix,
    }

    this.patch = next
    if (p.sequencer !== undefined) {
      const seqRoot = next.sequencer?.rootMidi ?? defaultPatch.sequencer!.rootMidi
      this.seqCurrentRoot = clampValue(seqRoot, 0, 127)
      this.seqProgressionIndex = 0
    }

    if (p.sampler !== undefined) {
      void this.updateSamplerBuffer(next.sampler)
    } else if (p.osc1?.sampler !== undefined) {
      void this.updateSamplerBuffer(next.osc1.sampler ?? defaultPatch.sampler)
    } else if (p.osc2?.sampler !== undefined) {
      void this.updateSamplerBuffer(next.osc2.sampler ?? defaultPatch.sampler)
    }

    this.configureExpressionRouting(next.expression)

    if (p.mix !== undefined && next.mix !== prev.mix) {
      const value = clampValue(next.mix, 0, 1)
      const now = this.ctx.currentTime
      for (const voice of this.activeVoices.values()) {
        if (voice.mixControl) voice.mixControl.offset.setTargetAtTime(value, now, 0.01)
      }
    }

    // Master gain smoothing
    if (next.master.gain !== prev.master.gain) {
      this.master.gain.setTargetAtTime(next.master.gain, this.ctx.currentTime, 0.01)
    }

    // Filter updates with smoothing
    if (next.filter.type !== prev.filter.type) this.filter.type = next.filter.type
    if (next.filter.q !== prev.filter.q) this.filter.Q.setTargetAtTime(next.filter.q, this.ctx.currentTime, 0.02)
    if (next.filter.cutoff !== prev.filter.cutoff) this.filter.frequency.setTargetAtTime(next.filter.cutoff, this.ctx.currentTime, 0.015)
    if (!this.noiseBuffer) this.noiseBuffer = createNoiseBuffer(this.ctx)

    // Rebuild FX chain only when effects were part of the change
    if (p.effects !== undefined) this.buildFxChain()

    // Configure LFOs only when LFOs changed
    if (p.lfo1 !== undefined || p.lfo2 !== undefined || p.master?.gain !== undefined) {
      const lfos = [this.patch.lfo1!, this.patch.lfo2!]
      for (let i = 0; i < this.lfos.length; i++) {
        const node = this.lfos[i]
        const pLfo = lfos[i]
        this.updateLfoSource(i, pLfo)
        // Disconnect prior routing
        try { node.gain.disconnect() } catch {}
        node.dest = 'none'
        // Amount scaling per destination set below; connect to targets
        node.gain.gain.value = 0
        if (pLfo.enabled) {
          if (pLfo.dest === 'filter') {
            node.dest = 'filter'
            // Scale to Hz: up to +/- 2000 Hz
            node.gain.gain.value = Math.max(0, pLfo.amount) * 2000
            node.gain.connect(this.filter.frequency)
          } else if (pLfo.dest === 'amp') {
            node.dest = 'amp'
            // Scale relative to master gain to keep within sensible range
            const base = this.patch.master.gain
            node.gain.gain.value = Math.max(0, pLfo.amount) * Math.max(0, base) * 0.8
            node.gain.connect(this.master.gain)
          } else if (pLfo.dest === 'pitch') {
            node.dest = 'pitch'
            // No connection here; per-voice hookup to detune in makeVoice
            node.gain.gain.value = Math.max(0, pLfo.amount) * 50 // cents
          }
        }
      }
      this.refreshMixAudioConnections()
    }

    // Reconfigure arpeggiator/sequencer only when those sections changed
    if (p.arp !== undefined) this.updateArpScheduler({ forceRestart: true })
    if (p.sequencer !== undefined) this.updateSeqScheduler()
    if (p.modMatrix !== undefined || p.lfo1 !== undefined || p.lfo2 !== undefined) {
      this.applyModMatrix(this.patch.modMatrix ?? [])
    }

    // Live-detune updates for currently playing voices
    if (p.osc1?.detune !== undefined || p.osc1?.detuneFine !== undefined) {
      const now = this.ctx.currentTime
      const effectiveDetune = (next.osc1.detune || 0) + (next.osc1.detuneFine ?? 0)
      for (const v of this.activeVoices.values()) {
        if (v.osc1Detune) {
          try { v.osc1Detune.setTargetAtTime(effectiveDetune, now, 0.01) } catch {}
        }
      }
    }
    if (p.osc2?.detune !== undefined) {
      const now = this.ctx.currentTime
      for (const v of this.activeVoices.values()) {
        if (v.osc2Detune) {
          try { v.osc2Detune.setTargetAtTime(next.osc2.detune || 0, now, 0.01) } catch {}
        }
      }
    }

    if (this.expression2D.active && !fromExpression) this.applyExpression2D()
  }

  async previewSampler(target: 'osc1' | 'osc2') {
    const sampler = this.patch[target].sampler ?? defaultPatch.sampler
    if (!sampler?.dataUrl) return
    await this.updateSamplerBuffer(sampler)
    if (!this.samplerBuffer) return
    const midi = Number.isFinite(sampler.rootMidi) ? sampler.rootMidi! : 60
    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    const created = this.createSamplerSource(freq, target, { autoStart: false, allowLoop: false })
    if (!created) return
    const source = ensureManagedSource(created)
    const gain = this.ctx.createGain()
    gain.gain.value = 0.8
    source.connect(gain)
    gain.connect(this.master)
    const now = this.ctx.currentTime
    const duration = Math.max(0.05, Math.min(source.buffer?.duration ?? 0.5, 5))
    let started = false
    try {
      source.start(now)
      started = true
      markSourceStarted(source)
      source.stop(now + duration)
      source._started = false
    } catch (error) {
      if (!started) {
        try { source.disconnect() } catch {}
        try { gain.disconnect() } catch {}
        return
      }
      throw error
    }
    const cleanup = () => {
      try { source.disconnect() } catch {}
      try { gain.disconnect() } catch {}
    }
    source.addEventListener('ended', cleanup, { once: true })
  }

  private buildFxChain() {
    try { this.fxInput.disconnect() } catch {}
    if (this.currentFxTap) {
      try { this.currentFxTap.disconnect(this.fxOutput) } catch {}
      this.currentFxTap = null
    }
    let current: AudioNode = this.fxInput

    // Delay first, then Reverb (common ordering)
    const fx = this.patch.effects
    if (fx?.delay?.enabled) {
      current = this.applyDelayEffect(current, fx.delay)
    }
    if (fx?.reverb?.enabled) {
      current = this.applyReverbEffect(current, fx.reverb)
    }

    current.connect(this.fxOutput)
    this.currentFxTap = current
  }

  private clamp01(x: number) { return Math.min(1, Math.max(0, x)) }

  setExpression2D(x: number, y: number) {
    const nx = this.clamp01(x)
    const ny = this.clamp01(y)
    if (!this.expression2D.active) {
      this.captureExpressionBase()
    }
    this.expression2D = { active: true, x: nx, y: ny }
    this.applyExpression2D()
    this.updateControlSource('exprX', nx * 2 - 1)
    this.updateControlSource('exprY', ny * 2 - 1)
  }

  clearExpression2D() {
    if (!this.expression2D.active) return
    this.expressionApplying = true
    try {
      for (const axis of EXPRESSION_AXES) this.resetExpressionAxis(axis)
    } finally {
      this.expressionApplying = false
      this.expression2D = { active: false, x: 0.5, y: 0.5 }
      this.expressionSnapshot = { x: null, y: null }
      this.updateControlSource('exprX', 0)
      this.updateControlSource('exprY', 0)
    }
  }

  private configureExpressionRouting(expression = this.patch.expression ?? defaultPatch.expression!) {
    const fallback = defaultPatch.expression ?? { x: 'osc1.detune', y: 'filter.cutoff' }
    for (const axis of EXPRESSION_AXES) {
      const requested = expression?.[axis] ?? fallback[axis]
      const supported = EXPRESSION_RUNTIME_TARGETS[requested] ? requested : fallback[axis]
      if (this.expressionAxisTargets[axis] !== supported || !this.expression2D.active) {
        this.expressionSnapshot[axis] = null
      }
      this.expressionAxisTargets[axis] = supported
    }
  }

  private captureExpressionBase() {
    for (const axis of EXPRESSION_AXES) {
      const target = this.expressionAxisTargets[axis]
      const def = EXPRESSION_RUNTIME_TARGETS[target]
      if (!def) continue
      const base = def.getBase(this)
      this.expressionSnapshot[axis] = Number.isFinite(base) ? base : 0
    }
  }

  private applyExpressionAxis(axis: ExpressionAxis, normalized: number) {
    const target = this.expressionAxisTargets[axis]
    const def = EXPRESSION_RUNTIME_TARGETS[target]
    if (!def) return

    let base = this.expressionSnapshot[axis]
    if (base == null || Number.isNaN(base)) {
      base = def.getBase(this)
      this.expressionSnapshot[axis] = base
    }
    const { min, max } = def.range(this, base)
    const span = max - min
    const value = span <= 0 ? base : min + span * this.clamp01(normalized)
    def.apply(this, value)
  }

  private resetExpressionAxis(axis: ExpressionAxis) {
    const base = this.expressionSnapshot[axis]
    const target = this.expressionAxisTargets[axis]
    const def = EXPRESSION_RUNTIME_TARGETS[target]
    if (def && base != null && Number.isFinite(base)) {
      def.apply(this, base)
    }
    this.expressionSnapshot[axis] = null
  }

  private applyExpression2D() {
    if (!this.expression2D.active || this.expressionApplying) return
    this.expressionApplying = true
    try {
      this.applyExpressionAxis('x', this.expression2D.x)
      this.applyExpressionAxis('y', this.expression2D.y)
    } finally {
      this.expressionApplying = false
    }
  }

  private applyDelayEffect(input: AudioNode, params: { time: number; feedback: number; mix: number }) {
    const mix = this.clamp01(params.mix)
    const time = Math.max(0, Math.min(1.5, params.time))
    const fbAmt = Math.max(0, Math.min(0.95, params.feedback))

    const delay = this.ctx.createDelay(2.0)
    delay.delayTime.value = time
    const fb = this.ctx.createGain()
    fb.gain.value = fbAmt
    delay.connect(fb)
    fb.connect(delay)

    const dryGain = this.ctx.createGain(); dryGain.gain.value = 1 - mix
    const wetGain = this.ctx.createGain(); wetGain.gain.value = mix
    const sum = this.ctx.createGain()

    input.connect(dryGain)
    input.connect(delay)
    delay.connect(wetGain)
    dryGain.connect(sum)
    wetGain.connect(sum)
    return sum as AudioNode
  }

  private makeImpulse(seconds: number, decay: number) {
    const length = Math.max(1, Math.floor(this.ctx.sampleRate * Math.max(0.05, seconds)))
    const impulse = this.ctx.createBuffer(2, length, this.ctx.sampleRate)
    for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
      const data = impulse.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        const t = i / length
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2 + decay * 6)
      }
    }
    return impulse
  }

  private applyReverbEffect(input: AudioNode, params: { size: number; decay: number; mix: number }) {
    const mix = this.clamp01(params.mix)
    const sizeSec = 0.1 + this.clamp01(params.size) * 3.0
    const decay = this.clamp01(params.decay)

    const convolver = this.ctx.createConvolver()
    convolver.normalize = true
    convolver.buffer = this.makeImpulse(sizeSec, decay)

    const dryGain = this.ctx.createGain(); dryGain.gain.value = 1 - mix
    const wetGain = this.ctx.createGain(); wetGain.gain.value = mix
    const sum = this.ctx.createGain()

    input.connect(dryGain)
    input.connect(convolver)
    convolver.connect(wetGain)
    dryGain.connect(sum)
    wetGain.connect(sum)
    return sum as AudioNode
  }

  // --- Macro engine helpers ---
  private makeWavefolderCurve(amount: number, symmetry: number, size = 2048) {
    const curve = new Float32Array(size)
    const k = Math.max(0.0001, amount) * 6
    const sym = (symmetry - 0.5) * 2
    for (let i = 0; i < size; i++) {
      let x = (i / (size - 1)) * 2 - 1
      x += sym * 0.5
      const y = Math.tanh(k * x) / Math.tanh(k)
      curve[i] = y
    }
    return curve
  }

  private buildMacroVoice(freq: number, settings: MacroSettings) {
    switch (settings.model) {
      case 'fold':
        return this.createMacroFold(freq, settings)
      case 'pluck':
        return this.createMacroPluck(freq, settings)
      case 'supersaw':
        return this.createMacroSuperSaw(freq, settings)
      case 'pwm':
        return this.createMacroPWM(freq, settings)
      case 'fm2op':
        return this.createMacroFM2Op(freq, settings)
      case 'wavetable':
        return this.createMacroWavetable(freq, settings)
      case 'harmonic':
        return this.createMacroHarmonic(freq, settings)
      case 'chord':
        return this.createMacroChord(freq, settings)
      case 'dirichlet':
        return this.createMacroDirichletPulse(freq, settings)
      case 'formant':
        return this.createMacroFormant(freq, settings)
      case 'va':
      default:
        return this.createMacroVA(freq, settings)
    }
  }

  private createMacroSuperSaw(freq: number, p: MacroSettings) {
    const NUM = 6
    const mix = this.ctx.createGain()
    const tone = this.ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 800 + p.timbre * 12000
    tone.Q.value = 0.3

    // detune spread in cents (0..30)
    const spreadCents = 0 + p.harmonics * 30
    const pattern = [-1, -0.6, -0.2, 0.2, 0.6, 1]
  const voices: { osc: OscillatorNode; pan: StereoPannerNode }[] = []
    for (let i = 0; i < NUM; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sawtooth'
      osc.frequency.value = freq
      osc.detune.value = pattern[i] * spreadCents
      const g = this.ctx.createGain()
      g.gain.value = 1 / NUM
      // Stereo spread: morph in [0..1] -> pan amount [-1..1] distributed across voices
      const pan = this.ctx.createStereoPanner()
      const spread = (p.morph - 0.5) * 2 // -1..1
      const voicePan = (pattern[i] / Math.max(1, Math.max(...pattern.map(Math.abs)))) * spread
      pan.pan.value = voicePan
      osc.connect(g).connect(pan).connect(mix)
      voices.push({ osc, pan })
      osc.start()
    }

    mix.connect(tone)
    const out = this.ctx.createGain()
    out.gain.value = p.level
    tone.connect(out)

    return {
      output: out as AudioNode,
      stop: (t: number) => voices.forEach(({ osc }) => osc.stop(t)),
      pitched: voices.map(v => v.osc),
    }
  }

  private createMacroDirichletPulse(freq: number, p: MacroSettings) {
    const osc = this.ctx.createOscillator()
    osc.frequency.value = freq

    const minPartials = 8
    const maxPartials = 64
    const partialCount = Math.max(minPartials, Math.round(minPartials + p.harmonics * (maxPartials - minPartials)))
    const width = Math.min(0.92, Math.max(0.08, 0.08 + p.timbre * 0.84))
    const phaseShift = (p.morph - 0.5) * Math.PI * 2

    const real = new Float32Array(partialCount + 1)
    const imag = new Float32Array(partialCount + 1)

    real[0] = 0
    for (let n = 1; n <= partialCount; n++) {
      const harmonic = n
      const baseAmp = (2 / (harmonic * Math.PI)) * Math.sin(harmonic * Math.PI * width)
      const x = harmonic / (partialCount + 1)
      const window = x === 0 ? 1 : Math.sin(Math.PI * x) / (Math.PI * x)
      const amp = baseAmp * window
      if (!Number.isFinite(amp) || Math.abs(amp) < 1e-6) continue
      const phase = phaseShift * harmonic
      real[harmonic] = amp * Math.cos(phase)
      imag[harmonic] = amp * Math.sin(phase)
    }

    const wave = this.ctx.createPeriodicWave(real, imag, { disableNormalization: false })
    osc.setPeriodicWave(wave)

    const tone = this.ctx.createBiquadFilter()
    tone.type = 'lowpass'
    const spectralReach = Math.max(freq * 2, freq * Math.min(partialCount + 2, 40))
    tone.frequency.value = Math.min(this.ctx.sampleRate * 0.48, spectralReach)
    tone.Q.value = Math.max(0.35, 0.7 + (0.5 - width) * 0.6)

    const out = this.ctx.createGain()
    out.gain.value = p.level

    osc.connect(tone).connect(out)
    osc.start()
    return {
      output: out as AudioNode,
      stop: (t: number) => osc.stop(t),
      pitched: [osc],
    }
  }

  private createMacroWavetable(freq: number, p: MacroSettings) {
    // Blend between basic waves: sine -> triangle -> saw -> square
    const shapes: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square']
    const seg = Math.min(3, Math.max(0, Math.floor(p.morph * 3.00001)))
    const t = Math.min(1, Math.max(0, p.morph * 3 - seg))

    const make = (type: OscillatorType, gain: number) => {
      const osc = this.ctx.createOscillator(); osc.type = type; osc.frequency.value = freq
      const g = this.ctx.createGain(); g.gain.value = gain
      osc.connect(g)
      return { osc, g }
    }
    const a = make(shapes[seg], seg === 3 ? 1 : 1 - t)
    const b = seg < 3 ? make(shapes[seg + 1], t) : null

    // Brightness via lowpass; timbre adjusts Q a bit
    const tone = this.ctx.createBiquadFilter(); tone.type = 'lowpass'
    tone.frequency.value = 800 + p.harmonics * 15000
    tone.Q.value = 0.1 + p.timbre * 0.6

    const out = this.ctx.createGain(); out.gain.value = p.level
    a.g.connect(tone); if (b) b.g.connect(tone); tone.connect(out)

    a.osc.start(); if (b) b.osc.start()

    const pitched: OscillatorNode[] = [a.osc]; if (b) pitched.push(b.osc)
    return {
      output: out as AudioNode,
      stop: (tStop: number) => { a.osc.stop(tStop); if (b) b.osc.stop(tStop) },
      pitched,
    }
  }

  private createMacroHarmonic(freq: number, p: MacroSettings) {
    // Additive stack with controllable partial count and tilt
    const maxPartials = 16
    const minPartials = 2
    const count = Math.round(minPartials + p.harmonics * (maxPartials - minPartials))
    const tilt = 0.5 + (1 - p.timbre) * 2.0 // higher -> darker
    const oddEvenBias = (p.morph - 0.5) * 2 // -1..1 (odd..even)

    const sum = this.ctx.createGain()
    const pitched: OscillatorNode[] = []
    for (let n = 1; n <= count; n++) {
      const osc = this.ctx.createOscillator(); osc.type = 'sine'
      osc.frequency.value = freq * n
      let amp = 1 / Math.pow(n, tilt)
      const isEven = (n % 2) === 0
      const bias = isEven ? Math.max(0.1, (oddEvenBias + 1) / 2) : Math.max(0.1, (1 - oddEvenBias) / 2)
      amp *= bias
      const g = this.ctx.createGain(); g.gain.value = amp
      osc.connect(g).connect(sum)
      osc.start()
      pitched.push(osc)
    }
    const tone = this.ctx.createBiquadFilter(); tone.type = 'lowpass'
    tone.frequency.value = 1000 + p.timbre * 15000
    tone.Q.value = 0.2
    const out = this.ctx.createGain(); out.gain.value = p.level
    sum.connect(tone).connect(out)
    return {
      output: out as AudioNode,
      stop: (tStop: number) => { for (const o of pitched) o.stop(tStop) },
      pitched,
    }
  }

  private createMacroFormant(freq: number, p: MacroSettings) {
    const source = this.ctx.createOscillator()
    source.type = 'sawtooth'
    source.frequency.value = freq

    const pre = this.ctx.createGain()
    pre.gain.value = 1
    source.connect(pre)

    const mix = this.ctx.createGain()
    mix.gain.value = 1

    const vowelSets = [
      { ratios: [1.0, 2.6, 4.9], widths: [0.22, 0.18, 0.28], gains: [1.0, 0.7, 0.45] },
      { ratios: [0.9, 2.1, 3.5], widths: [0.28, 0.22, 0.32], gains: [1.0, 0.65, 0.55] },
      { ratios: [1.3, 2.8, 4.2], widths: [0.2, 0.16, 0.24], gains: [0.9, 0.75, 0.5] },
      { ratios: [0.8, 1.6, 2.8], widths: [0.32, 0.26, 0.36], gains: [1.05, 0.6, 0.55] },
    ] as const

    const setPosition = p.morph * (vowelSets.length - 1)
    const setIndex = Math.floor(setPosition)
    const nextIndex = Math.min(vowelSets.length - 1, setIndex + 1)
    const blend = setPosition - setIndex
    const setA = vowelSets[setIndex] ?? vowelSets[0]
    const setB = vowelSets[nextIndex]

    const ratioScale = 0.8 + p.harmonics * 1.4
    const resonanceBoost = 0.6 + p.timbre * 2.4
    const safetyNyquist = this.ctx.sampleRate * 0.48
    const formantCount = setA.ratios.length

    for (let i = 0; i < formantCount; i++) {
      const ratioA = setA.ratios[i]
      const ratioB = setB.ratios[i]
      const widthA = setA.widths[i]
      const widthB = setB.widths[i]
      const gainA = setA.gains[i]
      const gainB = setB.gains[i]

      const ratio = (ratioA + (ratioB - ratioA) * blend) * ratioScale
      const width = Math.max(0.05, widthA + (widthB - widthA) * blend)
      const gain = gainA + (gainB - gainA) * blend

      const center = Math.min(safetyNyquist, Math.max(60, freq * ratio))
      const filter = this.ctx.createBiquadFilter()
      filter.type = 'bandpass'
      filter.frequency.value = center
      const q = Math.max(0.5, Math.min(30, (1 / width) * resonanceBoost))
      filter.Q.value = q

      const g = this.ctx.createGain()
      g.gain.value = (gain / formantCount) * (1 / Math.sqrt(q))

      pre.connect(filter)
      filter.connect(g).connect(mix)
    }

    const highpass = this.ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = Math.max(40, freq * 0.5)
    highpass.Q.value = 0.7

    const body = this.ctx.createBiquadFilter()
    body.type = 'lowpass'
    body.frequency.value = Math.min(safetyNyquist, 3000 + p.harmonics * 14000)
    body.Q.value = 0.7 + p.timbre * 0.6

    mix.connect(highpass).connect(body)

    const out = this.ctx.createGain()
    out.gain.value = p.level
    body.connect(out)

    source.start()

    return {
      output: out as AudioNode,
      stop: (t: number) => source.stop(t),
      pitched: [source],
    }
  }

  private createMacroChord(freq: number, p: MacroSettings) {
    // Stack a chord; choose set by harmonics, inversion/spread by morph
    const CHORDS: number[][] = [
      [0, 4, 7],            // Major
      [0, 3, 7],            // Minor
      [0, 5, 7],            // Sus4
      [0, 2, 7],            // Sus2
      [0, 4, 7, 10],        // Dom7
      [0, 3, 7, 10],        // Min7
      [0, 4, 7, 11],        // Maj7
      [0, 3, 6, 9],         // Dim7
      [0, 4, 8],            // Aug
      [-12, 0, 7, 12],      // Spread octave
    ]
    const idx = Math.max(0, Math.min(CHORDS.length - 1, Math.floor(p.harmonics * CHORDS.length)))
    const chord = CHORDS[idx]
    const spread = (p.morph - 0.5) * 2 // -1..1 -> detune/pan

    const mix = this.ctx.createGain()
    const tone = this.ctx.createBiquadFilter(); tone.type = 'lowpass'
    tone.frequency.value = 900 + p.timbre * 15000
    tone.Q.value = 0.3
    const out = this.ctx.createGain(); out.gain.value = p.level

    const pitched: OscillatorNode[] = []
    const panPattern = [-1, -0.3, 0.3, 1]
    chord.forEach((semi, i) => {
      const osc = this.ctx.createOscillator(); osc.type = 'sawtooth'
      const f = 440 * Math.pow(2, (Math.log2(freq / 440) + semi / 12))
      osc.frequency.value = f
      const detuneCents = panPattern[i % panPattern.length] * spread * 15
      osc.detune.value = detuneCents
      const g = this.ctx.createGain(); g.gain.value = 1 / chord.length
      const pan = this.ctx.createStereoPanner(); pan.pan.value = panPattern[i % panPattern.length] * spread
      osc.connect(g).connect(pan).connect(mix)
      osc.start()
      pitched.push(osc)
    })

    mix.connect(tone).connect(out)
    return {
      output: out as AudioNode,
      stop: (tStop: number) => { for (const o of pitched) o.stop(tStop) },
      pitched,
    }
  }

  private createMacroPWM(freq: number, p: MacroSettings) {
    // Generate PWM by offsetting a saw and passing through a steep tanh shaper
    const saw = this.ctx.createOscillator()
    saw.type = 'sawtooth'
    saw.frequency.value = freq

    // Summing node (Gain acts as adder in Web Audio)
    const sum = this.ctx.createGain()
    sum.gain.value = 1
    const dc = this.ctx.createConstantSource()
    // morph controls duty (roughly 10%..90%) -> shift -0.8..+0.8
    const shift = (p.morph - 0.5) * 1.6
    dc.offset.value = shift
  dc.start()

    saw.connect(sum)
    dc.connect(sum)

    const shaper = this.ctx.createWaveShaper()
    // Edge sharpness from harmonics (higher -> steeper -> brighter)
    const k = 1 + p.harmonics * 24
    const size = 2048
    const curve = new Float32Array(size)
    for (let i = 0; i < size; i++) {
      const x = (i / (size - 1)) * 2 - 1
      curve[i] = Math.tanh(k * x)
    }
    shaper.curve = curve
    shaper.oversample = '4x'

    const tone = this.ctx.createBiquadFilter()
    tone.type = 'lowpass'
    // tame aliasing on sharp edges; timbre opens the filter
    tone.frequency.value = 2000 + p.timbre * 14000
    tone.Q.value = 0.2

    const out = this.ctx.createGain()
    out.gain.value = p.level

    sum.connect(shaper).connect(tone).connect(out)
    saw.start()
    return {
      output: out as AudioNode,
      stop: (t: number) => { saw.stop(t); dc.stop(t) },
      pitched: [saw],
    }
  }

  private createMacroFM2Op(freq: number, p: MacroSettings) {
    // Simple 2-operator FM: sine modulator -> carrier frequency
    const carrier = this.ctx.createOscillator()
    carrier.type = 'sine'
    carrier.frequency.value = freq

    const mod = this.ctx.createOscillator()
    mod.type = 'sine'
    // harmonics controls ratio (0.25 .. 8.0)
    const ratio = 0.25 + p.harmonics * 7.75
    mod.frequency.value = freq * ratio

    // timbre controls index (amount in Hz). Scale with frequency for consistency
    const amt = this.ctx.createGain()
    amt.gain.value = Math.max(0, p.timbre) * freq * 2
    mod.connect(amt).connect(carrier.frequency)

    const tone = this.ctx.createBiquadFilter()
    tone.type = 'lowpass'
    // morph opens the filter
    tone.frequency.value = 1000 + p.morph * 15000
    tone.Q.value = 0.1

    const out = this.ctx.createGain()
    out.gain.value = p.level
    carrier.connect(tone).connect(out)

    carrier.start()
    mod.start()
    return {
      output: out as AudioNode,
      stop: (t: number) => { carrier.stop(t); mod.stop(t) },
      pitched: [carrier],
    }
  }

  private createMacroVA(freq: number, p: MacroSettings) {
    const oscSaw = this.ctx.createOscillator()
    const oscTri = this.ctx.createOscillator()
    oscSaw.type = 'sawtooth'
    oscTri.type = 'triangle'
    oscSaw.frequency.value = freq
    oscTri.frequency.value = freq

    const triGain = this.ctx.createGain()
    const sawGain = this.ctx.createGain()
    triGain.gain.value = 1 - p.timbre
    sawGain.gain.value = p.timbre
    const mix = this.ctx.createGain()
    const tone = this.ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 1000 + p.harmonics * 15000
    tone.Q.value = 0.5

    oscTri.connect(triGain).connect(mix)
    oscSaw.connect(sawGain).connect(mix)
    mix.connect(tone)

    oscTri.start()
    oscSaw.start()

    return {
      output: tone as AudioNode,
      stop: (t: number) => { oscTri.stop(t); oscSaw.stop(t) },
      pitched: [oscTri, oscSaw],
    }
  }

  private createMacroFold(freq: number, p: MacroSettings) {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = freq
    const pre = this.ctx.createGain()
    const shaper = this.ctx.createWaveShaper()
    const post = this.ctx.createGain()

    const drive = 0.2 + p.harmonics * 1.6
    const symmetry = p.morph
    shaper.curve = this.makeWavefolderCurve(drive, symmetry)
    shaper.oversample = '4x'

    pre.gain.value = 1
    post.gain.value = p.level
    const tone = this.ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.frequency.value = 4000 + p.timbre * 16000
    tone.Q.value = 0.2

    osc.connect(pre).connect(shaper).connect(tone).connect(post)
    osc.start()
    return {
      output: post as AudioNode,
      stop: (t: number) => osc.stop(t),
      pitched: [osc],
    }
  }

  private createMacroPluck(freq: number, p: MacroSettings) {
    const out = this.ctx.createGain()
    const burst = this.ctx.createBufferSource()
    const len = Math.floor(this.ctx.sampleRate * 0.02)
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
    const ch = buf.getChannelData(0)
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len)
    burst.buffer = buf
    burst.loop = false

    const periodSec = 1 / Math.max(20, freq)
    const delay = this.ctx.createDelay(1.0)
    delay.delayTime.value = periodSec
    const feedback = this.ctx.createGain()
    const harmonicPush = 0.78 + p.harmonics * 0.2 // keep base resonance musical
    const freqLoss = Math.max(0.8, 1 - freq * 0.0009) // higher pitches need more loss
    feedback.gain.value = Math.min(0.96, harmonicPush * freqLoss)
    const damp = this.ctx.createBiquadFilter()
    damp.type = 'lowpass'
    damp.frequency.value = 1000 + p.timbre * 8000
    damp.Q.value = 0
    const preHP = this.ctx.createBiquadFilter()
    preHP.type = 'highpass'
    preHP.frequency.value = 50 + p.morph * 400

    burst.connect(preHP).connect(delay).connect(out)
    delay.connect(damp).connect(feedback).connect(delay)
    out.gain.value = p.level
    burst.start()
    return {
      output: out as AudioNode,
      stop: (_t: number) => { /* one-shot */ },
      pitched: [],
    }
  }

  private makeVoice(freq: number) {
    const now = this.ctx.currentTime
    const env = this.patch.envelope

    const oscGain = this.ctx.createGain()
    oscGain.gain.value = 0
    oscGain.connect(this.filter)

    // Scale peak amplitude inversely with active voice load (sqrt keeps dynamics present)
    const activeVoiceCount = this.activeVoices.size
    const VOICE_GAIN_BASE = 0.65
    const voiceGainScale = VOICE_GAIN_BASE / Math.max(1, Math.sqrt(activeVoiceCount + 1))

    const clampOctave = (value: number | undefined) => {
      const n = Number(value ?? 0)
      if (!Number.isFinite(n)) return 0
      return Math.max(-3, Math.min(3, Math.round(n)))
    }
    const osc1Octave = clampOctave(this.patch.osc1.octave)
    const osc1Freq = freq * Math.pow(2, osc1Octave)

    const engineMode = this.patch.engineMode ?? 'classic'
    const fallbackMode = (mode: EngineMode) => (mode === 'macro' ? 'macro' : mode === 'sampler' ? 'sampler' : 'analog')
    const osc1Mode = this.patch.osc1.mode ?? fallbackMode(engineMode)
    const osc2Mode = this.patch.osc2.mode ?? fallbackMode(engineMode)

    // Sub-mix for two oscillators
    const sub1 = this.ctx.createGain()
    const sub2 = this.ctx.createGain()
    sub1.gain.value = 0
    sub2.gain.value = 0
    // Normal sum (so we can crossfade with ring product if enabled)
    const normalSum = this.ctx.createGain()
    normalSum.gain.value = 1
    sub1.connect(normalSum)
    sub2.connect(normalSum)
    normalSum.connect(oscGain)

    const mixBase = clampValue(this.patch.mix, 0, 1)
    const mixControl = this.ctx.createConstantSource()
    mixControl.offset.value = mixBase
    const mixBias = this.ctx.createConstantSource()
    mixBias.offset.value = 1
    const mixInvert = this.ctx.createGain()
    mixInvert.gain.value = -1
    mixControl.connect(sub2.gain)
    mixControl.connect(mixInvert)
    mixInvert.connect(sub1.gain)
    mixBias.connect(sub1.gain)
    mixControl.start()
    mixBias.start()

    const sources: AudioScheduledSourceNode[] = []
    let osc1Node: OscillatorNode | null = null
    let osc2Node: OscillatorNode | null = null
    let primarySource: AudioNode | null = null
    const lfoParamConnections: Array<{ g: GainNode; p: AudioParam }> = []
    const macroVoices: Array<{ output: AudioNode; stop: (t: number) => void; pitched?: OscillatorNode[] }> = []

    // Oscillator 1 (carrier)
    {
      if (osc1Mode === 'macro') {
        const macroSettings = this.patch.osc1.macro ?? this.patch.macro ?? DEFAULT_OSCILLATOR_MACRO
        const macro = this.buildMacroVoice(osc1Freq, macroSettings)
        macro.output.connect(sub1)
        macroVoices.push(macro)
        if (!primarySource) primarySource = macro.output
        if (macro.pitched && macro.pitched.length) {
          for (const osc of macro.pitched) {
            for (const l of this.lfos) {
              if (l.dest === 'pitch' && this.patch[(this.lfos.indexOf(l) === 0 ? 'lfo1' : 'lfo2') as 'lfo1' | 'lfo2']?.enabled) {
                l.gain.connect(osc.detune)
                lfoParamConnections.push({ g: l.gain, p: osc.detune })
              }
            }
          }
        }
      } else if (osc1Mode === 'sampler') {
        const sample = this.createSamplerSource(osc1Freq, 'osc1')
        if (sample) {
          sample.connect(sub1)
          sources.push(sample)
          primarySource = sample
        }
      } else {
        let s1: OscillatorNode | AudioBufferSourceNode | null = null
        if (this.patch.osc1.wave === 'noise') {
          const src = ensureManagedSource(this.ctx.createBufferSource())
          src.buffer = this.noiseBuffer!
          src.loop = true
          s1 = src
        } else if (this.patch.osc1.wave === 'sample') {
          s1 = this.createSamplerSource(osc1Freq, 'osc1')
        } else {
          const osc = ensureManagedSource(this.ctx.createOscillator())
          osc.type = this.patch.osc1.wave as OscillatorType
          osc.frequency.setValueAtTime(osc1Freq, now)
          const fine = this.patch.osc1.detuneFine ?? 0
          osc.detune.value = (this.patch.osc1.detune || 0) + fine
          s1 = osc
          osc1Node = osc
        }

        if (s1) {
          s1.connect(sub1)
          sources.push(s1)
          primarySource = s1
        }

        if (s1 && this.patch.fm.enabled && 'frequency' in (s1 as any)) {
          const carrier = s1 as OscillatorNode
          const mod = ensureManagedSource(this.ctx.createOscillator())
          mod.type = this.patch.osc2.wave as OscillatorType
          const ratio = Math.max(0.01, this.patch.fm.ratio || 1)
          mod.frequency.setValueAtTime(freq * ratio, now)
          mod.detune.value = this.patch.osc2.detune || 0
          const modGain = this.ctx.createGain()
          modGain.gain.value = Math.max(0, this.patch.fm.amount || 0)
          mod.connect(modGain)
          modGain.connect(carrier.frequency)
          sources.push(mod)
        }

        if (s1 && 'detune' in (s1 as any)) {
          for (const l of this.lfos) {
            if (l.dest === 'pitch' && this.patch[(this.lfos.indexOf(l) === 0 ? 'lfo1' : 'lfo2') as 'lfo1' | 'lfo2']?.enabled) {
              l.gain.connect((s1 as OscillatorNode).detune)
              lfoParamConnections.push({ g: l.gain, p: (s1 as OscillatorNode).detune })
            }
          }
        }
      }
    }

    // Oscillator 2
    {
      if (osc2Mode === 'macro') {
        const macroSettings = this.patch.osc2.macro ?? this.patch.macro ?? DEFAULT_OSCILLATOR_MACRO
        const macro = this.buildMacroVoice(freq, macroSettings)
        macro.output.connect(sub2)
        macroVoices.push(macro)
        if (macro.pitched && macro.pitched.length) {
          for (const osc of macro.pitched) {
            for (const l of this.lfos) {
              if (l.dest === 'pitch' && this.patch[(this.lfos.indexOf(l) === 0 ? 'lfo1' : 'lfo2') as 'lfo1' | 'lfo2']?.enabled) {
                l.gain.connect(osc.detune)
                lfoParamConnections.push({ g: l.gain, p: osc.detune })
              }
            }
          }
        }
      } else if (osc2Mode === 'sampler') {
        const sample = this.createSamplerSource(freq, 'osc2')
        if (sample) {
          sample.connect(sub2)
          sources.push(sample)
        }
      } else {
        let s2: OscillatorNode | AudioBufferSourceNode | null = null
        if (this.patch.osc2.wave === 'noise') {
          const src = ensureManagedSource(this.ctx.createBufferSource())
          src.buffer = this.noiseBuffer!
          src.loop = true
          s2 = src
        } else {
          const osc = ensureManagedSource(this.ctx.createOscillator())
          osc.type = this.patch.osc2.wave as OscillatorType
          osc.frequency.setValueAtTime(freq, now)
          osc.detune.value = this.patch.osc2.detune
          s2 = osc
          osc2Node = osc
        }

        if (s2) {
          s2.connect(sub2)
          sources.push(s2)
        }

        // Ring modulation: multiply s1 by s2 and crossfade with normal mix
        if (this.patch.ring.enabled && primarySource && s2) {
          const ringVca = this.ctx.createGain()
          ringVca.gain.value = 0 // remove DC offset so gain comes purely from modulator
          primarySource.connect(ringVca)
          // depth: modulator -> gain (audio-rate modulation)
          const depth = this.ctx.createGain()
          depth.gain.value = 1
          s2.connect(depth)
          depth.connect(ringVca.gain)

          // Crossfade between normal sum and ring product
          const amt = Math.max(0, Math.min(1, this.patch.ring.amount))
          normalSum.gain.value = 1 - amt
          const ringGain = this.ctx.createGain()
          ringGain.gain.value = amt
          ringVca.connect(ringGain)
          ringGain.connect(oscGain)
        }

        // LFOs to pitch (detune) for osc2 if applicable
        if (s2 && 'detune' in (s2 as any)) {
          for (const l of this.lfos) {
            if (l.dest === 'pitch' && this.patch[(this.lfos.indexOf(l) === 0 ? 'lfo1' : 'lfo2') as 'lfo1' | 'lfo2']?.enabled) {
              l.gain.connect((s2 as OscillatorNode).detune)
              lfoParamConnections.push({ g: l.gain, p: (s2 as OscillatorNode).detune })
            }
          }
        }
      }
    }

    // ADSR envelope
    const g = oscGain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(0, now)
    g.linearRampToValueAtTime(voiceGainScale, now + Math.max(0.001, env.attack))
    g.linearRampToValueAtTime(env.sustain * voiceGainScale, now + env.attack + Math.max(0.001, env.decay))

    // Sub oscillator: mixed into the same ADSR path
    if (this.patch.sub.enabled) {
      const subOsc = ensureManagedSource(this.ctx.createOscillator())
      subOsc.type = (this.patch.sub.wave || 'square') as OscillatorType
      const subFreq = freq / Math.pow(2, Math.max(1, Math.min(2, this.patch.sub.octave)))
      subOsc.frequency.setValueAtTime(subFreq, now)
      const subGain = this.ctx.createGain()
      subGain.gain.value = Math.max(0, Math.min(1, this.patch.sub.level))
      subOsc.connect(subGain)
      subGain.connect(oscGain)
      sources.push(subOsc)
      // Vibrato on sub
      for (const l of this.lfos) {
        if (l.dest === 'pitch' && this.patch[(this.lfos.indexOf(l) === 0 ? 'lfo1' : 'lfo2') as 'lfo1' | 'lfo2']?.enabled) {
          l.gain.connect(subOsc.detune)
          lfoParamConnections.push({ g: l.gain, p: subOsc.detune })
        }
      }
    }

    for (const s of sources) {
      if ('start' in s) {
        const node = ensureManagedSource(s)
        if (node._autoStarted) continue
        if (!node._started) {
          node.start()
          markSourceStarted(node)
        }
      }
    }

    const mixConnections: Array<{ sourceIndex: number; gain: GainNode }> = []

    const stop = (releaseTime: number) => {
      const t = Math.max(this.ctx.currentTime, releaseTime)
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(0, t + Math.max(0.001, env.release))
      for (const s of sources) {
        if ('stop' in s) {
          const node = ensureManagedSource(s)
          if (!node._started) continue
          try {
            node.stop(t + env.release + 0.05)
          } catch (error) {
            if (!(error instanceof DOMException)) {
              throw error
            }
          } finally {
            node._started = false
          }
        }
      }
      for (const macro of macroVoices) {
        try { macro.stop(t + env.release + 0.05) } catch {}
      }
      // Disconnect LFO param connections for this voice
      for (const c of lfoParamConnections) {
        try { c.g.disconnect(c.p) } catch {}
      }
      for (const conn of mixConnections) {
        const sourceNode = this.lfos[conn.sourceIndex]?.gain
        if (sourceNode) {
          try { sourceNode.disconnect(conn.gain) } catch {}
        }
        try { conn.gain.disconnect() } catch {}
      }
      try { mixControl.stop(t + env.release + 0.05) } catch {}
      try { mixBias.stop(t + env.release + 0.05) } catch {}
      try { mixControl.disconnect() } catch {}
      try { mixInvert.disconnect() } catch {}
      try { mixBias.disconnect() } catch {}
    }

    // Expose detune params for live updates (only if oscillators, not noise)
    const voiceHandle: ActiveVoice = {
      stop,
      mixControl,
      mixBias,
      mixConnections,
    }
    if (osc1Node) voiceHandle.osc1Detune = osc1Node.detune
    if (osc2Node) voiceHandle.osc2Detune = osc2Node.detune

    return voiceHandle
  }

  

  allNotesOff() {
    const t = this.ctx.currentTime
    for (const v of this.activeVoices.values()) v.stop(t)
    this.activeVoices.clear()
    this.activeNoteVelocities.clear()
    this.refreshVelocitySignals()
  }

  // --- Arpeggiator helpers ---
  private getArpChordOffsets() {
    const arp = this.patch.arp ?? defaultPatch.arp!
    const source = arp.chordSource ?? 'preset'
    if (source === 'sequencer') {
      const seq = this.patch.sequencer ?? defaultPatch.sequencer!
      const steps = seq.steps ?? []
      const length = Math.max(1, Math.min(steps.length, seq.length))
      const offsets = new Set<number>()
      for (let i = 0; i < length; i++) {
        const step = steps[i]
        if (step?.on) {
          const semis = Math.round(step.offset ?? 0)
          if (Number.isFinite(semis)) offsets.add(semis)
        }
      }
      if (offsets.size > 0) {
        return Array.from(offsets).sort((a, b) => a - b)
      }
      // Fall back to at least the pressed note if the sequence has no active steps
      return [0]
    }
    const chord = arp.chord ?? defaultPatch.arp!.chord ?? 'none'
    switch (chord) {
      case 'power': return [0, 7]
      case 'major': return [0, 4, 7]
      case 'minor': return [0, 3, 7]
      case 'sus2': return [0, 2, 7]
      case 'sus4': return [0, 5, 7]
      case 'maj7': return [0, 4, 7, 11]
      case 'min7': return [0, 3, 7, 10]
      default: return [0]
    }
  }

  private buildArpPool(): number[] {
    if (this.arpHeld.size === 0) return []
    const mode = this.patch.arp?.mode ?? 'up'

    // Special handling for sequence mode - play through sequencer pattern
    if (mode === 'sequence') {
      const seq = this.patch.sequencer ?? defaultPatch.sequencer!
      const steps = seq.steps ?? []
      const length = Math.max(1, Math.min(steps.length, seq.length))
      const base = Array.from(this.arpHeld.values()).sort((a, b) => a - b)
      const oct = Math.max(1, Math.min(4, this.patch.arp?.octaves ?? 1))
      const pool: number[] = []

      // Build pool by stepping through the sequence pattern
      // Use -1 to represent a rest/pause for steps that are OFF
      for (let i = 0; i < length; i++) {
        const step = steps[i]
        if (step?.on) {
          const offset = Math.round(step.offset ?? 0)
          for (let o = 0; o < oct; o++) {
            for (const n of base) {
              const midi = n + o * 12 + offset
              if (midi >= 0 && midi <= 127) {
                pool.push(midi)
              } else {
                pool.push(-1) // Rest if out of range
              }
            }
          }
        } else {
          // Step is OFF - add a rest for each octave/note combination
          for (let o = 0; o < oct; o++) {
            for (const n of base) {
              pool.push(-1) // Rest
            }
          }
        }
      }
      return pool
    }

    // Normal arp modes
    const base = mode === 'asplayed' ? Array.from(this.arpHeld.values()) : Array.from(this.arpHeld.values()).sort((a, b) => a - b)
    const oct = Math.max(1, Math.min(4, this.patch.arp?.octaves ?? 1))
    const pool: number[] = []
    const chordOffsets = this.getArpChordOffsets()
    for (let o = 0; o < oct; o++) {
      for (const n of base) {
        const root = n + o * 12
        for (const offset of chordOffsets) {
          const midi = root + offset
          if (midi < 0 || midi > 127) continue
          pool.push(midi)
        }
      }
    }
    if (mode === 'down') return pool.slice().sort((a, b) => b - a)
    if (mode === 'random') return pool.slice().sort(() => Math.random() - 0.5)
    if (mode === 'updown') {
      const up = pool.slice().sort((a, b) => a - b)
      const down = up.slice().reverse().slice(1, -1)
      return up.concat(down)
    }
    return pool
  }

  private updateArpScheduler(options: { forceRestart?: boolean } = {}) {
    const { forceRestart = false } = options
    const enabled = !!this.patch.arp?.enabled
    if (enabled && this.arpHeld.size > 0) {
      const shouldRestart = forceRestart || this.arpTimer == null
      if (shouldRestart && this.arpTimer != null) {
        clearTimeout(this.arpTimer)
        this.arpTimer = null
      }
      if (shouldRestart) {
        this.arpPhase = 0
        this.arpRepeatCounter = 0
        const baseStep = this.getArpStepMs()
        const alignedDelay = this.computeArpAlignmentDelay(baseStep)
        this.scheduleNextArpTick(alignedDelay)
      }
    } else {
      if (this.arpTimer != null) { clearTimeout(this.arpTimer); this.arpTimer = null }
      // stop any lingering gated note
      if (this.arpLastNote != null) {
        const toOff = this.arpLastNote
        this.arpBypass = true
        try { this.noteOff(toOff) } finally { this.arpBypass = false }
        this.arpLastNote = null
      }
      this.arpIndex = 0
      this.arpRepeatCounter = 0
    }
  }

  private computeArpAlignmentDelay(stepMs: number) {
    if (!(stepMs > 0)) return 0
    const nowMs = this.ctx.currentTime * 1000
    const remainder = nowMs % stepMs
    const epsilon = 1 // allow tiny timing drift without delaying a full step
    if (remainder < epsilon) return 0
    return stepMs - remainder
  }

  private scheduleNextArpTick(initialDelay?: number) {
    const base = this.getArpStepMs()
    // Swing only in BPM sync; scale by division (less swing for 1/16, none for triplets/quarters)
    let swing = 0
    if (this.patch.arp?.bpmSync) {
      const div = this.patch.arp?.division
      const raw = Math.max(0, Math.min(1, this.patch.arp?.swingPct ?? 0))
      if (div === '1/8') swing = raw
      else if (div === '1/16') swing = raw * 0.5
      else swing = 0 // 1/4 and triplets
    }
    // on-beat longer, off-beat shorter (classic swing)
    const factor = this.arpPhase === 0 ? 1 + swing * 0.5 : 1 - swing * 0.5
    const stepMs = base * factor
    const delay = initialDelay ?? stepMs
    this.arpCurrentStepMs = stepMs
    this.arpTimer = (setTimeout(() => {
      // If arp disabled mid-wait, abort
      if (!this.patch.arp?.enabled || this.arpHeld.size === 0) { this.updateArpScheduler(); return }
      this.arpTick()
      this.arpPhase = this.arpPhase ? 0 : 1
      this.scheduleNextArpTick()
    }, Math.max(0, delay)) as unknown) as number
  }

  private getArpStepMs() {
    const arp = this.patch.arp!
    if (arp?.bpmSync) {
      const bpm = Math.max(20, Math.min(300, arp.bpm || 120))
      const quarterMs = 60000 / bpm
      const div = arp.division || '1/8'
      const fraction = div === '1/4' ? 1
        : div === '1/8' ? 0.5
        : div === '1/8T' ? 1 / 3
        : div === '1/16' ? 0.25
        : /* '1/16T' */ 1 / 6
      return quarterMs * fraction
    } else {
      const rateHz = Math.max(0.1, arp?.rateHz ?? 8)
      return 1000 / rateHz
    }
  }

  private arpTick() {
    let pool = this.buildArpPool()
    if (pool.length === 0) {
      // nothing to play
      if (this.arpLastNote != null) {
        const toOff = this.arpLastNote
        this.arpBypass = true
        try { this.noteOff(toOff) } finally { this.arpBypass = false }
        this.arpLastNote = null
      }
      return
    }
    const maxLen = Math.max(0, this.patch.arp?.patternLen ?? 0)
    if (maxLen > 0 && pool.length > maxLen) pool = pool.slice(0, maxLen)
    // select next note
    if (this.arpIndex >= pool.length) this.arpIndex = 0
    const midi = pool[this.arpIndex++]
    const repeats = Math.max(1, Math.min(8, this.patch.arp?.repeats ?? 1))
    if (this.arpRepeatCounter < repeats - 1) {
      // stay on same index for more repeats
      this.arpIndex = (this.arpIndex - 1 + pool.length) % pool.length
      this.arpRepeatCounter++
    } else {
      this.arpRepeatCounter = 0
    }

    // Check if this is a rest (midi = -1 in sequence mode)
    const isRest = midi < 0

    // Stop previous note if gate < 1 or if this is a rest
    if (this.arpLastNote != null && (isRest || (this.patch.arp?.gate ?? 0.6) < 1)) {
      const toOff = this.arpLastNote
      this.arpBypass = true
      try { this.noteOff(toOff) } finally { this.arpBypass = false }
      this.arpLastNote = null
    }

    // If this is a rest, don't play a note
    if (isRest) {
      return
    }

    // Play now
    this.arpBypass = true
    try {
      this.noteOn(midi, 1)
    } finally {
      this.arpBypass = false
    }
    this.arpLastNote = midi

    // Schedule note off by gate fraction
    const stepMs = this.arpCurrentStepMs || this.getArpStepMs()
    const gate = Math.max(0.05, Math.min(1, this.patch.arp?.gate ?? 0.6))
    const offMs = stepMs * gate
    const toOff = midi
    setTimeout(() => {
      this.arpBypass = true
      try { this.noteOff(toOff) } finally { this.arpBypass = false }
    }, offMs)
  }

  getArpStatus() {
    const enabled = !!this.patch.arp?.enabled
    let len = 0
    let idx = 0
    if (enabled) {
      const poolLen = this.buildArpPool().length
      const maxLen = Math.max(0, this.patch.arp?.patternLen ?? 0)
      len = maxLen > 0 ? Math.min(maxLen, poolLen) : poolLen
      if (len <= 0) len = 0
      // Estimate current index as last played step
      if (len > 0) {
        const est = (this.arpIndex - 1 + len) % len
        idx = est < 0 ? 0 : est
      }
    }
    return { enabled, stepIndex: idx, length: len }
  }

  // --- Sequencer helpers ---
  private getSequencerProgression(mode?: string) {
    const id = typeof mode === 'string' && mode.length > 0 ? mode : 'static'
    return SEQUENCER_PROGRESSIONS.find((entry) => entry.id === id) ?? null
  }

  private getSequencerBaseRoot(seq: NonNullable<Patch['sequencer']>) {
    const raw = Number.isFinite(seq.grooveBaseMidi) ? seq.grooveBaseMidi! : seq.rootMidi
    const finite = Number.isFinite(raw) ? raw : defaultPatch.sequencer!.rootMidi
    return clampValue(Math.round(finite), 0, 127)
  }

  private resetSequencerProgression() {
    const seq = this.patch.sequencer!
    this.seqProgressionIndex = 0
    this.seqCurrentRoot = clampValue(seq.rootMidi ?? defaultPatch.sequencer!.rootMidi, 0, 127)
  }

  private advanceSequencerProgression() {
    const seq = this.patch.sequencer!
    const progression = this.getSequencerProgression(seq.progressionMode)
    if (!progression || progression.offsets.length === 0 || progression.id === 'static') {
      this.resetSequencerProgression()
      return
    }
    const baseRoot = this.getSequencerBaseRoot(seq)
    const offset = progression.offsets[this.seqProgressionIndex % progression.offsets.length]
    this.seqCurrentRoot = clampValue(baseRoot + offset, 0, 127)
    this.seqProgressionIndex = (this.seqProgressionIndex + 1) % progression.offsets.length
  }

  private getSeqStepMs() {
    const seq = this.patch.sequencer!
    const bpm = Math.max(20, Math.min(300, seq.bpm || 120))
    const quarterMs = 60000 / bpm
    const div = seq.division
    const fraction = div === '1/4' ? 1
      : div === '1/8' ? 0.5
      : div === '1/8T' ? 1 / 3
      : div === '1/16' ? 0.25
      : /* '1/16T' */ 1 / 6
    return quarterMs * fraction
  }

  private updateSeqScheduler() {
    const seq = this.patch.sequencer!
    const shouldRun = !!seq.enabled && !!seq.playing
    if (shouldRun) {
      if (this.seqTimer != null) { clearTimeout(this.seqTimer); this.seqTimer = null }
      this.seqPhase = 0
      this.seqStepIndex = 0
      this.seqProgressionIndex = 0
      this.seqCurrentRoot = clampValue(seq.rootMidi ?? defaultPatch.sequencer!.rootMidi, 0, 127)
      this.scheduleNextSeqTick()
    } else {
      if (this.seqTimer != null) { clearTimeout(this.seqTimer); this.seqTimer = null }
      if (this.seqLastNote != null) {
        const toOff = this.seqLastNote
        this.arpBypass = true
        try { this.noteOff(toOff) } finally { this.arpBypass = false }
        this.seqLastNote = null
      }
      this.updateControlSource('seqStep', 0)
      this.resetSequencerProgression()
    }
  }

  private scheduleNextSeqTick() {
    const base = this.getSeqStepMs()
    // Swing for sequencer; apply only to straight divisions (not triplets)
    const div = this.patch.sequencer?.division
    let swing = Math.max(0, Math.min(1, this.patch.sequencer?.swingPct ?? 0))
    if (div === '1/16') swing *= 0.5
    if (div === '1/8') swing = swing
    if (div === '1/4' || div?.endsWith('T')) swing = 0
    const factor = this.seqPhase === 0 ? 1 + swing * 0.5 : 1 - swing * 0.5
    const delay = base * factor
    this.seqCurrentStepMs = delay
    this.seqTimer = (setTimeout(() => {
      if (!this.patch.sequencer?.enabled || !this.patch.sequencer?.playing) { this.updateSeqScheduler(); return }
      this.seqTick()
      this.seqPhase = this.seqPhase ? 0 : 1
      this.scheduleNextSeqTick()
    }, delay) as unknown) as number
  }

  private seqTick() {
    const seq = this.patch.sequencer!
    const len = Math.max(1, Math.min(seq.steps.length, seq.length))
    const i = this.seqStepIndex % len
    const step = seq.steps[i] || { on: false, offset: 0, velocity: 1 }
    this.seqStepIndex = (this.seqStepIndex + 1) % len
    if (i === 0) {
      this.advanceSequencerProgression()
    }
    const rootMidi = clampValue(
      Number.isFinite(this.seqCurrentRoot) ? this.seqCurrentRoot : (seq.rootMidi ?? defaultPatch.sequencer!.rootMidi),
      0,
      127,
    )

    // Apply spice modulation (Minifreak-style randomization)
    const spiceAmount = clampValue(seq.spiceAmount ?? 0, 0, 1)
    let finalOffset = step.offset || 0
    let finalVelocity = step.velocity ?? 1
    let finalGate = seq.gate ?? 0.6
    let finalOn = step.on

    if (spiceAmount > 0 && seq.spiceSeed) {
      // Create seeded random generator for this step
      const rng = seededRandom(`${seq.spiceSeed}-${i}`)

      // Randomize offset (pitch) - can shift up to ±7 semitones
      const randomOffset = Math.floor(rng() * 15) - 7
      finalOffset = Math.round(finalOffset * (1 - spiceAmount) + randomOffset * spiceAmount)

      // Randomize velocity - vary by ±40%
      const randomVelocity = 0.6 + (rng() * 0.8)
      finalVelocity = clampValue(finalVelocity * (1 - spiceAmount) + randomVelocity * spiceAmount, 0, 1)

      // Randomize gate - vary between 0.2 and 1.0
      const randomGate = 0.2 + rng() * 0.8
      finalGate = clampValue(finalGate * (1 - spiceAmount) + randomGate * spiceAmount, 0.05, 1)

      // Occasionally mute steps at high spice amounts
      if (spiceAmount > 0.7 && rng() < 0.2 * spiceAmount) {
        finalOn = false
      }
    }

    // Stop previous sustained note if gate >= 1
    if (this.seqLastNote != null && finalGate >= 1) {
      const toOffPrev = this.seqLastNote
      this.arpBypass = true
      try { this.noteOff(toOffPrev) } finally { this.arpBypass = false }
      this.seqLastNote = null
    }

    if (finalOn) {
      const midi = Math.round(rootMidi + finalOffset)
      const velocity = clampValue(finalVelocity, 0, 1)
      // Trigger note bypassing ARP
      this.arpBypass = true
      try { this.noteOn(midi, velocity) } finally { this.arpBypass = false }
      this.seqLastNote = midi

      const token = ++this.seqControlToken
      this.updateControlSource('seqStep', velocity * 2 - 1)

      const gate = Math.max(0.05, Math.min(1, finalGate))
      const offMs = (this.seqCurrentStepMs || this.getSeqStepMs()) * gate
      setTimeout(() => {
        this.arpBypass = true
        try { this.noteOff(midi) } finally { this.arpBypass = false }
        if (this.seqControlToken === token) {
          this.updateControlSource('seqStep', 0)
        }
      }, offMs)
    } else {
      this.updateControlSource('seqStep', 0)
    }
  }

  getSequencerStatus() {
    const seq = this.patch.sequencer!
    const enabled = !!seq.enabled && !!seq.playing
    const length = Math.max(0, Math.min(seq.steps.length, seq.length))
    const stepIndex = enabled && length > 0 ? (this.seqStepIndex + length - 1) % length : 0
    const currentRoot = clampValue(
      Number.isFinite(this.seqCurrentRoot) ? this.seqCurrentRoot : (seq.rootMidi ?? defaultPatch.sequencer!.rootMidi),
      0,
      127,
    )
    return { enabled, stepIndex, length, currentRoot }
  }

  previewNote(midi: number, ms = 150) {
    this.arpBypass = true
    try { this.noteOn(midi, 1) } finally { this.arpBypass = false }
    setTimeout(() => {
      this.arpBypass = true
      try { this.noteOff(midi) } finally { this.arpBypass = false }
    }, Math.max(20, ms))
  }

  // Override noteOn/noteOff to integrate ARP
  noteOn(midi: number, velocity = 1) {
    if (this.patch.arp?.enabled && !this.arpBypass) {
      this.arpHeld.add(midi)
      this.updateArpScheduler()
      return
    }
    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    const voice = this.makeVoice(freq)
    this.activeVoices.set(midi, voice)
    const velNorm = clampValue(velocity, 0, 1)
    this.activeNoteVelocities.set(midi, velNorm)
    this.refreshVelocitySignals()
    this.refreshMixAudioConnections()
  }

  noteOff(midi: number) {
    if (this.patch.arp?.enabled && !this.arpBypass) {
      // In latch mode, ignore noteOff for held pool
      if (!this.patch.arp?.latch) {
        this.arpHeld.delete(midi)
        if (this.arpHeld.size === 0) this.updateArpScheduler()
      }
      // If the released key is the currently sounding one, stop it now
      if (this.arpLastNote === midi) {
        const v = this.activeVoices.get(midi)
        if (v) v.stop(this.ctx.currentTime)
        this.activeVoices.delete(midi)
        if (this.arpLastNote === midi) this.arpLastNote = null
      }
      return
    }
    const v = this.activeVoices.get(midi)
    if (v) {
      v.stop(this.ctx.currentTime)
      this.activeVoices.delete(midi)
    }
    if (!this.arpBypass) {
      this.activeNoteVelocities.delete(midi)
    } else {
      this.activeNoteVelocities.delete(midi)
    }
    this.refreshVelocitySignals()
  }

  arpClear() {
    // Clear latched held notes and stop scheduler
    this.arpHeld.clear()
    this.arpIndex = 0
    if (this.arpTimer != null) { clearInterval(this.arpTimer); this.arpTimer = null }
    if (this.arpLastNote != null) {
      const toOff = this.arpLastNote
      this.arpBypass = true
      try { this.noteOff(toOff) } finally { this.arpBypass = false }
      this.arpLastNote = null
    }
  }
}
