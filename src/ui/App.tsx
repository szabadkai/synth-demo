import React, { useEffect, useState } from 'react'
import { SynthEngine } from '../audio-engine/engine'
import { useStore, type State } from '../state/store'
import { OscillatorPanel } from './OscillatorPanel'
import { FilterPanel } from './FilterPanel'
import { EnvelopePanel } from './EnvelopePanel'
import { Keyboard } from './Keyboard'
import { Oscilloscope } from './Oscilloscope'
import { EffectsPanel } from './EffectsPanel'
import { LFOPanel } from './LFOPanel'
import { ArpPanel } from './ArpPanel'
import { SequencerPanel } from './SequencerPanel'
import { ExpressionSurface } from './ExpressionSurface'
import { DashboardGrid, type DashboardPanelConfig } from './DashboardGrid'
import { PatchPanel } from './PatchPanel'
import { ExpressionPanel } from './ExpressionPanel'
import { SettingsModal } from './SettingsModal'
import { DrumMachinePanel } from './DrumMachinePanel'
import { TransportTicker } from './TransportTicker'

export function App() {
  const engine = useStore((s: State) => s.engine)
  const setEngine = useStore((s: State) => s.setEngine)
  const patch = useStore((s: State) => s.patch)
  const [settingsOpen, setSettingsOpen] = useState(false)

  useEffect(() => {
    // Lazy-init engine after first interaction for autoplay policies
    const onFirstInteraction = async () => {
      if (!useStore.getState().engine) {
        const e = new SynthEngine()
        await e.resume()
        e.applyPatch(patch)
        setEngine(e)
      }
      window.removeEventListener('pointerdown', onFirstInteraction)
      window.removeEventListener('keydown', onFirstInteraction)
    }
    window.addEventListener('pointerdown', onFirstInteraction)
    window.addEventListener('keydown', onFirstInteraction)
    return () => {
      window.removeEventListener('pointerdown', onFirstInteraction)
      window.removeEventListener('keydown', onFirstInteraction)
    }
  }, [patch, setEngine])

  const initNow = async () => {
    if (!engine) {
      const e = new SynthEngine()
      await e.resume()
      e.applyPatch(patch)
      setEngine(e)
    }
  }

  const panels: DashboardPanelConfig[] = [
    { id: 'oscilloscope', title: 'Oscilloscope', span: 2, render: () => <Oscilloscope /> },
    { id: 'oscillator', title: 'Oscillator', span: 2, render: () => <OscillatorPanel /> },
    { id: 'effects', title: 'Effects', span: 2, render: () => <EffectsPanel /> },
    { id: 'lfos', title: 'LFOs', span: 2, render: () => <LFOPanel /> },
    { id: 'arp', title: 'Arpeggiator', span: 2, render: () => <ArpPanel /> },
    { id: 'sequencer', title: 'Sequencer', span: 2, render: () => <SequencerPanel /> },
    { id: 'drum', title: 'Drum Machine', span: 2, render: () => <DrumMachinePanel /> },
    { id: 'filter', title: 'Filter', render: () => <FilterPanel /> },
    { id: 'envelope', title: 'Envelope', render: () => <EnvelopePanel /> },
    { id: 'keyboard', title: 'Keyboard', span: 2, render: () => <Keyboard /> },
  ]

  const layoutOrder = useStore((s: State) => s.layoutOrder)
  const setLayoutOrder = useStore((s: State) => s.setLayoutOrder)

  return (
    <div className="app">
      <header className="header">
        <h2>WebSynth Studio</h2>
        <div className="row">
          <button onClick={initNow}>{engine ? 'Audio Ready' : 'Power On'}</button>
          <button onClick={() => setSettingsOpen(true)}>Settings</button>
        </div>
      </header>
      <main>
        <DashboardGrid panels={panels} order={layoutOrder} onOrderChange={setLayoutOrder} />
      </main>
      <ExpressionSurface />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <section className="settings-section">
          <h4 className="settings-heading">Patches</h4>
          <PatchPanel />
        </section>
        <section className="settings-section">
          <h4 className="settings-heading">Expression</h4>
          <ExpressionPanel />
        </section>
      </SettingsModal>
      <TransportTicker />
    </div>
  )
}
