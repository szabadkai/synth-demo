import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { SynthEngine, Patch, defaultPatch } from '../audio-engine/engine'

export type State = {
  engine: SynthEngine | null
  patch: Patch
  setEngine: (e: SynthEngine) => void
  updatePatch: (p: Partial<Patch>) => void
  importPatch: (json: string) => void
  exportPatch: () => string
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      engine: null,
      patch: defaultPatch,
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
          macro: { ...((get().patch as any).macro || defaultPatch.macro), ...(p as any).macro },
          effects: { ...((get().patch as any).effects || defaultPatch.effects), ...(p as any).effects },
          lfo1: { ...((get().patch as any).lfo1 || defaultPatch.lfo1), ...(p as any).lfo1 },
          lfo2: { ...((get().patch as any).lfo2 || defaultPatch.lfo2), ...(p as any).lfo2 },
          arp: { ...((get().patch as any).arp || defaultPatch.arp), ...(p as any).arp },
          sequencer: { ...((get().patch as any).sequencer || defaultPatch.sequencer), ...(p as any).sequencer },
          mix: (p as any).mix != null ? (p as any).mix : get().patch.mix,
        }
        // Apply only the delta to the engine to avoid heavy reconfiguration on unrelated tweaks
        get().engine?.applyPatch(p)
        set({ patch: next })
      },
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
          macro: { ...((get().patch as any).macro || defaultPatch.macro), ...(obj as any).macro },
          effects: { ...((get().patch as any).effects || defaultPatch.effects), ...(obj as any).effects },
          lfo1: { ...((get().patch as any).lfo1 || defaultPatch.lfo1), ...(obj as any).lfo1 },
          lfo2: { ...((get().patch as any).lfo2 || defaultPatch.lfo2), ...(obj as any).lfo2 },
          arp: { ...((get().patch as any).arp || defaultPatch.arp), ...(obj as any).arp },
          sequencer: { ...((get().patch as any).sequencer || defaultPatch.sequencer), ...(obj as any).sequencer },
          mix: (obj as any).mix != null ? (obj as any).mix : get().patch.mix,
        }
        get().engine?.applyPatch(merged)
        set({ patch: merged })
      },
      exportPatch: () => JSON.stringify(get().patch, null, 2),
    }),
    {
      name: 'websynth-patch',
      partialize: (state) => ({ patch: state.patch }),
      version: 7,
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
          macro: { ...defaultPatch.macro!, ...(p.macro || {}) },
          effects: { ...defaultPatch.effects!, ...(p.effects || {}) },
          lfo1: { ...defaultPatch.lfo1!, ...(p.lfo1 || {}) },
          lfo2: { ...defaultPatch.lfo2!, ...(p.lfo2 || {}) },
          arp: { ...defaultPatch.arp!, ...(p.arp || {}) },
          sequencer: { ...defaultPatch.sequencer!, ...(p.sequencer || {}) },
          mix: typeof p.mix === 'number' ? p.mix : defaultPatch.mix,
        }
        return { ...persistedState, patch: migratedPatch }
      },
      onRehydrateStorage: () => (state) => {
        // Ensure engine is not restored from storage
        if (!state) return
        state.engine = null
      },
    }
  )
)
