
import { MacroSettings } from './types'

export type MacroVoiceHandle = {
  output: AudioNode
  stop: (t: number) => void
  pitched?: OscillatorNode[]
}

function makeWavefolderCurve(amount: number, symmetry: number, size = 2048) {
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

function createMacroVA(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const oscSaw = ctx.createOscillator()
  const oscTri = ctx.createOscillator()
  oscSaw.type = 'sawtooth'
  oscTri.type = 'triangle'
  oscSaw.frequency.value = freq
  oscTri.frequency.value = freq

  const triGain = ctx.createGain()
  const sawGain = ctx.createGain()
  triGain.gain.value = 1 - p.timbre
  sawGain.gain.value = p.timbre
  const mix = ctx.createGain()
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1000 + p.harmonics * 15000
  tone.Q.value = 0.5

  oscTri.connect(triGain).connect(mix)
  oscSaw.connect(sawGain).connect(mix)
  mix.connect(tone)

  oscTri.start()
  oscSaw.start()

  return {
    output: tone,
    stop: (t: number) => {
      try { oscTri.stop(t) } catch {}
      try { oscSaw.stop(t) } catch {}
    },
    pitched: [oscTri, oscSaw],
  }
}

function createMacroFold(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const osc = ctx.createOscillator()
  osc.type = 'sine'
  osc.frequency.value = freq
  const pre = ctx.createGain()
  const shaper = ctx.createWaveShaper()
  const post = ctx.createGain()

  const drive = 0.2 + p.harmonics * 1.6
  const symmetry = p.morph
  shaper.curve = makeWavefolderCurve(drive, symmetry)
  shaper.oversample = '4x'

  pre.gain.value = 1
  post.gain.value = p.level
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 4000 + p.timbre * 16000
  tone.Q.value = 0.2

  osc.connect(pre).connect(shaper).connect(tone).connect(post)
  osc.start()
  return {
    output: post,
    stop: (t: number) => { try { osc.stop(t) } catch {} },
    pitched: [osc],
  }
}

function createMacroPluck(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const out = ctx.createGain()
  const burst = ctx.createBufferSource()
  const len = Math.floor(ctx.sampleRate * 0.02)
  const buf = ctx.createBuffer(1, len, ctx.sampleRate)
  const ch = buf.getChannelData(0)
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / len)
  burst.buffer = buf
  burst.loop = false

  const periodSec = 1 / Math.max(20, freq)
  const delay = ctx.createDelay(1.0)
  delay.delayTime.value = periodSec
  const feedback = ctx.createGain()
  const harmonicPush = 0.78 + p.harmonics * 0.2
  const freqLoss = Math.max(0.8, 1 - freq * 0.0009)
  feedback.gain.value = Math.min(0.96, harmonicPush * freqLoss)
  const damp = ctx.createBiquadFilter()
  damp.type = 'lowpass'
  damp.frequency.value = 1000 + p.timbre * 8000
  damp.Q.value = 0
  const preHP = ctx.createBiquadFilter()
  preHP.type = 'highpass'
  preHP.frequency.value = 50 + p.morph * 400

  burst.connect(preHP).connect(delay).connect(out)
  delay.connect(damp).connect(feedback).connect(delay)
  out.gain.value = p.level
  burst.start()
  return {
    output: out,
    stop: (_t: number) => { /* one-shot */ },
    pitched: [],
  }
}

function createMacroSuperSaw(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const NUM = 6
  const mix = ctx.createGain()
  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 800 + p.timbre * 12000
  tone.Q.value = 0.3

  const spreadCents = 0 + p.harmonics * 30
  const pattern = [-1, -0.6, -0.2, 0.2, 0.6, 1]
  const voices: { osc: OscillatorNode; pan: StereoPannerNode }[] = []
  
  for (let i = 0; i < NUM; i++) {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.value = freq
    osc.detune.value = pattern[i] * spreadCents
    const g = ctx.createGain()
    g.gain.value = 1 / NUM
    const pan = ctx.createStereoPanner()
    const spread = (p.morph - 0.5) * 2
    const voicePan = (pattern[i] / Math.max(1, Math.max(...pattern.map(Math.abs)))) * spread
    pan.pan.value = voicePan
    osc.connect(g).connect(pan).connect(mix)
    voices.push({ osc, pan })
    osc.start()
  }

  mix.connect(tone)
  const out = ctx.createGain()
  out.gain.value = p.level
  tone.connect(out)

  return {
    output: out,
    stop: (t: number) => voices.forEach(({ osc }) => { try { osc.stop(t) } catch {} }),
    pitched: voices.map(v => v.osc),
  }
}

