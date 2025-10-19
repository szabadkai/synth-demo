import React from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { SamplerControls } from './SamplerControls'
import { useStore } from '../state/store'
import { defaultPatch } from '../audio-engine/engine'

type Sample = {
  id: string
  name: string
  dataUrl: string
  rootMidi: number
  loop: boolean
  durationSec: number
  trimStartSec: number
  trimEndSec: number
  recordedAt: number
}

const makeSample = (overrides: Partial<Sample> = {}): Sample => ({
  id: 'sample-active',
  name: 'ActiveOne',
  dataUrl: 'data:audio/webm;base64,AAA',
  rootMidi: 60,
  loop: true,
  durationSec: 1.5,
  trimStartSec: 0,
  trimEndSec: 1.5,
  recordedAt: Date.now(),
  ...overrides,
})

const resetState = () => {
  const patch = typeof structuredClone === 'function'
    ? structuredClone(defaultPatch)
    : JSON.parse(JSON.stringify(defaultPatch))
  useStore.setState((state) => ({
    ...state,
    engine: null,
    patch,
    samplerLibrary: [],
  }))
}

describe('SamplerControls', () => {
  beforeEach(() => {
    resetState()
    const activeSample = makeSample({})
    useStore.getState().saveSamplerSample('osc1', activeSample)
    const secondSample = makeSample({
      id: 'sample-secondary',
      name: 'SecondOne',
      dataUrl: 'data:audio/webm;base64,BBB',
      rootMidi: 48,
      loop: false,
    })
    useStore.setState((state) => ({
      ...state,
      samplerLibrary: state.samplerLibrary.concat(secondSample),
      patch: {
        ...state.patch,
        osc1: {
          ...state.patch.osc1,
          mode: 'sampler',
          sampler: { ...state.patch.osc1.sampler, ...activeSample },
        },
      },
    }))
  })

  it('renames a library sample and truncates the stored name', async () => {
    render(<SamplerControls oscillator="osc1" />)

    const renameButtons = screen.getAllByRole('button', { name: /rename/i })
    fireEvent.click(renameButtons[0])

    const renameInput = screen.getByRole('textbox')
    fireEvent.change(renameInput, { target: { value: 'OrbitalsX999' } })

    const saveButton = screen.getByRole('button', { name: /save/i })
    fireEvent.click(saveButton)

    await waitFor(() => {
      const state = useStore.getState()
      expect(state.samplerLibrary[0].name).toBe('OrbitalsX9')
      expect(state.patch.osc1.sampler?.name).toBe('OrbitalsX9')
    })
  })

  it('activates a library sample when selecting "Use"', async () => {
    render(<SamplerControls oscillator="osc1" />)

    const useButton = screen.getByRole('button', { name: 'Use' })
    fireEvent.click(useButton)

    await waitFor(() => {
      const state = useStore.getState()
      expect(state.patch.osc1.sampler?.id).toBe('sample-secondary')
    })

    const indicator = await screen.findByText(/In Use/)
    expect(indicator).toBeTruthy()
  })
})
