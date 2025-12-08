import { buildMacroVoice, MacroVoiceHandle } from './MacroOscillator'
import {
  DEFAULT_OSCILLATOR_MACRO,
  defaultPatch,
  EngineMode,
  Patch,
} from './types'
import { clampValue, ensureManagedSource, markSourceAutoStarted, markSourceStarted, ManagedSourceNode } from './utils'
import { phaseVocoderPitchShift } from './phaseVocoder'

export type SamplerContext = {
  buffer: AudioBuffer | null
  meta: {
    id: string | null
    dataUrl: string | null
    trimStartSec?: number
    trimEndSec?: number
    rootMidi: number
    loop: boolean
  }
  pitchCache: Map<string, AudioBuffer>
}

// Helper to determine detune in cents
function getDetuneCents(patch: Patch, which: 'osc1' | 'osc2') {
  if (which === 'osc1') {
    const coarse = patch.osc1.detune || 0
    const fine = patch.osc1.detuneFine ?? 0
    return coarse + fine
  }
  return patch.osc2.detune || 0
}

function getPitchedSamplerBuffer(ctx: AudioContext, context: SamplerContext, pitchRatio: number) {
  if (!context.buffer) return null
  const sampleRate = context.buffer.sampleRate
  const startSec = context.meta.trimStartSec ?? 0
  const endSec = context.meta.trimEndSec ?? context.buffer.duration
  const clampedStart = clampValue(startSec, 0, context.buffer.duration)
  const clampedEnd = clampValue(endSec, clampedStart + 0.005, context.buffer.duration)
  const startSample = Math.max(0, Math.floor(clampedStart * sampleRate))
  const endSample = Math.max(startSample + 1, Math.min(context.buffer.length, Math.floor(clampedEnd * sampleRate)))
  const frameLength = endSample - startSample
  if (frameLength <= 0) return null
  const id = context.meta.id ?? 'inline'
  const sourceKey = `${id}|${context.meta.dataUrl ?? 'data'}|${startSample}|${endSample}`
  // Pitch shifting is expensive, so cache it
  const ratio = Number.isFinite(pitchRatio) && pitchRatio > 0 ? pitchRatio : 1
  const ratioKey = ratio.toFixed(6)
  const cacheKey = `${sourceKey}|${ratioKey}|${sampleRate}|${context.buffer.numberOfChannels}`
  const cached = context.pitchCache.get(cacheKey)
  if (cached) return cached
  
  return null
}

function getPitchedBufferWithVocoder(ctx: AudioContext, context: SamplerContext, pitchRatio: number) {
  if (!context.buffer) return null
  const sampleRate = context.buffer.sampleRate
  const startSec = context.meta.trimStartSec ?? 0
  const endSec = context.meta.trimEndSec ?? context.buffer.duration
  const clampedStart = clampValue(startSec, 0, context.buffer.duration)
  const clampedEnd = clampValue(endSec, clampedStart + 0.005, context.buffer.duration)
  const startSample = Math.max(0, Math.floor(clampedStart * sampleRate))
  const endSample = Math.max(startSample + 1, Math.min(context.buffer.length, Math.floor(clampedEnd * sampleRate)))
  const frameLength = endSample - startSample
  if (frameLength <= 0) return null
  
  const id = context.meta.id ?? 'inline'
  const sourceKey = `${id}|${context.meta.dataUrl ?? 'data'}|${startSample}|${endSample}`
  const ratio = Number.isFinite(pitchRatio) && pitchRatio > 0 ? pitchRatio : 1
  const ratioKey = ratio.toFixed(6)
  const cacheKey = `${sourceKey}|${ratioKey}|${sampleRate}|${context.buffer.numberOfChannels}`
  const cached = context.pitchCache.get(cacheKey)
  if (cached) return cached

  const channelCount = context.buffer.numberOfChannels
  const channels: Float32Array[] = []
  for (let ch = 0; ch < channelCount; ch++) {
    const source = context.buffer.getChannelData(ch)
    const segment = source.subarray(startSample, endSample)
    // Create copy to avoid mutating original if vocoder does in-place
    channels.push(Float32Array.from(segment))
  }

  const shifted = Math.abs(ratio - 1) < 1e-4 ? channels : phaseVocoderPitchShift({ channels, pitchRatio: ratio })

  if (!shifted.length || shifted[0].length === 0) return null

  const buffer = ctx.createBuffer(shifted.length, shifted[0].length, sampleRate)
  for (let ch = 0; ch < shifted.length; ch++) {
    buffer.copyToChannel(shifted[ch] as Float32Array, ch, 0)
  }
  context.pitchCache.set(cacheKey, buffer)
  return buffer
}