function createMacroPWM(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const saw = ctx.createOscillator()
  saw.type = 'sawtooth'
  saw.frequency.value = freq

  const sum = ctx.createGain()
  sum.gain.value = 1
  const dc = ctx.createConstantSource()
  const shift = (p.morph - 0.5) * 1.6
  dc.offset.value = shift
  dc.start()

  saw.connect(sum)
  dc.connect(sum)

  const shaper = ctx.createWaveShaper()
  const k = 1 + p.harmonics * 24
  const size = 2048
  const curve = new Float32Array(size)
  for (let i = 0; i < size; i++) {
    const x = (i / (size - 1)) * 2 - 1
    curve[i] = Math.tanh(k * x)
  }
  shaper.curve = curve
  shaper.oversample = '4x'

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 2000 + p.timbre * 14000
  tone.Q.value = 0.2

  const out = ctx.createGain()
  out.gain.value = p.level

  sum.connect(shaper).connect(tone).connect(out)
  saw.start()
  return {
    output: out,
    stop: (t: number) => { 
      try { saw.stop(t) } catch {}
      try { dc.stop(t) } catch {}
    },
    pitched: [saw],
  }
}

function createMacroFM2Op(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const carrier = ctx.createOscillator()
  carrier.type = 'sine'
  carrier.frequency.value = freq

  const mod = ctx.createOscillator()
  mod.type = 'sine'
  const ratio = 0.25 + p.harmonics * 7.75
  mod.frequency.value = freq * ratio

  const amt = ctx.createGain()
  amt.gain.value = Math.max(0, p.timbre) * freq * 2
  mod.connect(amt).connect(carrier.frequency)

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  tone.frequency.value = 1000 + p.morph * 15000
  tone.Q.value = 0.1

  const out = ctx.createGain()
  out.gain.value = p.level
  carrier.connect(tone).connect(out)

  carrier.start()
  mod.start()
  return {
    output: out,
    stop: (t: number) => { 
      try { carrier.stop(t) } catch {}
      try { mod.stop(t) } catch {}
    },
    pitched: [carrier],
  }
}

function createMacroWavetable(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const shapes: OscillatorType[] = ['sine', 'triangle', 'sawtooth', 'square']
  const seg = Math.min(3, Math.max(0, Math.floor(p.morph * 3.00001)))
  const t = Math.min(1, Math.max(0, p.morph * 3 - seg))

  const make = (type: OscillatorType, gain: number) => {
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.value = freq
    const g = ctx.createGain(); g.gain.value = gain
    osc.connect(g)
    return { osc, g }
  }
  const a = make(shapes[seg], seg === 3 ? 1 : 1 - t)
  const b = seg < 3 ? make(shapes[seg + 1], t) : null

  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'
  tone.frequency.value = 800 + p.harmonics * 15000
  tone.Q.value = 0.1 + p.timbre * 0.6

  const out = ctx.createGain(); out.gain.value = p.level
  a.g.connect(tone); if (b) b.g.connect(tone); tone.connect(out)

  a.osc.start(); if (b) b.osc.start()

  const pitched: OscillatorNode[] = [a.osc]; if (b) pitched.push(b.osc)
  return {
    output: out,
    stop: (tStop: number) => { 
      try { a.osc.stop(tStop) } catch {}
      try { b?.osc.stop(tStop) } catch {}
    },
    pitched,
  }
}

function createMacroHarmonic(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const maxPartials = 16
  const minPartials = 2
  const count = Math.round(minPartials + p.harmonics * (maxPartials - minPartials))
  const tilt = 0.5 + (1 - p.timbre) * 2.0
  const oddEvenBias = (p.morph - 0.5) * 2

  const sum = ctx.createGain()
  const pitched: OscillatorNode[] = []
  for (let n = 1; n <= count; n++) {
    const osc = ctx.createOscillator(); osc.type = 'sine'
    osc.frequency.value = freq * n
    let amp = 1 / Math.pow(n, tilt)
    const isEven = (n % 2) === 0
    const bias = isEven ? Math.max(0.1, (oddEvenBias + 1) / 2) : Math.max(0.1, (1 - oddEvenBias) / 2)
    amp *= bias
    const g = ctx.createGain(); g.gain.value = amp
    osc.connect(g).connect(sum)
    osc.start()
    pitched.push(osc)
  }
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'
  tone.frequency.value = 1000 + p.timbre * 15000
  tone.Q.value = 0.2
  const out = ctx.createGain(); out.gain.value = p.level
  sum.connect(tone).connect(out)
  return {
    output: out,
    stop: (tStop: number) => { for (const o of pitched) try { o.stop(tStop) } catch {} },
    pitched,
  }
}

