import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SynthEngine, Patch, SamplerSettings, defaultPatch } from '../audio-engine/engine'

export type MidiDeviceInfo = {
  id: string
  name: string
  manufacturer?: string | null
}

export type MidiStatus = 'idle' | 'requesting' | 'ready' | 'error' | 'unsupported'

export type State = {
  engine: SynthEngine | null
  patch: Patch
  samplerLibrary: SamplerSettings[]
  layoutOrder: string[]
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
  setMidiSupported: (supported: boolean) => void
  setMidiStatus: (status: MidiStatus, error?: string | null) => void
  setMidiEnabled: (enabled: boolean) => void
  setMidiInputs: (inputs: MidiDeviceInfo[]) => void
  setMidiSelectedInput: (id: string | null) => void
  setMidiActiveNotes: (notes: number[]) => void
  saveSamplerSample: (sample: SamplerSettings) => void
  deleteSamplerSample: (id: string) => void
  setSamplerFromLibrary: (id: string) => void
  updateCurrentSampler: (changes: Partial<SamplerSettings>) => void
  renameSamplerSample: (id: string, name: string) => void
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      engine: null,
      patch: defaultPatch,
      samplerLibrary: [],
      layoutOrder: [],
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
        const next = {
          ...get().patch,
          ...p,
          osc1: { ...get().patch.osc1, ...(p as any).osc1 },
          osc2: { ...get().patch.osc2, ...(p as any).osc2 },
          fm: { ...get().patch.fm, ...(p as any).fm },
          sub: { ...get().patch.sub, ...(p as any).sub },
          ring: { ...get().patch.ring, ...(p as any).ring },
          filter: { ...get().patch.filter, ...(p as any).filter },
          envelope: { ...get().patch.envelope, ...(p as any).envelope },
          master: { ...get().patch.master, ...(p as any).master },
          sampler: { ...get().patch.sampler, ...(p as any).sampler },
          macro: { ...((get().patch as any).macro || defaultPatch.macro), ...(p as any).macro },
          effects: { ...((get().patch as any).effects || defaultPatch.effects), ...(p as any).effects },
          lfo1: { ...((get().patch as any).lfo1 || defaultPatch.lfo1), ...(p as any).lfo1 },
          lfo2: { ...((get().patch as any).lfo2 || defaultPatch.lfo2), ...(p as any).lfo2 },
          arp: { ...((get().patch as any).arp || defaultPatch.arp), ...(p as any).arp },
          sequencer: { ...((get().patch as any).sequencer || defaultPatch.sequencer), ...(p as any).sequencer },
          mix: (p as any).mix != null ? (p as any).mix : get().patch.mix,
          expression: { ...((get().patch as any).expression || defaultPatch.expression), ...(p as any).expression },
        }
        // Apply only the delta to the engine to avoid heavy reconfiguration on unrelated tweaks
        get().engine?.applyPatch(p)
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
        }
        get().engine?.applyPatch(merged)
        set({ patch: merged })
      },
      exportPatch: () => JSON.stringify(get().patch, null, 2),
      setMidiSupported: (supported) => set((state) => ({ midi: { ...state.midi, supported } })),
      setMidiStatus: (status, error = null) => set((state) => ({ midi: { ...state.midi, status, lastError: error } })),
      setMidiEnabled: (enabled) => set((state) => ({ midi: { ...state.midi, enabled } })),
      setMidiInputs: (inputs) => set((state) => ({ midi: { ...state.midi, inputs } })),
      setMidiSelectedInput: (id) => set((state) => ({ midi: { ...state.midi, selectedInputId: id } })),
      setMidiActiveNotes: (notes) => set((state) => ({ midi: { ...state.midi, activeNotes: notes } })),
      saveSamplerSample: (sample) => set((state) => {
        const id = sample.id ?? `sample-${Date.now()}`
        const sanitized: SamplerSettings = { ...defaultPatch.sampler, ...sample, id }
        const nextLibrary = state.samplerLibrary.filter((s) => s.id !== id).concat(sanitized)
        state.engine?.applyPatch({ sampler: sanitized })
        return {
          samplerLibrary: nextLibrary,
          patch: { ...state.patch, sampler: sanitized },
        }
      }),
      deleteSamplerSample: (id) => set((state) => {
        const nextLibrary = state.samplerLibrary.filter((s) => s.id !== id)
        let nextPatch = state.patch
        if (state.patch.sampler.id === id) {
          const fallback = { ...defaultPatch.sampler }
          state.engine?.applyPatch({ sampler: fallback })
          nextPatch = { ...state.patch, sampler: fallback }
        }
        return { samplerLibrary: nextLibrary, patch: nextPatch }
      }),
      setSamplerFromLibrary: (id) => set((state) => {
        const found = state.samplerLibrary.find((s) => s.id === id)
        if (!found) return {}
        const sample = { ...defaultPatch.sampler, ...found }
        state.engine?.applyPatch({ sampler: sample })
        return { patch: { ...state.patch, sampler: sample } }
      }),
      updateCurrentSampler: (changes) => set((state) => {
        const current = { ...defaultPatch.sampler, ...(state.patch.sampler ?? {}) }
        const nextSampler = { ...current, ...changes }
        state.engine?.applyPatch({ sampler: nextSampler })
        const nextLibrary = nextSampler.id
          ? state.samplerLibrary.map((item) => (item.id === nextSampler.id ? { ...item, ...changes } : item))
          : state.samplerLibrary
        return { patch: { ...state.patch, sampler: nextSampler }, samplerLibrary: nextLibrary }
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
        let nextPatch = state.patch
        if (state.patch.sampler.id === id) {
          const nextSampler = { ...state.patch.sampler, name: trimmed }
          state.engine?.applyPatch({ sampler: nextSampler })
          nextPatch = { ...state.patch, sampler: nextSampler }
        }
        return { samplerLibrary: nextLibrary, patch: nextPatch }
      }),
    }),
    {
      name: 'websynth-patch',
      partialize: (state) => ({
        patch: {
          ...state.patch,
          sequencer: state.patch.sequencer ? { ...state.patch.sequencer, playing: false } : state.patch.sequencer,
          arp: state.patch.arp ? { ...state.patch.arp, bpmSync: state.patch.arp.bpmSync ?? true } : state.patch.arp,
        },
        samplerLibrary: state.samplerLibrary,
        layoutOrder: state.layoutOrder,
        tempo: state.tempo,
        transport: { tempo: state.transport.tempo, playing: false, tick: 0 },
        midi: {
          enabled: state.midi.enabled,
          selectedInputId: state.midi.selectedInputId,
        },
      }),
      version: 10,
      migrate: (persistedState: any, version: number) => {
        // Ensure new fields (osc2, mix) exist by merging with defaults
        const p = persistedState?.patch
        if (!p) return persistedState
        const migratedPatch: Patch = {
          ...defaultPatch,
          ...p,
          osc1: { ...defaultPatch.osc1, ...(p.osc1 || {}) },
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
        return {
          ...persistedState,
          patch: migratedPatch,
          samplerLibrary: library,
          layoutOrder,
          tempo,
          transport: migratedTransport,
          midi: migratedMidi,
        }
      },
      onRehydrateStorage: () => (state) => {
        // Ensure engine is not restored from storage
        if (!state) return
        state.engine = null
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
      },
    }
  )
)
