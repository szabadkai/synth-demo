import type { ExpressionTarget } from './expressionTargets'

export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise'

export type ADSR = {
  attack: number
  decay: number
  sustain: number
  release: number
}

export type MacroModel = 'va' | 'fold' | 'pluck' | 'supersaw' | 'pwm' | 'fm2op' | 'wavetable' | 'harmonic' | 'chord'

export type Patch = {
  osc1: { wave: WaveType; detune: number; finePct?: number }
  osc2: { wave: WaveType; detune: number }
  mix: number // 0 = osc1 only, 1 = osc2 only
  fm: { enabled: boolean; ratio: number; amount: number } // amount in Hz added to carrier freq
  sub: { enabled: boolean; octave: 1 | 2; level: number; wave?: Exclude<WaveType, 'noise'> }
  ring: { enabled: boolean; amount: number } // amount 0..1 crossfade between normal and ring product
  filter: { type: BiquadFilterType; cutoff: number; q: number }
  envelope: ADSR
  master: { gain: number }
  // Macro (Plaits-like) engine
  engineMode?: 'classic' | 'macro'
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
  lfo1?: { enabled: boolean; wave: Exclude<WaveType, 'noise'>; rateHz: number; amount: number; dest: 'pitch' | 'filter' | 'amp' }
  lfo2?: { enabled: boolean; wave: Exclude<WaveType, 'noise'>; rateHz: number; amount: number; dest: 'pitch' | 'filter' | 'amp' }
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
    mode: 'up' | 'down' | 'updown' | 'random' | 'asplayed'
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
    steps: Array<{ on: boolean; offset: number; velocity: number }>
  }
  expression?: {
    x: ExpressionTarget
    y: ExpressionTarget
  }
}

export const defaultPatch: Patch = {
  osc1: { wave: 'sawtooth', detune: 0, finePct: 0 },
  osc2: { wave: 'square', detune: 0 },
  mix: 0.0,
  fm: { enabled: false, ratio: 2.0, amount: 0 },
  sub: { enabled: false, octave: 1, level: 0.0, wave: 'square' },
  ring: { enabled: false, amount: 1.0 },
  filter: { type: 'lowpass', cutoff: 1200, q: 0.8 },
  envelope: { attack: 0.01, decay: 0.2, sustain: 0.7, release: 0.3 },
  master: { gain: 0.2 },
  engineMode: 'classic',
  macro: { model: 'va', harmonics: 0.6, timbre: 0.5, morph: 0.5, level: 1.0 },
  effects: {
    delay: { enabled: false, time: 0.25, feedback: 0.3, mix: 0.2 },
    reverb: { enabled: false, size: 0.5, decay: 0.5, mix: 0.25 },
  },
  lfo1: { enabled: false, wave: 'sine', rateHz: 5, amount: 0.2, dest: 'pitch' },
  lfo2: { enabled: false, wave: 'triangle', rateHz: 0.5, amount: 0.4, dest: 'filter' },
  arp: { enabled: false, rateHz: 8, bpmSync: false, bpm: 120, division: '1/8', gate: 0.6, mode: 'up', octaves: 1, chord: 'none', latch: false, swingPct: 0, repeats: 1, patternLen: 0 },
  sequencer: {
    enabled: false,
    playing: false,
    bpm: 120,
    division: '1/16',
    swingPct: 0,
    gate: 0.6,
    rootMidi: 60,
    length: 16,
    steps: Array.from({ length: 16 }, () => ({ on: false, offset: 0, velocity: 1 })),
  },
  expression: { x: 'filter.cutoff', y: 'master.gain' },
}

type ExpressionTargetDefinition = {
  getBase: (engine: SynthEngine) => number
  range: (engine: SynthEngine, base: number) => { min: number; max: number }
  apply: (engine: SynthEngine, value: number) => void
}

const ensureFinite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

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

export class SynthEngine {
  private ctx: AudioContext
  private master: GainNode
  private filter: BiquadFilterNode
  private analyser: AnalyserNode
  private noiseBuffer?: AudioBuffer
  private activeVoices = new Map<number, { stop: (t: number) => void; osc1Detune?: AudioParam; osc2Detune?: AudioParam }>()
  private fxInput: GainNode
  private fxOutput: GainNode
  private currentFxTap: AudioNode | null = null
  private lfos: Array<{ osc: OscillatorNode; gain: GainNode; dest: 'pitch' | 'filter' | 'amp' | 'none' }>
  private expression2D: { active: boolean; x: number; y: number } = { active: false, x: 0.5, y: 0.5 }
  private expressionAxisTargets: Record<ExpressionAxis, ExpressionTarget> = {
    x: defaultPatch.expression!.x,
    y: defaultPatch.expression!.y,
  }
  private expressionSnapshot: Record<ExpressionAxis, number | null> = { x: null, y: null }
  private expressionApplying = false
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

