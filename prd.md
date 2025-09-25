# Product Requirements Document (PRD)

**Product Name:** WebSynth Studio  
**Owner:** Levi (Engineering Manager)  
**Date:** September 25, 2025  
**Version:** 1.0

---

## 1. Overview

WebSynth Studio is a browser-based analogue synthesizer simulator that emulates the experience of using a physical modular/analogue synth. It targets musicians, hobbyists, and learners who want hands-on synthesis without hardware.

**Goal:** Deliver an intuitive, low-latency, visually rich web app that simulates classic analogue synth behavior with modular routing, real-time sound generation, and sharing capabilities.

---

## 2. Objectives & Success Metrics

- **Objectives:**
    - Provide an authentic analogue synth sound within the browser.
    - Ensure the UI mimics the tactile feel of knobs, sliders, and patch cables.
    - Enable users to create, save, and share patches.
    - Accessible on desktop and tablet.

- **Success Metrics:**
    - <50ms audio latency on modern browsers.
    - 95% of beta testers can create a patch without documentation.
    - > 80% retention after first session (music hobbyist cohort).
    - ≥1,000 shared patches post-launch.

---

## 3. Target Audience

- **Primary:** Musicians, producers, synth enthusiasts.
- **Secondary:** Students learning sound design.
- **Tertiary:** Developers/researchers experimenting with Web Audio API.

---

## 4. Features

### 4.1 Core Features

- **Sound Engines**
    - Oscillators: Sine, Square, Saw, Noise.
    - Filters: Low-pass, High-pass, Band-pass, Resonant.
    - Envelopes: ADSR.
    - LFOs.
    - Mixer.

- **Interface & UX**
    - Drag-and-drop patch cables for modular connectivity.
    - Knobs/sliders mimicking hardware response.
    - Preset patch browser.
    - Responsive layout for desktop/tablet.

- **Patch Management**
    - Save/load patches locally.
    - Import/export as JSON.
    - Online sharing (v2).

- **Playback**
    - On-screen keyboard.
    - MIDI controller support.
    - Polyphony up to 8 voices.

### 4.2 Stretch Features (Nice-to-Have)

- Sequencer (step-based).
- Effects (delay, reverb, distortion).
- Collaboration mode (live patching with friends).
- Visualizer (oscilloscope/spectrum analyzer).

---

## 5. User Stories

- _As a music hobbyist,_ I want to tweak knobs and connect modules so I can explore how different sounds are made.
- _As a producer,_ I want to plug in my MIDI keyboard so I can play synth lines in real-time.
- _As a learner,_ I want to load tutorials with example patches so I can understand synthesis basics.
- _As a pro user,_ I want to export my patch so I can reuse it in another session.

---

## 6. Non-Functional Requirements

- **Performance:** Real-time audio with <50ms latency.
- **Scalability:** Handle 500 concurrent users per server (cloud deploy).
- **Compatibility:** Chrome, Edge, Safari, Firefox (latest 2 versions).
- **Accessibility:** Keyboard navigation, colorblind-friendly options.
- **Security:** Sandbox audio engine execution, XSS/CSRF protection.

---

## 7. Technical Approach

- **Frontend:**
    - React (UI), Tone.js or Raw Web Audio API (engine).
    - Canvas/WebGL for knob animations and patch cables.

- **Backend (for cloud patch sharing):**
    - Node.js + Express, MongoDB for patch storage.
    - REST API for patch CRUD.

- **Deployment:**
    - Static frontend on CDN.
    - Backend on containerized service (Docker/Kubernetes).

---

## 8. Risks & Mitigations

- **Risk:** Browser audio inconsistencies.
    - _Mitigation:_ Use Web Audio API standard; fallback polyfills.

- **Risk:** Performance drops with complex patches.
    - _Mitigation:_ Limit polyphony, optimize DSP.

- **Risk:** Steep learning curve.
    - _Mitigation:_ Onboarding tutorials, preset library.

---

## 9. Timeline (MVP ~3 months)

- **Month 1:** Core sound engine + basic UI prototyping.
- **Month 2:** Patch management + MIDI support.
- **Month 3:** Polish UI/UX, QA, cloud storage integration.
- **Post-MVP:** Sequencer, FX, collaboration, visualizer.

---

## 10. Open Questions

- Should patch sharing be anonymous or account-based?
- Do we need offline mode (PWA) in v1 or later?
- Should presets mimic specific famous synths (e.g., Moog, Roland) or be generic?
