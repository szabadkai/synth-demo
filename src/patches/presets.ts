import { type Patch, defaultPatch } from '../audio-engine/engine'

export type PresetDefinition = {
  id: string
  name: string
  description: string
  tags?: string[]
  image?: string
  patch: Patch
}

export type PresetGroup = {
  id: string
  name: string
  description: string
  presets: PresetDefinition[]
}

const clonePatch = (): Patch => JSON.parse(JSON.stringify(defaultPatch))

const ensureEffects = (patch: Patch): NonNullable<Patch['effects']> => {
  if (!patch.effects) {
    patch.effects = JSON.parse(JSON.stringify(defaultPatch.effects!))
  }
  return patch.effects!
}

const ensureTrailingSlash = (value: string): string => (value.endsWith('/') ? value : `${value}/`)
const ASSET_BASE_URL = ensureTrailingSlash(import.meta.env.BASE_URL ?? '/')

const makePreset = (
  id: string,
  name: string,
  description: string,
  mutate: (patch: Patch) => void,
  options: { tags?: string[]; image?: string } = {},
): PresetDefinition => {
  const patch = clonePatch()
  mutate(patch)
  const tags = options.tags ?? []
  const image = options.image ?? `${ASSET_BASE_URL}presets/${id}.png`
  return { id, name, description, tags, image, patch }
}

const essentials: PresetGroup = {
  id: 'essentials',
  name: 'Essentials',
  description: 'Foundation tones that show the core oscillators, filter, and envelopes.',
  presets: [
    makePreset('init', 'Init Saw', 'Clean slate patch: saw + square with neutral envelope.', () => {}, { tags: ['init'] }),
    makePreset(
      'warm-pad',
      'Warm Pad',
      'Gently detuned analog pad with slow attack and soft filter motion.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'triangle'
        patch.osc1.detune = -4
        patch.osc1.detuneFine = -2
        patch.osc1.octave = 0
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'sawtooth'
        patch.osc2.detune = 5
        patch.osc2.detuneFine = 1
        patch.osc2.octave = 0
        patch.mix = 0.42
        patch.sub.enabled = true
        patch.sub.wave = 'sine'
        patch.sub.octave = 1
        patch.sub.level = 0.35
        patch.fm.enabled = false
        patch.ring.enabled = false
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 880
        patch.filter.q = 0.85
        patch.envelope.attack = 0.6
        patch.envelope.decay = 0.85
        patch.envelope.sustain = 0.78
        patch.envelope.release = 1.9
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'sine',
          dest: 'filter',
          rateHz: 0.18,
          amount: 0.38,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: false,
          wave: 'sine',
          dest: 'pitch',
          rateHz: 0.4,
          amount: 0.1,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: false, time: 0.32, feedback: 0.28, mix: 0.18 }
        effects.reverb = { enabled: true, size: 0.72, decay: 0.85, mix: 0.33 }
        patch.master.gain = 0.22
      }, { tags: ['pad', 'analog'] },
    ),
    makePreset(
      'bright-pluck',
      'Bright Pluck',
      'Snappy analog pluck with a touch of FM and tempo-friendly delay.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'square'
        patch.osc1.detune = 2
        patch.osc1.detuneFine = 0
        patch.osc1.octave = 0
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'sawtooth'
        patch.osc2.detune = -6
        patch.osc2.detuneFine = 0
        patch.osc2.octave = 0
        patch.mix = 0.5
        patch.fm.enabled = true
        patch.fm.ratio = 1.25
        patch.fm.amount = 90
        patch.sub.enabled = false
        patch.ring.enabled = false
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 1500
        patch.filter.q = 0.95
        patch.envelope.attack = 0.008
        patch.envelope.decay = 0.18
        patch.envelope.sustain = 0.12
        patch.envelope.release = 0.22
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: false,
          wave: 'triangle',
          dest: 'pitch',
          rateHz: 5.5,
          amount: 0.06,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: false,
          wave: 'sine',
          dest: 'amp',
          rateHz: 0.6,
          amount: 0.0,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.26, feedback: 0.32, mix: 0.24 }
        effects.reverb = { enabled: false, size: 0.4, decay: 0.4, mix: 0.18 }
        patch.master.gain = 0.23
      }, { tags: ['lead', 'pluck'] },
    ),
  ],
}