export class Voice {
  public osc1Detune?: AudioParam
  public osc2Detune?: AudioParam
  public mixControl?: ConstantSourceNode
  public mixBias?: ConstantSourceNode
  public mixConnections: Array<{ sourceIndex: number; gain: GainNode }> = []
  
  private ctx: AudioContext
  private sources: AudioScheduledSourceNode[] = []
  private macroVoices: Array<MacroVoiceHandle> = []
  private gain: GainNode
  private gainScale: number
  private lfoParamConnections: Array<{ g: GainNode; p: AudioParam }> = []

  constructor(
    ctx: AudioContext,
    destination: AudioNode,
    freq: number,
    patch: Patch,
    noiseBuffer: AudioBuffer | undefined,
    samplerContext: SamplerContext,
    activeVoiceCount: number,
    // We pass LFO gain nodes to connect them to voice parameters
    lfoGains: {
      lfo1: { gain: GainNode; enabled: boolean; dest: string },
      lfo2: { gain: GainNode; enabled: boolean; dest: string }
    }
  ) {
    this.ctx = ctx
    const now = ctx.currentTime

    // 1. Setup Gain (Envelope)
    this.gain = ctx.createGain()
    this.gain.gain.value = 0
    this.gain.connect(destination)

    // Scale peak amplitude inversely with active voice load
    const VOICE_GAIN_BASE = 0.65
    this.gainScale = VOICE_GAIN_BASE / Math.max(1, Math.sqrt(activeVoiceCount + 1))

    // Apply Envelope Attack
    const env = patch.envelope
    const g = this.gain.gain
    g.cancelScheduledValues(now)
    g.setValueAtTime(0, now)
    g.linearRampToValueAtTime(this.gainScale, now + Math.max(0.001, env.attack))
    g.linearRampToValueAtTime(env.sustain * this.gainScale, now + env.attack + Math.max(0.001, env.decay))

    // 2. Setup Sources
    const clampOctave = (value: number | undefined) => {
      const n = Number(value ?? 0)
      return Number.isFinite(n) ? Math.max(-3, Math.min(3, Math.round(n))) : 0
    }
    const osc1Octave = clampOctave(patch.osc1.octave)
    const osc1Freq = freq * Math.pow(2, osc1Octave)

    const engineMode = patch.engineMode ?? 'classic'
    const fallbackMode = (mode: EngineMode) => (mode === 'macro' ? 'macro' : mode === 'sampler' ? 'sampler' : 'analog')
    const osc1Mode = patch.osc1.mode ?? fallbackMode(engineMode)
    const osc2Mode = patch.osc2.mode ?? fallbackMode(engineMode)

    // Sub-mix
    const sub1 = ctx.createGain(); sub1.gain.value = 0
    const sub2 = ctx.createGain(); sub2.gain.value = 0
    const normalSum = ctx.createGain(); normalSum.gain.value = 1
    sub1.connect(normalSum); sub2.connect(normalSum); normalSum.connect(this.gain)

    // Mix control (Crossfade)
    const mixBase = clampValue(patch.mix, 0, 1)
    this.mixControl = ctx.createConstantSource()
    this.mixControl.offset.value = mixBase
    this.mixBias = ctx.createConstantSource()
    this.mixBias.offset.value = 1
    const mixInvert = ctx.createGain(); mixInvert.gain.value = -1
    
    this.mixControl.connect(sub2.gain)
    this.mixControl.connect(mixInvert)
    mixInvert.connect(sub1.gain)
    this.mixBias.connect(sub1.gain)
    this.mixControl.start()
    this.mixBias.start()

    let primarySource: AudioNode | null = null
    let osc1Node: OscillatorNode | null = null
    let osc2Node: OscillatorNode | null = null

    // -- OSC 1 --
    if (osc1Mode === 'macro') {
      const p = patch.osc1.macro ?? patch.macro ?? DEFAULT_OSCILLATOR_MACRO
      const macro = buildMacroVoice(ctx, osc1Freq, p)
      macro.output.connect(sub1)
      this.macroVoices.push(macro)
      if (!primarySource) primarySource = macro.output
      if (macro.pitched) {
        for (const osc of macro.pitched) this.connectLfos(osc.detune, lfoGains)
      }
    } else if (osc1Mode === 'sampler') {
      const sample = this.createSamplerSource(ctx, osc1Freq, 'osc1', patch, samplerContext)
      if (sample) {
        sample.connect(sub1)
        this.sources.push(sample)
        primarySource = sample
      }
    } else {
      // Analog / Noise
      if (patch.osc1.wave === 'noise' && noiseBuffer) {
        const src = ensureManagedSource(ctx.createBufferSource())
        src.buffer = noiseBuffer
        src.loop = true
        src.connect(sub1)
        this.sources.push(src)
        primarySource = src
      } else if (patch.osc1.wave === 'sample') {
         const sample = this.createSamplerSource(ctx, osc1Freq, 'osc1', patch, samplerContext)
         if (sample) {
           sample.connect(sub1)
           this.sources.push(sample)
           primarySource = sample
         }
      } else {
        const osc = ensureManagedSource(ctx.createOscillator())
        osc.type = patch.osc1.wave as OscillatorType
        osc.frequency.setValueAtTime(osc1Freq, now)
        const fine = patch.osc1.detuneFine ?? 0
        osc.detune.value = (patch.osc1.detune || 0) + fine
        osc.connect(sub1)
        this.sources.push(osc)
        primarySource = osc
        osc1Node = osc
        
        // FM
        if (patch.fm.enabled && patch.osc2.wave !== 'noise' && patch.osc2.wave !== 'sample') {
           const mod = ensureManagedSource(ctx.createOscillator())
           mod.type = patch.osc2.wave as OscillatorType
           const ratio = Math.max(0.01, patch.fm.ratio || 1)
           mod.frequency.setValueAtTime(freq * ratio, now)
           mod.detune.value = patch.osc2.detune || 0
           const modGain = ctx.createGain()
           modGain.gain.value = Math.max(0, patch.fm.amount || 0)
           mod.connect(modGain).connect(osc.frequency)
           this.sources.push(mod)
        }
        
        this.connectLfos(osc.detune, lfoGains)
      }
    }

    // -- OSC 2 --
    if (osc2Mode === 'macro') {
       const p = patch.osc2.macro ?? patch.macro ?? DEFAULT_OSCILLATOR_MACRO
       const macro = buildMacroVoice(ctx, freq, p)
       macro.output.connect(sub2)
       this.macroVoices.push(macro)
       if (macro.pitched) {
         for (const osc of macro.pitched) this.connectLfos(osc.detune, lfoGains)
       }
    } else if (osc2Mode === 'sampler') {
       const sample = this.createSamplerSource(ctx, freq, 'osc2', patch, samplerContext)
       if (sample) {
         sample.connect(sub2)
         this.sources.push(sample)
       }
    } else {
       if (patch.osc2.wave === 'noise' && noiseBuffer) {
         const src = ensureManagedSource(ctx.createBufferSource())
         src.buffer = noiseBuffer
         src.loop = true
         src.connect(sub2)
         this.sources.push(src)
       } else {
         const osc = ensureManagedSource(ctx.createOscillator())
         osc.type = patch.osc2.wave as OscillatorType
         osc.frequency.setValueAtTime(freq, now)
         osc.detune.value = patch.osc2.detune || 0
         osc.connect(sub2)
         this.sources.push(osc)
         osc2Node = osc
         this.connectLfos(osc.detune, lfoGains)
       }
       
       // Ring Mod
       if (patch.ring.enabled && primarySource && osc2Node) {
          const ringVca = ctx.createGain()
          ringVca.gain.value = 0
          primarySource.connect(ringVca)
          const depth = ctx.createGain()
          depth.gain.value = 1
          osc2Node.connect(depth)
          depth.connect(ringVca.gain)

          const amt = Math.max(0, Math.min(1, patch.ring.amount))
          normalSum.gain.value = 1 - amt
          const ringGain = ctx.createGain()
          ringGain.gain.value = amt
          ringVca.connect(ringGain).connect(this.gain)
       }
    }

    // -- Sub Osc --
    if (patch.sub.enabled) {
      const subOsc = ensureManagedSource(ctx.createOscillator())
      subOsc.type = (patch.sub.wave || 'square') as OscillatorType
      const subFreq = freq / Math.pow(2, Math.max(1, Math.min(2, patch.sub.octave)))
      subOsc.frequency.setValueAtTime(subFreq, now)
      const subGain = ctx.createGain()
      subGain.gain.value = Math.max(0, Math.min(1, patch.sub.level))
      subOsc.connect(subGain).connect(this.gain)
      this.sources.push(subOsc)
      this.connectLfos(subOsc.detune, lfoGains)
    }

    // Start everything
    this.sources.forEach(s => {
       const node = s as ManagedSourceNode
       if (('start' in s) && !node._started) {
          s.start()
          markSourceStarted(s)
       }
    })

    if (osc1Node) this.osc1Detune = osc1Node.detune
    if (osc2Node) this.osc2Detune = osc2Node.detune
  }

