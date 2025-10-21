import React from 'react'
import { describe, expect, it, beforeEach, vi } from 'vitest'
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
    userPresets: [],
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

  it('saves the current patch as a custom preset', () => {
    const promptSpy = vi.spyOn(window, 'prompt')
    promptSpy.mockImplementationOnce(() => 'My Custom')
    promptSpy.mockImplementationOnce(() => 'A mellow sound')

    render(<PatchPanel />)

    fireEvent.click(screen.getByRole('button', { name: /save preset/i }))

    const state = useStore.getState()
    expect(state.userPresets).toHaveLength(1)
    const saved = state.userPresets[0]
    expect(saved.name).toBe('My Custom')
    expect(saved.description).toBe('A mellow sound')

    const select = screen.getByRole('combobox') as HTMLSelectElement
    expect(select.value).toBe('user-my-custom')
    expect(screen.getByText('A mellow sound')).toBeTruthy()

    promptSpy.mockRestore()
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