const basslines: PresetGroup = {
  id: 'basslines',
  name: 'Basslines',
  description: 'Low-end starters that demonstrate sub layering, resonance, and FM growl.',
  presets: [
    makePreset(
      'sub-driver',
      'Sub Driver',
      'Focused sub bass with a sine layer and tight envelope.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'sawtooth'
        patch.osc1.octave = -1
        patch.osc1.detune = -2
        patch.osc1.detuneFine = 0
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'square'
        patch.osc2.octave = -1
        patch.osc2.detune = 3
        patch.osc2.detuneFine = 0
        patch.mix = 0.25
        patch.sub.enabled = true
        patch.sub.wave = 'sine'
        patch.sub.octave = 1
        patch.sub.level = 0.7
        patch.fm.enabled = false
        patch.ring.enabled = false
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 220
        patch.filter.q = 1.2
        patch.envelope.attack = 0.01
        patch.envelope.decay = 0.2
        patch.envelope.sustain = 0.75
        patch.envelope.release = 0.32
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'sine',
          dest: 'pitch',
          rateHz: 0.28,
          amount: 0.05,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: false,
          wave: 'sine',
          dest: 'filter',
          rateHz: 0.6,
          amount: 0.0,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: false, time: 0.2, feedback: 0.2, mix: 0.1 }
        effects.reverb = { enabled: false, size: 0.3, decay: 0.2, mix: 0.1 }
        patch.master.gain = 0.28
      }, { tags: ['bass'] },
    ),
    makePreset(
      'acid-line',
      'Acid Line',
      'Classic resonant saw bass ready for sequences and filter tweaks.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'sawtooth'
        patch.osc1.octave = -1
        patch.osc1.detune = 0
        patch.osc1.detuneFine = 0
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'sawtooth'
        patch.osc2.octave = 0
        patch.osc2.detune = 7
        patch.osc2.detuneFine = 0
        patch.mix = 0.55
        patch.sub.enabled = false
        patch.fm.enabled = false
        patch.ring.enabled = false
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 520
        patch.filter.q = 8.5
        patch.envelope.attack = 0.01
        patch.envelope.decay = 0.25
        patch.envelope.sustain = 0.3
        patch.envelope.release = 0.18
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'triangle',
          dest: 'filter',
          rateHz: 6.0,
          amount: 0.14,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: false,
          wave: 'sine',
          dest: 'pitch',
          rateHz: 3.5,
          amount: 0.04,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.18, feedback: 0.22, mix: 0.18 }
        effects.reverb = { enabled: false, size: 0.35, decay: 0.25, mix: 0.12 }
        patch.master.gain = 0.25
      }, { tags: ['bass', 'resonant'] },
    ),
    makePreset(
      'fm-growl',
      'FM Growl',
      'Two-operator FM for gritty bass leads with animated mids.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'sawtooth'
        patch.osc1.octave = 0
        patch.osc1.detune = 0
        patch.osc1.detuneFine = 0
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'square'
        patch.osc2.octave = 0
        patch.osc2.detune = 0
        patch.osc2.detuneFine = 0
        patch.mix = 0.4
        patch.fm.enabled = true
        patch.fm.ratio = 2
        patch.fm.amount = 180
        patch.sub.enabled = false
        patch.ring.enabled = false
        patch.filter.type = 'bandpass'
        patch.filter.cutoff = 540
        patch.filter.q = 2.8
        patch.envelope.attack = 0.012
        patch.envelope.decay = 0.22
        patch.envelope.sustain = 0.4
        patch.envelope.release = 0.3
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'triangle',
          dest: 'filter',
          rateHz: 1.2,
          amount: 0.25,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: false,
          wave: 'sine',
          dest: 'pitch',
          rateHz: 3,
          amount: 0.05,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: false, time: 0.2, feedback: 0.2, mix: 0.1 }
        effects.reverb = { enabled: false, size: 0.4, decay: 0.25, mix: 0.12 }
        patch.master.gain = 0.24
      }, { tags: ['bass', 'fm'] },
    ),
  ],
}

