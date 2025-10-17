import { describe, it, expect } from 'vitest'
import { phaseVocoderPitchShift } from './phaseVocoder'

const makeSine = (length: number, freq: number, sampleRate: number) => {
  const out = new Float32Array(length)
  const omega = (2 * Math.PI * freq) / sampleRate
  for (let i = 0; i < length; i++) {
    out[i] = Math.sin(omega * i)
  }
  return out
}

describe('phaseVocoderPitchShift', () => {
  it('returns identical data when pitch ratio is 1', () => {
    const sampleRate = 48000
    const input = makeSine(sampleRate / 10, 440, sampleRate)
    const [output] = phaseVocoderPitchShift({ channels: [input], pitchRatio: 1 })
    expect(output.length).toBe(input.length)
    let maxDiff = 0
    for (let i = 0; i < input.length; i++) {
      const diff = Math.abs(output[i] - input[i])
      if (diff > maxDiff) maxDiff = diff
    }
    expect(maxDiff).toBeLessThan(1e-3)
  })

  it('preserves duration while altering the spectrum for pitch shifts', () => {
    const sampleRate = 48000
    const input = makeSine(sampleRate / 5, 220, sampleRate)
    const [output] = phaseVocoderPitchShift({ channels: [input], pitchRatio: 1.5 })
    expect(output.length).toBe(input.length)
    const rms = Math.sqrt(output.reduce((sum, value) => sum + value * value, 0) / output.length)
    expect(rms).toBeGreaterThan(0)
    // Ensure the output is meaningfully different from the input
    let diff = 0
    for (let i = 0; i < input.length; i++) {
      diff += Math.abs(output[i] - input[i])
    }
    expect(diff / input.length).toBeGreaterThan(1e-4)
  })
})
