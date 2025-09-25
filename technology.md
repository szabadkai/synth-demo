# Document 2: Technology Choices for WebSynth Studio

Since you want a static browser-only deployment, everything will run **client-side** with no backend.

### 1. Core Libraries & Frameworks

- **UI Framework:** React + TypeScript
    - Widely supported ecosystem.
    - Hooks-based state handling.
- **Audio Engine:** Web Audio API (native browser tech)
    - OscillatorNode, BiquadFilterNode, GainNode, AnalyserNode.
    - Optionally Tone.js to speed up development (but can be limiting).
- **State Management:** Zustand (lightweight, react-friendly alternative to Redux).
- **Build Tool:** Vite (fast dev server, modern ESBuild pipeline).

### 2. Visual Layer

- **Controls UI (Knobs/Sliders):** Custom React Canvas components or libraries like `react-knob`.
- **Patch Cables:** HTML Canvas or SVG lines with drag interactions.
- **Keyboard:** On-screen piano component (React custom or library).

### 3. Storage & Patches

- **Local Storage / IndexedDB:** Store user patches (JSON).
- **Serialization:**
    ```json
    {
        "osc1": { "wave": "saw", "freq": 440 },
        "filter": { "type": "lowpass", "cutoff": 800 },
        "envelope": {
            "attack": 0.1,
            "decay": 0.2,
            "sustain": 0.7,
            "release": 0.5
        }
    }
    ```
- Export/Import as JSON text files for sharing.

### 4. Performance

- **Polyphony Handling:** Limit to 8 voices using `AudioContext.createOscillator()` per note.
- **Async Scheduling:** Use `setTargetAtTime` and `start/stop` methods for precise timing.
- **Minimize CPU load:** avoid unnecessary re-render of UI at audio sample rate.

### 5. Tooling & Quality

- **Testing:** Jest + Testing Library (unit/UI), Cypress (E2E).
- **CI/CD:** GitHub Actions to build + run tests on PRs.
- **Deployment:**
    - GitHub Pages / Netlify for fast static hosting.
    - Single-page app with cache busting.

### 6. Optional Enhancements (Post-MVP)

- **PWA Mode:** Service Worker for offline usage (turn synth into a mini app).
- **WebMIDI API:** Direct external MIDI keyboard control.
- **Visualizer:** Use AnalyserNode for oscilloscope/spectrum.
