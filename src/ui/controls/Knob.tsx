import React, { useCallback, useMemo, useRef, useState } from 'react'

type Props = {
  value: number
  min: number
  max: number
  step?: number
  size?: number
  label?: string
  hint?: string
  formatValue?: (value: number) => string
  onChange: (v: number) => void
  disabled?: boolean
  showValue?: boolean
}

export function Knob({
  value,
  min,
  max,
  step = 0.01,
  size = 56,
  label,
  hint,
  formatValue,
  onChange,
  disabled = false,
  showValue = true,
}: Props) {
  const [active, setActive] = useState(false)
  const start = useRef<{ y: number; v: number } | null>(null)
  const clamp = useCallback((v: number) => Math.min(max, Math.max(min, v)), [min, max])
  const range = max - min
  const norm = range === 0 ? 0 : (value - min) / range
  const angle = useMemo(() => -135 + norm * 270, [norm])
  const formattedValue = formatValue ? formatValue(value) : formatNumber(value)

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { y: e.clientY, v: value }
    setActive(true)
  }
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!start.current || disabled) return
    if (e.buttons === 0) {
      start.current = null
      setActive(false)
      try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
      return
    }
    const dy = start.current.y - e.clientY
    const delta = (dy / 150) * range
    const next = clamp(start.current.v + delta)
    onChange(roundTo(next, step))
  }
  const onPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (disabled) return
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
    start.current = null
    setActive(false)
  }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    const s = step
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') onChange(clamp(roundTo(value + s, s)))
    if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') onChange(clamp(roundTo(value - s, s)))
  }

  const r = size / 2 - 6
  const cx = size / 2
  const cy = size / 2
  const startAngle = -135
  const startX = cx + Math.cos((startAngle * Math.PI) / 180) * (r + 6)
  const startY = cy + Math.sin((startAngle * Math.PI) / 180) * (r + 6)
  const indicatorX = cx + Math.cos((angle * Math.PI) / 180) * (r - 6)
  const indicatorY = cy + Math.sin((angle * Math.PI) / 180) * (r - 6)

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        opacity: disabled ? 0.4 : 1,
        pointerEvents: disabled ? 'none' : 'auto',
        width: size,
      }}
      title={hint}
    >
      <svg
        width={size}
        height={size}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onKeyDown}
        role="slider"
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={value}
        aria-valuetext={formattedValue}
        aria-description={hint}
        tabIndex={disabled ? -1 : 0}
        style={{ cursor: disabled ? 'default' : 'ns-resize', outline: active ? '1px solid var(--accent)' : 'none', borderRadius: 8 }}
      >
        <circle cx={cx} cy={cy} r={r} fill="#0f1217" stroke="#2a3040" />
        <circle cx={cx} cy={cy} r={r - 8} fill="#161a22" stroke="#202635" />
        <circle cx={startX} cy={startY} r={2.4} fill="#3dd973" stroke="#12161f" strokeWidth={0.8} />
        <line x1={cx} y1={cy} x2={indicatorX} y2={indicatorY} stroke="var(--accent)" strokeWidth={3} strokeLinecap="round" />
      </svg>
      {(label || showValue) && (
        <div className="knob-legend">
          {label ? <span className="label">{label}</span> : null}
          {showValue ? <span className="value">{formattedValue}</span> : null}
        </div>
      )}
    </div>
  )
}

function roundTo(v: number, step: number) {
  const inv = 1 / step
  return Math.round(v * inv) / inv
}

function formatNumber(v: number) {
  if (Math.abs(v) >= 100) return v.toFixed(0)
  if (Math.abs(v) >= 10) return v.toFixed(1)
  return v.toFixed(2)
}
