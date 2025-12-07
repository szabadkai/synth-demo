import React, { useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'

export function RecorderPanel() {
    const engine = useStore((s) => s.engine)
    const [recording, setRecording] = useState(false)
    const [duration, setDuration] = useState(0)
    const [blobUrl, setBlobUrl] = useState<string | null>(null)

    const mediaRecorder = useRef<MediaRecorder | null>(null)
    const chunks = useRef<Blob[]>([])
    const timerRef = useRef<number | null>(null)

    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
            if (blobUrl) URL.revokeObjectURL(blobUrl)
        }
    }, [blobUrl])

    const startRecording = () => {
        if (!engine) return
        const dest = engine.getRecordDestination()
        if (!dest) return

        chunks.current = []

        // Check supported types
        const types = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/mp4'
        ]
        const mimeType = types.find(t => MediaRecorder.isTypeSupported(t)) || ''

        try {
            const recorder = new MediaRecorder(dest.stream, { mimeType })

            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunks.current.push(e.data)
            }

            recorder.onstop = () => {
                const BlobType = mimeType || 'audio/webm'
                const blob = new Blob(chunks.current, { type: BlobType })
                const url = URL.createObjectURL(blob)
                setBlobUrl(url)
            }

            recorder.start()
            mediaRecorder.current = recorder
            setRecording(true)
            setBlobUrl(null)

            const startTime = Date.now()
            setDuration(0)
            timerRef.current = window.setInterval(() => {
                setDuration(Math.floor((Date.now() - startTime) / 1000))
            }, 1000)
        } catch (e) {
            console.error('Recording failed:', e)
        }
    }

    const stopRecording = () => {
        if (mediaRecorder.current && mediaRecorder.current.state !== 'inactive') {
            mediaRecorder.current.stop()
        }
        setRecording(false)
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }

    const handleDownload = () => {
        if (!blobUrl) return
        const a = document.createElement('a')
        a.href = blobUrl
        a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
        a.click()
    }

    return (
        <div className="recorder-panel">
            <div className="recorder-display" style={{
                fontFamily: 'monospace',
                fontSize: '14px',
                color: recording ? '#ef4444' : '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
            }}>
                <div style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: "currentcolor",
                    opacity: recording ? 1 : 0.3
                }} />
                {formatTime(duration)}
            </div>

            {!recording ? (
                <button
                    className="recorder-btn record"
                    onClick={startRecording}
                    title="Start Recording"
                    style={{
                        color: '#ef4444',
                        borderColor: '#ef4444'
                    }}
                >
                    ● REC
                </button>
            ) : (
                <button
                    className="recorder-btn stop"
                    onClick={stopRecording}
                    style={{
                        borderColor: 'currentColor'
                    }}
                >
                    ■ STOP
                </button>
            )}

            {blobUrl && !recording && (
                <button
                    className="recorder-btn download"
                    onClick={handleDownload}
                    title="Download Recording"
                >
                    ⬇
                </button>
            )}
        </div>
    )
}