const macroVoices: PresetGroup = {
  id: 'macro',
  name: 'Macro Voices',
  description: 'Presets that lean on the macro engine for hybrid keys, pads, and textures.',
  presets: [
    makePreset(
      'glass-keys',
      'Glass Keys',
      'Macro pluck blended with a triangle support for bell-like keys.',
      (patch) => {
        patch.engineMode = 'macro'
        patch.osc1.mode = 'macro'
        patch.osc1.macro = {
          ...(patch.osc1.macro ?? defaultPatch.osc1.macro!),
          model: 'pluck',
          harmonics: 0.45,
          timbre: 0.6,
          morph: 0.35,
          level: 0.9,
        }
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'triangle'
        patch.osc2.detune = -2
        patch.osc2.detuneFine = 0
        patch.osc2.octave = 0
        patch.mix = 0.35
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 1800
        patch.filter.q = 0.7
        patch.envelope.attack = 0.02
        patch.envelope.decay = 0.25
        patch.envelope.sustain = 0.6
        patch.envelope.release = 0.55
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'sine',
          dest: 'pitch',
          rateHz: 5,
          amount: 0.04,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: false,
          wave: 'sine',
          dest: 'amp',
          rateHz: 0.4,
          amount: 0.0,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.3, feedback: 0.25, mix: 0.22 }
        effects.reverb = { enabled: true, size: 0.55, decay: 0.6, mix: 0.28 }
        patch.master.gain = 0.21
      }, { tags: ['macro', 'keys'] },
    ),
    makePreset(
      'supersaw-pad',
      'Supersaw Pad',
      'Wide, macro-driven supersaw with evolving filter movement.',
      (patch) => {
        patch.engineMode = 'macro'
        patch.osc1.mode = 'macro'
        patch.osc1.macro = {
          ...(patch.osc1.macro ?? defaultPatch.osc1.macro!),
          model: 'supersaw',
          harmonics: 0.68,
          timbre: 0.5,
          morph: 0.52,
          level: 1,
        }
        patch.osc2.mode = 'macro'
        patch.osc2.macro = {
          ...(patch.osc2.macro ?? defaultPatch.osc2.macro!),
          model: 'va',
          harmonics: 0.4,
          timbre: 0.5,
          morph: 0.5,
          level: 0.5,
        }
        patch.mix = 0.5
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 720
        patch.filter.q = 0.8
        patch.envelope.attack = 0.5
        patch.envelope.decay = 0.9
        patch.envelope.sustain = 0.82
        patch.envelope.release = 2.4
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'sine',
          dest: 'filter',
          rateHz: 0.12,
          amount: 0.5,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: false,
          wave: 'sine',
          dest: 'pitch',
          rateHz: 0.4,
          amount: 0.0,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.36, feedback: 0.32, mix: 0.22 }
        effects.reverb = { enabled: true, size: 0.82, decay: 1.2, mix: 0.4 }
        patch.master.gain = 0.2
      }, { tags: ['macro', 'pad'] },
    ),
    makePreset(
      'harmonic-motion',
      'Harmonic Motion',
      'Evolving harmonic macro texture with slow motion and shimmer.',
      (patch) => {
        patch.engineMode = 'macro'
        patch.osc1.mode = 'macro'
        patch.osc1.macro = {
          ...(patch.osc1.macro ?? defaultPatch.osc1.macro!),
          model: 'harmonic',
          harmonics: 0.55,
          timbre: 0.68,
          morph: 0.45,
          level: 1,
        }
        patch.osc2.mode = 'macro'
        patch.osc2.macro = {
          ...(patch.osc2.macro ?? defaultPatch.osc2.macro!),
          model: 'fm2op',
          harmonics: 0.4,
          timbre: 0.6,
          morph: 0.35,
          level: 0.6,
        }
        patch.mix = 0.6
        patch.filter.type = 'bandpass'
        patch.filter.cutoff = 680
        patch.filter.q = 1.6
        patch.envelope.attack = 1.2
        patch.envelope.decay = 1.1
        patch.envelope.sustain = 0.65
        patch.envelope.release = 3.2
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'sine',
          dest: 'filter',
          rateHz: 0.1,
          amount: 0.55,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: true,
          wave: 'noise',
          dest: 'pitch',
          rateHz: 1.2,
          amount: 0.08,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.5, feedback: 0.4, mix: 0.28 }
        effects.reverb = { enabled: true, size: 0.9, decay: 1.5, mix: 0.45 }
        patch.master.gain = 0.18
      }, { tags: ['macro', 'texture'] },
    ),
  ],
}

