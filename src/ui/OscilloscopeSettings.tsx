import React from 'react'
import { useStore, type State } from '../state/store'

const FFT_OPTIONS: Array<{ label: string; value: 1024 | 2048 | 4096 | 8192; description: string }> = [
  { label: '1024', value: 1024, description: 'Fastest response, lowest resolution' },
  { label: '2048', value: 2048, description: 'Balanced speed and detail' },
  { label: '4096', value: 4096, description: 'Default detail' },
  { label: '8192', value: 8192, description: 'Highest resolution, slowest refresh' },
]

export function OscilloscopeSettings() {
  const fftSize = useStore((s: State) => s.oscilloscope.fftSize)
  const setFftSize = useStore((s: State) => s.setOscilloscopeFftSize)

  return (
    <div className="settings-group">
      <h5 className="settings-subheading">Oscilloscope</h5>
      <div className="settings-row">
        <span className="label">FFT Size</span>
        <div className="fft-options">
          {FFT_OPTIONS.map((option) => {
            const active = fftSize === option.value
            return (
              <button
                key={option.value}
                type="button"
                className={`fft-option${active ? ' active' : ''}`}
                aria-pressed={active}
                onClick={() => setFftSize(option.value)}
              >
                <span className="fft-option__label">{option.label}</span>
                <span className="fft-option__hint">{option.description}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
