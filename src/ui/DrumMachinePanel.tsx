import React, { useEffect, useRef, useState } from 'react'
import { SynthEngine, defaultPatch, type Patch } from '../audio-engine/engine'
import { useStore, type State } from '../state/store'

const STEPS = 16

const INSTRUMENTS: Array<{ id: string; label: string; midi: number; patch: Partial<Patch> }> = [
  {
    id: 'kick',
    label: 'Kick',
    midi: 36,
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
    id: 'snare',
    label: 'Snare',
    midi: 38,
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
    id: 'hat',
    label: 'Hat',
    midi: 42,
    patch: {
      osc1: { wave: 'noise', detune: 0 },
      osc2: { wave: 'triangle', detune: 24 },
      mix: 0.7,
      envelope: { attack: 0.001, decay: 0.08, sustain: 0, release: 0.05 },
      filter: { type: 'highpass', cutoff: 5000, q: 0.9 },
      master: { gain: 0.22 },
    },
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
  const [pattern, setPattern] = useState<Pattern>(() => makeInitialPattern())
  const [step, setStep] = useState(0)
  const voicesRef = useRef<Record<string, SynthEngine>>({})
  const patternRef = useRef(pattern)

  useEffect(() => {
    patternRef.current = pattern
  }, [pattern])


  const ensureVoice = async (instrumentId: string) => {
    let voice = voicesRef.current[instrumentId]
    if (!voice) {
      voice = new SynthEngine()
      voicesRef.current[instrumentId] = voice
    }
    await voice.resume()
    const patch = INSTRUMENTS.find((i) => i.id === instrumentId)?.patch
    if (patch) voice.applyPatch({ ...defaultPatch, ...patch })
    return voice
  }

  const playStep = async (index: number) => {
    const currentPattern = patternRef.current
    const active = INSTRUMENTS.filter((inst) => currentPattern[inst.id]?.[index])
    for (const inst of active) {
      const voice = await ensureVoice(inst.id)
      voice.previewNote(inst.midi, 180)
    }
  }

  useEffect(() => {
    if (!playing) {
      setStep(0)
      return
    }
    const currentStep = transportTick % STEPS
    setStep(currentStep)
    void playStep(currentStep)
  }, [transportTick, playing])

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

  return (
    <div className="drum-machine">
      <div className="drum-controls">
        <button className="play-button" onClick={() => setPlayingGlobal(!playing)}>{playing ? 'Stop' : 'Play'}</button>
        <label className="tempo-control">
          <span>Tempo</span>
          <input
            type="range"
            min={60}
            max={180}
            step={1}
            value={tempo}
            onChange={(e) => setTempoGlobal(Number(e.target.value))}
          />
          <span className="tempo-value">{tempo} BPM</span>
        </label>
      </div>
      <div className="drum-grid">
        {INSTRUMENTS.map((inst) => (
          <div key={inst.id} className="drum-row">
            <div className="drum-label">{inst.label}</div>
            <div className="drum-steps">
              {pattern[inst.id]?.map((active, idx) => {
                const isCurrent = playing && step === idx
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
