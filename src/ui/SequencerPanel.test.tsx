import React from 'react'
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest'
import { fireEvent, render, screen, act } from '@testing-library/react'
import { SequencerPanel } from './SequencerPanel'
import { useStore } from '../state/store'
import { defaultPatch, SEQUENCER_PROGRESSIONS } from '../audio-engine/engine'

const resetStore = () => {
  const reset =
    typeof structuredClone === 'function'
      ? structuredClone(defaultPatch)
      : JSON.parse(JSON.stringify(defaultPatch))
  useStore.setState((state) => ({
    ...state,
    engine: null,
    patch: reset,
  }))
}

const toggleOn = () => {
  const checkbox = screen.getByRole('checkbox', { name: /On/i })
  fireEvent.click(checkbox)
}

describe('SequencerPanel', () => {
  beforeEach(() => {
    resetStore()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('enables the sequencer and unlocks the knobs when toggled on', () => {
    render(<SequencerPanel />)
    expect(useStore.getState().patch.sequencer?.enabled).toBe(false)

    toggleOn()

    const state = useStore.getState().patch.sequencer!
    expect(state.enabled).toBe(true)

    const lengthKnob = screen.getByRole('slider', { name: 'Length' })
    expect(lengthKnob.getAttribute('tabindex')).toBe('0')
  })

  it('adjusts length via the knob and clamps the step buffer to 64 slots', () => {
    render(<SequencerPanel />)
    toggleOn()

    const lengthKnob = screen.getByRole('slider', { name: 'Length' })
    lengthKnob.focus()

    for (let i = 0; i < 80; i += 1) {
      fireEvent.keyDown(lengthKnob, { key: 'ArrowUp' })
    }

    const seq = useStore.getState().patch.sequencer!
    expect(seq.length).toBe(64)
    expect(seq.steps).toHaveLength(64)
    expect(seq.steps.every((step) => typeof step.on === 'boolean')).toBe(true)
  })

  it('surfaces the current root from the engine and renders note names', () => {
    vi.useFakeTimers()
    const status = { enabled: true, stepIndex: 0, length: 16, currentRoot: 63 }
    const engineMock = {
      getSequencerStatus: vi.fn(() => ({ ...status })),
      applyPatch: vi.fn(),
    } as any
    useStore.setState((state) => ({ ...state, engine: engineMock }))

    render(<SequencerPanel />)
    toggleOn()

    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(engineMock.getSequencerStatus).toHaveBeenCalled()
    expect(screen.getByText('D#4')).toBeTruthy()

    status.currentRoot = 59
    act(() => {
      vi.advanceTimersByTime(150)
    })
    expect(screen.getByText('B3')).toBeTruthy()
  })

  it('updates progression mode and base root from the knob', () => {
    render(<SequencerPanel />)
    toggleOn()

    const progressionKnob = screen.getByRole('slider', { name: 'Progression' })
    progressionKnob.focus()

    fireEvent.keyDown(progressionKnob, { key: 'ArrowUp' })

    const seq = useStore.getState().patch.sequencer!
    expect(seq.progressionMode).toBe(SEQUENCER_PROGRESSIONS[1].id)
    expect(seq.grooveBaseMidi).toBe(seq.rootMidi)

    const rootKnob = screen.getByRole('slider', { name: 'Root' })
    rootKnob.focus()
    fireEvent.keyDown(rootKnob, { key: 'ArrowUp' })

    const updated = useStore.getState().patch.sequencer!
    expect(updated.rootMidi).toBe(seq.rootMidi + 1)
    expect(updated.grooveBaseMidi).toBe(seq.rootMidi + 1)
  })
})
