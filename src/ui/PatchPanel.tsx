import React, { useRef } from 'react'
import { useStore, type State } from '../state/store'
import { presets } from '../patches/presets'

export function PatchPanel() {
  const updatePatch = useStore((s: State) => s.updatePatch)
  const exportPatch = useStore((s: State) => s.exportPatch)
  const importPatch = useStore((s: State) => s.importPatch)
  const fileRef = useRef<HTMLInputElement>(null)

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

  return (
    <div className="row" style={{ justifyContent: 'space-between' }}>
      <div className="row" style={{ gap: 8 }}>
        <select onChange={(e) => updatePatch(presets[e.target.value])} defaultValue="init">
          {Object.entries(presets).map(([key]) => (
            <option key={key} value={key}>
              {key}
            </option>
          ))}
        </select>
        <button onClick={() => fileRef.current?.click()}>Import</button>
        <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImport} />
        <button onClick={download}>Export</button>
        <button onClick={() => updatePatch(presets.init)}>Reset</button>
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
      <div className="label">Presets and Patch IO</div>
    </div>
  )
}