function createMacroChord(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
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
  const spread = (p.morph - 0.5) * 2

  const mix = ctx.createGain()
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'
  tone.frequency.value = 900 + p.timbre * 15000
  tone.Q.value = 0.3
  const out = ctx.createGain(); out.gain.value = p.level

  const pitched: OscillatorNode[] = []
  const panPattern = [-1, -0.3, 0.3, 1]
  chord.forEach((semi, i) => {
    const osc = ctx.createOscillator(); osc.type = 'sawtooth'
    const f = 440 * Math.pow(2, (Math.log2(freq / 440) + semi / 12))
    osc.frequency.value = f
    const detuneCents = panPattern[i % panPattern.length] * spread * 15
    osc.detune.value = detuneCents
    const g = ctx.createGain(); g.gain.value = 1 / chord.length
    const pan = ctx.createStereoPanner(); pan.pan.value = panPattern[i % panPattern.length] * spread
    osc.connect(g).connect(pan).connect(mix)
    osc.start()
    pitched.push(osc)
  })

  mix.connect(tone).connect(out)
  return {
    output: out,
    stop: (tStop: number) => { for (const o of pitched) try { o.stop(tStop) } catch {} },
    pitched,
  }
}

function createMacroDirichletPulse(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const osc = ctx.createOscillator()
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

  const wave = ctx.createPeriodicWave(real, imag, { disableNormalization: false })
  osc.setPeriodicWave(wave)

  const tone = ctx.createBiquadFilter()
  tone.type = 'lowpass'
  const spectralReach = Math.max(freq * 2, freq * Math.min(partialCount + 2, 40))
  // Safety cap at 0.48 sample rate
  tone.frequency.value = Math.min(ctx.sampleRate * 0.48, spectralReach)
  tone.Q.value = Math.max(0.35, 0.7 + (0.5 - width) * 0.6)

  const out = ctx.createGain()
  out.gain.value = p.level

  osc.connect(tone).connect(out)
  osc.start()
  return {
    output: out,
    stop: (t: number) => { try { osc.stop(t) } catch {} },
    pitched: [osc],
  }
}

function createMacroFormant(ctx: AudioContext, freq: number, p: MacroSettings): MacroVoiceHandle {
  const source = ctx.createOscillator()
  source.type = 'sawtooth'
  source.frequency.value = freq

  const pre = ctx.createGain()
  pre.gain.value = 1
  source.connect(pre)

  const mix = ctx.createGain()
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
  const safetyNyquist = ctx.sampleRate * 0.48
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
    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = center
    const q = Math.max(0.5, Math.min(30, (1 / width) * resonanceBoost))
    filter.Q.value = q

    const g = ctx.createGain()
    g.gain.value = (gain / formantCount) * (1 / Math.sqrt(q))

    pre.connect(filter)
    filter.connect(g).connect(mix)
  }

  const highpass = ctx.createBiquadFilter()
  highpass.type = 'highpass'
  highpass.frequency.value = Math.max(40, freq * 0.5)
  highpass.Q.value = 0.7

  const body = ctx.createBiquadFilter()
  body.type = 'lowpass'
  body.frequency.value = Math.min(safetyNyquist, 3000 + p.harmonics * 14000)
  body.Q.value = 0.7 + p.timbre * 0.6

  mix.connect(highpass).connect(body)

  const out = ctx.createGain()
  out.gain.value = p.level
  body.connect(out)

  source.start()

  return {
    output: out,
    stop: (t: number) => { try { source.stop(t) } catch {} },
    pitched: [source],
  }
}

export function buildMacroVoice(ctx: AudioContext, freq: number, settings: MacroSettings): MacroVoiceHandle {
  switch (settings.model) {
    case 'fold':
      return createMacroFold(ctx, freq, settings)
    case 'pluck':
      return createMacroPluck(ctx, freq, settings)
    case 'supersaw':
      return createMacroSuperSaw(ctx, freq, settings)
    case 'pwm':
      return createMacroPWM(ctx, freq, settings)
    case 'fm2op':
      return createMacroFM2Op(ctx, freq, settings)
    case 'wavetable':
      return createMacroWavetable(ctx, freq, settings)
    case 'harmonic':
      return createMacroHarmonic(ctx, freq, settings)
    case 'chord':
      return createMacroChord(ctx, freq, settings)
    case 'dirichlet':
      return createMacroDirichletPulse(ctx, freq, settings)
    case 'formant':
      return createMacroFormant(ctx, freq, settings)
    case 'va':
    default:
      return createMacroVA(ctx, freq, settings)
  }
}
