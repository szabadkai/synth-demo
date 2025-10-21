import React from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ModMatrixPanel } from './ModMatrixPanel'
import { useStore } from '../state/store'
import { defaultPatch } from '../audio-engine/engine'

describe('ModMatrixPanel', () => {
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

  it('adds, updates, and removes modulation routes', () => {
    render(<ModMatrixPanel />)

    const addButton = screen.getByRole('button', { name: /add route/i })
    fireEvent.click(addButton)

    const sourceSelect = screen.getByLabelText(/source/i) as HTMLSelectElement
    expect(sourceSelect.value).toBe('lfo1')
    fireEvent.change(sourceSelect, { target: { value: 'exprY' } })
    expect(useStore.getState().patch.modMatrix?.[0].source).toBe('exprY')

    const targetSelect = screen.getByLabelText(/target/i) as HTMLSelectElement
    fireEvent.change(targetSelect, { target: { value: 'macro.morph' } })
    expect(useStore.getState().patch.modMatrix?.[0].target).toBe('macro.morph')

    const amountSlider = screen.getByLabelText(/amount/i) as HTMLInputElement
    fireEvent.change(amountSlider, { target: { value: '-0.25' } })
    expect(useStore.getState().patch.modMatrix?.[0].amount).toBeCloseTo(-0.25)

    const enabledToggle = screen.getByLabelText(/enabled/i) as HTMLInputElement
    fireEvent.click(enabledToggle)
    expect(useStore.getState().patch.modMatrix?.[0].enabled).toBe(false)

    const removeButton = screen.getByRole('button', { name: /remove route/i })
    fireEvent.click(removeButton)
    expect(useStore.getState().patch.modMatrix).toHaveLength(0)
  })
})
