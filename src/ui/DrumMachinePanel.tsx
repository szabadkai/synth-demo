import React, { useEffect, useRef, useState } from 'react'
import { SynthEngine, defaultPatch, type Patch } from '../audio-engine/engine'
import { useStore, type State } from '../state/store'
import { Knob } from './controls/Knob'

type InstrumentVoice = {
  name: string
  patch: Partial<Patch>
}

type InstrumentConfig = {
  id: string
  label: string
  midi: number
  voices: InstrumentVoice[]
}

const STEPS = 16

const INSTRUMENTS: InstrumentConfig[] = [
  {
    id: 'kick',
    label: 'Kick',
    midi: 36,
    voices: [
      {
        name: 'Classic',
        patch: {
          osc1: { wave: 'sine', detune: -24 },
          osc2: { wave: 'sine', detune: 0 },
          mix: 0,
          envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.08 },
          filter: { type: 'lowpass', cutoff: 380, q: 0.8 },
          master: { gain: 0.35 },
        },
      },
      {
        name: 'Boom',
        patch: {
          osc1: { wave: 'sine', detune: -36 },
          osc2: { wave: 'triangle', detune: -12 },
          mix: 0.25,
          envelope: { attack: 0.001, decay: 0.32, sustain: 0, release: 0.22 },
          filter: { type: 'lowpass', cutoff: 240, q: 1.1 },
          master: { gain: 0.38 },
        },
      },
      {
        name: 'Punch',
        patch: {
          osc1: { wave: 'sawtooth', detune: -12 },
          osc2: { wave: 'square', detune: 0 },
          mix: 0.6,
          envelope: { attack: 0.001, decay: 0.16, sustain: 0, release: 0.1 },
          filter: { type: 'bandpass', cutoff: 680, q: 1.8 },
          master: { gain: 0.33 },
        },
      },
      {
        name: 'Snap',
        patch: {
          osc1: { wave: 'triangle', detune: -24 },
          osc2: { wave: 'noise', detune: 0 },
          mix: 0.2,
          envelope: { attack: 0.001, decay: 0.12, sustain: 0, release: 0.08 },
          filter: { type: 'highpass', cutoff: 320, q: 0.7 },
          master: { gain: 0.3 },
        },
      },
      {
        name: '808',
        patch: {
          osc1: { wave: 'sine', detune: -12 },
          osc2: { wave: 'sine', detune: -12, detuneFine: -5 },
          mix: 0.4,
          envelope: { attack: 0.001, decay: 0.5, sustain: 0.05, release: 0.4 },
          filter: { type: 'lowpass', cutoff: 180, q: 1.4 },
          master: { gain: 0.36 },
        },
      },
      {
        name: 'Drive',
        patch: {
          osc1: { wave: 'sawtooth', detune: -7 },
          osc2: { wave: 'sawtooth', detune: 5 },
          mix: 0.5,
          envelope: { attack: 0.001, decay: 0.24, sustain: 0.05, release: 0.18 },
          filter: { type: 'lowpass', cutoff: 420, q: 1.6 },
          master: { gain: 0.32 },
          ring: { enabled: true, amount: 0.35 },
        },
      },
      {
        name: 'Click',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'sine', detune: -24 },
          mix: 0.15,
          envelope: { attack: 0.001, decay: 0.1, sustain: 0, release: 0.06 },
          filter: { type: 'highpass', cutoff: 400, q: 1 },
          master: { gain: 0.28 },
        },
      },
      {
        name: 'Thud',
        patch: {
          osc1: { wave: 'triangle', detune: -24 },
          osc2: { wave: 'triangle', detune: -36 },
          mix: 0.3,
          envelope: { attack: 0.001, decay: 0.26, sustain: 0.05, release: 0.2 },
          filter: { type: 'lowpass', cutoff: 260, q: 1.2 },
          master: { gain: 0.37 },
        },
      },
    ],
  },
  {
    id: 'snare',
    label: 'Snare',
    midi: 38,
    voices: [
      {
        name: 'Tight',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'triangle', detune: 12 },
          mix: 0.55,
          envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.12 },
          filter: { type: 'bandpass', cutoff: 1800, q: 2.8 },
          master: { gain: 0.28 },
        },
      },
      {
        name: 'Crack',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'square', detune: 24 },
          mix: 0.65,
          envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.09 },
          filter: { type: 'highpass', cutoff: 2800, q: 1.6 },
          master: { gain: 0.26 },
        },
      },
      {
        name: 'Wide',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'sawtooth', detune: 7 },
          mix: 0.6,
          envelope: { attack: 0.001, decay: 0.28, sustain: 0.05, release: 0.18 },
          filter: { type: 'bandpass', cutoff: 1500, q: 1.4 },
          master: { gain: 0.3 },
        },
      },
      {
        name: 'LoFi',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'triangle', detune: -12 },
          mix: 0.4,
          envelope: { attack: 0.001, decay: 0.24, sustain: 0, release: 0.18 },
          filter: { type: 'bandpass', cutoff: 950, q: 3.2 },
          master: { gain: 0.24 },
        },
      },
      {
        name: 'Brush',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'noise', detune: 12 },
          mix: 0.5,
          envelope: { attack: 0.001, decay: 0.32, sustain: 0.05, release: 0.24 },
          filter: { type: 'highpass', cutoff: 1400, q: 0.9 },
          master: { gain: 0.22 },
        },
      },
      {
        name: 'Snap',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'sine', detune: 5 },
          mix: 0.35,
          envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.08 },
          filter: { type: 'bandpass', cutoff: 2000, q: 2.1 },
          master: { gain: 0.25 },
        },
      },
      {
        name: 'Clap',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'noise', detune: 12 },
          mix: 0.8,
          envelope: { attack: 0.001, decay: 0.26, sustain: 0, release: 0.22 },
          filter: { type: 'bandpass', cutoff: 1200, q: 1 },
          master: { gain: 0.27 },
        },
      },
      {
        name: 'Body',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'triangle', detune: -7 },
          mix: 0.45,
          envelope: { attack: 0.001, decay: 0.3, sustain: 0.1, release: 0.24 },
          filter: { type: 'bandpass', cutoff: 900, q: 1.8 },
          master: { gain: 0.31 },
        },
      },
    ],
  },
  {
    id: 'hat',
    label: 'Hat',
    midi: 42,
    voices: [
      {
        name: 'Closed',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'triangle', detune: 24 },
          mix: 0.7,
          envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
          filter: { type: 'highpass', cutoff: 5000, q: 0.9 },
          master: { gain: 0.22 },
        },
      },
      {
        name: 'Open',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'noise', detune: 24 },
          mix: 0.65,
          envelope: { attack: 0.001, decay: 0.32, sustain: 0.15, release: 0.3 },
          filter: { type: 'highpass', cutoff: 4200, q: 0.7 },
          master: { gain: 0.25 },
        },
      },
      {
        name: 'Tight',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'square', detune: 18 },
          mix: 0.5,
          envelope: { attack: 0.001, decay: 0.06, sustain: 0, release: 0.04 },
          filter: { type: 'highpass', cutoff: 6200, q: 1.1 },
          master: { gain: 0.2 },
        },
      },
      {
        name: 'Shimmer',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'sawtooth', detune: 12 },
          mix: 0.55,
          envelope: { attack: 0.001, decay: 0.14, sustain: 0, release: 0.1 },
          filter: { type: 'bandpass', cutoff: 6800, q: 2.2 },
          master: { gain: 0.23 },
        },
      },
      {
        name: 'Metal',
        patch: {
          osc1: { wave: 'triangle', detune: 24 },
          osc2: { wave: 'square', detune: 36 },
          mix: 0.45,
          envelope: { attack: 0.001, decay: 0.18, sustain: 0.05, release: 0.12 },
          filter: { type: 'highpass', cutoff: 4600, q: 1.5 },
          master: { gain: 0.24 },
        },
      },
      {
        name: 'Loose',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'noise', detune: 36 },
          mix: 0.75,
          envelope: { attack: 0.001, decay: 0.22, sustain: 0.1, release: 0.18 },
          filter: { type: 'highpass', cutoff: 3800, q: 0.8 },
          master: { gain: 0.26 },
        },
      },
      {
        name: 'Chick',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'triangle', detune: 30 },
          mix: 0.5,
          envelope: { attack: 0.001, decay: 0.09, sustain: 0, release: 0.05 },
          filter: { type: 'highpass', cutoff: 5400, q: 1.3 },
          master: { gain: 0.21 },
        },
      },
      {
        name: 'Airy',
        patch: {
          osc1: { wave: 'noise', detune: 0 },
          osc2: { wave: 'noise', detune: 18 },
          mix: 0.6,
          envelope: { attack: 0.001, decay: 0.18, sustain: 0.08, release: 0.18 },
          filter: { type: 'highpass', cutoff: 6400, q: 0.9 },
          master: { gain: 0.2 },
        },
      },
    ],
  },
]