  private connectLfos(param: AudioParam, lfoGains: { lfo1: { gain: GainNode; enabled: boolean; dest: string }, lfo2: { gain: GainNode; enabled: boolean; dest: string } }) {
    if (lfoGains.lfo1.enabled && lfoGains.lfo1.dest === 'pitch') {
      lfoGains.lfo1.gain.connect(param)
      this.lfoParamConnections.push({ g: lfoGains.lfo1.gain, p: param })
    }
    if (lfoGains.lfo2.enabled && lfoGains.lfo2.dest === 'pitch') {
      lfoGains.lfo2.gain.connect(param)
      this.lfoParamConnections.push({ g: lfoGains.lfo2.gain, p: param })
    }
  }

  createSamplerSource(
    ctx: AudioContext,
    freq: number,
    which: 'osc1' | 'osc2',
    patch: Patch,
    context: SamplerContext,
  ) {
    if (!context.buffer) return null
    
    // Calculate ratio
    const rootMidi = Number.isFinite(context.meta.rootMidi) ? context.meta.rootMidi : 60
    const baseFreq = 440 * Math.pow(2, (rootMidi - 69) / 12)
    const detuneCents = getDetuneCents(patch, which)
    const detuneRatio = Math.pow(2, detuneCents / 1200)
    const ratio = baseFreq > 0 ? (freq / baseFreq) * detuneRatio : detuneRatio

    const pitchedBuffer = getPitchedBufferWithVocoder(ctx, context, ratio)
    if (!pitchedBuffer) return null
    
    const playbackWindow = pitchedBuffer.duration
    const loopEnabled = !!context.meta.loop && playbackWindow > 0.01
    
    const src = ensureManagedSource(ctx.createBufferSource())
    src.buffer = pitchedBuffer
    src.loop = loopEnabled
    if (loopEnabled) {
      src.loopStart = 0
      src.loopEnd = playbackWindow
    }
    // Auto-start logic will be handled by caller (Voice constructor)
    if (!loopEnabled) {
       // Just to be safe, we don't start it here, we return it.
       // The original engine handled auto-start. Here we create and return.
    }

    return src
  }

