import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { useStore, type State } from '../state/store'
import type { Patch } from '../audio-engine/engine'
import { presets, DEFAULT_PRESET_ID } from '../patches/presets'

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')

export function PatchPanel() {
  const updatePatch = useStore((s: State) => s.updatePatch)
  const exportPatch = useStore((s: State) => s.exportPatch)
  const importPatch = useStore((s: State) => s.importPatch)
  const saveUserPreset = useStore((s: State) => s.saveUserPreset)
  const overwriteUserPreset = useStore((s: State) => s.overwriteUserPreset)
  const deleteUserPreset = useStore((s: State) => s.deleteUserPreset)
  const userPresets = useStore((s: State) => s.userPresets)

  const fileRef = useRef<HTMLInputElement>(null)
  const [selectedPresetId, setSelectedPresetId] = useState<string | null>(null)
  const [nameInput, setNameInput] = useState('')
  const [descriptionInput, setDescriptionInput] = useState('')
  const nameInputId = useId()
  const descriptionInputId = useId()

  const selectedPreset = useMemo(
    () => userPresets.find((preset) => preset.id === selectedPresetId) ?? null,
    [selectedPresetId, userPresets],
  )

  useEffect(() => {
    if (!selectedPreset) return
    setNameInput(selectedPreset.name)
    setDescriptionInput(selectedPreset.description ?? '')
  }, [selectedPreset])

  const applyPatch = (patch: Patch) => {
    const cloned: Patch = typeof structuredClone === 'function'
      ? structuredClone(patch)
      : JSON.parse(JSON.stringify(patch))
    updatePatch(cloned)
  }

  const exportCurrentPatch = () => {
    const data = exportPatch()
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'patch.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  const onImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      importPatch(String(reader.result))
    }
    reader.readAsText(file)
  }

  const resetSelection = () => {
    setSelectedPresetId(null)
    setNameInput('')
    setDescriptionInput('')
  }

  const handleSaveNew = () => {
    const trimmedName = nameInput.trim()
    if (!trimmedName) return
    const trimmedDescription = descriptionInput.trim()

    const existing = userPresets.find((preset) => preset.name.toLowerCase() === trimmedName.toLowerCase())
    if (existing) {
      const confirmed = window.confirm(`Overwrite existing preset "${existing.name}" with the current patch?`)
      if (!confirmed) return
      const ok = overwriteUserPreset(existing.id, {
        name: trimmedName,
        description: trimmedDescription,
        updatePatch: true,
      })
      if (ok) setSelectedPresetId(existing.id)
      return
    }

    const createdId = saveUserPreset(trimmedName, trimmedDescription)
    if (createdId) setSelectedPresetId(createdId)
  }

  const handleOverwrite = () => {
    if (!selectedPreset) return
    overwriteUserPreset(selectedPreset.id, {
      name: nameInput.trim() || selectedPreset.name,
      description: descriptionInput.trim(),
      updatePatch: true,
    })
  }

  const handleLoad = (id: string) => {
    const preset = userPresets.find((item) => item.id === id)
    if (!preset) return
    setSelectedPresetId(id)
    setNameInput(preset.name)
    setDescriptionInput(preset.description ?? '')
    applyPatch(preset.patch)
  }

  const handleExportPreset = (id: string) => {
    const preset = userPresets.find((item) => item.id === id)
    if (!preset) return
    const data = JSON.stringify(preset.patch, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${slugify(preset.name) || preset.id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDelete = (id: string) => {
    const preset = userPresets.find((item) => item.id === id)
    if (!preset) return
    const confirmed = window.confirm(`Delete custom preset "${preset.name}"?`)
    if (!confirmed) return
    deleteUserPreset(id)
    if (selectedPresetId === id) resetSelection()
  }

  const handleResetToDefault = () => {
    resetSelection()
    applyPatch(presets[DEFAULT_PRESET_ID])
  }

  const canSaveNew = nameInput.trim().length > 0

  return (
    <section className="preset-dashboard">
      <div className="preset-dashboard__header">
        <h3>Custom Presets</h3>
        <div className="preset-dashboard__header-actions">
          <button type="button" onClick={() => fileRef.current?.click()}>
            Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            style={{ display: 'none' }}
            onChange={onImport}
          />
          <button type="button" onClick={exportCurrentPatch}>
            Export Current
          </button>
          <button
            type="button"
            title="Clears local presets to recover from incompatible versions"
            onClick={() => {
              localStorage.removeItem('websynth-patch')
              location.reload()
            }}
          >
            Clear Local
          </button>
        </div>
      </div>

      <div className="preset-dashboard__save">
        <div className="preset-dashboard__save-fields">
          <label className="preset-manager__field" htmlFor={nameInputId}>
            <span className="preset-manager__field-label">Preset Name</span>
            <input
              id={nameInputId}
              className="preset-manager__input"
              placeholder="Warm Keys"
              value={nameInput}
              onChange={(event) => setNameInput(event.target.value)}
              type="text"
            />
          </label>
          <label className="preset-manager__field" htmlFor={descriptionInputId}>
            <span className="preset-manager__field-label">Description</span>
            <textarea
              id={descriptionInputId}
              className="preset-manager__textarea"
              placeholder="Describe the character or intended use"
              rows={3}
              value={descriptionInput}
              onChange={(event) => setDescriptionInput(event.target.value)}
            />
          </label>
        </div>
        <div className="preset-dashboard__save-actions">
          <button type="button" onClick={handleSaveNew} disabled={!canSaveNew}>
            Save New Preset
          </button>
          <button type="button" onClick={handleOverwrite} disabled={!selectedPreset}>
            Overwrite Selected
          </button>
          <button type="button" onClick={handleResetToDefault}>
            Load Init Patch
          </button>
        </div>
      </div>

      <div className="preset-dashboard__table-wrapper">
        <table className="preset-dashboard__table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Description</th>
              <th scope="col">Created</th>
              <th scope="col" className="preset-dashboard__table-actions">Actions</th>
            </tr>
          </thead>
          <tbody>
            {userPresets.length === 0 ? (
              <tr>
                <td colSpan={4} className="preset-dashboard__empty">
                  No custom presets yet. Save your current patch to add one.
                </td>
              </tr>
            ) : (
              userPresets.map((preset) => {
                const isSelected = preset.id === selectedPresetId
                const created = new Date(preset.createdAt).toLocaleString()
                return (
                  <tr key={preset.id} className="preset-dashboard__row" data-selected={isSelected ? 'true' : 'false'}>
                    <td>
                      <button type="button" className="preset-dashboard__name" onClick={() => handleLoad(preset.id)}>
                        {preset.name}
                      </button>
                    </td>
                    <td className="preset-dashboard__description">{preset.description || '—'}</td>
                    <td className="preset-dashboard__created">
                      <time dateTime={preset.createdAt}>{created}</time>
                    </td>
                    <td className="preset-dashboard__table-actions">
                      <button type="button" onClick={() => handleLoad(preset.id)}>
                        Load
                      </button>
                      <button type="button" onClick={() => handleExportPreset(preset.id)}>
                        Export
                      </button>
                      <button type="button" onClick={() => handleDelete(preset.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
