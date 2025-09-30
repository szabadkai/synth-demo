import React, { useMemo } from 'react'
import { EXPRESSION_TARGETS, type ExpressionTarget } from '../audio-engine/expressionTargets'
import { defaultPatch } from '../audio-engine/engine'
import { useStore } from '../state/store'

type Axis = 'x' | 'y'

export function ExpressionPanel() {
  const expressionFromStore = useStore((s) => s.patch.expression)
  const expression = expressionFromStore ?? defaultPatch.expression!
  const updatePatch = useStore((s) => s.updatePatch)

  const grouped = useMemo(() => {
    const map = new Map<string, typeof EXPRESSION_TARGETS>()
    for (const target of EXPRESSION_TARGETS) {
      const list = map.get(target.category) ?? []
      list.push(target)
      map.set(target.category, list)
    }
    return Array.from(map.entries())
  }, [])

  const handleChange = (axis: Axis) => (event: React.ChangeEvent<HTMLSelectElement>) => {
    const next = event.target.value as ExpressionTarget
    const nextExpression = axis === 'x'
      ? { x: next, y: expression.y }
      : { x: expression.x, y: next }
    updatePatch({ expression: nextExpression })
  }

  const description = (axis: Axis) => {
    const id = expression?.[axis]
    const info = EXPRESSION_TARGETS.find((t) => t.id === id)
    return info?.description ?? 'Select a destination to be controlled by the XY surface.'
  }

  return (
    <div className="expression-panel">
      <div className="expression-row">
        <label>
          <span className="label">X Axis Target</span>
          <select value={expression?.x ?? defaultPatch.expression!.x} onChange={handleChange('x')}>
            {grouped.map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="hint-text">{description('x')}</p>
      </div>
      <div className="expression-row">
        <label>
          <span className="label">Y Axis Target</span>
          <select value={expression?.y ?? defaultPatch.expression!.y} onChange={handleChange('y')}>
            {grouped.map(([category, items]) => (
              <optgroup key={category} label={category}>
                {items.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <p className="hint-text">{description('y')}</p>
      </div>
    </div>
  )
}
