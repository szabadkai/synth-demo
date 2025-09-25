import React from 'react'

type Props = {
  value: number
  min: number
  max: number
  step?: number
  label?: string
  onChange: (v: number) => void
  disabled?: boolean
}

export function Slider({ value, min, max, step = 0.01, label, onChange, disabled = false }: Props) {
  return (
    <label style={{ display: 'grid', gap: 6, opacity: disabled ? 0.6 : 1 }}>
      {label && <span className="label">{label}</span>}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
      />
      <span className="value">{value.toFixed(2)}</span>
    </label>
  )
}
