import { useEffect } from 'react'
import { useStore } from '../state/store'
import { defaultPatch } from '../audio-engine/engine'

const STEP_DIVISIONS = 4 // 16th notes

export function TransportTicker() {
  const tempo = useStore((s) => s.transport.tempo)
  const playing = useStore((s) => s.transport.playing)
  const bump = useStore((s) => s.bumpTransportTick)
  const patch = useStore((s) => s.patch)
  const updatePatch = useStore((s) => s.updatePatch)

  useEffect(() => {
    if (!playing) return
    const interval = 60000 / tempo / STEP_DIVISIONS
    const id = window.setInterval(() => bump(), interval)
    return () => window.clearInterval(id)
  }, [playing, tempo, bump])

  useEffect(() => {
    const seq = patch.sequencer ?? defaultPatch.sequencer
    if (seq?.enabled && seq.playing !== playing) {
      updatePatch({ sequencer: { ...seq, playing } })
    }
  }, [playing, patch.sequencer, updatePatch])

  useEffect(() => {
    const seq = patch.sequencer ?? defaultPatch.sequencer
    if (seq?.enabled && seq.bpm !== tempo) {
      updatePatch({ sequencer: { ...seq, bpm: tempo } })
    }
    const arp = patch.arp ?? defaultPatch.arp
    if (arp?.enabled && (arp.bpm !== tempo || !arp.bpmSync)) {
      updatePatch({ arp: { ...arp, bpm: tempo, bpmSync: true } })
    }
  }, [tempo, patch.sequencer, patch.arp, updatePatch])

  return null
}
