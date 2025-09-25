import React from 'react'
import { useStore, type State } from '../state/store'
import { Slider } from './controls/Slider'

export function EffectsPanel() {
  const patch = useStore((s: State) => s.patch)
  const update = useStore((s: State) => s.updatePatch)
  const fx = patch.effects ?? { delay: { enabled: false, time: 0.25, feedback: 0.3, mix: 0.2 }, reverb: { enabled: false, size: 0.5, decay: 0.5, mix: 0.25 } }

  return (
    <div className="controls-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Delay</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={fx.delay.enabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ effects: { ...fx, delay: { ...fx.delay, enabled: e.target.checked } } })}
        />
        <span className="label">Enabled</span>
      </label>
      <Slider label="Time (s)" min={0} max={1.5} step={0.01} value={fx.delay.time} onChange={(v: number) => update({ effects: { ...fx, delay: { ...fx.delay, time: v } } })} disabled={!fx.delay.enabled} />
      <Slider label="Feedback" min={0} max={0.95} step={0.01} value={fx.delay.feedback} onChange={(v: number) => update({ effects: { ...fx, delay: { ...fx.delay, feedback: v } } })} disabled={!fx.delay.enabled} />
      <Slider label="Mix" min={0} max={1} step={0.01} value={fx.delay.mix} onChange={(v: number) => update({ effects: { ...fx, delay: { ...fx.delay, mix: v } } })} disabled={!fx.delay.enabled} />

      <div style={{ gridColumn: '1 / -1', fontSize: 12, color: 'var(--muted)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 12 }}>Reverb</div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="checkbox"
          checked={fx.reverb.enabled}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => update({ effects: { ...fx, reverb: { ...fx.reverb, enabled: e.target.checked } } })}
        />
        <span className="label">Enabled</span>
      </label>
      <Slider label="Size" min={0} max={1} step={0.01} value={fx.reverb.size} onChange={(v: number) => update({ effects: { ...fx, reverb: { ...fx.reverb, size: v } } })} disabled={!fx.reverb.enabled} />
      <Slider label="Decay" min={0} max={1} step={0.01} value={fx.reverb.decay} onChange={(v: number) => update({ effects: { ...fx, reverb: { ...fx.reverb, decay: v } } })} disabled={!fx.reverb.enabled} />
      <Slider label="Mix" min={0} max={1} step={0.01} value={fx.reverb.mix} onChange={(v: number) => update({ effects: { ...fx, reverb: { ...fx.reverb, mix: v } } })} disabled={!fx.reverb.enabled} />
    </div>
  )
}