const motionFx: PresetGroup = {
  id: 'motion',
  name: 'Motion & FX',
  description: 'Rhythmic and ambient presets highlighting LFO routing, noise modulation, and space.',
  presets: [
    makePreset(
      'noisy-motion',
      'Noisy Motion',
      'Analog layers with the new noise LFO pushing the filter for organic movement.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'sawtooth'
        patch.osc1.detune = -7
        patch.osc1.detuneFine = -2
        patch.osc1.octave = 0
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'triangle'
        patch.osc2.detune = 6
        patch.osc2.detuneFine = 2
        patch.osc2.octave = 0
        patch.mix = 0.48
        patch.filter.type = 'bandpass'
        patch.filter.cutoff = 950
        patch.filter.q = 1.4
        patch.envelope.attack = 0.12
        patch.envelope.decay = 0.6
        patch.envelope.sustain = 0.55
        patch.envelope.release = 0.8
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'noise',
          dest: 'filter',
          rateHz: 3.2,
          amount: 0.24,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: true,
          wave: 'sine',
          dest: 'amp',
          rateHz: 0.55,
          amount: 0.35,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.4, feedback: 0.42, mix: 0.26 }
        effects.reverb = { enabled: true, size: 0.75, decay: 1.1, mix: 0.36 }
        patch.master.gain = 0.21
      }, { tags: ['motion', 'noise'] },
    ),
    makePreset(
      'pulsar-gate',
      'Pulsar Gate',
      'Square-wave LFO chops the amp while a slow triangle sweeps the filter.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'sawtooth'
        patch.osc1.detune = -3
        patch.osc1.detuneFine = 0
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'square'
        patch.osc2.detune = 3
        patch.osc2.detuneFine = 0
        patch.mix = 0.5
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 1400
        patch.filter.q = 0.9
        patch.envelope.attack = 0.03
        patch.envelope.decay = 0.4
        patch.envelope.sustain = 0.6
        patch.envelope.release = 0.6
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'square',
          dest: 'amp',
          rateHz: 6,
          amount: 0.7,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: true,
          wave: 'triangle',
          dest: 'filter',
          rateHz: 0.25,
          amount: 0.4,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.33, feedback: 0.35, mix: 0.24 }
        effects.reverb = { enabled: true, size: 0.6, decay: 0.7, mix: 0.28 }
        patch.master.gain = 0.22
        patch.arp = {
          ...(patch.arp ?? defaultPatch.arp!),
          enabled: true,
          gate: 0.45,
          bpmSync: true,
          bpm: 120,
          division: '1/8',
          mode: 'updown',
          octaves: 1,
          latch: false,
        }
      }, { tags: ['motion', 'arp'] },
    ),
    makePreset(
      'space-drone',
      'Space Drone',
      'Long-release drone with ring modulation and cavernous ambience.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'triangle'
        patch.osc1.detune = -6
        patch.osc1.detuneFine = -3
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'sine'
        patch.osc2.detune = 6
        patch.osc2.detuneFine = 3
        patch.mix = 0.5
        patch.sub.enabled = true
        patch.sub.wave = 'sine'
        patch.sub.octave = 2
        patch.sub.level = 0.4
        patch.ring.enabled = true
        patch.ring.amount = 0.6
        patch.filter.type = 'bandpass'
        patch.filter.cutoff = 420
        patch.filter.q = 2.2
        patch.envelope.attack = 1.5
        patch.envelope.decay = 1.2
        patch.envelope.sustain = 0.65
        patch.envelope.release = 4.5
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'sine',
          dest: 'filter',
          rateHz: 0.08,
          amount: 0.45,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: true,
          wave: 'noise',
          dest: 'pitch',
          rateHz: 1.5,
          amount: 0.08,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.6, feedback: 0.48, mix: 0.3 }
        effects.reverb = { enabled: true, size: 0.95, decay: 2.4, mix: 0.55 }
        patch.master.gain = 0.18
      }, { tags: ['drone', 'fx'] },
    ),
  ],
}

