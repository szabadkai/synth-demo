import React from 'react'
import { useStore, type State } from '../state/store'
import {
  defaultPatch,
  MAX_SEQUENCER_STEPS,
  SEQUENCER_PROGRESSIONS,
  createEmptySequencerStep,
} from '../audio-engine/engine'
import { Knob } from './controls/Knob'

const DIVISION_STEPS = ['1/4', '1/8', '1/8T', '1/16', '1/16T'] as const
const PROGRESSION_PRESETS = SEQUENCER_PROGRESSIONS

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const formatMidiNote = (value: number) => {
  const midi = Math.max(0, Math.min(127, Math.round(value)))
  const name = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return `${name}${octave}`
}

export function SequencerPanel() {
  const patch = useStore((s: State) => s.patch)
  const update = useStore((s: State) => s.updatePatch)
  const engine = useStore((s: State) => s.engine)
  const tempo = useStore((s: State) => s.transport.tempo)
  const transportPlaying = useStore((s: State) => s.transport.playing)
  const transportTick = useStore((s: State) => s.transport.tick)
  const setTempoGlobal = useStore((s: State) => s.setTempo)
  const setTransportPlaying = useStore((s: State) => s.setTransportPlaying)
  const seq = (patch.sequencer ?? defaultPatch.sequencer)!

  const set = React.useCallback((changes: Partial<NonNullable<State['patch']['sequencer']>>) => {
    const base = patch.sequencer ?? defaultPatch.sequencer!
    update({ sequencer: { ...base, ...changes } } as any)
  }, [patch.sequencer, update])

  const steps = seq.steps ?? []
  const len = Math.max(1, Math.min(seq.length, steps.length, MAX_SEQUENCER_STEPS))
  const visibleCount = Math.max(16, Math.min(seq.length, MAX_SEQUENCER_STEPS))
  const divisionIndex = React.useMemo(() => {
    const idx = DIVISION_STEPS.indexOf(seq.division)
    return idx >= 0 ? idx : DIVISION_STEPS.indexOf('1/16')
  }, [seq.division])
  const progressionIndex = React.useMemo(() => {
    const idx = PROGRESSION_PRESETS.findIndex((entry) => entry.id === (seq.progressionMode ?? 'static'))
    return idx >= 0 ? idx : 0
  }, [seq.progressionMode])

  React.useEffect(() => {
    const currentSteps = seq.steps ?? []
    const targetLength = Math.max(1, Math.min(seq.length, MAX_SEQUENCER_STEPS))
    const needsLengthClamp = seq.length !== targetLength
    const needsPadding = currentSteps.length < MAX_SEQUENCER_STEPS
    if (!needsLengthClamp && !needsPadding) return
    const changes: Partial<NonNullable<State['patch']['sequencer']>> = {}
    if (needsLengthClamp) changes.length = targetLength
    if (needsPadding) {
      const nextSteps = currentSteps.slice()
      while (nextSteps.length < MAX_SEQUENCER_STEPS) {
        nextSteps.push(createEmptySequencerStep())
      }
      changes.steps = nextSteps
    }
    set(changes)
  }, [seq.length, seq.steps, set])

  const [status, setStatus] = React.useState<{ enabled: boolean; stepIndex: number; length: number; currentRoot: number | null }>({
    enabled: false,
    stepIndex: 0,
    length: 0,
    currentRoot: seq.rootMidi ?? null,
  })
  const rootDisplay = React.useMemo(() => {
    const current = Number.isFinite(status.currentRoot) ? status.currentRoot : undefined
    return current ?? seq.rootMidi ?? defaultPatch.sequencer!.rootMidi
  }, [status.currentRoot, seq.rootMidi])
  React.useEffect(() => {
    if (!engine) return
    const id = setInterval(() => {
      const s = (engine as any).getSequencerStatus?.()
      if (s) setStatus(s)
    }, 100)
    return () => clearInterval(id)
  }, [engine])

  const updateStep = (i: number, change: Partial<{ on: boolean; offset: number; velocity: number }>) => {
    if (i < 0 || i >= MAX_SEQUENCER_STEPS) return
    const base = steps.slice()
    while (base.length <= i && base.length < MAX_SEQUENCER_STEPS) {
      base.push(createEmptySequencerStep())
    }
    const current = base[i] ?? createEmptySequencerStep()
    base[i] = { ...current, ...change }
    set({ steps: base })
  }

  const REL_MAP: Record<string, number> = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
    o: 13, l: 14, p: 15, ';': 16, "'": 17,
  }
  const gridRef = React.useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = React.useState(0)
  const [kbEdit, setKbEdit] = React.useState(false)
  React.useEffect(() => { setCursor((c) => Math.min(Math.max(0, c), len - 1)) }, [len])
  React.useEffect(() => { if (kbEdit) gridRef.current?.focus() }, [kbEdit])

  React.useEffect(() => {
    if (!seq.enabled) return
    if (seq.bpm !== tempo) set({ bpm: tempo })
  }, [tempo])

  React.useEffect(() => {
    if (!seq.enabled) return
    if (seq.playing !== transportPlaying) set({ playing: transportPlaying })
  }, [transportPlaying, seq.playing, seq.enabled])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!kbEdit || !seq.enabled) return
    const key = e.key
    const lower = key.length === 1 ? key.toLowerCase() : key
    if (lower in REL_MAP) {
      e.preventDefault()
      const offset = REL_MAP[lower]
      updateStep(cursor, { on: true, offset })
      setCursor((c) => (c + 1) % len)
      return
    }
    if (key === 'ArrowRight') { e.preventDefault(); setCursor((c) => (c + 1) % len) }
    else if (key === 'ArrowLeft') { e.preventDefault(); setCursor((c) => (c - 1 + len) % len) }
    else if (key === 'ArrowUp') { e.preventDefault(); updateStep(cursor, { on: true, offset: Math.min(24, (steps[cursor]?.offset || 0) + 1) }) }
    else if (key === 'ArrowDown') { e.preventDefault(); updateStep(cursor, { on: true, offset: Math.max(-24, (steps[cursor]?.offset || 0) - 1) }) }
    else if (key === 'Enter') { e.preventDefault(); updateStep(cursor, { on: !(steps[cursor]?.on) }) }
    else if (key === 'Backspace' || key === 'Delete') { e.preventDefault(); updateStep(cursor, { on: false }) }
    else if (key === '+' || key === '=') { e.preventDefault(); updateStep(cursor, { on: true, offset: Math.min(24, (steps[cursor]?.offset || 0) + 1) }) }
    else if (key === '-' || key === '_') { e.preventDefault(); updateStep(cursor, { on: true, offset: Math.max(-24, (steps[cursor]?.offset || 0) - 1) }) }
    else if (lower === 'z') { e.preventDefault(); set({ rootMidi: Math.max(24, seq.rootMidi - 12) }) }
    else if (lower === 'x') { e.preventDefault(); set({ rootMidi: Math.min(96, seq.rootMidi + 12) }) }
    else if (key === ' ') { e.preventDefault(); setTransportPlaying(!transportPlaying) }
  }

  return (
    <div className="sequence-panel">
      <div className="sequence-controls">
        <button className="play-button" onClick={() => setTransportPlaying(!transportPlaying)} disabled={!seq.enabled}>
          {transportPlaying ? 'Stop' : 'Play'}
        </button>
        <label className="sequence-toggle">
          <input type="checkbox" checked={seq.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
          <span>On</span>
        </label>
        <Knob
          label="Length"
          min={1}
          max={MAX_SEQUENCER_STEPS}
          step={1}
          value={Math.max(1, Math.min(seq.length, MAX_SEQUENCER_STEPS))}
          onChange={(value) => {
            const next = Math.round(value)
            const clamped = Math.max(1, Math.min(MAX_SEQUENCER_STEPS, next))
            set({ length: clamped })
          }}
          disabled={!seq.enabled}
          formatValue={(value) => `${Math.round(value)}`}
        />
        <Knob
          label="Division"
          min={0}
          max={DIVISION_STEPS.length - 1}
          step={1}
          value={divisionIndex}
          onChange={(value) => {
            const idx = Math.round(value)
            const clampedIdx = Math.max(0, Math.min(DIVISION_STEPS.length - 1, idx))
            set({ division: DIVISION_STEPS[clampedIdx] })
          }}
          disabled={!seq.enabled}
          formatValue={(value) => {
            const idx = Math.round(value)
            const clampedIdx = Math.max(0, Math.min(DIVISION_STEPS.length - 1, idx))
            return DIVISION_STEPS[clampedIdx]
          }}
        />
        <Knob
          label="Tempo"
          min={40}
          max={240}
          step={1}
          value={tempo}
          onChange={(value) => {
            setTempoGlobal(value)
            set({ bpm: value })
          }}
          disabled={!seq.enabled}
          formatValue={(value) => `${Math.round(value)}`}
        />
        <Knob label="Gate" min={0.05} max={1} step={0.01} value={seq.gate} onChange={(v) => set({ gate: v })} disabled={!seq.enabled} />
        <Knob label="Swing" min={0} max={0.75} step={0.01} value={seq.swingPct ?? 0} onChange={(v) => set({ swingPct: v })} disabled={!seq.enabled || seq.division.endsWith('T') || seq.division === '1/4'} />
        <Knob
          label="Root"
          min={36}
          max={84}
          step={1}
          value={rootDisplay}
          onChange={(v) => {
            const midi = Math.round(v)
            const clamped = Math.max(0, Math.min(127, midi))
            const updates: Partial<NonNullable<State['patch']['sequencer']>> = { rootMidi: clamped }
            if ((seq.progressionMode ?? 'static') !== 'static') {
              updates.grooveBaseMidi = clamped
            }
            set(updates)
            setStatus((prev) => ({ ...prev, currentRoot: clamped }))
          }}
          disabled={!seq.enabled}
          formatValue={(value) => formatMidiNote(value)}
        />
        <Knob
          label="Progression"
          min={0}
          max={PROGRESSION_PRESETS.length - 1}
          step={1}
          value={progressionIndex}
          onChange={(value) => {
            const idx = Math.round(value)
            const clampedIdx = Math.max(0, Math.min(PROGRESSION_PRESETS.length - 1, idx))
            const preset = PROGRESSION_PRESETS[clampedIdx]
            const baseRoot = Math.round(seq.grooveBaseMidi ?? seq.rootMidi ?? 60)
            const clampedBase = Math.max(0, Math.min(127, baseRoot))
            set({
              progressionMode: preset.id,
              grooveBaseMidi: clampedBase,
            })
            setStatus((prev) => ({ ...prev, currentRoot: clampedBase }))
          }}
          disabled={!seq.enabled}
          formatValue={(value) => {
            const idx = Math.round(value)
            const clampedIdx = Math.max(0, Math.min(PROGRESSION_PRESETS.length - 1, idx))
            return PROGRESSION_PRESETS[clampedIdx].label
          }}
        />
      </div>
      <div className="sequence-body">
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={kbEdit} onChange={(e) => setKbEdit(e.target.checked)} />
            <span className="label">Edit Notes (Keyboard)</span>
          </label>
          <div className="hint-text" style={{ opacity: 0.8 }}>
            Keys: A/W/S... set notes • Arrows move • Z/X root ±1 oct • Space play/pause • +/- semitone • Backspace clear
          </div>
        </div>
        <div ref={gridRef} tabIndex={0} onKeyDown={handleKeyDown} style={{ display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 6, outline: kbEdit ? '1px dashed #2a3040' : 'none', borderRadius: 6, padding: 2 }}>
          {Array.from({ length: visibleCount }, (_, i) => {
            const st = steps[i] ?? createEmptySequencerStep()
            const active = i < len
            const isOn = st.on && active
            const currentTickStep = len > 0 ? transportTick % len : 0
            const isPlaying = status.enabled && transportPlaying && active && currentTickStep === i
            return (
              <div
                key={i}
                onClick={(e) => {
                  if (e.altKey) {
                    updateStep(i, { offset: Math.max(-24, Math.min(24, (st.offset || 0) + 1)) })
                  } else {
                    updateStep(i, { on: !st.on })
                  }
                  setCursor(i)
                }}
                onContextMenu={(e) => { e.preventDefault(); updateStep(i, { offset: Math.max(-24, Math.min(24, (st.offset || 0) - 1)) }) }}
                title={`Step ${i + 1}${st.offset ? `, ${st.offset > 0 ? '+' : ''}${st.offset}` : ''}`}
                style={{
                  height: 44,
                  borderRadius: 6,
                  border: `1px solid ${isPlaying ? 'var(--accent)' : (i === cursor && kbEdit ? 'var(--accent)' : '#2a3040')}`,
                  background: isOn ? (isPlaying ? 'var(--accent)' : '#1d2432') : '#0f1217',
                  color: isOn ? (isPlaying ? '#0f1217' : 'var(--text)') : '#556',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <span style={{ fontSize: 11, opacity: 0.9 }}>{st.offset === 0 ? '0' : (st.offset > 0 ? `+${st.offset}` : `${st.offset}`)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
