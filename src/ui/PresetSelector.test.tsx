import React from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PresetSelector } from './PresetSelector'
import { useStore } from '../state/store'
import { defaultPatch, type Patch } from '../audio-engine/engine'

const clonePatch = (): Patch => (typeof structuredClone === 'function'
  ? structuredClone(defaultPatch)
  : JSON.parse(JSON.stringify(defaultPatch)))

const resetStore = () => {
  useStore.setState((state) => ({
    ...state,
    engine: null,
    patch: clonePatch(),
    samplerLibrary: [],
    userPresets: [],
  }))
}

const createCustomPatch = (mutate: (patch: Patch) => void): Patch => {
  const patch = clonePatch()
  mutate(patch)
  return patch
}

describe('PresetSelector', () => {
  beforeEach(() => {
    resetStore()
  })

  it('shows custom presets in the list when available', () => {
    const customPatch = createCustomPatch((patch) => {
      patch.master.gain = 0.42
    })
    useStore.setState((state) => ({
      ...state,
      userPresets: [
        {
          id: 'user-test',
          name: 'Test Custom',
          description: 'Saved tone',
          createdAt: new Date(0).toISOString(),
          patch: customPatch,
        },
      ],
    }))

    render(<PresetSelector />)

    fireEvent.click(screen.getByRole('button', { name: /presets/i }))
    expect(screen.getByText('Custom Presets')).toBeTruthy()
    expect(screen.getByRole('option', { name: /Test Custom/i })).toBeTruthy()
  })

  it('applies a custom preset when selected', () => {
    const customPatch = createCustomPatch((patch) => {
      patch.master.gain = 0.31
      patch.osc1.detune = 7
    })
    useStore.setState((state) => ({
      ...state,
      userPresets: [
        {
          id: 'user-bright',
          name: 'Bright Custom',
          description: 'Custom preset',
          createdAt: new Date(0).toISOString(),
          patch: customPatch,
        },
      ],
    }))

    render(<PresetSelector />)

    fireEvent.click(screen.getByRole('button', { name: /presets/i }))
    fireEvent.click(screen.getByRole('option', { name: /Bright Custom/i }))

    const state = useStore.getState()
    expect(state.patch.master.gain).toBeCloseTo(0.31)
    expect(state.patch.osc1.detune).toBe(7)
  })
})