  stop(releaseTime: number, envRelease: number) {
    const t = Math.max(this.ctx.currentTime, releaseTime)
    const g = this.gain.gain
    g.cancelScheduledValues(t)
    g.setValueAtTime(g.value, t)
    g.linearRampToValueAtTime(0, t + Math.max(0.001, envRelease))
    
    const stopTime = t + envRelease + 0.05
    
    this.sources.forEach(s => {
      try {
        const node = s as ManagedSourceNode
        if (node._started) (s as any).stop(stopTime)
      } catch (e) { /* ignore */ }
    })
    this.macroVoices.forEach(m => {
      try { m.stop(stopTime) } catch {}
    })
    
    try { this.mixControl?.stop(stopTime) } catch {}
    try { this.mixBias?.stop(stopTime) } catch {}

    // Cleanup connections immediately or after stop?
    // Disconnect LFOs immediately to stop modulation affecting other voices? 
    // No, LFO gains are shared but connections are per-voice.
    // We must disconnect the specific connections we made.
    setTimeout(() => {
       this.lfoParamConnections.forEach(c => {
         try { c.g.disconnect(c.p) } catch {}
       })
       this.mixConnections.forEach(c => {
         // This logic was in engine to disconnect mod matrix taps.
         // We might need to handle this if we support per-voice mix modulation.
       })
       try { this.gain.disconnect() } catch {}
    }, (envRelease + 0.1) * 1000)
  }
}