const keysAndLeads: PresetGroup = {
  id: 'keys-leads',
  name: 'Keys & Leads',
  description: 'Playable patches that highlight melodic work—keys, brass, and expressive leads.',
  presets: [
    makePreset(
      'dream-keys',
      'Dream Keys',
      'Soft keys with gentle vibrato and a shimmering tail.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'triangle'
        patch.osc1.detune = -3
        patch.osc1.detuneFine = -1
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'sine'
        patch.osc2.detune = 4
        patch.osc2.detuneFine = 1
        patch.mix = 0.46
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 1450
        patch.filter.q = 0.75
        patch.envelope.attack = 0.05
        patch.envelope.decay = 0.4
        patch.envelope.sustain = 0.65
        patch.envelope.release = 0.9
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'sine',
          dest: 'pitch',
          rateHz: 5.8,
          amount: 0.08,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: false,
          wave: 'sine',
          dest: 'amp',
          rateHz: 0.5,
          amount: 0.0,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.28, feedback: 0.22, mix: 0.2 }
        effects.reverb = { enabled: true, size: 0.6, decay: 0.85, mix: 0.3 }
        patch.master.gain = 0.23
      }, { tags: ['keys', 'vibrato'] },
    ),
    makePreset(
      'poly-brass',
      'Poly Brass',
      'Brassy synth stack with macro morphing and expressive filter.',
      (patch) => {
        patch.engineMode = 'macro'
        patch.osc1.mode = 'macro'
        patch.osc1.macro = {
          ...(patch.osc1.macro ?? defaultPatch.osc1.macro!),
          model: 'va',
          harmonics: 0.72,
          timbre: 0.48,
          morph: 0.62,
          level: 1,
        }
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'sawtooth'
        patch.osc2.detune = -8
        patch.osc2.detuneFine = -1
        patch.mix = 0.58
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 980
        patch.filter.q = 1.05
        patch.envelope.attack = 0.03
        patch.envelope.decay = 0.36
        patch.envelope.sustain = 0.58
        patch.envelope.release = 0.44
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'triangle',
          dest: 'filter',
          rateHz: 0.45,
          amount: 0.32,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: false, time: 0.3, feedback: 0.2, mix: 0.1 }
        effects.reverb = { enabled: true, size: 0.5, decay: 0.65, mix: 0.24 }
        patch.master.gain = 0.24
      }, { tags: ['macro', 'brass'] },
    ),
    makePreset(
      'shimmer-lead',
      'Shimmer Lead',
      'Cutting lead with harmonics shimmer and subtle glide.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'sawtooth'
        patch.osc1.detune = 7
        patch.osc1.detuneFine = 1
        patch.osc2.mode = 'macro'
        patch.osc2.macro = {
          ...(patch.osc2.macro ?? defaultPatch.osc2.macro!),
          model: 'harmonic',
          harmonics: 0.58,
          timbre: 0.62,
          morph: 0.4,
          level: 0.7,
        }
        patch.mix = 0.48
        patch.filter.type = 'bandpass'
        patch.filter.cutoff = 2100
        patch.filter.q = 1.1
        patch.envelope.attack = 0.01
        patch.envelope.decay = 0.22
        patch.envelope.sustain = 0.45
        patch.envelope.release = 0.28
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'sine',
          dest: 'pitch',
          rateHz: 6.5,
          amount: 0.12,
        }
        patch.lfo2 = {
          ...(patch.lfo2 ?? defaultPatch.lfo2!),
          enabled: true,
          wave: 'noise',
          dest: 'filter',
          rateHz: 2.8,
          amount: 0.18,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: true, time: 0.24, feedback: 0.27, mix: 0.2 }
        effects.reverb = { enabled: true, size: 0.48, decay: 0.6, mix: 0.22 }
        patch.master.gain = 0.23
      }, { tags: ['lead'] },
    ),
  ],
}

