import React, { useEffect, useRef } from 'react'
import { useStore, type MidiDeviceInfo } from '../state/store'

const NOTE_ON = 0x90
const NOTE_OFF = 0x80

function mapDevices(access: MIDIAccess): MidiDeviceInfo[] {
  return Array.from(access.inputs.values()).map((input) => ({
    id: input.id,
    name: input.name ?? 'Unknown input',
    manufacturer: input.manufacturer ?? null,
  }))
}

let pendingMidiAccess: Promise<MIDIAccess> | null = null

export function requestMidiAccess(): Promise<MIDIAccess> {
  if (pendingMidiAccess) return pendingMidiAccess
  if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
    return Promise.reject(new Error('Web MIDI API is not supported in this environment'))
  }
  pendingMidiAccess = navigator.requestMIDIAccess({ sysex: false }).finally(() => {
    pendingMidiAccess = null
  })
  return pendingMidiAccess
}

export function MidiManager() {
  const engine = useStore((s) => s.engine)
  const midi = useStore((s) => s.midi)
  const setMidiSupported = useStore((s) => s.setMidiSupported)
  const setMidiStatus = useStore((s) => s.setMidiStatus)
  const setMidiInputs = useStore((s) => s.setMidiInputs)
  const setMidiSelectedInput = useStore((s) => s.setMidiSelectedInput)
  const setMidiActiveNotes = useStore((s) => s.setMidiActiveNotes)

  const accessRef = useRef<MIDIAccess | null>(null)
  const inputRef = useRef<MIDIInput | null>(null)
  const activeNotesRef = useRef<Set<number>>(new Set())

  useEffect(() => {
    if (!midi.enabled) {
      // Ensure clean teardown when disabled
      const notes = Array.from(activeNotesRef.current)
      if (notes.length && engine) {
        notes.forEach((note) => engine.noteOff(note))
      }
      activeNotesRef.current.clear()
      setMidiActiveNotes([])
      const nextStatus = midi.supported === false ? 'unsupported' : 'idle'
      if (midi.status !== nextStatus) {
        setMidiStatus(nextStatus)
      }
      setMidiInputs([])
      if (accessRef.current) {
        accessRef.current.onstatechange = null
      }
      return
    }

    if (typeof navigator === 'undefined' || typeof navigator.requestMIDIAccess !== 'function') {
      setMidiSupported(false)
      setMidiStatus('unsupported')
      return
    }

    let cancelled = false
    setMidiSupported(true)
    setMidiStatus('requesting')

    requestMidiAccess().then((access) => {
      if (cancelled) return
      accessRef.current = access

      const pushDevices = () => {
        const devices = mapDevices(access)
        setMidiInputs(devices)
        const { selectedInputId } = useStore.getState().midi
        if (devices.length === 0) {
          activeNotesRef.current.clear()
          setMidiActiveNotes([])
        }
        if (devices.length > 0) {
          const exists = devices.some((d) => d.id === selectedInputId)
          if (!exists) {
            setMidiSelectedInput(devices[0]?.id ?? null)
          }
        } else if (selectedInputId) {
          setMidiSelectedInput(null)
        }
      }

      pushDevices()
      access.onstatechange = () => pushDevices()
      setMidiStatus('ready')
    }).catch((error: unknown) => {
      if (cancelled) return
      const message = error instanceof Error ? error.message : 'Failed to access MIDI devices'
      setMidiStatus('error', message)
    })

    return () => {
      cancelled = true
      if (accessRef.current) {
        accessRef.current.onstatechange = null
      }
      accessRef.current = null
    }
  }, [engine, midi.enabled, setMidiActiveNotes, setMidiInputs, setMidiSelectedInput, setMidiStatus, setMidiSupported])

  useEffect(() => {
    if (!midi.enabled) {
      if (inputRef.current) {
        inputRef.current.onmidimessage = null
        inputRef.current = null
      }
      return
    }
    const access = accessRef.current
    if (!access) return

    const selectedId = midi.selectedInputId
    const nextInput = selectedId
      ? Array.from(access.inputs.values()).find((input) => input.id === selectedId)
      : null

    if (inputRef.current && inputRef.current !== nextInput) {
      inputRef.current.onmidimessage = null
      inputRef.current = null
      const notes = Array.from(activeNotesRef.current)
      if (notes.length && engine) {
        notes.forEach((note) => engine.noteOff(note))
      }
      activeNotesRef.current.clear()
      setMidiActiveNotes([])
    }

    if (!nextInput) {
      return
    }

    const handleMessage = (event: MIDIMessageEvent) => {
      const data = event.data
      if (!data || data.length < 2) return
      const status = data[0]
      const data1 = data[1]
      const data2 = data[2] ?? 0
      const command = status & 0xf0
      const midiNote = data1
      if (command === NOTE_ON && data2 > 0) {
        const velocity = Math.max(0, Math.min(1, data2 / 127))
        if (engine) engine.noteOn(midiNote, velocity)
        activeNotesRef.current.add(midiNote)
        setMidiActiveNotes(Array.from(activeNotesRef.current))
        return
      }
      if (command === NOTE_OFF || (command === NOTE_ON && data2 === 0)) {
        if (engine) engine.noteOff(midiNote)
        activeNotesRef.current.delete(midiNote)
        setMidiActiveNotes(Array.from(activeNotesRef.current))
      }
    }

    nextInput.onmidimessage = handleMessage
    inputRef.current = nextInput

    return () => {
      if (nextInput.onmidimessage === handleMessage) nextInput.onmidimessage = null
      const notes = Array.from(activeNotesRef.current)
      if (notes.length && engine) {
        notes.forEach((note) => engine.noteOff(note))
      }
      activeNotesRef.current.clear()
      setMidiActiveNotes([])
    }
  }, [engine, midi.enabled, midi.selectedInputId, setMidiActiveNotes])

  return null
}
