import React, { useMemo, useCallback } from 'react'
import { useStore } from '../state/store'
import { requestMidiAccess } from './MidiManager'

const STATUS_TEXT: Record<string, string> = {
  idle: 'Not connected',
  requesting: 'Awaiting browser permission...',
  ready: 'Connected',
  error: 'Connection error',
  unsupported: 'Not supported',
}

export function MidiSettings() {
  const midi = useStore((s) => s.midi)
  const setMidiEnabled = useStore((s) => s.setMidiEnabled)
  const setMidiSelectedInput = useStore((s) => s.setMidiSelectedInput)
  const setMidiStatus = useStore((s) => s.setMidiStatus)
  const setMidiSupported = useStore((s) => s.setMidiSupported)

  const statusLabel = useMemo(() => {
    const base = STATUS_TEXT[midi.status] ?? 'Unknown'
    if (midi.status === 'error' && midi.lastError) {
      return `${base}: ${midi.lastError}`
    }
    if (midi.status === 'ready' && midi.inputs.length === 0) {
      return 'Connected - no inputs detected'
    }
    return base
  }, [midi.inputs.length, midi.lastError, midi.status])

  const disabled = midi.supported === false

  const handleEnabledChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const nextEnabled = event.target.checked
      if (!nextEnabled) {
        setMidiEnabled(false)
        return
      }

      setMidiStatus('requesting')
      setMidiEnabled(true)

      requestMidiAccess()
        .then(() => {
          setMidiSupported(true)
        })
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'Failed to access MIDI devices'
          const notSupported = error instanceof Error && /not supported/i.test(error.message)
          if (notSupported) {
            setMidiSupported(false)
            setMidiStatus('unsupported')
            setMidiEnabled(false)
            return
          }
          setMidiSupported(true)
          setMidiStatus('error', message)
        })
    },
    [setMidiEnabled, setMidiStatus, setMidiSupported],
  )

  return (
    <div className="settings-card">
      <div className="settings-row">
        <label className="settings-label" htmlFor="midi-enabled">
          Enable MIDI input
        </label>
        <input
          id="midi-enabled"
          type="checkbox"
          checked={midi.enabled}
          onChange={handleEnabledChange}
          disabled={disabled}
        />
      </div>
      <div className="settings-row">
        <span className="settings-label">Status</span>
        <span className="settings-value" data-status={midi.status}>
          {statusLabel}
        </span>
      </div>
      {midi.status === 'unsupported' ? (
        <p className="settings-help">
          This browser does not expose the Web MIDI API. Try Chrome or Edge on desktop.
        </p>
      ) : null}
      <div className="settings-row">
        <label className="settings-label" htmlFor="midi-input">
          MIDI input device
        </label>
        <select
          id="midi-input"
          value={midi.selectedInputId ?? ''}
          onChange={(event) => {
            const value = event.target.value
            setMidiSelectedInput(value.length ? value : null)
          }}
          disabled={!midi.enabled || midi.inputs.length === 0}
        >
          {midi.inputs.length === 0 ? <option value="">No inputs detected</option> : null}
          {midi.inputs.map((input) => (
            <option key={input.id} value={input.id}>
              {input.name}
              {input.manufacturer ? ` (${input.manufacturer})` : ''}
            </option>
          ))}
        </select>
      </div>
      {midi.enabled && midi.inputs.length === 0 ? (
        <p className="settings-help">Plug in a controller or check browser permissions.</p>
      ) : null}
    </div>
  )
}
