import React, { useMemo, useRef, useState } from 'react'
import { useStore, type State } from '../state/store'
import {
  presets,
  presetGroups,
  presetIndex,
  DEFAULT_PRESET_ID,
} from '../patches/presets'

export function PatchPanel() {
  const updatePatch = useStore((s: State) => s.updatePatch)
  const exportPatch = useStore((s: State) => s.exportPatch)
  const importPatch = useStore((s: State) => s.importPatch)
  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedPresetId, setSelectedPresetId] = useState<string>(DEFAULT_PRESET_ID)

  const download = () => {
    const data = exportPatch()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'patch.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      importPatch(String(reader.result))
    }
    reader.readAsText(file)
  }

  const selectedPreset = useMemo(() => presetIndex[selectedPresetId], [selectedPresetId])

  const handleSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value
    setSelectedPresetId(id)
    event.target.blur()
    const preset = presets[id]
    if (preset) updatePatch(preset)
  }

  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div className="row" style={{ gap: 8 }}>
        <select value={selectedPresetId} onChange={handleSelect}>
          {presetGroups.map((group) => (
            <optgroup key={group.id} label={group.name}>
              {group.presets.map((preset) => (
                <option key={preset.id} value={preset.id} title={preset.description}>
                  {preset.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <button onClick={() => fileRef.current?.click()}>Import</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImport} />
        <button onClick={download}>Export</button>
        <button
          onClick={() => {
            setSelectedPresetId(DEFAULT_PRESET_ID)
            updatePatch(presets[DEFAULT_PRESET_ID])
          }}
        >
          Reset
        </button>
        <button
          title="Clears local patches to recover from incompatible versions"
          onClick={() => {
            localStorage.removeItem('websynth-patch')
            location.reload()
          }}
        >
          Clear Local
        </button>
      </div>
      <div className="preset-panel-meta">
        <div className="label">Presets &amp; Patch IO</div>
        {selectedPreset && (
          <div className="preset-description">
            <p>{selectedPreset.description}</p>
            {selectedPreset.tags && selectedPreset.tags.length > 0 && (
              <div className="preset-tags">
                {selectedPreset.tags.map((tag) => (
                  <span key={tag} className="preset-tag">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
