import React from 'react'
import { useStore, type State } from '../state/store'
import { defaultPatch } from '../audio-engine/engine'
import { Slider } from './controls/Slider'

function midiToName(m: number) {
  const names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
  const n = Math.round(m)
  const name = names[n % 12]
  const oct = Math.floor(n / 12) - 1
  return `${name}${oct}`
}

export function SequencerPanel() {
  const patch = useStore((s: State) => s.patch)
  const update = useStore((s: State) => s.updatePatch)
  const engine = useStore((s: State) => s.engine)
  const seq = (patch.sequencer ?? defaultPatch.sequencer)!

  const set = (changes: Partial<NonNullable<State['patch']['sequencer']>>) => {
    const base = patch.sequencer ?? defaultPatch.sequencer!
    update({ sequencer: { ...base, ...changes } } as any)
  }

  const steps = seq.steps || []
  const len = Math.max(1, Math.min(steps.length, seq.length))

  const [status, setStatus] = React.useState<{ enabled: boolean; stepIndex: number; length: number }>({ enabled: false, stepIndex: 0, length: 0 })
  React.useEffect(() => {
    if (!engine) return
    const id = setInterval(() => {
      const s = (engine as any).getSequencerStatus?.()
      if (s) setStatus(s)
    }, 100)
    return () => clearInterval(id)
  }, [engine])

  const updateStep = (i: number, change: Partial<{ on: boolean; offset: number; velocity: number }>) => {
    const base = steps.slice()
    base[i] = { ...base[i], ...change }
    set({ steps: base })
  }

  // Keyboard note entry
  const REL_MAP: Record<string, number> = {
    a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
    o: 13, l: 14, p: 15, ';': 16, "'": 17,
  }
  const gridRef = React.useRef<HTMLDivElement>(null)
  const [cursor, setCursor] = React.useState(0)
  const [kbEdit, setKbEdit] = React.useState(false)
  const [audition, setAudition] = React.useState(true)
  React.useEffect(() => { setCursor((c) => Math.min(Math.max(0, c), len - 1)) }, [len])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!kbEdit || !seq.enabled) return
    const key = e.key
    const lower = key.length === 1 ? key.toLowerCase() : key
    if (lower in REL_MAP) {
      e.preventDefault()
      const offset = REL_MAP[lower]
      updateStep(cursor, { on: true, offset })
      if (audition && engine) (engine as any).previewNote?.(seq.rootMidi + offset, 120)
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
    else if (key === ' ') { e.preventDefault(); set({ playing: !seq.playing }) }
  }

  return (
    <div className="controls-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
      {/* Row 1: enable + play + mode controls */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={seq.enabled} onChange={(e) => set({ enabled: e.target.checked })} />
        <span className="label">Enabled</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={seq.playing} onChange={(e) => set({ playing: e.target.checked })} disabled={!seq.enabled} />
        <span className="label">Play</span>
      </label>
      <label>
        <div className="label">Division</div>
        <select value={seq.division} onChange={(e) => set({ division: e.target.value as any })} disabled={!seq.enabled}>
          <option value="1/4">1/4</option>
          <option value="1/8">1/8</option>
          <option value="1/8T">1/8T</option>
          <option value="1/16">1/16</option>
          <option value="1/16T">1/16T</option>
        </select>
      </label>
      <Slider label="BPM" min={40} max={240} step={1} value={seq.bpm} onChange={(v) => set({ bpm: v })} disabled={!seq.enabled} format={(v) => `${Math.round(v)}`} />

      {/* Row 1b: Keyboard edit tools */}
      <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 12, alignItems: 'center' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={kbEdit} onChange={(e) => setKbEdit(e.target.checked)} />
          <span className="label">Edit Notes (Keyboard)</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={audition} onChange={(e) => setAudition(e.target.checked)} />
          <span className="label">Audition</span>
        </label>
        <button onClick={() => gridRef.current?.focus()} style={{ padding: '6px 10px', fontSize: 12, borderRadius: 6, background: 'transparent', border: '1px solid var(--border, #2a3040)', color: 'var(--text)' }}>Focus Grid</button>
        <div className="hint-text" style={{ opacity: 0.8 }}>
          Keys: A/W/S... set notes • Arrows move • Z/X root ±1 oct • Space play/pause • +/- semitone • Backspace clear
        </div>
      </div>

      {/* Row 2: root note, length, gate, swing */}
      <div>
        <div className="label">Root</div>
        <div className="row" style={{ gap: 8, alignItems: 'center' }}>
          <Slider label={undefined} min={36} max={84} step={1} value={seq.rootMidi} onChange={(v) => set({ rootMidi: v })} disabled={!seq.enabled} format={(v) => midiToName(v)} />
        </div>
      </div>
      <label>
        <div className="label">Length</div>
        <select value={seq.length} onChange={(e) => set({ length: Number(e.target.value) })} disabled={!seq.enabled}>
          {Array.from({ length: steps.length }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
      </label>
      <Slider label="Gate" min={0.05} max={1} step={0.01} value={seq.gate} onChange={(v) => set({ gate: v })} disabled={!seq.enabled} format={(v) => `${Math.round(v * 100)}%`} />
      <Slider label="Swing" min={0} max={0.75} step={0.01} value={seq.swingPct ?? 0} onChange={(v) => set({ swingPct: v })} disabled={!seq.enabled || seq.division.endsWith('T') || seq.division === '1/4'} format={(v) => `${Math.round(v * 100)}%`} />

      {/* Row 3: steps grid */}
      <div ref={gridRef} tabIndex={0} onKeyDown={handleKeyDown} style={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: 'repeat(16, 1fr)', gap: 6, outline: kbEdit ? '1px dashed #2a3040' : 'none', borderRadius: 6, padding: 2 }}>
        {steps.map((st, i) => {
          const active = i < len
          const isOn = st.on && active
          const playing = status.enabled && active && (status.stepIndex % len) === i
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
                border: `1px solid ${playing ? 'var(--accent)' : (i === cursor && kbEdit ? 'var(--accent)' : '#2a3040')}`,
                background: isOn ? (playing ? 'var(--accent)' : '#1d2432') : '#0f1217',
                color: isOn ? (playing ? '#0f1217' : 'var(--text)') : '#556',
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
  )
}
