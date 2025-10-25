import React from 'react'
import { useStore, type State } from '../state/store'
import { defaultPatch } from '../audio-engine/engine'
import type { Patch } from '../audio-engine/engine'
import { Knob } from './controls/Knob'

const MODE_OPTIONS = ['up', 'down', 'updown', 'random', 'asplayed', 'sequence'] as const
const MODE_LABELS = ['Up', 'Down', 'Up-Down', 'Random', 'As Played', 'Sequence']
const CHORD_OPTIONS = ['none', 'power', 'major', 'minor', 'sus2', 'sus4', 'maj7', 'min7', 'sequencer'] as const
const CHORD_LABELS = ['Single', 'Power', 'Major', 'Minor', 'Sus2', 'Sus4', 'Maj7', 'Min7', 'Seq']
const DIVISION_OPTIONS = ['1/4', '1/8', '1/8T', '1/16', '1/16T'] as const

export function ArpPanel() {
  const patch = useStore((s: State) => s.patch)
  const update = useStore((s: State) => s.updatePatch)
  const engine = useStore((s: State) => s.engine)
  const tempo = useStore((s: State) => s.transport.tempo)
  const setTempo = useStore((s: State) => s.setTempo)
  const arp = (patch.arp ?? defaultPatch.arp)!
  const seq = (patch.sequencer ?? defaultPatch.sequencer)!
  const [status, setStatus] = React.useState<{ enabled: boolean; stepIndex: number; length: number }>({ enabled: false, stepIndex: 0, length: 0 })

  const setArp = (changes: Partial<typeof arp>) => {
    update({ arp: { ...arp, ...changes } })
  }

  const chordSource = arp.chordSource ?? 'preset'
  const sequencerChordCount = React.useMemo(() => {
    const steps = seq.steps ?? []
    const length = Math.max(1, Math.min(steps.length, seq.length))
    const offsets = new Set<number>()
    for (let i = 0; i < length; i++) {
      const step = steps[i]
      if (step?.on) offsets.add(Math.round(step.offset ?? 0))
    }
    return offsets.size
  }, [seq])

  // Derive indices for knob values
  const modeIndex = MODE_OPTIONS.indexOf(arp.mode)
  const chordValue = chordSource === 'sequencer' ? 'sequencer' : (arp.chord ?? 'none')
  const chordIndex = CHORD_OPTIONS.indexOf(chordValue as any)
  const divisionIndex = DIVISION_OPTIONS.indexOf(arp.division)

  React.useEffect(() => {
    if (!engine) return
    const id = setInterval(() => {
      const s = (engine as any).getArpStatus?.()
      if (s) setStatus(s)
    }, 120)
    return () => clearInterval(id)
  }, [engine])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Toggles and controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={arp.enabled}
            onChange={(e) => update({ arp: { ...arp, enabled: e.target.checked } })}
          />
          <span className="label">On</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={arp.latch || false}
            onChange={(e) => update({ arp: { ...arp, latch: e.target.checked } })}
            disabled={!arp.enabled}
          />
          <span className="label">Latch</span>
        </label>
        <button
          onClick={() => engine?.arpClear()}
          disabled={!arp.enabled}
          style={{
            padding: '6px 10px', fontSize: 12, borderRadius: 6,
            background: 'transparent', border: '1px solid var(--border, #2a3040)', color: 'var(--text)'
          }}
        >
          Clear
        </button>
      </div>

      {/* All knobs in one flexible row */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
        <Knob
          label="Mode"
          min={0}
          max={MODE_OPTIONS.length - 1}
          step={1}
          value={modeIndex >= 0 ? modeIndex : 0}
          onChange={(v) => {
            const idx = Math.round(v)
            const mode = MODE_OPTIONS[idx]
            if (mode) setArp({ mode })
          }}
          disabled={!arp.enabled}
          formatValue={(v) => MODE_LABELS[Math.round(v)] ?? 'Up'}
        />
        <Knob
          label="Octaves"
          min={1}
          max={4}
          step={1}
          value={arp.octaves}
          onChange={(v) => setArp({ octaves: Math.round(v) })}
          disabled={!arp.enabled}
        />
        <Knob
          label="Chord"
          min={0}
          max={CHORD_OPTIONS.length - 1}
          step={1}
          value={chordIndex >= 0 ? chordIndex : 0}
          onChange={(v) => {
            const idx = Math.round(v)
            const value = CHORD_OPTIONS[idx]
            if (value === 'sequencer') {
              setArp({ chordSource: 'sequencer', chord: 'none' })
            } else {
              setArp({ chordSource: 'preset', chord: value as NonNullable<Patch['arp']>['chord'] })
            }
          }}
          disabled={!arp.enabled}
          formatValue={(v) => CHORD_LABELS[Math.round(v)] ?? 'Single'}
        />
        <Knob
          label="Division"
          min={0}
          max={DIVISION_OPTIONS.length - 1}
          step={1}
          value={divisionIndex >= 0 ? divisionIndex : 3}
          onChange={(v) => {
            const idx = Math.round(v)
            const division = DIVISION_OPTIONS[idx]
            if (division) setArp({ division })
          }}
          disabled={!arp.enabled}
          formatValue={(v) => DIVISION_OPTIONS[Math.round(v)] ?? '1/16'}
        />
        <Knob
          label="Tempo"
          min={40}
          max={240}
          step={1}
          value={tempo}
          onChange={(v) => {
            setTempo(v)
            setArp({ bpm: v, bpmSync: true })
          }}
          disabled={!arp.enabled}
        />
        <Knob label="Gate" min={0.05} max={1} step={0.01} value={arp.gate} onChange={(v) => update({ arp: { ...arp, gate: v } })} disabled={!arp.enabled} />
        <Knob label="Swing" min={0} max={0.75} step={0.01} value={arp.swingPct ?? 0} onChange={(v) => update({ arp: { ...arp, swingPct: v } })} disabled={!arp.enabled || !(arp.bpmSync)} />
        <Knob
          label="Repeats"
          min={1}
          max={4}
          step={1}
          value={arp.repeats ?? 1}
          onChange={(v) => setArp({ repeats: Math.round(v) })}
          disabled={!arp.enabled}
          formatValue={(v) => `${Math.round(v)}x`}
        />
        <Knob
          label="Length"
          min={0}
          max={16}
          step={1}
          value={arp.patternLen ?? 0}
          onChange={(v) => setArp({ patternLen: Math.round(v) })}
          disabled={!arp.enabled}
          formatValue={(v) => {
            const val = Math.round(v)
            return val === 0 ? 'Auto' : `${val}`
          }}
        />
      </div>

      {chordSource === 'sequencer' && (
        <div className="hint-text" style={{ fontSize: 12, opacity: 0.8 }}>
          Sequencer pattern{sequencerChordCount > 0 ? ` • ${sequencerChordCount} interval${sequencerChordCount === 1 ? '' : 's'}` : ' • no active steps yet'}
        </div>
      )}
    </div>
  )
}
