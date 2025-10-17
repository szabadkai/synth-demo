import React from 'react'
import { useStore, type State } from '../state/store'
import { presetGroups, presetIndex } from '../patches/presets'

export function PresetSelector() {
  const updatePatch = useStore((s: State) => s.updatePatch)
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [open, setOpen] = React.useState(false)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const selectedPreset = selectedId ? presetIndex[selectedId] : null

  const closeMenu = React.useCallback(() => {
    setOpen(false)
    triggerRef.current?.blur()
  }, [])

  const handleSelect = React.useCallback(
    (id: string) => {
      setSelectedId(id)
      closeMenu()
      const preset = presetIndex[id]
      if (preset) updatePatch(preset.patch)
    },
    [closeMenu, updatePatch],
  )

  React.useEffect(() => {
    if (!open) return
    const handlePointerDown = (event: PointerEvent) => {
      if (
        !triggerRef.current?.contains(event.target as Node) &&
        !listRef.current?.contains(event.target as Node)
      ) {
        closeMenu()
      }
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
      }
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open, closeMenu])

  const toggleMenu = () => {
    setOpen((prev) => !prev)
    if (open) {
      closeMenu()
    }
  }

  return (
    <div className="preset-selector" data-open={open ? 'true' : 'false'}>
      <button
        type="button"
        ref={triggerRef}
        className="preset-selector-trigger"
        onClick={toggleMenu}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedPreset ? (
          <span className="preset-selector-label">
            <span
              className="preset-selector-thumb"
              style={{ backgroundImage: `url(${selectedPreset.image})` }}
            />
            <span>{selectedPreset.name}</span>
          </span>
        ) : (
          <span className="preset-selector-placeholder">Presets</span>
        )}
        <span className="preset-selector-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div
          className="preset-selector-popover"
          ref={listRef}
          role="listbox"
          aria-label="Preset library"
        >
          {presetGroups.map((group) => (
            <div key={group.id} className="preset-selector-group">
              <div className="preset-selector-group-title">{group.name}</div>
              <div className="preset-selector-options">
                {group.presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    role="option"
                    aria-selected={preset.id === selectedId}
                    className="preset-option"
                    style={{ backgroundImage: `url(${preset.image})` }}
                    onClick={() => handleSelect(preset.id)}
                  >
                    <div className="preset-option-overlay">
                      <div className="preset-option-name">{preset.name}</div>
                      <div className="preset-option-description">{preset.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
