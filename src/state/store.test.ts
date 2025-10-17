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
