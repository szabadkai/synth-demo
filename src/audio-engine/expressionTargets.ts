export type ExpressionTarget =
  | 'filter.cutoff'
  | 'filter.q'
  | 'master.gain'
  | 'mix'
  | 'osc1.detune'
  | 'osc2.detune'
  | 'fm.amount'
  | 'envelope.attack'
  | 'envelope.release'
  | 'macro.harmonics'
  | 'macro.timbre'
  | 'macro.morph'
  | 'macro.level'
  | 'lfo1.rateHz'
  | 'lfo1.amount'
  | 'lfo2.rateHz'
  | 'lfo2.amount'

type TargetInfo = {
  id: ExpressionTarget
  label: string
  category: 'Filter' | 'Master' | 'Oscillators' | 'FM' | 'Envelope' | 'Macro' | 'LFO'
  description?: string
}

export const EXPRESSION_TARGETS: TargetInfo[] = [
  { id: 'filter.cutoff', label: 'Filter Cutoff', category: 'Filter', description: 'Move the filter cutoff frequency' },
  { id: 'filter.q', label: 'Filter Resonance', category: 'Filter', description: 'Adjust filter Q / resonance' },
  { id: 'master.gain', label: 'Master Gain', category: 'Master', description: 'Scale the master volume' },
  { id: 'mix', label: 'Osc Mix', category: 'Oscillators', description: 'Crossfade between Osc 1 and Osc 2' },
  { id: 'osc1.detune', label: 'Osc 1 Detune', category: 'Oscillators', description: 'Offset oscillator 1 pitch in cents' },
  { id: 'osc2.detune', label: 'Osc 2 Detune', category: 'Oscillators', description: 'Offset oscillator 2 pitch in cents' },
  { id: 'fm.amount', label: 'FM Amount', category: 'FM', description: 'Modulation index for FM routing' },
  { id: 'envelope.attack', label: 'Env Attack', category: 'Envelope', description: 'Envelope attack time' },
  { id: 'envelope.release', label: 'Env Release', category: 'Envelope', description: 'Envelope release time' },
  { id: 'macro.harmonics', label: 'Macro Harmonics', category: 'Macro', description: 'Macro engine harmonics' },
  { id: 'macro.timbre', label: 'Macro Timbre', category: 'Macro', description: 'Macro engine timbre' },
  { id: 'macro.morph', label: 'Macro Morph', category: 'Macro', description: 'Macro engine morph' },
  { id: 'macro.level', label: 'Macro Level', category: 'Macro', description: 'Macro engine output level' },
  { id: 'lfo1.rateHz', label: 'LFO 1 Rate', category: 'LFO', description: 'LFO1 rate in Hz' },
  { id: 'lfo1.amount', label: 'LFO 1 Amount', category: 'LFO', description: 'LFO1 depth' },
  { id: 'lfo2.rateHz', label: 'LFO 2 Rate', category: 'LFO', description: 'LFO2 rate in Hz' },
  { id: 'lfo2.amount', label: 'LFO 2 Amount', category: 'LFO', description: 'LFO2 depth' },
]

export const EXPRESSION_TARGET_LABELS: Record<ExpressionTarget, string> = Object.fromEntries(
  EXPRESSION_TARGETS.map((t) => [t.id, t.label])
) as Record<ExpressionTarget, string>
