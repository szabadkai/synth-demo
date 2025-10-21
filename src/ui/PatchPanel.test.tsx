import React from 'react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { PatchPanel } from './PatchPanel'
import { useStore } from '../state/store'
import { defaultPatch, type Patch } from '../audio-engine/engine'
import { presets, DEFAULT_PRESET_ID } from '../patches/presets'

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

const fillField = (label: string, value: string) => {
  const input = screen.getByLabelText(label) as HTMLInputElement | HTMLTextAreaElement
  fireEvent.change(input, { target: { value } })
}

describe('PatchPanel', () => {
  beforeEach(() => {
    resetStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows an empty state when no presets exist', () => {
    render(<PatchPanel />)

    expect(screen.getByText(/No custom presets yet/i)).toBeTruthy()
    const saveButton = screen.getByRole('button', { name: /Save New Preset/i }) as HTMLButtonElement
    expect(saveButton.disabled).toBe(true)
  })

  it('saves a new preset and lists it in the table', () => {
    render(<PatchPanel />)

    fillField('Preset Name', 'My Custom')
    fillField('Description', 'A mellow sound')
    fireEvent.click(screen.getByRole('button', { name: /Save New Preset/i }))

    const state = useStore.getState()
    expect(state.userPresets).toHaveLength(1)
    const saved = state.userPresets[0]
    expect(saved.name).toBe('My Custom')
    expect(saved.description).toBe('A mellow sound')

    const rowButton = screen.getByRole('button', { name: 'My Custom' })
    expect(rowButton).toBeTruthy()
    const overwriteButton = screen.getByRole('button', { name: /Overwrite Selected/i }) as HTMLButtonElement
    expect(overwriteButton.disabled).toBe(false)
  })

  it('loads a preset from the table and overwrites it', () => {
    render(<PatchPanel />)

    fillField('Preset Name', 'My Custom')
    fillField('Description', 'Original')
    fireEvent.click(screen.getByRole('button', { name: /Save New Preset/i }))

    // Tweak the patch and overwrite
    useStore.getState().updatePatch({ master: { ...useStore.getState().patch.master, gain: 0.42 } })
    fillField('Description', 'Updated desc')
    fireEvent.click(screen.getByRole('button', { name: /Overwrite Selected/i }))

    const saved = useStore.getState().userPresets[0]
    expect(saved.patch.master.gain).toBeCloseTo(0.42)
    expect(saved.description).toBe('Updated desc')

    // Load via table button
    fireEvent.click(screen.getByRole('button', { name: 'My Custom' }))
    const state = useStore.getState()
    expect(state.patch.master.gain).toBeCloseTo(0.42)
  })

  it('prompts when saving a duplicate preset name', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<PatchPanel />)

    fillField('Preset Name', 'My Custom')
    fireEvent.click(screen.getByRole('button', { name: /Save New Preset/i }))

    fillField('Description', 'Replacement')
    useStore.getState().updatePatch({ master: { ...useStore.getState().patch.master, gain: 0.25 } })
    fireEvent.click(screen.getByRole('button', { name: /Save New Preset/i }))

    expect(confirmSpy).toHaveBeenCalled()
    const saved = useStore.getState().userPresets[0]
    expect(saved.description).toBe('Replacement')
    expect(saved.patch.master.gain).toBeCloseTo(0.25)
  })

  it('exports, loads, and deletes presets via row actions', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const originalCreateObjectURL = URL.createObjectURL
    const originalRevokeObjectURL = URL.revokeObjectURL
    const createObjectURLMock = vi.fn(() => 'blob:mock')
    const revokeObjectURLMock = vi.fn()
    ;(URL as any).createObjectURL = createObjectURLMock
    ;(URL as any).revokeObjectURL = revokeObjectURLMock

    render(<PatchPanel />)

    fillField('Preset Name', 'To Manage')
    fillField('Description', 'Desc')
    fireEvent.click(screen.getByRole('button', { name: /Save New Preset/i }))

    const row = screen.getByRole('row', { name: /To Manage/ })
    const exportButton = within(row).getByRole('button', { name: 'Export' })
    fireEvent.click(exportButton)
    expect(createObjectURLMock).toHaveBeenCalled()
    expect(clickSpy).toHaveBeenCalled()
    expect(revokeObjectURLMock).toHaveBeenCalled()

    const loadButton = within(row).getByRole('button', { name: 'Load' })
    fireEvent.click(loadButton)
    expect(useStore.getState().patch).toBeDefined()

    const deleteButton = within(row).getByRole('button', { name: 'Delete' })
    fireEvent.click(deleteButton)
    expect(confirmSpy).toHaveBeenCalled()
    expect(useStore.getState().userPresets).toHaveLength(0)

    if (originalCreateObjectURL) {
      (URL as any).createObjectURL = originalCreateObjectURL
    } else {
      delete (URL as any).createObjectURL
    }
    if (originalRevokeObjectURL) {
      (URL as any).revokeObjectURL = originalRevokeObjectURL
    } else {
      delete (URL as any).revokeObjectURL
    }
  })

  it('loads the init patch when requested', () => {
    render(<PatchPanel />)

    const store = useStore.getState()
    store.updatePatch({ osc1: { ...store.patch.osc1, wave: 'sine' } })
    fireEvent.click(screen.getByRole('button', { name: /Load Init Patch/i }))

    const state = useStore.getState()
    expect(state.patch.osc1.wave).toBe(presets[DEFAULT_PRESET_ID].osc1.wave)
  })
})
