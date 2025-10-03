import React, { useMemo, useState } from 'react'

export type DashboardPanelConfig = {
  id: string
  title: string
  render: () => React.ReactNode
  span?: number
}

const DRAG_TYPE = 'application/x-websynth-panel'

type HoverMarker = { id: string; position: 'before' | 'after' } | null

function insertAt(ids: string[], sourceId: string, index: number) {
  if (!ids.includes(sourceId)) return ids
  const withoutSource = ids.filter((id) => id !== sourceId)
  const clampedIndex = Math.max(0, Math.min(index, withoutSource.length))
  return [
    ...withoutSource.slice(0, clampedIndex),
    sourceId,
    ...withoutSource.slice(clampedIndex),
  ]
}

export type DashboardGridProps = {
  panels: DashboardPanelConfig[]
  order: string[]
  onOrderChange: (ids: string[]) => void
  onRequestHelp?: (id: string) => void
}

export function DashboardGrid({ panels, order, onOrderChange, onRequestHelp }: DashboardGridProps) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [hover, setHover] = useState<HoverMarker>(null)
  const [draggingToEnd, setDraggingToEnd] = useState(false)

  const panelMap = useMemo(() => new Map(panels.map((panel) => [panel.id, panel])), [panels])
  const defaultOrder = useMemo(() => panels.map((panel) => panel.id), [panels])

  const normalizedOrder = useMemo(() => {
    const known = (order.length ? order : defaultOrder).filter((id) => panelMap.has(id))
    const seen = new Set(known)
    const missing = panels.filter((panel) => !seen.has(panel.id)).map((panel) => panel.id)
    return [...known, ...missing]
  }, [order, defaultOrder, panelMap, panels])

  const handleDragStart = (id: string) => (event: React.DragEvent) => {
    event.dataTransfer.effectAllowed = 'move'
    try {
      event.dataTransfer.setData(DRAG_TYPE, id)
    } catch {
      event.dataTransfer.setData('text/plain', id)
    }
    setDraggingId(id)
    setHover(null)
    setDraggingToEnd(false)
  }

  const handleDragEnd = () => {
    setDraggingId(null)
    setHover(null)
    setDraggingToEnd(false)
  }

  const extractId = (event: React.DragEvent) => {
    let payload = ''
    try {
      payload = event.dataTransfer.getData(DRAG_TYPE)
    } catch {
      payload = event.dataTransfer.getData('text/plain')
    }
    return payload || draggingId
  }

  const handleDragOverPanel = (id: string, index: number) => (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    if (!draggingId) return
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height / 2
    setHover({ id, position: before ? 'before' : 'after' })
    setDraggingToEnd(false)
  }

  const handleDropOnPanel = (id: string, index: number) => (event: React.DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    const sourceId = extractId(event)
    if (!sourceId) return
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
    const before = event.clientY < rect.top + rect.height / 2
    const targetIndex = before ? index : index + 1
    const nextOrder = insertAt(normalizedOrder, sourceId, targetIndex)
    onOrderChange(nextOrder)
    setHover(null)
    setDraggingToEnd(false)
  }

  const handleDragLeavePanel = (id: string) => (event: React.DragEvent) => {
    event.stopPropagation()
    if (hover?.id === id) setHover(null)
  }

  const handleDragOverGrid = (event: React.DragEvent) => {
    if (!draggingId) return
    event.preventDefault()
    setHover(null)
    setDraggingToEnd(true)
  }

  const handleDropOnGrid = (event: React.DragEvent) => {
    event.preventDefault()
    const sourceId = extractId(event)
    if (!sourceId) return
    const nextOrder = insertAt(normalizedOrder, sourceId, normalizedOrder.length)
    onOrderChange(nextOrder)
    setHover(null)
    setDraggingToEnd(false)
  }

  const handleHelpClick = (id: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    event.stopPropagation()
    onRequestHelp?.(id)
  }

  return (
    <div
      className={`dashboard-grid${draggingToEnd ? ' drop-end' : ''}`}
      onDragOver={handleDragOverGrid}
      onDrop={handleDropOnGrid}
    >
      {normalizedOrder.map((id, index) => {
        const panel = panelMap.get(id)
        if (!panel) return null
        const span = panel.span ?? 1
        const isDragging = draggingId === id
        const hoverBefore = hover?.id === id && hover.position === 'before'
        const hoverAfter = hover?.id === id && hover.position === 'after'
        const className = [
          'panel',
          'dashboard-panel',
          isDragging ? 'dragging' : '',
          hoverBefore ? 'drop-before' : '',
          hoverAfter ? 'drop-after' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <section
            key={panel.id}
            className={className}
            style={{ gridColumn: span > 1 ? `span ${span}` : undefined }}
            onDragOver={handleDragOverPanel(panel.id, index)}
            onDrop={handleDropOnPanel(panel.id, index)}
            onDragLeave={handleDragLeavePanel(panel.id)}
          >
            <div className="panel-body">
              <div className="panel-header">
                <h3 className="panel-title">{panel.title}</h3>
                <div className="panel-actions">
                  {onRequestHelp ? (
                    <button
                      type="button"
                      className="panel-help-button"
                      onClick={handleHelpClick(panel.id)}
                      aria-label={`Show help for ${panel.title}`}
                    >
                      ?
                    </button>
                  ) : null}
                  <span
                    className="panel-drag-hint"
                    aria-hidden="true"
                    draggable
                    onDragStart={handleDragStart(panel.id)}
                    onDragEnd={handleDragEnd}
                  >
                    ⋮⋮
                  </span>
                </div>
              </div>
              {panel.render()}
            </div>
          </section>
        )
      })}
    </div>
  )
}
