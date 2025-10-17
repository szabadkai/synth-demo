const TWO_PI = Math.PI * 2

const clamp = (value: number, min: number, max: number) => {
  if (value < min) return min
  if (value > max) return max
  return value
}

const nextPow2 = (value: number) => {
  let v = 1
  while (v < value) v <<= 1
  return v
}

const bitReversePermutation = (n: number) => {
  const result = new Uint32Array(n)
  let bits = 0
  while ((1 << bits) < n) bits++
  for (let i = 0; i < n; i++) {
    let j = 0
    let x = i
    for (let k = 0; k < bits; k++) {
      j = (j << 1) | (x & 1)
      x >>= 1
    }
    result[i] = j
  }
  return result
}

const makeHannWindow = (size: number) => {
  const win = new Float32Array(size)
  const factor = TWO_PI / (size - 1)
  for (let i = 0; i < size; i++) {
    win[i] = 0.5 * (1 - Math.cos(factor * i))
  }
  return win
}

class FftContext {
  readonly size: number
  readonly permutation: Uint32Array
  readonly twiddleReal: Float32Array[]
  readonly twiddleImag: Float32Array[]

  constructor(size: number) {
    this.size = size
    this.permutation = bitReversePermutation(size)
    this.twiddleReal = []
    this.twiddleImag = []
    for (let span = 2; span <= size; span <<= 1) {
      const half = span >> 1
      const step = TWO_PI / span
      const tableR = new Float32Array(half)
      const tableI = new Float32Array(half)
      for (let k = 0; k < half; k++) {
        tableR[k] = Math.cos(step * k)
        tableI[k] = Math.sin(step * k)
      }
      this.twiddleReal.push(tableR)
      this.twiddleImag.push(tableI)
    }
  }

  fft(real: Float32Array, imag: Float32Array, inverse: boolean) {
    const { size, permutation, twiddleReal, twiddleImag } = this
    for (let i = 0; i < size; i++) {
      const j = permutation[i]
      if (j > i) {
        const tmpR = real[i]
        const tmpI = imag[i]
        real[i] = real[j]
        imag[i] = imag[j]
        real[j] = tmpR
        imag[j] = tmpI
      }
    }
    let stage = 0
    for (let span = 2; span <= size; span <<= 1) {
      const half = span >> 1
      const tableR = twiddleReal[stage]
      const tableI = twiddleImag[stage]
      for (let offset = 0; offset < size; offset += span) {
        for (let k = 0; k < half; k++) {
          const evenIndex = offset + k
          const oddIndex = evenIndex + half
          const wr = tableR[k]
          const wi = inverse ? -tableI[k] : tableI[k]
          const oddR = real[oddIndex]
          const oddI = imag[oddIndex]
          const tr = wr * oddR - wi * oddI
          const ti = wr * oddI + wi * oddR
          const evenR = real[evenIndex]
          const evenI = imag[evenIndex]
          real[oddIndex] = evenR - tr
          imag[oddIndex] = evenI - ti
          real[evenIndex] = evenR + tr
          imag[evenIndex] = evenI + ti
        }
      }
      stage++
    }
    if (inverse) {
      const inv = 1 / size
      for (let i = 0; i < size; i++) {
        real[i] *= inv
        imag[i] *= inv
      }
    }
  }
}

const VOCODER_WINDOW = 2048
const VOCODER_HOP = 512

const getFrameCount = (length: number, windowSize: number, hop: number) => {
  if (length <= 0) return 0
  if (length <= windowSize) return 1
  return Math.ceil((length - windowSize) / hop) + 1
}

const unwrapPhase = (value: number) => {
  if (value > Math.PI || value < -Math.PI) {
    value -= TWO_PI * Math.round(value / TWO_PI)
  }
  return value
}

export type PhaseVocoderOptions = {
  channels: Float32Array[]
  pitchRatio: number
  windowSize?: number
  hopSize?: number
}

