import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  SynthEngine,
  defaultPatch,
  DEFAULT_OSCILLATOR_MACRO,
  DEFAULT_OSCILLATOR_SAMPLER,
} from '../audio-engine/engine'
import type {
  Patch,
  SamplerSettings,
  EngineMode,
  OscillatorMode,
  ModMatrixRow,
  ModSource,
  ModTarget,
} from '../audio-engine/engine'

const normalizeOscillator = (osc: Patch['osc1']): Patch['osc1'] => ({
  ...osc,
  mode: osc.mode ?? 'analog',
  macro: { ...DEFAULT_OSCILLATOR_MACRO, ...(osc.macro ?? {}) },
  sampler: { ...DEFAULT_OSCILLATOR_SAMPLER, ...(osc.sampler ?? {}) },
})

const deriveEngineMode = (
  osc1Mode: OscillatorMode,
  osc2Mode: OscillatorMode,
): EngineMode => {
  if (osc1Mode === 'sampler' || osc2Mode === 'sampler') return 'sampler'
  if (osc1Mode === 'macro' || osc2Mode === 'macro') return 'macro'
  return 'classic'
}

const selectMacroSource = (state: Patch): NonNullable<Patch['macro']> => {
  if (state.osc1.mode === 'macro' && state.osc1.macro) return state.osc1.macro
  if (state.osc2.mode === 'macro' && state.osc2.macro) return state.osc2.macro
  return state.macro ?? DEFAULT_OSCILLATOR_MACRO
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const MOD_SOURCES: ModSource[] = ['lfo1', 'lfo2', 'exprX', 'exprY', 'seqStep', 'velocity', 'gate']
const MOD_TARGETS: ModTarget[] = [
  'filter.cutoff',
  'filter.q',
  'master.gain',
  'macro.harmonics',
  'macro.timbre',
  'macro.morph',
  'macro.level',
  'fm.amount',
  'mix',
  'envelope.attack',
  'envelope.release',
]

const normalizeModRow = (row: Partial<ModMatrixRow>, fallbackId: string): ModMatrixRow => {
  const id = typeof row.id === 'string' && row.id.length > 0 ? row.id : fallbackId
  const source = MOD_SOURCES.includes(row.source as ModSource) ? (row.source as ModSource) : 'lfo1'
  const target = MOD_TARGETS.includes(row.target as ModTarget) ? (row.target as ModTarget) : 'filter.cutoff'
  const amount = clamp(Number.isFinite(row.amount) ? Number(row.amount) : 0, -1, 1)
  const enabled = row.enabled !== false
  return { id, source, target, amount, enabled }
}

const makeModId = () => `mod-${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 6)}`

const normalizeModMatrix = (rows: Partial<ModMatrixRow>[]): ModMatrixRow[] => {
  const seen = new Set<string>()
  return rows.map((raw) => {
    let normalized = normalizeModRow(raw, makeModId())
    if (seen.has(normalized.id)) {
      normalized = { ...normalized, id: makeModId() }
    }
    seen.add(normalized.id)
    return normalized
  })
}

const clonePatch = (patch: Patch): Patch => JSON.parse(JSON.stringify(patch))

export type MidiDeviceInfo = {
  id: string
  name: string
  manufacturer?: string | null
}

export type MidiStatus = 'idle' | 'requesting' | 'ready' | 'error' | 'unsupported'

export type UserPreset = {
  id: string
  name: string
  description: string
  createdAt: string
  patch: Patch
}

export type State = {
  engine: SynthEngine | null
  patch: Patch
  userPresets: UserPreset[]
  samplerLibrary: SamplerSettings[]
  layoutOrder: string[]
  oscilloscope: {
    fftSize: 1024 | 2048 | 4096 | 8192
  }
  transport: {
    tempo: number
    playing: boolean
    tick: number
  }
  midi: {
    supported: boolean | null
    status: MidiStatus
    enabled: boolean
    inputs: MidiDeviceInfo[]
    selectedInputId: string | null
    lastError: string | null
    activeNotes: number[]
  }
  setEngine: (e: SynthEngine) => void
  updatePatch: (p: Partial<Patch>) => void
  setLayoutOrder: (ids: string[]) => void
  tempo: number
  setTempo: (bpm: number) => void
  setTransportPlaying: (playing: boolean) => void
  bumpTransportTick: () => void
  importPatch: (json: string) => void
  exportPatch: () => string
  saveUserPreset: (name: string, description?: string) => string | null
  setMidiSupported: (supported: boolean) => void
  setMidiStatus: (status: MidiStatus, error?: string | null) => void
  setMidiEnabled: (enabled: boolean) => void
  setMidiInputs: (inputs: MidiDeviceInfo[]) => void
  setMidiSelectedInput: (id: string | null) => void
  setMidiActiveNotes: (notes: number[]) => void
  setOscilloscopeFftSize: (size: 1024 | 2048 | 4096 | 8192) => void
  saveSamplerSample: (target: 'osc1' | 'osc2', sample: SamplerSettings) => void
  deleteSamplerSample: (id: string) => void
  setSamplerFromLibrary: (target: 'osc1' | 'osc2', id: string) => void
  updateCurrentSampler: (target: 'osc1' | 'osc2', changes: Partial<SamplerSettings>) => void
  renameSamplerSample: (id: string, name: string) => void
  playSamplerPreview: (target: 'osc1' | 'osc2') => void
  resetPatch: () => void
  addModRoute: () => void
  updateModRoute: (id: string, changes: Partial<ModMatrixRow>) => void
  removeModRoute: (id: string) => void
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      engine: null,
      patch: defaultPatch,
      userPresets: [],
      samplerLibrary: [],
      layoutOrder: [],
      oscilloscope: { fftSize: 4096 },
      tempo: 110,
      transport: { tempo: 110, playing: false, tick: 0 },
      midi: {
        supported: null,
        status: 'idle',
        enabled: false,
        inputs: [],
        selectedInputId: null,
        lastError: null,
        activeNotes: [],
      },
      setEngine: (e) => set({ engine: e }),
      updatePatch: (p) => {
        const prevPatch = get().patch
        const incomingMatrix = Array.isArray((p as any).modMatrix)
          ? normalizeModMatrix((p as any).modMatrix as Partial<ModMatrixRow>[])
          : undefined
        const prevMatrix = (prevPatch.modMatrix ?? []).map((row) => ({ ...row }))
        const next = {
          ...prevPatch,
          ...p,
          osc1: { ...prevPatch.osc1, ...(p as any).osc1 },
          osc2: { ...prevPatch.osc2, ...(p as any).osc2 },
          fm: { ...prevPatch.fm, ...(p as any).fm },
          sub: { ...prevPatch.sub, ...(p as any).sub },
          ring: { ...prevPatch.ring, ...(p as any).ring },
          filter: { ...prevPatch.filter, ...(p as any).filter },
          envelope: { ...prevPatch.envelope, ...(p as any).envelope },
          master: { ...prevPatch.master, ...(p as any).master },
          sampler: { ...prevPatch.sampler, ...(p as any).sampler },
          macro: { ...((prevPatch as any).macro || defaultPatch.macro), ...(p as any).macro },
          effects: { ...((prevPatch as any).effects || defaultPatch.effects), ...(p as any).effects },
          lfo1: { ...((prevPatch as any).lfo1 || defaultPatch.lfo1), ...(p as any).lfo1 },
          lfo2: { ...((prevPatch as any).lfo2 || defaultPatch.lfo2), ...(p as any).lfo2 },
          arp: { ...((prevPatch as any).arp || defaultPatch.arp), ...(p as any).arp },
          sequencer: { ...((prevPatch as any).sequencer || defaultPatch.sequencer), ...(p as any).sequencer },
          mix: (p as any).mix != null ? (p as any).mix : prevPatch.mix,
          expression: { ...((prevPatch as any).expression || defaultPatch.expression), ...(p as any).expression },
        }
        next.osc1 = normalizeOscillator(next.osc1)
        next.osc2 = normalizeOscillator(next.osc2)
        next.modMatrix = incomingMatrix ?? prevMatrix

        const requestedEngineMode = p.engineMode
        const derivedEngineMode = requestedEngineMode
          ?? deriveEngineMode(next.osc1.mode ?? 'analog', next.osc2.mode ?? 'analog')
        next.engineMode = derivedEngineMode

        const enginePatch: Partial<Patch> = { ...p }
        if (requestedEngineMode !== undefined || (prevPatch.engineMode ?? 'classic') !== derivedEngineMode) {
          enginePatch.engineMode = derivedEngineMode
        }

        const macroSource = selectMacroSource(next)
        const normalizedMacro = { ...DEFAULT_OSCILLATOR_MACRO, ...(macroSource ?? {}) }
        next.macro = normalizedMacro

        if (derivedEngineMode === 'macro' || p.macro !== undefined || (p as any).osc1?.macro !== undefined || (p as any).osc2?.macro !== undefined) {
          enginePatch.macro = normalizedMacro
        }
        if (incomingMatrix !== undefined) {
          enginePatch.modMatrix = incomingMatrix
        }

        // Apply only the delta to the engine to avoid heavy reconfiguration on unrelated tweaks
        get().engine?.applyPatch(enginePatch)
        set({ patch: next })
      },
      setLayoutOrder: (ids) => set({ layoutOrder: ids }),
      setTempo: (bpm) => set((state) => ({ tempo: bpm, transport: { ...state.transport, tempo: bpm } })),
      setTransportPlaying: (playing) => set((state) => ({ transport: { ...state.transport, playing, tick: 0 } })),
      bumpTransportTick: () => set((state) => ({ transport: { ...state.transport, tick: state.transport.tick + 1 } })),
      importPatch: (json) => {
        const obj = JSON.parse(json)
        const merged = {
          ...get().patch,
          ...obj,
          osc1: { ...get().patch.osc1, ...(obj as any).osc1 },
          osc2: { ...get().patch.osc2, ...(obj as any).osc2 },
          fm: { ...get().patch.fm, ...(obj as any).fm },
          sub: { ...get().patch.sub, ...(obj as any).sub },
          ring: { ...get().patch.ring, ...(obj as any).ring },
          filter: { ...get().patch.filter, ...(obj as any).filter },
          envelope: { ...get().patch.envelope, ...(obj as any).envelope },
          master: { ...get().patch.master, ...(obj as any).master },
          sampler: { ...get().patch.sampler, ...(obj as any).sampler },
          macro: { ...((get().patch as any).macro || defaultPatch.macro), ...(obj as any).macro },
          effects: { ...((get().patch as any).effects || defaultPatch.effects), ...(obj as any).effects },
          lfo1: { ...((get().patch as any).lfo1 || defaultPatch.lfo1), ...(obj as any).lfo1 },
          lfo2: { ...((get().patch as any).lfo2 || defaultPatch.lfo2), ...(obj as any).lfo2 },
          arp: { ...((get().patch as any).arp || defaultPatch.arp), ...(obj as any).arp },
          sequencer: { ...((get().patch as any).sequencer || defaultPatch.sequencer), ...(obj as any).sequencer },
          mix: (obj as any).mix != null ? (obj as any).mix : get().patch.mix,
          expression: { ...((get().patch as any).expression || defaultPatch.expression), ...(obj as any).expression },
          modMatrix: Array.isArray((obj as any).modMatrix)
            ? normalizeModMatrix((obj as any).modMatrix as Partial<ModMatrixRow>[])
            : ((get().patch.modMatrix ?? []).map((row) => ({ ...row }))),
        }
        merged.osc1 = normalizeOscillator(merged.osc1)
        merged.osc2 = normalizeOscillator(merged.osc2)
        get().engine?.applyPatch(merged)
        set({ patch: merged })
      },
      exportPatch: () => JSON.stringify(get().patch, null, 2),
      saveUserPreset: (name, description) => {
        const trimmedName = name.trim()
        if (!trimmedName) return null
        const trimmedDescription = (description ?? '').trim()
        let createdId: string | null = null
        set((state) => {
          const baseSlug = trimmedName
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
          const baseId = baseSlug.length > 0 ? `user-${baseSlug}` : `user-${Date.now().toString(36)}`
          const existingIds = new Set(state.userPresets.map((preset) => preset.id))
          let candidate = baseId
          let suffix = 1
          while (existingIds.has(candidate)) {
            candidate = `${baseId}-${suffix++}`
          }
          createdId = candidate
          const snapshot = clonePatch(state.patch)
          const nextPreset: UserPreset = {
            id: candidate,
            name: trimmedName,
            description: trimmedDescription.length > 0 ? trimmedDescription : 'Custom preset',
            createdAt: new Date().toISOString(),
            patch: snapshot,
          }
          return { userPresets: [...state.userPresets, nextPreset] }
        })
        return createdId
      },
      setMidiSupported: (supported) => set((state) => ({ midi: { ...state.midi, supported } })),
      setMidiStatus: (status, error = null) => set((state) => ({ midi: { ...state.midi, status, lastError: error } })),
      setMidiEnabled: (enabled) => set((state) => ({ midi: { ...state.midi, enabled } })),
      setMidiInputs: (inputs) => set((state) => ({ midi: { ...state.midi, inputs } })),
      setMidiSelectedInput: (id) => set((state) => ({ midi: { ...state.midi, selectedInputId: id } })),
      setMidiActiveNotes: (notes) => set((state) => ({ midi: { ...state.midi, activeNotes: notes } })),
      setOscilloscopeFftSize: (size) => set((state) => ({ oscilloscope: { fftSize: size } })),
      saveSamplerSample: (target, sample) => set((state) => {
        const id = sample.id ?? `sample-${Date.now()}`
        const sanitized: SamplerSettings = { ...DEFAULT_OSCILLATOR_SAMPLER, ...sample, id }
        const nextLibrary = state.samplerLibrary.filter((s) => s.id !== id).concat(sanitized)
        const nextPatch: Patch = {
          ...state.patch,
          [target]: normalizeOscillator({
            ...state.patch[target],
            mode: 'sampler',
            sampler: sanitized,
          }),
        }
        const enginePatch: Partial<Patch> = {
          [target]: { mode: 'sampler', sampler: sanitized } as Patch['osc1'],
        }
        nextPatch.sampler = sanitized
        enginePatch.sampler = sanitized
        state.engine?.applyPatch(enginePatch)
        return {
          samplerLibrary: nextLibrary,
          patch: nextPatch,
        }
      }),
      deleteSamplerSample: (id) => set((state) => {
        const nextLibrary = state.samplerLibrary.filter((s) => s.id !== id)
        const nextPatch: Patch = { ...state.patch }
        const enginePatch: Partial<Patch> = {}
        ;(['osc1', 'osc2'] as const).forEach((key) => {
          if (nextPatch[key].sampler?.id === id) {
            const fallback = { ...DEFAULT_OSCILLATOR_SAMPLER }
            nextPatch[key] = normalizeOscillator({
              ...nextPatch[key],
              sampler: fallback,
            })
            ;(enginePatch as any)[key] = { sampler: fallback }
          }
        })
        if (nextPatch.sampler?.id === id) {
          const fallback = { ...DEFAULT_OSCILLATOR_SAMPLER }
          nextPatch.sampler = fallback
          ;(enginePatch as any).sampler = fallback
        }
        if (Object.keys(enginePatch).length > 0) {
          state.engine?.applyPatch(enginePatch)
        }
        return { samplerLibrary: nextLibrary, patch: nextPatch }
      }),
      setSamplerFromLibrary: (target, id) => set((state) => {
        const found = state.samplerLibrary.find((s) => s.id === id)
        if (!found) return {}
        const sample = { ...DEFAULT_OSCILLATOR_SAMPLER, ...found }
        const nextPatch: Patch = {
          ...state.patch,
          [target]: normalizeOscillator({
            ...state.patch[target],
            mode: 'sampler',
            sampler: sample,
          }),
        }
        const enginePatch: Partial<Patch> = {
          [target]: { mode: 'sampler', sampler: sample } as Patch['osc1'],
        }
        nextPatch.sampler = sample
        enginePatch.sampler = sample
        state.engine?.applyPatch(enginePatch)
        return { patch: nextPatch }
      }),
      updateCurrentSampler: (target, changes) => set((state) => {
        const current = { ...DEFAULT_OSCILLATOR_SAMPLER, ...(state.patch[target].sampler ?? {}) }
        const nextSampler = { ...current, ...changes }
        const nextPatch: Patch = {
          ...state.patch,
          [target]: normalizeOscillator({
            ...state.patch[target],
            sampler: nextSampler,
          }),
        }
        const enginePatch: Partial<Patch> = {
          [target]: { sampler: nextSampler } as Patch['osc1'],
        }
        nextPatch.sampler = nextSampler
        enginePatch.sampler = nextSampler
        state.engine?.applyPatch(enginePatch)
        const nextLibrary = nextSampler.id
          ? state.samplerLibrary.map((item) => (item.id === nextSampler.id ? { ...item, ...changes } : item))
          : state.samplerLibrary
        return { patch: nextPatch, samplerLibrary: nextLibrary }
      }),
      renameSamplerSample: (id, name) => set((state) => {
        const trimmed = name.trim()
        if (!trimmed) return {}
        let changed = false
        const nextLibrary = state.samplerLibrary.map((item) => {
          if (item.id !== id) return item
          changed = true
          return { ...item, name: trimmed }
        })
        if (!changed) return {}
        const nextPatch: Patch = { ...state.patch }
        const enginePatch: Partial<Patch> = {}
        ;(['osc1', 'osc2'] as const).forEach((key) => {
          if (nextPatch[key].sampler?.id === id) {
            const updated = { ...nextPatch[key].sampler, name: trimmed }
            nextPatch[key] = normalizeOscillator({
              ...nextPatch[key],
              sampler: updated,
            })
            ;(enginePatch as any)[key] = { sampler: updated }
          }
        })
        if (nextPatch.sampler?.id === id) {
          const updated = { ...nextPatch.sampler, name: trimmed }
          nextPatch.sampler = updated
          ;(enginePatch as any).sampler = updated
        }
        if (Object.keys(enginePatch).length > 0) {
          state.engine?.applyPatch(enginePatch)
        }
        return { samplerLibrary: nextLibrary, patch: nextPatch }
      }),
      playSamplerPreview: (target) => {
        const engine = get().engine
        if (!engine) return
        void engine.previewSampler(target)
      },
      resetPatch: () => set((state) => {
        state.engine?.applyPatch(defaultPatch)
        return { patch: defaultPatch, samplerLibrary: state.samplerLibrary }
      }),
      addModRoute: () => {
        const current = get().patch.modMatrix ?? []
        if (current.length >= 16) return
        const base: ModMatrixRow = {
          id: makeModId(),
          source: 'lfo1',
          target: 'filter.cutoff',
          amount: 0.5,
          enabled: true,
        }
        const matrix = [...current.map((row) => ({ ...row })), base]
        get().updatePatch({ modMatrix: matrix } as Partial<Patch>)
      },
      updateModRoute: (id, changes) => {
        const matrix = (get().patch.modMatrix ?? []).map((row) =>
          row.id === id ? normalizeModRow({ ...row, ...changes }, row.id) : row,
        )
        get().updatePatch({ modMatrix: matrix } as Partial<Patch>)
      },
      removeModRoute: (id) => {
        const matrix = (get().patch.modMatrix ?? []).filter((row) => row.id !== id)
        get().updatePatch({ modMatrix: matrix } as Partial<Patch>)
      },
    }),
    {
      name: 'websynth-patch',
      partialize: (state) => ({
        patch: {
          ...state.patch,
          sequencer: state.patch.sequencer ? { ...state.patch.sequencer, playing: false } : state.patch.sequencer,
          arp: state.patch.arp ? { ...state.patch.arp, bpmSync: state.patch.arp.bpmSync ?? true } : state.patch.arp,
        },
        userPresets: state.userPresets,
        samplerLibrary: state.samplerLibrary,
        layoutOrder: state.layoutOrder,
        tempo: state.tempo,
        transport: { tempo: state.transport.tempo, playing: false, tick: 0 },
        midi: {
          enabled: state.midi.enabled,
          selectedInputId: state.midi.selectedInputId,
        },
        oscilloscope: state.oscilloscope,
      }),
      version: 11,
      migrate: (persistedState: any, version: number) => {
        // Ensure new fields (osc2, mix) exist by merging with defaults
        const p = persistedState?.patch
        if (!p) return persistedState
        const legacyOsc1 = p.osc1 || {}
        const { finePct: _legacyFine, ...osc1Rest } = legacyOsc1
        const migratedPatch: Patch = {
          ...defaultPatch,
          ...p,
          osc1: { ...defaultPatch.osc1, ...osc1Rest },
          osc2: { ...defaultPatch.osc2, ...(p.osc2 || {}) },
          fm: { ...defaultPatch.fm, ...(p.fm || {}) },
          sub: { ...defaultPatch.sub, ...(p.sub || {}) },
          ring: { ...defaultPatch.ring, ...(p.ring || {}) },
          filter: { ...defaultPatch.filter, ...(p.filter || {}) },
          envelope: { ...defaultPatch.envelope, ...(p.envelope || {}) },
          master: { ...defaultPatch.master, ...(p.master || {}) },
          sampler: { ...defaultPatch.sampler, ...(p.sampler || {}) },
          macro: { ...defaultPatch.macro!, ...(p.macro || {}) },
          effects: { ...defaultPatch.effects!, ...(p.effects || {}) },
          lfo1: { ...defaultPatch.lfo1!, ...(p.lfo1 || {}) },
          lfo2: { ...defaultPatch.lfo2!, ...(p.lfo2 || {}) },
          arp: { ...defaultPatch.arp!, ...(p.arp || {}) },
          sequencer: { ...defaultPatch.sequencer!, ...(p.sequencer || {}) },
          mix: typeof p.mix === 'number' ? p.mix : defaultPatch.mix,
          expression: { ...defaultPatch.expression!, ...(p.expression || {}) },
          modMatrix: Array.isArray(p.modMatrix)
            ? normalizeModMatrix(p.modMatrix as Partial<ModMatrixRow>[])
            : [],
        }
        const layoutOrder: string[] = Array.isArray(persistedState?.layoutOrder)
          ? persistedState.layoutOrder.filter((id: unknown) => typeof id === 'string')
          : []
        const tempo = typeof persistedState?.tempo === 'number' ? persistedState.tempo : 110
        const transport = persistedState?.transport
        const migratedTransport = transport
          ? { tempo: transport.tempo ?? tempo, playing: false, tick: 0 }
          : { tempo, playing: false, tick: 0 }
        const midi = persistedState?.midi
        const migratedMidi = {
          supported: null,
          status: 'idle' as MidiStatus,
          enabled: midi?.enabled ?? false,
          inputs: [] as MidiDeviceInfo[],
          selectedInputId: midi?.selectedInputId ?? null,
          lastError: null as string | null,
          activeNotes: [] as number[],
        }
        const library = Array.isArray(persistedState?.samplerLibrary)
          ? (persistedState.samplerLibrary as any[]).map((item, index) => ({
              ...defaultPatch.sampler,
              ...(item ?? {}),
              id: typeof item?.id === 'string' ? item.id : `legacy-${Date.now()}-${index}`,
            }))
          : []
        const userPresets = Array.isArray(persistedState?.userPresets)
          ? (persistedState.userPresets as any[]).map((item, index) => {
              const name = typeof item?.name === 'string' && item.name.trim().length > 0
                ? item.name.trim()
                : `Custom Preset ${index + 1}`
              const description = typeof item?.description === 'string' ? item.description : 'Custom preset'
              const id = typeof item?.id === 'string' && item.id.trim().length > 0
                ? item.id.trim()
                : `user-${Date.now()}-${index}`
              const createdAt = typeof item?.createdAt === 'string' ? item.createdAt : new Date().toISOString()
              const rawPatch = item?.patch && typeof item.patch === 'object' ? item.patch : defaultPatch
              const patch: Patch = {
                ...defaultPatch,
                ...(rawPatch as Partial<Patch>),
              }
              patch.osc1 = normalizeOscillator(patch.osc1)
              patch.osc2 = normalizeOscillator(patch.osc2)
              patch.modMatrix = Array.isArray((rawPatch as any)?.modMatrix)
                ? normalizeModMatrix((rawPatch as any).modMatrix as Partial<ModMatrixRow>[])
                : (patch.modMatrix ?? []).map((row) => ({ ...row }))
              return { id, name, description, createdAt, patch }
            })
          : []
        const allowedFft = [1024, 2048, 4096, 8192] as const
        const persistedFft = persistedState?.oscilloscope?.fftSize
        const fftSize: typeof allowedFft[number] = allowedFft.includes(persistedFft)
          ? (persistedFft as typeof allowedFft[number])
          : 4096
        return {
          ...persistedState,
          patch: migratedPatch,
          samplerLibrary: library,
          userPresets,
          layoutOrder,
          tempo,
          transport: migratedTransport,
          midi: migratedMidi,
          oscilloscope: { fftSize },
        }
      },
      onRehydrateStorage: () => (state) => {
        // Ensure engine is not restored from storage
        if (!state) return
        state.engine = null
        if (!state.oscilloscope || ![1024, 2048, 4096, 8192].includes(state.oscilloscope.fftSize as any)) {
          state.oscilloscope = { fftSize: 4096 }
        }
        if (!Array.isArray(state.layoutOrder)) state.layoutOrder = []
        if (typeof state.tempo !== 'number') state.tempo = 110
        if (!state.transport) state.transport = { tempo: state.tempo, playing: false, tick: 0 }
        if (!state.midi) {
          state.midi = {
            supported: null,
            status: 'idle',
            enabled: false,
            inputs: [],
            selectedInputId: null,
            lastError: null,
            activeNotes: [],
          }
        } else {
          state.midi = {
            supported: null,
            status: 'idle',
            enabled: !!state.midi.enabled,
            inputs: [],
            selectedInputId: state.midi.selectedInputId ?? null,
            lastError: null,
            activeNotes: [],
          }
        }
        if (!Array.isArray(state.userPresets)) state.userPresets = []
      },
    }
  )
)
