export type WaveType = 'sine' | 'square' | 'sawtooth' | 'triangle' | 'noise'

export type ADSR = {
  attack: number
  decay: number
  sustain: number
  release: number
}

export type MacroModel = 'va' | 'fold' | 'pluck' | 'supersaw' | 'pwm' | 'fm2op'

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
}

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
  private activeVoices = new Map<number, { stop: (t: number) => void }>()
  private fxInput: GainNode
  private fxOutput: GainNode
  private currentFxTap: AudioNode | null = null
  private lfos: Array<{ osc: OscillatorNode; gain: GainNode; dest: 'pitch' | 'filter' | 'amp' | 'none' }>
  patch: Patch

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
    this.master.connect(this.analyser)
    this.analyser.connect(this.ctx.destination)

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

  applyPatch(p: Partial<Patch> = {}) {
    this.patch = {
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
      effects: { ...(this.patch.effects ?? defaultPatch.effects!), ...(p.effects ?? {}) },
      lfo1: { ...(this.patch.lfo1 ?? defaultPatch.lfo1!), ...(p.lfo1 ?? {}) },
      lfo2: { ...(this.patch.lfo2 ?? defaultPatch.lfo2!), ...(p.lfo2 ?? {}) },
    }

    this.master.gain.value = this.patch.master.gain
    this.filter.type = this.patch.filter.type
    this.filter.Q.value = this.patch.filter.q
    this.filter.frequency.setTargetAtTime(this.patch.filter.cutoff, this.ctx.currentTime, 0.01)
    if (!this.noiseBuffer) this.noiseBuffer = createNoiseBuffer(this.ctx)

    // Rebuild FX chain on patch changes affecting effects
    this.buildFxChain()

    // Configure LFOs
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

    return { stop }
  }

  noteOn(midi: number) {
    const freq = 440 * Math.pow(2, (midi - 69) / 12)
    const voice = this.makeVoice(freq)
    this.activeVoices.set(midi, voice)
  }

  noteOff(midi: number) {
    const v = this.activeVoices.get(midi)
    if (v) {
      v.stop(this.ctx.currentTime)
      this.activeVoices.delete(midi)
    }
  }

  allNotesOff() {
    const t = this.ctx.currentTime
    for (const v of this.activeVoices.values()) v.stop(t)
    this.activeVoices.clear()
  }
}
