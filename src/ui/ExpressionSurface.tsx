import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../state/store'
import { defaultPatch } from '../audio-engine/engine'
import { EXPRESSION_TARGET_LABELS } from '../audio-engine/expressionTargets'

type Point = { x: number; y: number }

export function ExpressionSurface() {
  const engine = useStore((s) => s.engine)
  const expressionConfig = useStore((s) => s.patch.expression)
  const expression = expressionConfig ?? defaultPatch.expression!
  const xLabel = EXPRESSION_TARGET_LABELS[expression.x] ?? 'X Axis'
  const yLabel = EXPRESSION_TARGET_LABELS[expression.y] ?? 'Y Axis'
  const engineRef = useRef(engine)
  const [capsActive, setCapsActive] = useState(false)
  const [lastPoint, setLastPoint] = useState<Point | null>(null)
  const capsRef = useRef(false)
  const rafRef = useRef<number | null>(null)
  const pendingPoint = useRef<Point | null>(null)

  useEffect(() => {
    engineRef.current = engine
  }, [engine])

  const updateCaps = useCallback((value: boolean) => {
    capsRef.current = value
    setCapsActive(value)
    if (!value) {
      pendingPoint.current = null
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      engineRef.current?.clearExpression2D()
      setLastPoint(null)
    }
  }, [])

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'CapsLock') {
        updateCaps(event.getModifierState('CapsLock'))
      } else if (!event.getModifierState('CapsLock') && capsRef.current) {
        // If focus moved and modifier cleared, ensure we stop
        updateCaps(false)
      }
    }
    const handleBlur = () => updateCaps(false)
    window.addEventListener('keydown', handleKey)
    window.addEventListener('keyup', handleKey)
    window.addEventListener('blur', handleBlur)
    return () => {
      window.removeEventListener('keydown', handleKey)
      window.removeEventListener('keyup', handleKey)
      window.removeEventListener('blur', handleBlur)
    }
  }, [updateCaps])

  useEffect(() => {
    const flushPoint = () => {
      rafRef.current = null
      if (!capsRef.current) return
      const point = pendingPoint.current
      if (!point) return
      pendingPoint.current = null
      engineRef.current?.setExpression2D(point.x, point.y)
      setLastPoint(point)
    }

    const scheduleFlush = () => {
      if (rafRef.current != null) return
      rafRef.current = requestAnimationFrame(flushPoint)
    }

    const handlePointer = (event: PointerEvent) => {
      if (!engineRef.current) return
      const capsOn = event.getModifierState?.('CapsLock') ?? capsRef.current
      if (capsOn !== capsRef.current) updateCaps(capsOn)
      if (!capsOn) return
      // Restrict to touch-capable pointer devices (trackpad will report mouse)
      if (!['mouse', 'touch', 'pen'].includes(event.pointerType)) return
      const x = Math.min(1, Math.max(0, event.clientX / window.innerWidth))
      const y = Math.min(1, Math.max(0, 1 - event.clientY / window.innerHeight))
      pendingPoint.current = { x, y }
      scheduleFlush()
    }

    const handleLeave = () => updateCaps(false)

    window.addEventListener('pointermove', handlePointer, { passive: true })
    window.addEventListener('pointerdown', handlePointer, { passive: true })
    window.addEventListener('pointerup', handlePointer, { passive: true })
    window.addEventListener('pointercancel', handleLeave)
    window.addEventListener('mouseleave', handleLeave)

    return () => {
      window.removeEventListener('pointermove', handlePointer)
      window.removeEventListener('pointerdown', handlePointer)
      window.removeEventListener('pointerup', handlePointer)
      window.removeEventListener('pointercancel', handleLeave)
      window.removeEventListener('mouseleave', handleLeave)
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [updateCaps])

  if (!engine) return null

  return (
    <div className={`expression-overlay${capsActive ? ' active' : ''}`} aria-hidden="true">
      <div className="expression-label">CapsLock XY Expression</div>
      {capsActive ? (
        <div className="expression-status">
          Active · {xLabel} {((lastPoint?.x ?? 0.5) * 100).toFixed(0)}% · {yLabel}{' '}
          {((lastPoint?.y ?? 0.5) * 100).toFixed(0)}%
        </div>
      ) : (
        <div className="expression-status">
          Engage CapsLock and move on the trackpad to modulate {xLabel} / {yLabel}
        </div>
      )}
    </div>
  )
}