type Pattern = Record<string, boolean[]>

function makeInitialPattern(): Pattern {
  const pattern: Pattern = {}
  for (const inst of INSTRUMENTS) {
    pattern[inst.id] = Array.from({ length: STEPS }, () => false)
  }
  pattern.kick[0] = true
  pattern.kick[8] = true
  pattern.snare[4] = true
  pattern.snare[12] = true
  pattern.hat = pattern.hat.map((_, i) => i % 2 === 0)
  return pattern
}

export function DrumMachinePanel() {
  const tempo = useStore((s: State) => s.transport.tempo)
  const playing = useStore((s: State) => s.transport.playing)
  const transportTick = useStore((s: State) => s.transport.tick)
  const setTempoGlobal = useStore((s: State) => s.setTempo)
  const setPlayingGlobal = useStore((s: State) => s.setTransportPlaying)
  const [enabled, setEnabled] = useState(true)
  const [pattern, setPattern] = useState<Pattern>(() => makeInitialPattern())
  const [step, setStep] = useState(0)
  const [voiceIndices, setVoiceIndices] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    for (const inst of INSTRUMENTS) {
      initial[inst.id] = 0
    }
    return initial
  })

  const voicesRef = useRef<Record<string, SynthEngine>>({})
  const patternRef = useRef(pattern)
  const voiceIndicesRef = useRef(voiceIndices)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    patternRef.current = pattern
  }, [pattern])

  useEffect(() => {
    voiceIndicesRef.current = voiceIndices
  }, [voiceIndices])

  useEffect(() => {
    enabledRef.current = enabled
    if (!enabled) {
      setStep(0)
    }
  }, [enabled])

  const applyVoicePatch = (instrumentId: string, voiceIndex: number, engine?: SynthEngine) => {
    const inst = INSTRUMENTS.find((item) => item.id === instrumentId)
    if (!inst) return
    const selected = inst.voices[voiceIndex] ?? inst.voices[0]
    if (!selected) return
    const target = engine ?? voicesRef.current[instrumentId]
    if (!target) return
    target.applyPatch({ ...defaultPatch, ...selected.patch })
  }

  const ensureVoice = async (instrumentId: string) => {
    let voice = voicesRef.current[instrumentId]
    if (!voice) {
      voice = new SynthEngine()
      voicesRef.current[instrumentId] = voice
    }
    await voice.resume()
    const currentVoiceIndex = voiceIndicesRef.current[instrumentId] ?? 0
    applyVoicePatch(instrumentId, currentVoiceIndex, voice)
    return voice
  }

  const playStep = async (index: number) => {
    if (!enabledRef.current) return
    const currentPattern = patternRef.current
    const active = INSTRUMENTS.filter((inst) => currentPattern[inst.id]?.[index])
    for (const inst of active) {
      const voice = await ensureVoice(inst.id)
      voice.previewNote(inst.midi, 180)
    }
  }

  useEffect(() => {
    if (!playing || !enabled) {
      setStep(0)
      return
    }
    const currentStep = transportTick % STEPS
    setStep(currentStep)
    void playStep(currentStep)
  }, [transportTick, playing, enabled])

  useEffect(() => () => {
    for (const voice of Object.values(voicesRef.current)) {
      try {
        voice.audioContext.close()
      } catch {}
    }
    voicesRef.current = {}
  }, [])

  const toggleStep = (instrumentId: string, index: number) => {
    setPattern((prev) => {
      const next = { ...prev, [instrumentId]: [...prev[instrumentId]] }
      next[instrumentId][index] = !next[instrumentId][index]
      return next
    })
  }

  const handleVoiceChange = (instrumentId: string, rawValue: number) => {
    const inst = INSTRUMENTS.find((item) => item.id === instrumentId)
    if (!inst) return
    const maxIndex = inst.voices.length - 1
    const clamped = Math.round(Math.min(maxIndex, Math.max(0, rawValue)))
    setVoiceIndices((prev) => ({ ...prev, [instrumentId]: clamped }))
    applyVoicePatch(instrumentId, clamped)
  }

  return (
    <div className="drum-machine">
      <div className="drum-controls">
        <button
          className="play-button"
          onClick={() => setPlayingGlobal(!playing)}
          disabled={!enabled}
        >
          {playing ? 'Stop' : 'Play'}
        </button>
        <label className="drum-enable-toggle">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => setEnabled(event.target.checked)}
          />
          <span>On</span>
        </label>
        <Knob
          label="Tempo"
          min={60}
          max={180}
          step={1}
          value={tempo}
          onChange={(value) => setTempoGlobal(value)}
        />
        {INSTRUMENTS.map((inst) => {
          const voiceIndex = voiceIndices[inst.id] ?? 0
          return (
            <Knob
              key={`${inst.id}-voice`}
              label={`${inst.label} Voice`}
              min={0}
              max={inst.voices.length - 1}
              step={1}
              value={voiceIndex}
              onChange={(value) => handleVoiceChange(inst.id, value)}
              formatValue={(value) => inst.voices[Math.round(value)]?.name ?? ''}
            />
          )
        })}
      </div>
      <div className="drum-grid">
        {INSTRUMENTS.map((inst) => (
          <div key={inst.id} className="drum-row">
            <div className="drum-label">{inst.label}</div>
            <div className="drum-steps">
              {pattern[inst.id]?.map((active, idx) => {
                const isCurrent = playing && enabled && step === idx
                return (
                  <button
                    key={idx}
                    className={`drum-step${active ? ' active' : ''}${isCurrent ? ' current' : ''}`}
                    onClick={() => toggleStep(inst.id, idx)}
                  />
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