const percussionFx: PresetGroup = {
  id: 'percussion-fx',
  name: 'Percussion & FX',
  description: 'Hits, plucks, and sound design starters for rhythm tracks and atmospheres.',
  presets: [
    makePreset(
      'fm-bell',
      'FM Bell',
      'Metallic bell with quick shimmer and lingering tail.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'sine'
        patch.osc1.octave = 1
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'sine'
        patch.osc2.octave = 1
        patch.fm.enabled = true
        patch.fm.ratio = 3
        patch.fm.amount = 210
        patch.mix = 0.5
        patch.filter.type = 'lowpass'
        patch.filter.cutoff = 1700
        patch.filter.q = 1.4
        patch.envelope.attack = 0.002
        patch.envelope.decay = 0.42
        patch.envelope.sustain = 0.0
        patch.envelope.release = 1.2
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: false,
          wave: 'sine',
          dest: 'pitch',
          rateHz: 6,
          amount: 0.0,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: false, time: 0.22, feedback: 0.25, mix: 0.18 }
        effects.reverb = { enabled: true, size: 0.7, decay: 1.4, mix: 0.4 }
        patch.master.gain = 0.2
      }, { tags: ['percussion', 'fm'] },
    ),
    makePreset(
      'noise-hit',
      'Noise Hit',
      'Short noise burst shaped with looping sampler trim—ideal for snares or whooshes.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'noise'
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'sine'
        patch.osc2.detune = -12
        patch.osc2.octave = -1
        patch.mix = 0.32
        patch.filter.type = 'bandpass'
        patch.filter.cutoff = 1800
        patch.filter.q = 5
        patch.envelope.attack = 0.001
        patch.envelope.decay = 0.28
        patch.envelope.sustain = 0
        patch.envelope.release = 0.18
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: true,
          wave: 'noise',
          dest: 'filter',
          rateHz: 8,
          amount: 0.2,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: false, time: 0.12, feedback: 0.1, mix: 0.08 }
        effects.reverb = { enabled: true, size: 0.55, decay: 0.6, mix: 0.28 }
        patch.master.gain = 0.22
      }, { tags: ['percussion', 'noise'] },
    ),
    makePreset(
      'chiptune-click',
      'Chiptune Click',
      'Retro 8-bit percussive blip with sequencer-ready envelope.',
      (patch) => {
        patch.engineMode = 'classic'
        patch.osc1.mode = 'analog'
        patch.osc1.wave = 'square'
        patch.osc1.octave = 1
        patch.osc2.mode = 'analog'
        patch.osc2.wave = 'square'
        patch.osc2.detune = 7
        patch.osc2.octave = 1
        patch.mix = 0.45
        patch.filter.type = 'highpass'
        patch.filter.cutoff = 600
        patch.filter.q = 0.7
        patch.envelope.attack = 0.001
        patch.envelope.decay = 0.12
        patch.envelope.sustain = 0
        patch.envelope.release = 0.08
        patch.lfo1 = {
          ...(patch.lfo1 ?? defaultPatch.lfo1!),
          enabled: false,
          wave: 'square',
          dest: 'pitch',
          rateHz: 12,
          amount: 0.0,
        }
        const effects = ensureEffects(patch)
        effects.delay = { enabled: false, time: 0.08, feedback: 0.1, mix: 0.05 }
        effects.reverb = { enabled: false, size: 0.3, decay: 0.3, mix: 0.08 }
        patch.master.gain = 0.2
      }, { tags: ['percussion', 'retro'] },
    ),
  ],
}

export const presetGroups: PresetGroup[] = [essentials, basslines, macroVoices, motionFx, keysAndLeads, percussionFx]

type IndexedPreset = PresetDefinition & { groupId: string }

const flattened: IndexedPreset[] = presetGroups.flatMap((group) =>
  group.presets.map((preset) => ({ ...preset, groupId: group.id })),
)

export const presetIndex: Record<string, IndexedPreset> = Object.fromEntries(
  flattened.map((preset) => [preset.id, preset]),
)

export const presets: Record<string, Patch> = Object.fromEntries(
  flattened.map((preset) => [preset.id, preset.patch]),
)

export const presetOrder: string[] = flattened.map((preset) => preset.id)
export const DEFAULT_PRESET_ID = 'init'