  constructor(ctx?: AudioContext) {
    this.ctx = ctx ?? new (window.AudioContext || (window as any).webkitAudioContext)()
    this.master = this.ctx.createGain()
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
      this.lfos.push({ osc, gain: g, dest: 'none' })
    }

    this.patch = { ...defaultPatch }
    this.applyPatch()
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

  applyPatch(p: DeepPartial<Patch> = {}, options: { fromExpression?: boolean } = {}) {
    const { fromExpression = false } = options
    const prev = this.patch
    const next: Patch = {
      ...this.patch,
      ...p,
      osc1: { ...this.patch.osc1, ...(p.osc1 ?? {}) },
      osc2: { ...this.patch.osc2, ...(p.osc2 ?? {}) },
      fm: { ...this.patch.fm, ...(p.fm ?? {}) },
      sub: { ...this.patch.sub, ...(p.sub ?? {}) },
      ring: { ...this.patch.ring, ...(p.ring ?? {}) },
      filter: { ...this.patch.filter, ...(p.filter ?? {}) },
      envelope: { ...this.patch.envelope, ...(p.envelope ?? {}) },
      master: { ...this.patch.master, ...(p.master ?? {}) },
      mix: p.mix != null ? p.mix : this.patch.mix,
      engineMode: p.engineMode ?? this.patch.engineMode ?? 'classic',
      macro: { ...(this.patch.macro ?? defaultPatch.macro!), ...(p.macro ?? {}) },
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
    }
    this.patch = next

    this.configureExpressionRouting(next.expression)

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
        node.osc.type = (pLfo.wave as OscillatorType)
        node.osc.frequency.setValueAtTime(Math.max(0.01, pLfo.rateHz), this.ctx.currentTime)
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
    }

    // Reconfigure arpeggiator/sequencer only when those sections changed
    if (p.arp !== undefined) this.updateArpScheduler({ forceRestart: true })
    if (p.sequencer !== undefined) this.updateSeqScheduler()

