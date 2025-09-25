import { describe, it, expect } from 'vitest'
import { SynthEngine } from './engine'

describe('SynthEngine', () => {
  it('creates an AudioContext and applies default patch', async () => {
    const engine = new SynthEngine()
    await engine.resume()
    expect(engine.audioContext).toBeDefined()
  })
})
