# WebSynth Studio (MVP)

A browser-based analogue synth simulator using React, TypeScript, Vite, and the Web Audio API.

## Features (MVP)

- Oscillator (wave + detune)
- Filter (type, cutoff, resonance)
- ADSR envelope
- Master gain
- On-screen keyboard + computer key mapping
- Patch import/export + presets
- Oscilloscope waveform visualization

## Local Development

1. Install dependencies

```sh
npm install
```

2. Start the dev server

```sh
npm run dev
```

3. Open the app

Vite will print a local URL (usually http://localhost:5173). Click anywhere or press a key to enable audio, then play using the on-screen keys or the computer keyboard (A/W/S/E/D/F/T/G/Y/H/U/J/K).

4. Tests

```sh
npm test
```

## Tech

- React + TypeScript + Vite
- Zustand for state
- Web Audio API for synthesis
- Canvas for oscilloscope

## Notes

- Browsers require a user interaction to start audio; use the Power On button or press a key.
- This MVP is intentionally simple and ready to extend with more modules, LFOs, polyphony mgmt, and MIDI.
