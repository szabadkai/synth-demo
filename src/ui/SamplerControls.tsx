import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore, type State } from '../state/store'
import { DEFAULT_OSCILLATOR_SAMPLER, type SamplerSettings } from '../audio-engine/engine'

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const SAMPLE_NAME_MAX_CHARS = 10
const ROOT_NOTE_OPTIONS = Array.from({ length: 61 }, (_v, index) => {
  const midi = 36 + index // C2 upwards
  const name = NOTE_NAMES[midi % 12]
  const octave = Math.floor(midi / 12) - 1
  return { midi, label: `${name}${octave}` }
})

const makeSamplerId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `sample-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const toShortName = (raw: string | null | undefined, fallback: string) => {
  const trimmed = (raw ?? '').trim()
  if (!trimmed) return fallback
  return trimmed.slice(0, SAMPLE_NAME_MAX_CHARS)
}

const makeRecordingName = () => {
  const stamp = Math.floor(Date.now() % 1_000_000)
  const code = stamp.toString(36).toUpperCase().padStart(4, '0')
  return `REC-${code}`.slice(0, SAMPLE_NAME_MAX_CHARS)
}

const makeUploadName = (filename: string) => {
  const base = filename.replace(/\.[^/.]+$/, '')
  const sanitized = base.replace(/[^A-Za-z0-9_-]/g, '').toUpperCase()
  if (!sanitized) return 'SAMPLE'
  return sanitized.slice(0, SAMPLE_NAME_MAX_CHARS)
}

const ensureSampler = (sampler: SamplerSettings | undefined) => {
  const merged = { ...DEFAULT_OSCILLATOR_SAMPLER, ...(sampler ?? {}) }
  const duration = typeof merged.durationSec === 'number' && merged.durationSec > 0 ? merged.durationSec : 0
  if (duration === 0) {
    return { ...merged, durationSec: 0, trimStartSec: 0, trimEndSec: 0 }
  }
  const epsilon = 0.005
  const maxStart = Math.max(0, duration - epsilon)
  const rawStart = Number(merged.trimStartSec)
  const start = Math.min(Math.max(Number.isFinite(rawStart) ? rawStart : 0, 0), maxStart)
  const rawEnd = Number(merged.trimEndSec)
  let end = Number.isFinite(rawEnd) ? rawEnd : duration
  if (end - start < epsilon) end = duration
  end = Math.min(Math.max(end, start + epsilon), duration)
  return {
    ...merged,
    durationSec: duration,
    trimStartSec: start,
    trimEndSec: end,
  }
}

const formatTime = (seconds: number) => {
  const clamped = Math.max(0, seconds)
  const mins = Math.floor(clamped / 60)
  const secs = Math.floor(clamped % 60)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

type SamplerControlsProps = {
  oscillator?: 'osc1' | 'osc2'
}

export function SamplerControls({ oscillator = 'osc1' }: SamplerControlsProps) {
  const sampler = useStore((s: State) => s.patch[oscillator].sampler)
  const samplerLibrary = useStore((s: State) => s.samplerLibrary)
  const saveSamplerSample = useStore((s: State) => s.saveSamplerSample)
  const deleteSamplerSample = useStore((s: State) => s.deleteSamplerSample)
  const setSamplerFromLibrary = useStore((s: State) => s.setSamplerFromLibrary)
  const updateSamplerSettings = useStore((s: State) => s.updateCurrentSampler)
  const renameSamplerSample = useStore((s: State) => s.renameSamplerSample)
  const playSamplerPreview = useStore((s: State) => s.playSamplerPreview)
  const [error, setError] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingElapsed, setRecordingElapsed] = useState(0)
  const [blinkOn, setBlinkOn] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recordingStartRef = useRef<number | null>(null)
  const timerRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const mediaRecorderAvailable = useMemo(() => {
    const hasWindow = typeof window !== 'undefined'
    if (!hasWindow) return false
    return typeof (window as any).MediaRecorder !== 'undefined'
  }, [])

  const canRecord = mediaRecorderAvailable && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia

  const cleanupStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try { track.stop() } catch {}
      })
      streamRef.current = null
    }
    mediaRecorderRef.current = null
  }, [])

  const ensureAudioContext = useCallback(async () => {
    if (typeof window === 'undefined') return null
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new AudioContext()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to create AudioContext')
        return null
      }
    }
    const ctx = audioContextRef.current
    if (ctx && ctx.state === 'suspended') {
      try { await ctx.resume() } catch {}
    }
    return ctx
  }, [])

  const decodeSampleDuration = useCallback(
    async (dataUrl: string) => {
      const ctx = await ensureAudioContext()
      if (!ctx) return null
      try {
        const response = await fetch(dataUrl)
        const arrayBuffer = await response.arrayBuffer()
        const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0))
        return buffer.duration
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to decode audio')
        return null
      }
    },
    [ensureAudioContext],
  )

  const currentSampler = ensureSampler(sampler)

  const ingestSample = useCallback(
    async (dataUrl: string, name: string) => {
      setIsProcessing(true)
      setError(null)
      try {
        const duration = await decodeSampleDuration(dataUrl)
        if (duration == null) return
        const safeDuration = duration > 0 ? duration : 0
        const samplePayload: SamplerSettings = {
          id: makeSamplerId(),
          name: toShortName(name, 'SAMPLE'),
          dataUrl,
          recordedAt: Date.now(),
          durationSec: safeDuration,
          trimStartSec: 0,
          trimEndSec: safeDuration,
          loop: currentSampler.loop,
          rootMidi: currentSampler.rootMidi,
        }
        saveSamplerSample(oscillator, samplePayload)
      } finally {
        setIsProcessing(false)
      }
    },
    [oscillator, currentSampler.loop, currentSampler.rootMidi, decodeSampleDuration, saveSamplerSample],
  )

  const handleRecordedBlob = useCallback(
    (blob: Blob, suggestedName: string) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result
        if (typeof result === 'string') {
          void ingestSample(result, suggestedName)
        } else {
          setError('Unable to read recording data')
        }
      }
      reader.onerror = () => {
        setError('Failed to read recorded audio')
      }
      reader.readAsDataURL(blob)
    },
    [ingestSample],
  )

  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop() } catch {}
      setRecording(false)
      recordingStartRef.current = null
    }
  }, [])

  const startRecording = async () => {
    if (!canRecord || recording || isProcessing) return
    setError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const MediaRecorderCtor = (window as any).MediaRecorder as typeof MediaRecorder
      const recorder = new MediaRecorderCtor(stream)
      chunksRef.current = []
      recorder.ondataavailable = (evt) => {
        if (evt.data && evt.data.size > 0) chunksRef.current.push(evt.data)
      }
      recorder.onerror = (evt) => {
        const message = (evt as any)?.error?.message ?? 'Recording error'
        setError(message)
        stopRecording()
      }
      recorder.onstop = () => {
        setRecording(false)
        const blob = new Blob(chunksRef.current, { type: chunksRef.current[0]?.type || 'audio/webm' })
        chunksRef.current = []
        cleanupStream()
        if (blob.size > 0) {
          handleRecordedBlob(blob, makeRecordingName())
        }
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      streamRef.current = stream
      setRecording(true)
      recordingStartRef.current = performance.now()
      setRecordingElapsed(0)
      setBlinkOn(true)
    } catch (err) {
      cleanupStream()
      setRecording(false)
      recordingStartRef.current = null
      setError(err instanceof Error ? err.message : 'Microphone access denied')
    }
  }

  const onFileSelected = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onloadend = () => {
        const result = reader.result
        if (typeof result === 'string') {
          void ingestSample(result, makeUploadName(file.name))
        } else {
          setError('Unable to read file')
        }
      }
      reader.onerror = () => setError('Unable to load file')
      reader.readAsDataURL(file)
    },
    [ingestSample],
  )

  const onFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) onFileSelected(file)
    if (event.target) event.target.value = ''
  }

  useEffect(
    () => () => {
      stopRecording()
      cleanupStream()
    },
    [cleanupStream, stopRecording],
  )

  useEffect(() => {
    if (recording) {
      if (timerRef.current != null) window.clearInterval(timerRef.current)
      timerRef.current = window.setInterval(() => {
        if (recordingStartRef.current != null) {
          const elapsedSec = (performance.now() - recordingStartRef.current) / 1000
          setRecordingElapsed(elapsedSec)
          setBlinkOn((prev) => !prev)
        }
      }, 500)
    } else {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
      setRecordingElapsed(0)
      setBlinkOn(false)
    }
    return () => {
      if (timerRef.current != null) {
        window.clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }, [recording])

  const durationSec = currentSampler.durationSec ?? 0
  const hasSample = !!currentSampler.dataUrl && durationSec > 0
  const trimStartSec = currentSampler.trimStartSec ?? 0
  const trimEndSec = currentSampler.trimEndSec ?? durationSec

  const updateTrimStart = (valueSec: number) => {
    if (!hasSample) return
    const start = Math.max(0, Math.min(valueSec, durationSec))
    const minWindow = 0.005
    const ensuredEnd = Math.max(start + minWindow, trimEndSec)
    updateSamplerSettings(oscillator, { trimStartSec: start, trimEndSec: Math.min(ensuredEnd, durationSec) })
  }

  const updateTrimEnd = (valueSec: number) => {
    if (!hasSample) return
    const end = Math.max(0, Math.min(valueSec, durationSec))
    const minWindow = 0.005
    const ensuredStart = Math.min(trimStartSec, end - minWindow)
    const clampedStart = Math.max(0, Math.min(ensuredStart, durationSec))
    const newEnd = Math.min(durationSec, Math.max(end, minWindow))
    updateSamplerSettings(oscillator, { trimStartSec: Math.max(clampedStart, 0), trimEndSec: newEnd })
  }

  const handleExport = useCallback((sample: SamplerSettings) => {
    if (typeof window === 'undefined' || !sample.dataUrl) return
    const link = document.createElement('a')
    link.href = sample.dataUrl
    const mime = sample.dataUrl.split(';')[0]?.split(':')[1] ?? 'audio/webm'
    const ext = mime.includes('/') ? mime.split('/')[1] : 'webm'
    const safeName = (sample.name || 'sample').replace(/[^a-z0-9_\-]+/gi, '_')
    link.download = `${safeName}.${ext}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }, [])

  const handleExportLibrary = useCallback(() => {
    if (typeof window === 'undefined' || samplerLibrary.length === 0) return
    const payload = JSON.stringify(
      samplerLibrary.map((item) => ({
        ...item,
        // Avoid persisting undefined values explicitly
        recordedAt: item.recordedAt ?? null,
      })),
      null,
      2,
    )
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `sampler-library-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [samplerLibrary])

  const cancelRename = useCallback(() => {
    setRenamingId(null)
    setRenameValue('')
  }, [])

  const commitRename = useCallback(() => {
    if (!renamingId) return
    const trimmed = renameValue.trim()
    if (!trimmed) return
    renameSamplerSample(renamingId, toShortName(trimmed, 'SAMPLE'))
    setRenamingId(null)
    setRenameValue('')
  }, [renamingId, renameValue, renameSamplerSample])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '0 0 8px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="label">Sampler</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isProcessing}>
            {isProcessing ? 'Loading...' : 'Load Sample'}
          </button>
          <button
            type="button"
            onClick={() => playSamplerPreview(oscillator)}
            disabled={!currentSampler.dataUrl || isProcessing}
          >
            Play
          </button>
          <button type="button" onClick={recording ? stopRecording : startRecording} disabled={!canRecord || isProcessing}>
            {recording ? 'Stop Recording' : 'Record'}
          </button>
          <button
            type="button"
            onClick={() => {
              updateSamplerSettings(oscillator, {
                id: null,
                name: DEFAULT_OSCILLATOR_SAMPLER.name,
                dataUrl: null,
                recordedAt: undefined,
                durationSec: 0,
                trimStartSec: 0,
                trimEndSec: 0,
                loop: DEFAULT_OSCILLATOR_SAMPLER.loop,
                rootMidi: DEFAULT_OSCILLATOR_SAMPLER.rootMidi,
              })
              setError(null)
            }}
            disabled={!currentSampler.dataUrl}
          >
            Clear
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          style={{ display: 'none' }}
          onChange={onFileInputChange}
          disabled={isProcessing}
        />
      </div>
      {recording && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: blinkOn ? '#ff4d4f' : '#ffb3b8',
              boxShadow: blinkOn ? '0 0 8px rgba(255,77,79,0.8)' : 'none',
              transition: 'background-color 0.2s linear, box-shadow 0.2s linear',
            }}
          />
          <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
            Recording {formatTime(recordingElapsed)}
          </span>
        </div>
      )}
      <div style={{ fontSize: 12, color: 'var(--muted)', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <span>
          <span className="label" style={{ marginRight: 4 }}>Current</span>
          <span
            style={{
              maxWidth: `${SAMPLE_NAME_MAX_CHARS}ch`,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'inline-block',
              verticalAlign: 'bottom',
            }}
            title={currentSampler.dataUrl ? currentSampler.name : undefined}
          >
            {currentSampler.dataUrl ? currentSampler.name : 'No sample loaded'}
          </span>
        </span>
        {hasSample && (
          <span>
            Length {formatTime(durationSec)} · Window {formatTime(trimEndSec - trimStartSec)}
          </span>
        )}
        {!canRecord && <span>(Recording unsupported in this browser)</span>}
      </div>
      {error && (
        <div style={{ color: 'var(--danger, #d14343)', fontSize: 12 }}>
          {error}
        </div>
      )}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <label>
          <span className="label">Root Note</span>
          <select
           value={currentSampler.rootMidi}
            onChange={(event) => updateSamplerSettings(oscillator, { rootMidi: Number(event.target.value) })}
          >
            {ROOT_NOTE_OPTIONS.map((option) => (
              <option key={option.midi} value={option.midi}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!currentSampler.loop}
            onChange={(event) => updateSamplerSettings(oscillator, { loop: event.target.checked })}
          />
          Loop playback
        </label>
      </div>
      {hasSample && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="label">Trim</div>
          <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                Start {Math.round(trimStartSec * 1000)} ms
              </span>
              <input
                type="range"
                min={0}
                max={Math.max(durationSec * 1000, 5)}
                step={5}
                value={Math.round(trimStartSec * 1000)}
                onChange={(event) => updateTrimStart(Number(event.target.value) / 1000)}
              />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                End {Math.round(trimEndSec * 1000)} ms
              </span>
              <input
                type="range"
                min={5}
                max={Math.max(durationSec * 1000, 5)}
                step={5}
                value={Math.round(trimEndSec * 1000)}
                onChange={(event) => updateTrimEnd(Number(event.target.value) / 1000)}
              />
            </label>
          </div>
        </div>
      )}
      {samplerLibrary.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div className="label">Library</div>
            <button type="button" onClick={handleExportLibrary} style={{ fontSize: 12 }}>
              Export Library
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {samplerLibrary.map((item) => {
              if (!item.id) return null
              const isActive = item.id === currentSampler.id
              const isRenaming = renamingId === item.id
              return (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: isActive ? 'rgba(255, 77, 79, 0.1)' : 'rgba(255,255,255,0.04)',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 160 }}>
                    {isRenaming ? (
                      <input
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') { event.preventDefault(); commitRename() }
                          if (event.key === 'Escape') { event.preventDefault(); cancelRename() }
                        }}
                        autoFocus
                        maxLength={SAMPLE_NAME_MAX_CHARS}
                      />
                    ) : (
                      <span
                        style={{
                          fontWeight: 600,
                          maxWidth: `${SAMPLE_NAME_MAX_CHARS}ch`,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={item.name || 'Sample'}
                      >
                        {item.name || 'Sample'}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {formatTime(item.durationSec ?? 0)} {isActive ? '· Active' : ''}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isRenaming ? (
                      <>
                        <button type="button" onClick={commitRename} disabled={!renameValue.trim()}>
                          Save
                        </button>
                        <button type="button" onClick={cancelRename}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" onClick={() => setSamplerFromLibrary(oscillator, item.id!)} disabled={isActive}>
                          {isActive ? 'In Use' : 'Use'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(item.id!)
                            setRenameValue(item.name || '')
                          }}
                        >
                          Rename
                        </button>
                        <button type="button" onClick={() => handleExport(item)} disabled={!item.dataUrl}>
                          Export
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteSamplerSample(item.id!)}
                          style={{ color: 'var(--danger, #d14343)' }}
                        >
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
