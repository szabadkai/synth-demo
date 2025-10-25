import React from 'react'

interface OnboardingGuideProps {
  onFinish?: () => void
}

const guideSections: Array<{
  title: string
  points: string[]
}> = [
  {
    title: 'Power On + Audio Check',
    points: [
      'Click Power On (or press any key) to resume the audio engine – browsers block sound until you interact.',
      'Hold a note on the on-screen keyboard or your computer keys (A/W/S…) to confirm audio output.',
      'Watch the Audio Ready badge so you know the synth engine is live and responsive.',
    ],
  },
  {
    title: 'Dashboard Basics',
    points: [
      'Each panel can be dragged by the ⋮⋮ handle to personalise your layout.',
      'Use the Oscilloscope panel to visualise how the engines, filter, and envelope tweaks shape the signal.',
      'Dive into the Engine panel (ENG1/ENG2), plus Filter, Envelope, and Effects modules to sculpt tone, dynamics, and ambience.',
    ],
  },
  {
    title: 'Modulation Playground',
    points: [
      'Assign LFOs to pitch, filter, or effect targets for evolving textures – adjust rate, shape, sync, and depth.',
      'Flip on the Arpeggiator to latch held notes, experiment with 6 modes (Up, Down, Up-Down, Random, As Played, Sequence).',
      'Try "Sequence" mode to play through your Sequencer pattern with rests – OFF steps create rhythmic pauses.',
      'Program riffs in the Sequencer, toggle steps live, and shape groove with progression modes and spice amount.',
    ],
  },
  {
    title: 'Rhythm Layer',
    points: [
      'Open the Drum Machine to sequence kick, snare, and hat voices using the shared global transport.',
      'Hit Play/Stop in the Drum Machine (or space bar in the Sequencer) to drive every tempo-aware module.',
      'Adjust BPM from either panel – the Transport keeps LFO sync, sequencer rate, and arps locked in.',
    ],
  },
  {
    title: 'Expressive Performance',
    points: [
      'Engage CapsLock to activate the 2D expression surface; glide a trackpad, mouse, or pen for live modulation.',
      'Check the overlay label to see which parameters the X/Y axes control and their real-time values.',
      'Customise X/Y destinations under Settings → Expression to map filter sweeps, macro blends, and more.',
    ],
  },
  {
    title: 'Patch Workflow',
    points: [
      'Browse the top-bar Preset menu or Settings → Patches to explore curated starting points.',
      'Export your patch as JSON to share, import saved patches, or reset to the init patch at any time.',
      'Use Clear Local if you ever need to wipe cached patches after upgrading the app.',
    ],
  },
  {
    title: 'Hardware MIDI',
    points: [
      'Toggle Enable MIDI input in Settings → MIDI to request browser permission for your controller.',
      'Select a detected device and play – incoming notes route straight into the synth voice engine.',
      'Status hints show permission prompts, errors, or a friendly ready state so you know what to expect.',
    ],
  },
  {
    title: 'Arpeggiator Deep Dive',
    points: [
      '"Up/Down/Up-Down" modes arpeggiate sorted by pitch; "Random" shuffles on each cycle.',
      '"As Played" preserves the order you pressed keys – great for creating specific melodic patterns.',
      '"Sequence" mode plays through your Sequencer pattern: ON steps trigger notes, OFF steps are rests.',
      'Use "Chord" knob to add intervals (Single, Power, Major, Minor, etc.) or "Seq" to use sequencer offsets as chords.',
    ],
  },
  {
    title: 'Next Steps',
    points: [
      'Layer Sequencer, Arpeggiator, Drum Machine, and expression surface for full arrangements.',
      'Save favourite patches into src/patches/ to share with your team or future sessions.',
      'Before shipping changes, run npm run lint, npm run typecheck, npm test, and npm run build to keep QA tight.',
    ],
  },
]

export function OnboardingGuide({ onFinish }: OnboardingGuideProps) {
  return (
    <div className="onboarding-guide">
      <p className="onboarding-intro">
        New to WebSynth Studio? Work through the highlights below, tweaking the live app as you go. Each section points
        you to the panels and controls that define the instrument.
      </p>
      <ol className="onboarding-list">
        {guideSections.map((section) => (
          <li key={section.title} className="onboarding-section">
            <h4>{section.title}</h4>
            <ul>
              {section.points.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <button
        type="button"
        className="onboarding-cta"
        onClick={() => {
          onFinish?.()
        }}
      >
        Let&apos;s go
      </button>
    </div>
  )
}
