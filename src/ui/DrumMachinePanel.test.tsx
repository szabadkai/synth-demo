import React from 'react'
import { describe, it, beforeEach, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { DrumMachinePanel } from './DrumMachinePanel'
import { useStore } from '../state/store'
import { defaultPatch } from '../audio-engine/engine'

const resetStore = () => {
  const reset = typeof structuredClone === 'function'
    ? structuredClone(defaultPatch)
    : JSON.parse(JSON.stringify(defaultPatch))
  useStore.setState((state) => ({
    ...state,
    engine: null,
    patch: reset,
    transport: { ...state.transport, playing: false, tick: 0 },
  }))
}

describe('DrumMachinePanel', () => {
  beforeEach(() => {
    resetStore()
  })

  it('renders controls with enable toggle and voice selectors in a single row', () => {
    render(<DrumMachinePanel />)

    const onToggle = screen.getByRole('checkbox', { name: /On/i }) as HTMLInputElement
    expect(onToggle.checked).toBe(true)
    fireEvent.click(onToggle)
    expect(onToggle.checked).toBe(false)
    fireEvent.click(onToggle)
    expect(onToggle.checked).toBe(true)

    const tempoSlider = screen.getByRole('slider', { name: 'Tempo' })
    expect(tempoSlider.getAttribute('aria-valuenow')).toBe('110')
    const kickSlider = screen.getByRole('slider', { name: 'Kick Voice' })
    const snareSlider = screen.getByRole('slider', { name: 'Snare Voice' })
    const hatSlider = screen.getByRole('slider', { name: 'Hat Voice' })

    kickSlider.focus()
    expect(kickSlider.getAttribute('aria-valuenow')).toBe('0')
    expect(kickSlider.getAttribute('aria-valuetext')).toBe('Classic')

    fireEvent.keyDown(kickSlider, { key: 'ArrowUp' })

    expect(kickSlider.getAttribute('aria-valuenow')).toBe('1')
    expect(kickSlider.getAttribute('aria-valuetext')).toBe('Boom')
    expect(snareSlider.getAttribute('aria-valuetext')).toBe('Tight')
    expect(hatSlider.getAttribute('aria-valuetext')).toBe('Closed')
  })
})