export const phaseVocoderPitchShift = (options: PhaseVocoderOptions): Float32Array[] => {
  const { channels, pitchRatio } = options
  const windowSize = nextPow2(clamp(options.windowSize ?? VOCODER_WINDOW, 256, 8192))
  const hopSize = clamp(options.hopSize ?? VOCODER_HOP, 1, windowSize >> 1)
  if (!channels.length) return []
  const pitch = Number.isFinite(pitchRatio) && pitchRatio > 0 ? pitchRatio : 1
  if (Math.abs(pitch - 1) < 1e-6) {
    return channels.map((data) => new Float32Array(data))
  }
  const length = channels[0].length
  if (length === 0) return channels.map(() => new Float32Array(0))

  const window = makeHannWindow(windowSize)
  const fft = new FftContext(windowSize)
  const bins = (windowSize >> 1) + 1

  const frameCount = getFrameCount(length, windowSize, hopSize)
  const outLength = length + windowSize
  const output: Float32Array[] = channels.map(() => new Float32Array(outLength))
  const norm = new Float32Array(outLength)

  const real = new Float32Array(windowSize)
  const imag = new Float32Array(windowSize)
  const specR = new Float32Array(windowSize)
  const specI = new Float32Array(windowSize)

  const mag = new Float32Array(bins)
  const inst = new Float32Array(bins)

  const prevPhasePerChannel = channels.map(() => new Float32Array(bins))
  const phaseAccPerChannel = channels.map(() => new Float32Array(bins))

  for (let frame = 0; frame < frameCount; frame++) {
    const frameOffset = frame * hopSize

    for (let ch = 0; ch < channels.length; ch++) {
      const channel = channels[ch]
      real.fill(0)
      imag.fill(0)
      for (let i = 0; i < windowSize; i++) {
        const sampleIndex = frameOffset + i
        const sample = sampleIndex < length ? channel[sampleIndex] : 0
        real[i] = sample * window[i]
      }

      fft.fft(real, imag, false)

      const prevPhase = prevPhasePerChannel[ch]
      const phaseAcc = phaseAccPerChannel[ch]

      for (let k = 0; k < bins; k++) {
        const re = real[k]
        const im = imag[k]
        const magnitude = Math.hypot(re, im)
        const phase = Math.atan2(im, re)
        const expected = (TWO_PI * hopSize * k) / windowSize
        const delta = unwrapPhase(phase - prevPhase[k] - expected)
        const instFreq = expected + delta
        mag[k] = magnitude
        inst[k] = instFreq
        prevPhase[k] = phase
      }

      specR.fill(0)
      specI.fill(0)

      for (let k = 0; k < bins; k++) {
        const srcIndex = k / pitch
        let magnitude = 0
        let phaseIncrement = 0
        if (srcIndex <= 0) {
          magnitude = mag[0]
          phaseIncrement = inst[0] * pitch
        } else if (srcIndex >= bins - 1) {
          const idx = bins - 1
          magnitude = mag[idx]
          phaseIncrement = inst[idx] * pitch
        } else {
          const lower = Math.floor(srcIndex)
          const upper = lower + 1
          const frac = srcIndex - lower
          const magLower = mag[lower]
          const magUpper = mag[upper]
          const instLower = inst[lower]
          const instUpper = inst[upper]
          magnitude = magLower + frac * (magUpper - magLower)
          const instFreq = instLower + frac * (instUpper - instLower)
          phaseIncrement = instFreq * pitch
        }
        phaseAcc[k] += phaseIncrement
        const phase = phaseAcc[k]
        const realBin = magnitude * Math.cos(phase)
        const imagBin = magnitude * Math.sin(phase)
        specR[k] = realBin
        specI[k] = imagBin
        if (k > 0 && k < bins - 1) {
          const mirrorIndex = windowSize - k
          specR[mirrorIndex] = realBin
          specI[mirrorIndex] = -imagBin
        }
      }

      specI[0] = 0
      specI[bins - 1] = 0

      fft.fft(specR, specI, true)

      for (let i = 0; i < windowSize; i++) {
        const idx = frameOffset + i
        if (idx >= outLength) break
        const win = window[i]
        output[ch][idx] += specR[i] * win
        if (ch === 0) norm[idx] += win * win
      }
    }
  }

  const finalOutputs = output.map((channelOutput) => {
    const slice = channelOutput.subarray(0, length)
    for (let i = 0; i < slice.length; i++) {
      const weight = norm[i]
      if (weight > 1e-6) slice[i] /= weight
    }
    return Float32Array.from(slice)
  })

  return finalOutputs
}
