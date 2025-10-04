import React, { useEffect, useMemo, useState } from 'react'
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
import { MidiManager } from './MidiManager'
import { MidiSettings } from './MidiSettings'
import { GitHubCorner } from './GitHubCorner'
import { OnboardingGuide } from './OnboardingGuide'

const GUIDE_STORAGE_KEY = 'websynth-guide-seen'
const HELP_PANEL_IDS = ['oscilloscope', 'oscillator', 'effects', 'lfos', 'arp', 'sequencer', 'drum', 'keyboard'] as const
type PanelHelpId = typeof HELP_PANEL_IDS[number]
type PanelHelpContent = { title: string; body: React.ReactNode }

function isPanelHelpId(id: string): id is PanelHelpId {
  return (HELP_PANEL_IDS as readonly string[]).includes(id)
}

export function App() {
  const engine = useStore((s: State) => s.engine)
  const setEngine = useStore((s: State) => s.setEngine)
  const patch = useStore((s: State) => s.patch)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [guideOpen, setGuideOpen] = useState(false)
  const [helpPanel, setHelpPanel] = useState<PanelHelpId | null>(null)

  useEffect(() => {
    try {
      const seen = localStorage.getItem(GUIDE_STORAGE_KEY)
      if (!seen) {
        setGuideOpen(true)
      }
    } catch {
      // ignore storage access issues (private browsing, etc.)
    }
  }, [])

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
    { id: 'oscilloscope', title: 'Oscilloscope', span: 2, render: () => (
      <div className="oscilloscope-stack">
        <Oscilloscope />
        <div className="oscilloscope-row">
          <FilterPanel />
          <EnvelopePanel />
        </div>
      </div>
    ) },
    { id: 'oscillator', title: 'Oscillator', span: 2, render: () => <OscillatorPanel /> },
    { id: 'effects', title: 'Effects', span: 2, render: () => <EffectsPanel /> },
    { id: 'lfos', title: 'LFOs', span: 2, render: () => <LFOPanel /> },
    { id: 'arp', title: 'Arpeggiator', span: 2, render: () => <ArpPanel /> },
    { id: 'sequencer', title: 'Sequencer', span: 2, render: () => <SequencerPanel /> },
    { id: 'drum', title: 'Drum Machine', span: 2, render: () => <DrumMachinePanel /> },
    { id: 'keyboard', title: 'Keyboard', span: 2, render: () => <Keyboard /> },
  ]

  const layoutOrder = useStore((s: State) => s.layoutOrder)
  const setLayoutOrder = useStore((s: State) => s.setLayoutOrder)

  const panelHelpContent = useMemo<Record<PanelHelpId, PanelHelpContent>>(() => ({
    oscilloscope: {
      title: 'Oscilloscope & Signal Shaping',
      body: (
        <div className="module-help">
          <p>
            This column stacks the live scope with the filter and envelope controls so you can see and hear how each tweak
            reshapes the voice in real time.
          </p>
          <h5>Oscilloscope</h5>
          <ul>
            <li><strong>Live waveform</strong> shows the post-filter signal—watch for clipping, phase inversion, or DC offset.</li>
            <li><strong>Visual feedback</strong> makes it easy to dial envelope curves or modulation depth by eye.</li>
          </ul>
          <h5>Filter</h5>
          <ul>
            <li><strong>Filter Type</strong>: switch between low-pass, high-pass, band-pass, or notch responses.</li>
            <li><strong>Cutoff</strong>: set the corner frequency (40–8 kHz).</li>
            <li><strong>Resonance</strong>: emphasise frequencies around the cutoff for squelchy tones or formants.</li>
            <li><strong>Master</strong>: trim the synth output to prevent overload after heavy resonance or drive.</li>
          </ul>
          <h5>Envelope</h5>
          <ul>
            <li><strong>Attack/Decay</strong>: tune how quickly the note ramps up and falls back.</li>
            <li><strong>Sustain</strong>: set the plateau level while a key is held.</li>
            <li><strong>Release</strong>: control how long the tail rings once the note stops.</li>
          </ul>
          <h5>Workflow Tips</h5>
          <ul>
            <li>Start with moderate sustain and adjust cutoff until the oscilloscope shows a balanced waveform.</li>
            <li>Use short attacks with high resonance for plucky stabs, or longer releases for pads.</li>
          </ul>
        </div>
      ),
    },
    oscillator: {
      title: 'Oscillator Engine',
      body: (
        <div className="module-help">
          <p>The oscillator panel builds the raw tone. Switch between the classic dual-oscillator stack and the macro voice engine.</p>
          <h5>Classic Mode</h5>
          <ul>
            <li><strong>Mode</strong>: choose Classic to expose Osc 1 and Osc 2 controls; Macro flips to the multi-model engine.</li>
            <li><strong>Wave</strong>: pick saw, square, triangle, sine, or noise per oscillator.</li>
            <li><strong>Detune/Fine</strong>: detune Osc 1 in cents for chorus movement; fine tune provides subtle offsets.</li>
            <li><strong>Mix</strong>: blend Osc 1 against Osc 2 to balance the tone.</li>
            <li><strong>FM toggle</strong>: enable frequency modulation, then set <strong>Ratio</strong> for the modulator harmonic and <strong>Amount</strong> for depth.</li>
            <li><strong>Ring toggle</strong>: engage ring modulation and scale its <strong>Amount</strong> for metallic textures.</li>
          </ul>
          <h5>Macro Mode</h5>
          <ul>
            <li><strong>Model</strong>: jump between macro-oscillator flavours (VA, wavefold, pluck, FM 2-Op, etc.).</li>
            <li><strong>Harmonics/Timbre/Morph</strong>: scan each model’s parameter set—great for morphing wavetables or shaping plucks.</li>
            <li><strong>Level</strong>: trim the macro engine output when layering with other voices.</li>
          </ul>
          <h5>Sound Design Tips</h5>
          <ul>
            <li>Stack slight detune plus a touch of ring modulation for wide analog pads.</li>
            <li>Macro models respond well to LFO or expression assignments—map CapsLock X/Y to Morph or Timbre for live movement.</li>
          </ul>
        </div>
      ),
    },
    effects: {
      title: 'Effects Rack',
      body: (
        <div className="module-help">
          <p>Delay and reverb live here so you can finish a patch without leaving the synth view.</p>
          <h5>Delay</h5>
          <ul>
            <li><strong>Enabled</strong>: toggle the bucket-brigade style delay.</li>
            <li><strong>Time</strong>: set delay time in seconds (0–1.5s). Syncs nicely with tempo divisions.</li>
            <li><strong>Feedback</strong>: control repeats; keep under ~0.7 for stable feedback.</li>
            <li><strong>Mix</strong>: blend the wet signal back with the dry synth.</li>
          </ul>
          <h5>Reverb</h5>
          <ul>
            <li><strong>Enabled</strong>: load the convolution reverb stage.</li>
            <li><strong>Size</strong>: pick the impulse “room” length.</li>
            <li><strong>Decay</strong>: shape how long the tail sustains.</li>
            <li><strong>Mix</strong>: balance ambience without washing out the dry signal.</li>
          </ul>
          <h5>Tips</h5>
          <ul>
            <li>Short delay times with low mix create slapback for bass and plucks.</li>
            <li>Cut delay feedback when engaging heavy reverb to avoid muddiness.</li>
          </ul>
        </div>
      ),
    },
    lfos: {
      title: 'LFO Modulators',
      body: (
        <div className="module-help">
          <p>Two low-frequency oscillators inject motion into almost any destination in the patch.</p>
          <h5>LFO Controls</h5>
          <ul>
            <li><strong>Enabled</strong>: arm the modulation path for each LFO.</li>
            <li><strong>Wave</strong>: choose sine, triangle, square, or saw for the modulation shape.</li>
            <li><strong>Dest</strong>: route to pitch, filter, or amp—tie depth to macros or expression for more routings.</li>
            <li><strong>Rate</strong>: set frequency in Hz (0.01–20); syncs with tempo when combined with the transport.</li>
            <li><strong>Amount</strong>: scale modulation depth; automate this with the Sequencer or expression surface for evolving sounds.</li>
          </ul>
          <h5>Tips</h5>
          <ul>
            <li>Use LFO1 for slow filter sweeps and LFO2 for faster vibrato or tremolo.</li>
            <li>Disable the checkbox to park an LFO without losing its configuration.</li>
          </ul>
        </div>
      ),
    },
    arp: {
      title: 'Arpeggiator',
      body: (
        <div className="module-help">
          <p>Turn held chords into rhythmic runs that follow the global transport.</p>
          <h5>Playback</h5>
          <ul>
            <li><strong>Enabled</strong>: start capturing held notes.</li>
            <li><strong>Latch</strong>: keep notes running after you release the keys.</li>
            <li><strong>Clear</strong>: flush the current latched chord without toggling the arp off.</li>
          </ul>
          <h5>Timing</h5>
          <ul>
            <li><strong>Mode</strong>: set traversal (up, down, up/down, random, as played).</li>
            <li><strong>Octaves</strong>: extend the pattern across 1–4 octaves.</li>
            <li><strong>Chord</strong>: fold power chords, triads, or sevenths into each step.</li>
            <li><strong>Division</strong>: choose rhythmic value (1/4–1/16T).</li>
            <li><strong>BPM</strong>: the slider writes to the global tempo so drums and sequencer stay in sync.</li>
            <li><strong>Gate/Swing</strong>: tighten note length and groove feel.</li>
            <li><strong>Repeats/Length</strong>: loop steps multiple times or clamp the pattern length.</li>
          </ul>
          <h5>Tips</h5>
          <ul>
            <li>Combine Latch with the Sequencer for counterpoint—that way the arp handles chords while the sequencer drives lead lines.</li>
            <li>Use the expression surface to modulate filter cutoff while the arp runs for dynamic sweeps.</li>
          </ul>
        </div>
      ),
    },
    sequencer: {
      title: 'Step Sequencer',
      body: (
        <div className="module-help">
          <p>Program note offsets and modulation lanes across up to 16 steps—perfect for basslines or evolving textures.</p>
          <h5>Transport & Timing</h5>
          <ul>
            <li><strong>Play</strong>: toggles the shared transport; the button mirrors the space-bar shortcut.</li>
            <li><strong>Enabled</strong>: arm the sequencer without nuking your pattern.</li>
            <li><strong>Tempo</strong>: linked to the global BPM so drums and arp line up.</li>
            <li><strong>Division</strong>: set step rate (quarter to triplet sixteenths).</li>
            <li><strong>Length</strong>: choose how many steps play before looping.</li>
          </ul>
          <h5>Shape the Pattern</h5>
          <ul>
            <li><strong>Gate</strong>: change note length; great for staccato acid lines.</li>
            <li><strong>Swing</strong>: add shuffle (disabled for triplets and quarter notes).</li>
            <li><strong>Root</strong>: slide the entire sequence up or down in pitch.</li>
            <li><strong>Edit Notes (Keyboard)</strong>: enable to type notes with A/W/S…; +/- nudges semitones, Z/X shifts the root octave.</li>
            <li><strong>Step grid</strong>: click to toggle notes, <strong>Alt+click</strong> raises semitone offset, right-click lowers it.</li>
          </ul>
          <h5>Visual Feedback</h5>
          <ul>
            <li>The highlighted cell shows the playhead; cursor outlines follow keyboard edit focus.</li>
            <li>Offsets in the cells (+/- values) represent semitone shifts relative to Root.</li>
          </ul>
        </div>
      ),
    },
    drum: {
      title: 'Drum Machine',
      body: (
        <div className="module-help">
          <p>Create percussive backbeats that share tempo and transport with the synth voice.</p>
          <h5>Transport</h5>
          <ul>
            <li><strong>Play/Stop</strong>: drives the global clock, so sequencer and arp follow the same BPM.</li>
            <li><strong>Tempo</strong>: change BPM with the slider—applies everywhere.</li>
          </ul>
          <h5>Programming</h5>
          <ul>
            <li><strong>Step buttons</strong>: click to toggle hits for kick, snare, and hat; glowing steps are active.</li>
            <li><strong>Current step highlight</strong>: a brighter cell shows the beat currently firing.</li>
            <li>Each instrument has its own SynthEngine voice with curated patches for punchy drums.</li>
          </ul>
          <h5>Tips</h5>
          <ul>
            <li>Start with the default 4-on-the-floor kick and build snare/hat syncopation around it.</li>
            <li>Layer sequencer basslines with hats on offbeats for instant groove.</li>
          </ul>
        </div>
      ),
    },
    keyboard: {
      title: 'Keyboard & Performance',
      body: (
        <div className="module-help">
          <p>Play and monitor incoming notes from both the computer keyboard and external MIDI controllers.</p>
          <h5>Computer Keys</h5>
          <ul>
            <li><strong>Mapping</strong>: A/W/S/D/F/G… map to white and black keys; apostrophe reaches two octaves up.</li>
            <li><strong>Z / X</strong>: shift the octave indicator down or up in 12-semitone jumps.</li>
            <li>Held keys appear highlighted so you always know what is sustaining.</li>
          </ul>
          <h5>Pointer & Touch</h5>
          <ul>
            <li>Click or drag for glissando; multi-touch (trackpad/tablet) keeps parallel notes held.</li>
            <li>Black keys float above the whites for accurate gliss transitions.</li>
          </ul>
          <h5>MIDI Integration</h5>
          <ul>
            <li>Notes triggered from external hardware light up alongside local keys—great for debugging MIDI routing.</li>
            <li>The octave badge shows the base MIDI note and offset so you can align hardware controllers quickly.</li>
          </ul>
        </div>
      ),
    },
  }), [])

  const activeHelp = helpPanel ? panelHelpContent[helpPanel] : null

  return (
    <div className="app">
      <GitHubCorner />
      <MidiManager />
      <header className="header">
        <h2>WebSynth Studio</h2>
        <div className="row">
          <button onClick={initNow}>{engine ? 'Audio Ready' : 'Power On'}</button>
          <button
            onClick={() => {
              setGuideOpen(true)
            }}
          >
            Help
          </button>
          <button onClick={() => setSettingsOpen(true)}>Settings</button>
        </div>
      </header>
      <main>
        <DashboardGrid
          panels={panels}
          order={layoutOrder}
          onOrderChange={setLayoutOrder}
          onRequestHelp={(id) => {
            if (isPanelHelpId(id)) {
              setHelpPanel(id)
            }
          }}
        />
      </main>
      <ExpressionSurface />
      <SettingsModal
        open={helpPanel != null}
        onClose={() => setHelpPanel(null)}
        title={activeHelp?.title ?? 'Module Help'}
        closeLabel="Close module help"
      >
        {activeHelp?.body ?? <p>Help content coming soon.</p>}
      </SettingsModal>
      <SettingsModal
        open={guideOpen}
        onClose={() => {
          try {
            localStorage.setItem(GUIDE_STORAGE_KEY, '1')
          } catch {
            // ignore storage access issues
          }
          setGuideOpen(false)
        }}
        title="Onboarding Guide"
        closeLabel="Close help overlay"
      >
        <OnboardingGuide />
      </SettingsModal>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <section className="settings-section">
          <h4 className="settings-heading">Patches</h4>
          <PatchPanel />
        </section>
        <section className="settings-section">
          <h4 className="settings-heading">Expression</h4>
          <ExpressionPanel />
        </section>
        <section className="settings-section">
          <h4 className="settings-heading">MIDI</h4>
          <MidiSettings />
        </section>
      </SettingsModal>
      <TransportTicker />
    </div>
  )
}
