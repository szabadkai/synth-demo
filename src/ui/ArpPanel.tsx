import React from 'react'
import { useStore, type State } from '../state/store'
import { defaultPatch } from '../audio-engine/engine'
import type { Patch } from '../audio-engine/engine'
import { Slider } from './controls/Slider'
import { Knob } from './controls/Knob'

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

  React.useEffect(() => {
    if (!engine) return
    const id = setInterval(() => {
      const s = (engine as any).getArpStatus?.()
      if (s) setStatus(s)
    }, 120)
    return () => clearInterval(id)
  }, [engine])

  return (
    <div className="controls-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {/* Row 1: toggles + clear + mode */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={arp.enabled}
          onChange={(e) => update({ arp: { ...arp, enabled: e.target.checked } })}
        />
        <span className="label">Enabled</span>
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
          justifySelf: 'start', alignSelf: 'end',
          padding: '6px 10px', fontSize: 12, borderRadius: 6,
          background: 'transparent', border: '1px solid var(--border, #2a3040)', color: 'var(--text)'
        }}
      >
        Clear
      </button>
      <label>
        <div className="label">Mode</div>
        <select value={arp.mode} onChange={(e) => update({ arp: { ...arp, mode: e.target.value as any } })} disabled={!arp.enabled}>
          <option value="up">Up</option>
          <option value="down">Down</option>
          <option value="updown">Up-Down</option>
          <option value="random">Random</option>
          <option value="asplayed">As Played</option>
        </select>
      </label>

      {/* Row 2: octaves + sync + division/rate + bpm */}
      <label>
        <div className="label">Octaves</div>
        <select value={arp.octaves} onChange={(e) => update({ arp: { ...arp, octaves: Number(e.target.value) } })} disabled={!arp.enabled}>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
          <option value={4}>4</option>
        </select>
      </label>
      <label>
        <div className="label">Chord</div>
        <select
          value={chordSource === 'sequencer' ? 'sequencer' : (arp.chord ?? 'none')}
          onChange={(e) => {
            const value = e.target.value as string
            if (value === 'sequencer') {
              setArp({ chordSource: 'sequencer' })
            } else {
              setArp({ chordSource: 'preset', chord: value as NonNullable<Patch['arp']>['chord'] })
            }
          }}
          disabled={!arp.enabled}
        >
          <option value="none">Single</option>
          <option value="power">Power (5th)</option>
          <option value="major">Major Triad</option>
          <option value="minor">Minor Triad</option>
          <option value="sus2">Sus2</option>
          <option value="sus4">Sus4</option>
          <option value="maj7">Major 7th</option>
          <option value="min7">Minor 7th</option>
          <option value="sequencer">Sequencer Pattern</option>
        </select>
      </label>
      {chordSource === 'sequencer' && (
        <div className="hint-text" style={{ gridColumn: 'span 2', fontSize: 12, opacity: 0.8, alignSelf: 'end' }}>
          Sequencer pattern{sequencerChordCount > 0 ? ` • ${sequencerChordCount} interval${sequencerChordCount === 1 ? '' : 's'}` : ' • no active steps yet'}
        </div>
      )}
      <label>
        <div className="label">Division</div>
        <select value={arp.division} onChange={(e) => setArp({ division: e.target.value as any })} disabled={!arp.enabled}>
          <option value="1/4">1/4</option>
          <option value="1/8">1/8</option>
          <option value="1/8T">1/8T</option>
          <option value="1/16">1/16</option>
          <option value="1/16T">1/16T</option>
        </select>
      </label>
      <Slider
        label="BPM"
        min={40}
        max={240}
        step={1}
        value={tempo}
        onChange={(v) => {
          setTempo(v)
          setArp({ bpm: v, bpmSync: true })
        }}
        disabled={!arp.enabled}
        format={(v) => `${Math.round(v)}`}
      />

      {/* Row 3: gate across */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'flex-start', padding: '6px 0' }}>
        <Knob label="Gate" min={0.05} max={1} step={0.01} value={arp.gate} onChange={(v) => update({ arp: { ...arp, gate: v } })} disabled={!arp.enabled} />
        <Knob label="Swing" min={0} max={0.75} step={0.01} value={arp.swingPct ?? 0} onChange={(v) => update({ arp: { ...arp, swingPct: v } })} disabled={!arp.enabled || !(arp.bpmSync)} />
      </div>

      {/* Row 4: repeats + pattern length */}
      <div style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label>
          <div className="label">Repeats</div>
          <select value={arp.repeats ?? 1} onChange={(e) => update({ arp: { ...arp, repeats: Number(e.target.value) } })} disabled={!arp.enabled}>
            {[1,2,3,4].map(n => <option key={n} value={n}>{n}x</option>)}
          </select>
        </label>
        <label>
          <div className="label">Length</div>
          <select value={arp.patternLen ?? 0} onChange={(e) => update({ arp: { ...arp, patternLen: Number(e.target.value) } })} disabled={!arp.enabled}>
            <option value={0}>Auto</option>
            {Array.from({ length: 16 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>

      {/* Row 5: Step indicator */}
    </div>
  )
}
