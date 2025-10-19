import React from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PatchPanel } from './PatchPanel'
import { useStore } from '../state/store'
import { defaultPatch, type Patch } from '../audio-engine/engine'
import { presets, presetIndex, DEFAULT_PRESET_ID } from '../patches/presets'

const resetStore = () => {
  const basePatch: Patch = typeof structuredClone === 'function'
    ? structuredClone(defaultPatch)
    : JSON.parse(JSON.stringify(defaultPatch))
  useStore.setState((state) => ({
    ...state,
    engine: null,
    patch: basePatch,
    samplerLibrary: [],
  }))
}

describe('PatchPanel', () => {
  beforeEach(() => {
    resetStore()
  })

  it('shows the description and tags for the active preset', () => {
    render(<PatchPanel />)

    const presetMeta = presetIndex[DEFAULT_PRESET_ID]
    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe(DEFAULT_PRESET_ID)
    expect(screen.getByText(/Presets & Patch IO/i)).toBeTruthy()
    expect(screen.getByText(presetMeta.description)).toBeTruthy()
    presetMeta.tags?.forEach((tag) => {
      expect(screen.getByText(tag)).toBeTruthy()
    })
  })

  it('updates the store patch when selecting a different preset', () => {
    render(<PatchPanel />)

    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'warm-pad' } })

    const state = useStore.getState()
    expect(state.patch.engineMode).toBe('classic')
    expect(state.patch.osc1.wave).toBe(presets['warm-pad'].osc1.wave)
    const presetMeta = presetIndex['warm-pad']
    expect(screen.getByText(presetMeta.description)).toBeTruthy()
    presetMeta.tags?.forEach((tag) => {
      expect(screen.getByText(tag)).toBeTruthy()
    })
  })
})
