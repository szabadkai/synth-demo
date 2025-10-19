import { describe, expect, it, beforeEach, vi } from 'vitest'
import { useStore } from './store'
import { defaultPatch } from '../audio-engine/engine'
import type { Patch, SynthEngine } from '../audio-engine/engine'

describe('useStore patch normalization', () => {
  beforeEach(() => {
    const reset = typeof structuredClone === 'function'
      ? structuredClone(defaultPatch)
      : JSON.parse(JSON.stringify(defaultPatch))
    useStore.setState((state) => ({
      ...state,
      engine: null,
      patch: reset,
    }))
  })

  it('preserves oscillator mode across unrelated updates', () => {
    useStore.getState().updatePatch({ osc1: { mode: 'macro' as const } } as Partial<Patch>)
    expect(useStore.getState().patch.osc1.mode).toBe('macro')

    useStore.getState().updatePatch({ mix: 0.42 } as Partial<Patch>)
    expect(useStore.getState().patch.osc1.mode).toBe('macro')
  })

  it('derives engine mode when oscillator mode changes', () => {
    const applyPatch = vi.fn()
    const fakeEngine = { applyPatch } as unknown as SynthEngine
    useStore.setState((state) => ({
      ...state,
      engine: fakeEngine,
    }))

    useStore.getState().updatePatch({ osc1: { mode: 'macro' } } as Partial<Patch>)
    expect(useStore.getState().patch.engineMode).toBe('macro')
    expect(applyPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        osc1: { mode: 'macro' },
        engineMode: 'macro',
        macro: expect.objectContaining({ model: 'va' }),
      }),
    )

    useStore.getState().updatePatch({ osc1: { mode: 'analog' }, osc2: { mode: 'analog' } } as Partial<Patch>)
    expect(useStore.getState().patch.engineMode).toBe('classic')
    expect(applyPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        osc1: { mode: 'analog' },
        osc2: { mode: 'analog' },
        engineMode: 'classic',
      }),
    )
  })

  it('syncs macro controls to global macro patch in macro mode', () => {
    const applyPatch = vi.fn()
    const fakeEngine = { applyPatch } as unknown as SynthEngine
    useStore.setState((state) => ({
      ...state,
      engine: fakeEngine,
    }))

    useStore.getState().updatePatch({ osc1: { mode: 'macro' } } as Partial<Patch>)
    applyPatch.mockClear()

    useStore.getState().updatePatch({ osc1: { macro: { model: 'pluck', harmonics: 0.25 } } } as Partial<Patch>)
    const state = useStore.getState()
    expect(state.patch.osc1.macro?.model).toBe('pluck')
    expect(state.patch.macro?.model).toBe('pluck')
    expect(state.patch.macro?.harmonics).toBeCloseTo(0.25)
    expect(applyPatch).toHaveBeenLastCalledWith(
      expect.objectContaining({
        osc1: expect.objectContaining({
          macro: expect.objectContaining({ model: 'pluck', harmonics: 0.25 }),
        }),
        macro: expect.objectContaining({ model: 'pluck', harmonics: 0.25 }),
      }),
    )
  })
})

describe('sampler library management', () => {
  const resetState = () => {
    const resetPatch = typeof structuredClone === 'function'
      ? structuredClone(defaultPatch)
      : JSON.parse(JSON.stringify(defaultPatch))
    useStore.setState((state) => ({
      ...state,
      engine: null,
      patch: resetPatch,
      samplerLibrary: [],
    }))
  }

  beforeEach(() => {
    resetState()
  })

  it('saves a sampler sample and normalizes the target oscillator', () => {
    const sample = {
      id: 'sample-1',
      name: 'My Sample',
      dataUrl: 'data:audio/webm;base64,AAAA',
      rootMidi: 60,
      loop: true,
      durationSec: 1.2,
      trimStartSec: 0.1,
      trimEndSec: 1.0,
    }

    useStore.getState().saveSamplerSample('osc1', sample)

    const state = useStore.getState()
    expect(state.samplerLibrary).toHaveLength(1)
    expect(state.samplerLibrary[0]).toMatchObject({
      id: 'sample-1',
      name: 'My Sample',
      loop: true,
    })
    expect(state.patch.osc1.mode).toBe('sampler')
    expect(state.patch.osc1.sampler?.id).toBe('sample-1')
    expect(state.patch.sampler?.id).toBe('sample-1')
  })

  it('can select a library sample onto an oscillator', () => {
    const existing = {
      id: 'sample-2',
      name: 'Library',
      dataUrl: 'data:audio/wav;base64,BBBB',
      rootMidi: 48,
      loop: false,
      durationSec: 0.8,
      trimStartSec: 0,
      trimEndSec: 0.8,
    }
    useStore.setState((state) => ({
      ...state,
      samplerLibrary: [existing],
    }))

    useStore.getState().setSamplerFromLibrary('osc2', 'sample-2')

    const state = useStore.getState()
    expect(state.patch.osc2.mode).toBe('sampler')
    expect(state.patch.osc2.sampler?.id).toBe('sample-2')
    expect(state.patch.osc2.sampler?.loop).toBe(false)
  })

  it('deletes a sample and resets any oscillators using it', () => {
    const sample = {
      id: 'sample-3',
      name: 'Temp',
      dataUrl: 'data:audio/webm;base64,CCCC',
      rootMidi: 55,
      loop: true,
      durationSec: 1.5,
      trimStartSec: 0,
      trimEndSec: 1.5,
    }

    useStore.getState().saveSamplerSample('osc1', sample)
    useStore.getState().setSamplerFromLibrary('osc2', 'sample-3')

    useStore.getState().deleteSamplerSample('sample-3')

    const state = useStore.getState()
    expect(state.samplerLibrary).toHaveLength(0)
    expect(state.patch.osc1.sampler?.id).not.toBe('sample-3')
    expect(state.patch.osc2.sampler?.id).not.toBe('sample-3')
  })
})
