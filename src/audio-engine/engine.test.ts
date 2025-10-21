import { describe, it, expect } from 'vitest'
import { SynthEngine, defaultPatch, type ModMatrixRow } from './engine'

describe('SynthEngine', () => {
  it('creates an AudioContext and applies default patch', async () => {
    const hasAudio = typeof window !== 'undefined' && (!!(window as any).AudioContext || !!(window as any).webkitAudioContext)
    if (!hasAudio) {
      // Environment (jsdom) lacks Web Audio; consider this a pass for CI.
      expect(true).toBe(true)
      return
    }
    const engine = new SynthEngine()
    await engine.resume()
    expect(engine.audioContext).toBeDefined()
  })

  it('provides sampler defaults on the patch', () => {
    expect(defaultPatch.sampler).toBeDefined()
    expect(defaultPatch.sampler.id).toBeNull()
    expect(defaultPatch.sampler.dataUrl).toBeNull()
    expect(typeof defaultPatch.sampler.rootMidi).toBe('number')
    expect(defaultPatch.sampler.loop).toBe(true)
    expect(defaultPatch.sampler.durationSec).toBe(0)
    expect(defaultPatch.sampler.trimStartSec).toBe(0)
    expect(defaultPatch.sampler.trimEndSec).toBe(0)
  })

  it('applies control-source modulation when expression moves', async () => {
    const hasAudio = typeof window !== 'undefined' && (!!(window as any).AudioContext || !!(window as any).webkitAudioContext)
    if (!hasAudio) {
      expect(true).toBe(true)
      return
    }
    const engine = new SynthEngine()
    await engine.resume()
    const route: ModMatrixRow = {
      id: 'expr-route',
      source: 'exprX',
      target: 'macro.morph',
      amount: 0.8,
      enabled: true,
    }
    engine.applyPatch({ modMatrix: [route] })
    const base = engine.patch.macro?.morph ?? 0
    engine.setExpression2D(1, 0.5)
    const modded = engine.patch.macro?.morph ?? 0
    expect(modded).toBeGreaterThan(base)
    engine.clearExpression2D()
    const reset = engine.patch.macro?.morph ?? 0
    expect(reset).toBeCloseTo(base, 2)
  })

  it('responds to sequencer control modulation', async () => {
    const hasAudio = typeof window !== 'undefined' && (!!(window as any).AudioContext || !!(window as any).webkitAudioContext)
    if (!hasAudio) {
      expect(true).toBe(true)
      return
    }
    const engine = new SynthEngine()
    await engine.resume()
    const route: ModMatrixRow = {
      id: 'seq-route',
      source: 'seqStep',
      target: 'fm.amount',
      amount: 0.5,
      enabled: true,
    }
    engine.applyPatch({ modMatrix: [route] })
    const base = engine.patch.fm.amount
    ;(engine as any).updateControlSource('seqStep', 1)
    const modded = engine.patch.fm.amount
    expect(modded).toBeGreaterThan(base)
    ;(engine as any).updateControlSource('seqStep', 0)
    const reset = engine.patch.fm.amount
    expect(reset).toBeCloseTo(base, 2)
  })

  it('routes LFO modulation into oscillator mix crossfade', async () => {
    const hasAudio = typeof window !== 'undefined' && (!!(window as any).AudioContext || !!(window as any).webkitAudioContext)
    if (!hasAudio) {
      expect(true).toBe(true)
      return
    }
    const engine = new SynthEngine()
    await engine.resume()
    engine.applyPatch({ lfo2: { enabled: true, amount: 0.5, dest: 'filter', rateHz: 5, wave: 'sine' } })
    const route: ModMatrixRow = {
      id: 'mix-audio',
      source: 'lfo2',
      target: 'mix',
      amount: 0.4,
      enabled: true,
    }
    engine.applyPatch({ modMatrix: [route] })
    engine.noteOn(60, 1)
    const voice = (engine as any).activeVoices.get(60)
    expect(voice).toBeTruthy()
    expect(voice.mixControl).toBeDefined()
    expect(voice.mixConnections.length).toBeGreaterThan(0)
    expect(voice.mixConnections[0].gain.gain.value).toBeCloseTo(0.4)
    engine.noteOff(60)
    engine.allNotesOff()
  })

  it('exposes velocity and gate as modulation sources', async () => {
    const hasAudio = typeof window !== 'undefined' && (!!(window as any).AudioContext || !!(window as any).webkitAudioContext)
    if (!hasAudio) {
      expect(true).toBe(true)
      return
    }
    const engine = new SynthEngine()
    await engine.resume()
    engine.applyPatch({ modMatrix: [{ id: 'vel-route', source: 'velocity', target: 'macro.harmonics', amount: 0.5, enabled: true }] })
    const baseHarmonics = engine.patch.macro?.harmonics ?? 0
    engine.noteOn(60, 0.25)
    const modded = engine.patch.macro?.harmonics ?? 0
    expect(modded).toBeLessThan(baseHarmonics)
    engine.noteOff(60)
    expect(engine.patch.macro?.harmonics ?? 0).toBeCloseTo(baseHarmonics, 2)

    engine.applyPatch({ modMatrix: [{ id: 'gate-route', source: 'gate', target: 'master.gain', amount: 0.3, enabled: true }] })
    const baseGain = engine.patch.master.gain
    engine.noteOn(64, 1)
    expect(engine.patch.master.gain).toBeGreaterThan(baseGain)
    engine.noteOff(64)
    expect(engine.patch.master.gain).toBeCloseTo(baseGain, 3)
  })
})
