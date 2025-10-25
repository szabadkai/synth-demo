# WebSynth Studio

WebSynth Studio is a browser-based analogue-style synthesizer built with React, TypeScript, Vite, and the Web Audio API. It runs fully offline, supports preset management, and now features configurable 2D expression control mapped to your device's trackpad.

- **Repository**: https://github.com/szabadkai/synth-demo
- **Live demo**: https://szabadkai.github.io/synth-demo (replace `szabadkai` with your GitHub username when deploying forks via GitHub Pages)
- **Buy me a coffee**: https://buymeacoffee.com/szabadkai

## Highlights

- **Dual ENG voice engine** (ENG1/ENG2) with sub, ring-mod, macro engines, and a flexible mixer.
- **Filter, envelopes, and effects** including delay and convolution reverb.
- **Modulation system** with two assignable LFOs, 6-mode arpeggiator (including new Sequence mode), step sequencer, and macro controls.
- **Advanced arpeggiator** with Up/Down/Random/As-Played modes, plus new Sequence mode that plays through your sequencer pattern with rests.
- **Curated presets** surfaced in the top bar that cover pads, basses, macro textures, and motion studies.
- **Configurable XY expression**: engage CapsLock and glide on the trackpad to control any two parameters (filter cutoff, oscillator detune, FM amount, envelope times, macro sliders, LFO rate/depth, etc.).
- **Patch workflow**: import/export JSON patches, curate presets under `src/patches/`, and persist the working sound via local storage.
- **Responsive keyboard**: MIDI-like computer keyboard mapping, on-screen keys, pointer glissando, and octave shifts.
- **Hardware MIDI input**: enable Web MIDI in settings, pick a controller, and play the synth from external gear.

## Getting Started

```sh
npm install
npm run dev
```

Open the printed Vite URL (defaults to http://localhost:5173). Click the **Power On** button or press a key to resume audio. Use the on-screen keyboard, your computer keyboard (A/W/S/…), or CapsLock + trackpad to perform.

### Trackpad Expression Cheat Sheet

1. Toggle **CapsLock** to arm the XY surface.
2. Move your finger across the trackpad (or touch surface) to send X/Y values.
3. The live HUD shows which parameters are being modulated and their current percentage.
4. Customize X and Y destinations in the **Expression** panel.
5. Disengaging CapsLock smoothly restores each parameter to its stored patch value.

### Arpeggiator Modes

The arpeggiator features 6 playback modes accessible via the Mode knob:

- **Up** - Arpeggiate held notes ascending by pitch
- **Down** - Arpeggiate held notes descending by pitch
- **Up-Down** - Ascend then descend in ping-pong fashion
- **Random** - Randomize note order on each cycle
- **As Played** - Preserve the exact order you pressed keys (great for creating melodic patterns)
- **Sequence** ⭐ NEW - Play through your Sequencer pattern with rhythmic rests
  - ON steps trigger notes using your held note(s) + the step's offset
  - OFF steps create pauses/rests in the pattern
  - Combine with octaves and chord modes for complex rhythmic sequences

**Chord Options:** Use the Chord knob to add intervals (Power, Major, Minor, Sus2/4, Maj7/Min7) or select "Seq" to use your sequencer offsets as chord intervals.

## Available Scripts

| Command                           | Description                                           |
| --------------------------------- | ----------------------------------------------------- |
| `npm run dev`                     | Start Vite with HMR.                                  |
| `npm run build`                   | Type-check (`tsc -b`) and create a production bundle. |
| `npm run preview`                 | Preview the production build locally.                 |
| `npm run typecheck`               | TypeScript no-emit check.                             |
| `npm test` / `npm run test:watch` | Run Vitest once or in watch mode.                     |
| `npm run lint` / `npm run format` | ESLint and Prettier tasks.                            |

## Project Structure

```
src/
  audio-engine/   # Web Audio graph & DSP
  ui/             # React components and panels
  state/          # Zustand store and selectors
  patches/        # Factory presets and helpers
public/           # Static assets
docs/             # GitHub Pages build (served at /synth-demo)
```

## Tech Stack

- React, TypeScript, Vite, Zustand
- Web Audio API with custom DSP voice engine
- Canvas oscilloscope visualization
- Vitest + React Testing Library for unit/UI tests

## Contributing

1. Fork and clone the repo.
2. Create a feature branch.
3. Keep changes focused; follow conventional commits (e.g., `feat:` / `fix:`).
4. Ensure `npm run lint && npm run typecheck && npm test && npm run build` all pass before opening a PR.
5. Include screenshots or GIFs for UI changes.

## Deployment

- GitHub Pages serves the production bundle from `docs/`.
- To publish your fork, enable Pages (Project Sites) and set the source to `main` ➝ `/docs`. Update the README link to point at `https://<your-user>.github.io/synth-demo`.
