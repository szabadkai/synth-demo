import React, { useEffect } from 'react'
import { SynthEngine } from '../audio-engine/engine'
import { useStore, type State } from '../state/store'
import { OscillatorPanel } from './OscillatorPanel'
import { FilterPanel } from './FilterPanel'
import { EnvelopePanel } from './EnvelopePanel'
import { MasterPanel } from './MasterPanel'
import { Keyboard } from './Keyboard'
import { PatchPanel } from './PatchPanel'
import { Oscilloscope } from './Oscilloscope'
import { EffectsPanel } from './EffectsPanel'
import { LFOPanel } from './LFOPanel'
import { ArpPanel } from './ArpPanel'
import { SequencerPanel } from './SequencerPanel'
import { ExpressionSurface } from './ExpressionSurface'
import { ExpressionPanel } from './ExpressionPanel'

export function App() {
  const engine = useStore((s: State) => s.engine)
  const setEngine = useStore((s: State) => s.setEngine)
  const patch = useStore((s: State) => s.patch)

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

  return (
    <div className="app">
      <header className="header">
        <h2>WebSynth Studio</h2>
        <div className="row">
          <button onClick={initNow}>{engine ? 'Audio Ready' : 'Power On'}</button>
        </div>
      </header>
      <main>
        <div className="grid">
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>Oscilloscope</h3>
            <Oscilloscope />
          </section>
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>Oscillator</h3>
            <OscillatorPanel />
          </section>
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>Master</h3>
            <MasterPanel />
          </section>
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>Patches</h3>
            <PatchPanel />
          </section>
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>Effects</h3>
            <EffectsPanel />
          </section>
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>LFOs</h3>
            <LFOPanel />
          </section>
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>Arpeggiator</h3>
            <ArpPanel />
          </section>
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>Sequencer</h3>
            <SequencerPanel />
          </section>
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>Expression</h3>
            <ExpressionPanel />
          </section>
          <section className="panel">
            <h3>Filter</h3>
            <FilterPanel />
          </section>
          <section className="panel">
            <h3>Envelope</h3>
            <EnvelopePanel />
          </section>
          <section className="panel" style={{ gridColumn: 'span 2' }}>
            <h3>Keyboard</h3>
            <Keyboard />
          </section>
        </div>
      </main>
      <ExpressionSurface />
    </div>
  )
}
