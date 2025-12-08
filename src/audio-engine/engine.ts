import {
  ADSR,
  defaultPatch,
  EngineMode,
  ExpressionTarget,
  ExpressionAxis, // Added
  EXPRESSION_AXES, // Added
  LfoWave,
  MacroModel,
  MacroSettings,
  ModMatrixRow,
  ModSource,
  ModTarget,
  normalizeOscillatorConfig,
  OscillatorConfig,
  Patch,
  SamplerSettings,
  SequencerStep,
  WaveType,
  MAX_SEQUENCER_STEPS,
  SEQUENCER_PROGRESSIONS,
  createEmptySequencerStep,
  DEFAULT_OSCILLATOR_MACRO,
  DEFAULT_OSCILLATOR_SAMPLER,
} from './types'
import {
  clampValue,
  createNoiseBuffer,
  ensureFinite,
  ensureManagedSource,
  isAudioSource,
  isAudioTarget,
  isControlSource,
  ManagedSourceNode,
  markSourceAutoStarted,
  markSourceStarted,
  seededRandom
} from './utils'
import { SamplerContext, Voice } from './Voice'
import { phaseVocoderPitchShift } from './phaseVocoder'

// Re-export types associated with the engine
export type {
  Patch,
  ModSource,
  ModTarget,
  ModMatrixRow,
  SequencerStep,
  ADSR,
  WaveType,
  LfoWave,
  MacroModel,
  SamplerSettings,
  OscillatorConfig,
  EngineMode,
  OscillatorMode,
} from './types'

// Re-export values used by UI
export {
  defaultPatch,
  MAX_SEQUENCER_STEPS,
  SEQUENCER_PROGRESSIONS,
  createEmptySequencerStep,
  DEFAULT_OSCILLATOR_MACRO,
  DEFAULT_OSCILLATOR_SAMPLER,
  normalizeOscillatorConfig,
} from './types'

type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T

type ExpressionTargetDefinition = {
  getBase: (engine: SynthEngine) => number
  range: (engine: SynthEngine, base: number) => { min: number; max: number }
  apply: (engine: SynthEngine, value: number) => void
}

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



export class SynthEngine {
  private ctx: AudioContext
  private master: GainNode
  private filter: BiquadFilterNode
  private analyser: AnalyserNode
  private noiseBuffer?: AudioBuffer
  private activeVoices = new Map<number, Voice>()
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

    const start = this.samplerMeta.trimStartSec ?? 0
    const end = this.samplerMeta.trimEndSec ?? this.samplerBuffer.duration
    const duration = Math.max(0.05, end - start)

    const source = ensureManagedSource(this.ctx.createBufferSource())
    source.buffer = this.samplerBuffer
    
    // Connect to master directly (raw preview)
    const gain = this.ctx.createGain()
    gain.gain.value = 0.8
    source.connect(gain)
    gain.connect(this.master)
    
    const now = this.ctx.currentTime
    source.start(now, start, duration)
    
    const cleanup = () => {
        try { source.stop() } catch {}
        try { source.disconnect() } catch {}
        try { gain.disconnect() } catch {}
    }
    
    source.addEventListener('ended', cleanup, { once: true })
    setTimeout(cleanup, duration * 1000 + 200)
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

  allNotesOff() {
    const t = this.ctx.currentTime
    for (const v of this.activeVoices.values()) {
        try {
            v.stop(t, 0.1)
        } catch {}
    }
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

    // Stop existing voice if any
    const existing = this.activeVoices.get(midi)
    if (existing) {
      try { existing.stop(this.ctx.currentTime, 0.05) } catch {}
      this.activeVoices.delete(midi)
    }

    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    
    // Create SamplerContext
    const samplerContext: SamplerContext = {
      buffer: this.samplerBuffer,
      meta: { 
          id: this.samplerMeta.id || null, 
          dataUrl: this.samplerMeta.dataUrl || null,
          trimStartSec: this.samplerMeta.trimStartSec,
          trimEndSec: this.samplerMeta.trimEndSec,
          rootMidi: this.samplerMeta.rootMidi ?? 60, 
          loop: !!this.samplerMeta.loop 
      },
      pitchCache: this.samplerPitchCache
    }

    // Build LFO gains structure
    const lfos = {
      lfo1: { gain: this.lfos[0].gain, enabled: !!this.patch.lfo1?.enabled, dest: this.lfos[0].dest },
      lfo2: { gain: this.lfos[1].gain, enabled: !!this.patch.lfo2?.enabled, dest: this.lfos[1].dest },
    }

    const voice = new Voice(
      this.ctx,
      this.filter, // Connected to filter
      freq,
      this.patch,
      this.noiseBuffer,
      samplerContext,
      this.activeVoices.size,
      lfos
    )

    this.activeVoices.set(midi, voice)
    
    // Register velocity
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
        if (v) {
            try { v.stop(this.ctx.currentTime, this.patch.envelope.release) } catch {}
        }
        this.activeVoices.delete(midi)
        if (this.arpLastNote === midi) this.arpLastNote = null
      }
      return
    }
    const v = this.activeVoices.get(midi)
    if (v) {
      try { v.stop(this.ctx.currentTime, this.patch.envelope.release) } catch {}
      this.activeVoices.delete(midi)
    }
    if (!this.arpBypass) {
      this.activeNoteVelocities.delete(midi)
    } else {
      this.activeNoteVelocities.delete(midi) // Same? 
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
