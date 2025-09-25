import React, { useEffect, useMemo, useState } from 'react'
import { useStore, type State } from '../state/store'

const WHITE_OFFSETS = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B
const BLACK_OFFSETS_MAP: Record<number, number | null> = {
  0: 1, // C# over C
  1: 3, // D# over D
  2: null, // no black over E
  3: 6, // F# over F
  4: 8, // G# over G
  5: 10, // A# over A
  6: null, // no black over B
}

function whiteMidi(whiteIndex: number, baseMidi = 60) {
  const octave = Math.floor(whiteIndex / 7)
  const degree = WHITE_OFFSETS[whiteIndex % 7]
  return baseMidi + octave * 12 + degree
}

function blackMidi(whiteIndex: number, baseMidi = 60) {
  const octave = Math.floor(whiteIndex / 7)
  const offset = BLACK_OFFSETS_MAP[whiteIndex % 7]
  if (offset == null) return null
  return baseMidi + octave * 12 + offset
}

export function Keyboard() {
  const engine = useStore((s: State) => s.engine)
  const [active, setActive] = useState<Set<number>>(() => new Set())
  const [baseMidi, setBaseMidi] = useState(60) // C4 by default

  const noteOn = (midi: number) => {
    engine?.noteOn(midi)
    setActive((prev: Set<number>) => new Set(prev).add(midi))
  }
  const noteOff = (midi: number) => {
    engine?.noteOff(midi)
    setActive((prev: Set<number>) => {
      const next = new Set(prev)
      next.delete(midi)
      return next
    })
  }

  useEffect(() => {
    // map to relative semitone offsets from baseMidi
    const rel: Record<string, number> = {
      a: 0, w: 1, s: 2, e: 3, d: 4, f: 5, t: 6, g: 7, y: 8, h: 9, u: 10, j: 11, k: 12,
      o: 13, l: 14, p: 15, ';': 16, "'": 17,
    }
    const down = new Set<string>()
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return
      // octave shift
      if (e.key === 'z') {
        setBaseMidi((m: number) => Math.max(24, m - 12))
        return
      }
      if (e.key === 'x') {
        setBaseMidi((m: number) => Math.min(96, m + 12))
        return
      }
      const off = rel[e.key]
      const midi = off != null ? baseMidi + off : undefined
      if (midi != null && !down.has(e.key)) {
        down.add(e.key)
        noteOn(midi)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      const off = rel[e.key]
      const midi = off != null ? baseMidi + off : undefined
      if (midi != null) {
        down.delete(e.key)
        noteOff(midi)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [engine, baseMidi])

  const whiteCount = 14
  const whites = useMemo(() => Array.from({ length: whiteCount }, (_, i) => whiteMidi(i, baseMidi)), [whiteCount, baseMidi])
  const whiteWidth = 28
  const whiteGap = 2
  const spacing = whiteWidth + whiteGap
  const octave = Math.floor(baseMidi / 12) - 1
  const deltaOct = octave - 4

  return (
    <div className="keyboard">
      <div className="row" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <div className="octave-indicator">
          <span className="badge">Octave</span>
          <span className="value" style={{ color: deltaOct === 0 ? 'var(--text)' : 'var(--accent)' }}>
            {octave} {deltaOct !== 0 ? `(${deltaOct > 0 ? '+' : ''}${deltaOct})` : ''}
          </span>
        </div>
      </div>
      <div className="keys-and-help">
        <div className="keys-row">
          {whites.map((midi: number, i: number) => (
            <div
              key={i}
              className="key"
              style={{ background: active.has(midi) ? '#d1d5db' : '#f8fafc' }}
              onMouseDown={() => noteOn(midi)}
              onMouseUp={() => noteOff(midi)}
              onMouseLeave={() => noteOff(midi)}
            />
          ))}
          {/* Black keys overlay, positioned over whites */}
          {Array.from({ length: whiteCount }).map((_: unknown, i: number) => {
            const midi = blackMidi(i, baseMidi)
            if (midi == null) return null
            // Position the black key roughly between the white keys i and i+1 (account for gaps)
            const left = i * spacing + Math.floor(whiteWidth * 0.7)
            return (
              <div
                key={`b-${i}`}
                className="key black"
                style={{ left, background: active.has(midi) ? '#111827' : '#0b0f16' }}
                onMouseDown={() => noteOn(midi)}
                onMouseUp={() => noteOff(midi)}
                onMouseLeave={() => noteOff(midi)}
              />
            )
          })}
        </div>
        <div className="kbd-help">
          <div className="badge" style={{ alignSelf: 'flex-start' }}>Octave shift</div>
          <div className="kbd-row"><span className="kbd">Z</span><span className="hint-text">down</span></div>
          <div className="kbd-row"><span className="kbd">X</span><span className="hint-text">up</span></div>
        </div>
      </div>
    </div>
  )
}
