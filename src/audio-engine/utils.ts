
import { ModSource, ModTarget } from './types'

// Seeded random number generator (xorshift32) for deterministic spice randomization
export function seededRandom(seed: string): () => number {
  let state = 0
  for (let i = 0; i < seed.length; i++) {
    state = (state << 5) - state + seed.charCodeAt(i)
    state |= 0
  }
  if (state === 0) state = 1
  return () => {
    state ^= state << 13
    state ^= state >>> 17
    state ^= state << 5
    return ((state >>> 0) / 0xffffffff)
  }
}

export const ensureFinite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback)

export type ManagedSourceNode = AudioScheduledSourceNode & {
  _autoStarted?: boolean
  _started?: boolean
  _managedLifecycleAttached?: boolean
}

export const ensureManagedSource = <T extends AudioScheduledSourceNode>(source: T): T & ManagedSourceNode => {
  const managed = source as T & ManagedSourceNode
  if (!managed._managedLifecycleAttached) {
    managed._managedLifecycleAttached = true
    const handleEnded = () => {
      managed._started = false
    }
    if (typeof managed.addEventListener === 'function') {
      managed.addEventListener('ended', handleEnded as EventListener)
    } else {
      const previous = (managed as any).onended
      ;(managed as any).onended = (event: Event) => {
        handleEnded()
        if (typeof previous === 'function') previous.call(managed, event)
      }
    }
  }
  if (managed._started == null) managed._started = !!managed._autoStarted
  return managed
}

export const markSourceStarted = (source: AudioScheduledSourceNode) => {
  const managed = ensureManagedSource(source)
  managed._started = true
}

export const markSourceAutoStarted = (source: AudioScheduledSourceNode) => {
  const managed = ensureManagedSource(source)
  managed._autoStarted = true
  managed._started = true
}

export const isAudioSource = (source: ModSource) => source === 'lfo1' || source === 'lfo2'

export const isAudioTarget = (target: ModTarget) =>
  target === 'filter.cutoff' ||
  target === 'filter.q' ||
  target === 'master.gain' ||
  target === 'mix'

export const isControlSource = (source: ModSource) => source === 'exprX' || source === 'exprY' || source === 'seqStep' || source === 'velocity' || source === 'gate'

export const clampValue = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export function createNoiseBuffer(ctx: AudioContext) {
  const bufferSize = ctx.sampleRate * 1
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1
  }
  return buffer
}