    // Live-detune updates for currently playing voices
    if (p.osc1?.detune !== undefined || p.osc1?.finePct !== undefined) {
      const now = this.ctx.currentTime
      const coarse = next.osc1.detune || 0
      const finePct = (next.osc1.finePct ?? 0) / 100
      const delta = Math.abs(coarse) * 0.05 * finePct
      const effectiveDetune = coarse + delta
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
    }
  }

  private configureExpressionRouting(expression = this.patch.expression ?? defaultPatch.expression!) {
    const fallback = defaultPatch.expression ?? { x: 'filter.cutoff', y: 'master.gain' }
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

  private createMacroSuperSaw(freq: number, p: NonNullable<Patch['macro']>) {
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

  private createMacroWavetable(freq: number, p: NonNullable<Patch['macro']>) {
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

  private createMacroHarmonic(freq: number, p: NonNullable<Patch['macro']>) {
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

  private createMacroChord(freq: number, p: NonNullable<Patch['macro']>) {
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

  private createMacroPWM(freq: number, p: NonNullable<Patch['macro']>) {
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

  private createMacroFM2Op(freq: number, p: NonNullable<Patch['macro']>) {
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

  private createMacroVA(freq: number, p: NonNullable<Patch['macro']>) {
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

  private createMacroFold(freq: number, p: NonNullable<Patch['macro']>) {
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

  private createMacroPluck(freq: number, p: NonNullable<Patch['macro']>) {
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
    feedback.gain.value = 0.85 + p.harmonics * 0.14
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

    // Macro engine path
    if ((this.patch.engineMode ?? 'classic') === 'macro' && this.patch.macro) {
      const p = this.patch.macro
      let macro: { output: AudioNode; stop: (t: number) => void; pitched?: OscillatorNode[] }
      switch (p.model) {
        case 'fold':
          macro = this.createMacroFold(freq, p)
          break
        case 'pluck':
          macro = this.createMacroPluck(freq, p)
          break
        case 'supersaw':
          macro = this.createMacroSuperSaw(freq, p)
          break
        case 'pwm':
          macro = this.createMacroPWM(freq, p)
          break
        case 'fm2op':
          macro = this.createMacroFM2Op(freq, p)
          break
        case 'wavetable':
          macro = this.createMacroWavetable(freq, p)
          break
        case 'harmonic':
          macro = this.createMacroHarmonic(freq, p)
          break
        case 'chord':
          macro = this.createMacroChord(freq, p)
          break
        case 'va':
        default:
          macro = this.createMacroVA(freq, p)
          break
      }
      macro.output.connect(oscGain)

      // Connect LFOs to any pitched oscillators
      const lfoParamConnections: Array<{ g: GainNode; p: AudioParam }> = []
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

      // ADSR envelope
      const g = oscGain.gain
      g.cancelScheduledValues(now)
      g.setValueAtTime(0, now)
      g.linearRampToValueAtTime(1, now + Math.max(0.001, env.attack))
      g.linearRampToValueAtTime(env.sustain, now + env.attack + Math.max(0.001, env.decay))

      const stop = (releaseTime: number) => {
        const t = Math.max(this.ctx.currentTime, releaseTime)
        g.cancelScheduledValues(t)
        g.setValueAtTime(g.value, t)
        g.linearRampToValueAtTime(0, t + Math.max(0.001, env.release))
        macro.stop(t + env.release + 0.05)
        for (const c of lfoParamConnections) { try { c.g.disconnect(c.p) } catch {} }
      }
      return { stop }
    }

    // Sub-mix for two oscillators
  const sub1 = this.ctx.createGain()
  const sub2 = this.ctx.createGain()
    const mix = Math.max(0, Math.min(1, this.patch.mix))
    sub1.gain.value = 1 - mix
    sub2.gain.value = mix
  // Normal sum (so we can crossfade with ring product if enabled)
  const normalSum = this.ctx.createGain()
  normalSum.gain.value = 1
  sub1.connect(normalSum)
  sub2.connect(normalSum)
  normalSum.connect(oscGain)

  const sources: Array<OscillatorNode | AudioBufferSourceNode> = []
  let osc1Node: OscillatorNode | null = null
  let osc2Node: OscillatorNode | null = null
  const lfoParamConnections: Array<{ g: GainNode; p: AudioParam }> = []

    // Oscillator 1 (carrier)
    {
      let s1: OscillatorNode | AudioBufferSourceNode
      if (this.patch.osc1.wave === 'noise') {
        const src = this.ctx.createBufferSource()
        src.buffer = this.noiseBuffer!
        src.loop = true
        s1 = src
      } else {
        const osc = this.ctx.createOscillator()
        osc.type = this.patch.osc1.wave as OscillatorType
        osc.frequency.setValueAtTime(freq, now)
        const coarse = this.patch.osc1.detune || 0
        const finePct = (this.patch.osc1.finePct ?? 0) / 100 // -1..1
        const delta = Math.abs(coarse) * 0.05 * finePct
        const effectiveDetune = coarse + delta
        osc.detune.value = effectiveDetune
        s1 = osc
        osc1Node = osc
  }
      s1.connect(sub1)
      sources.push(s1)

      // FM: use osc2 as modulator on carrier frequency (if carrier supports frequency param)
      if (this.patch.fm.enabled && 'frequency' in (s1 as any)) {
        const carrier = s1 as OscillatorNode
        const mod = this.ctx.createOscillator()
        mod.type = this.patch.osc2.wave as OscillatorType
        const ratio = Math.max(0.01, this.patch.fm.ratio || 1)
        mod.frequency.setValueAtTime(freq * ratio, now)
        mod.detune.value = this.patch.osc2.detune || 0
        const modGain = this.ctx.createGain()
        modGain.gain.value = Math.max(0, this.patch.fm.amount || 0) // Hz
        mod.connect(modGain)
        modGain.connect(carrier.frequency)
        sources.push(mod)
      }

      // LFOs to pitch (detune in cents)
      if ('detune' in (s1 as any)) {
        for (const l of this.lfos) {
          if (l.dest === 'pitch' && this.patch[(this.lfos.indexOf(l) === 0 ? 'lfo1' : 'lfo2') as 'lfo1' | 'lfo2']?.enabled) {
            l.gain.connect((s1 as OscillatorNode).detune)
            lfoParamConnections.push({ g: l.gain, p: (s1 as OscillatorNode).detune })
          }
        }
      }
    }

    // Oscillator 2
    {
      let s2: OscillatorNode | AudioBufferSourceNode
      if (this.patch.osc2.wave === 'noise') {
        const src = this.ctx.createBufferSource()
        src.buffer = this.noiseBuffer!
        src.loop = true
        s2 = src
      } else {
        const osc = this.ctx.createOscillator()
        osc.type = this.patch.osc2.wave as OscillatorType
        osc.frequency.setValueAtTime(freq, now)
        osc.detune.value = this.patch.osc2.detune
        s2 = osc
        osc2Node = osc
      }
  s2.connect(sub2)
      sources.push(s2)

      // Ring modulation: multiply s1 by s2 and crossfade with normal mix
      if (this.patch.ring.enabled) {
        const ringVca = this.ctx.createGain()
        ringVca.gain.value = 0 // remove DC offset so gain comes purely from modulator
        // connect carrier to VCA input
        ;(sources[0] as AudioNode).connect(ringVca)
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
      if ('detune' in (s2 as any)) {
        for (const l of this.lfos) {
          if (l.dest === 'pitch' && this.patch[(this.lfos.indexOf(l) === 0 ? 'lfo1' : 'lfo2') as 'lfo1' | 'lfo2']?.enabled) {
            l.gain.connect((s2 as OscillatorNode).detune)
            lfoParamConnections.push({ g: l.gain, p: (s2 as OscillatorNode).detune })
          }
        }
      }
    }

    // ADSR envelope
    const g = oscGain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(0, now)
    g.linearRampToValueAtTime(1, now + Math.max(0.001, env.attack))
    g.linearRampToValueAtTime(env.sustain, now + env.attack + Math.max(0.001, env.decay))

    for (const s of sources) {
      if ('start' in s) (s as any).start()
    }

    // Sub oscillator: mixed into the same ADSR path
    if (this.patch.sub.enabled) {
      const subOsc = this.ctx.createOscillator()
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

    const stop = (releaseTime: number) => {
      const t = Math.max(this.ctx.currentTime, releaseTime)
      g.cancelScheduledValues(t)
      g.setValueAtTime(g.value, t)
      g.linearRampToValueAtTime(0, t + Math.max(0.001, env.release))
      for (const s of sources) {
        if ('stop' in s) (s as any).stop(t + env.release + 0.05)
      }
      // Disconnect LFO param connections for this voice
      for (const c of lfoParamConnections) {
        try { c.g.disconnect(c.p) } catch {}
      }
    }

    // Expose detune params for live updates (only if oscillators, not noise)
    const voiceHandle: { stop: (t: number) => void; osc1Detune?: AudioParam; osc2Detune?: AudioParam } = { stop }
    if (osc1Node) voiceHandle.osc1Detune = osc1Node.detune
    if (osc2Node) voiceHandle.osc2Detune = osc2Node.detune

    return voiceHandle
  }

  

  allNotesOff() {
    const t = this.ctx.currentTime
    for (const v of this.activeVoices.values()) v.stop(t)
    this.activeVoices.clear()
  }

  // --- Arpeggiator helpers ---
  private getArpChordOffsets() {
    const chord = this.patch.arp?.chord ?? defaultPatch.arp!.chord ?? 'none'
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

    // Stop previous if gate < 1 (avoid overhang). We'll still allow envelope release.
    if (this.arpLastNote != null && (this.patch.arp?.gate ?? 0.6) >= 1) {
      // keep sustained until next explicit stop
    }

    // Play now
    this.arpBypass = true
    try {
      this.noteOn(midi)
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
      this.scheduleNextSeqTick()
    } else {
      if (this.seqTimer != null) { clearTimeout(this.seqTimer); this.seqTimer = null }
      if (this.seqLastNote != null) {
        const toOff = this.seqLastNote
        this.arpBypass = true
        try { this.noteOff(toOff) } finally { this.arpBypass = false }
        this.seqLastNote = null
      }
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

    // Stop previous sustained note if gate >= 1
    if (this.seqLastNote != null && (seq.gate ?? 0.6) >= 1) {
      const toOffPrev = this.seqLastNote
      this.arpBypass = true
      try { this.noteOff(toOffPrev) } finally { this.arpBypass = false }
      this.seqLastNote = null
    }

    if (step.on) {
      const midi = Math.round((seq.rootMidi || 60) + (step.offset || 0))
      // Trigger note bypassing ARP
      this.arpBypass = true
      try { this.noteOn(midi) } finally { this.arpBypass = false }
      this.seqLastNote = midi

      const gate = Math.max(0.05, Math.min(1, seq.gate ?? 0.6))
      const offMs = (this.seqCurrentStepMs || this.getSeqStepMs()) * gate
      setTimeout(() => {
        this.arpBypass = true
        try { this.noteOff(midi) } finally { this.arpBypass = false }
      }, offMs)
    }
  }

  getSequencerStatus() {
    const seq = this.patch.sequencer!
    const enabled = !!seq.enabled && !!seq.playing
    const length = Math.max(0, Math.min(seq.steps.length, seq.length))
    const stepIndex = enabled && length > 0 ? (this.seqStepIndex + length - 1) % length : 0
    return { enabled, stepIndex, length }
  }

  previewNote(midi: number, ms = 150) {
    this.arpBypass = true
    try { this.noteOn(midi) } finally { this.arpBypass = false }
    setTimeout(() => {
      this.arpBypass = true
      try { this.noteOff(midi) } finally { this.arpBypass = false }
    }, Math.max(20, ms))
  }

  // Override noteOn/noteOff to integrate ARP
  noteOn(midi: number) {
    if (this.patch.arp?.enabled && !this.arpBypass) {
      this.arpHeld.add(midi)
      this.updateArpScheduler()
      return
    }
    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    const voice = this.makeVoice(freq)
    this.activeVoices.set(midi, voice)
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
