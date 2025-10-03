import React, { useEffect } from 'react'

export type SettingsModalProps = {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  title?: string
  closeLabel?: string
}

export function SettingsModal({ open, onClose, children, title = 'Settings', closeLabel = 'Close settings' }: SettingsModalProps) {
  useEffect(() => {
    if (!open) return
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal">
        <header className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close" onClick={onClose} aria-label={closeLabel}>
            ×
          </button>
        </header>
        <div className="modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}
