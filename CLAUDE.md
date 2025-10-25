# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WebSynth Studio is a browser-based analogue-style synthesizer built with React, TypeScript, Vite, and the Web Audio API. It runs fully client-side with no backend, featuring dual oscillator engines (ENG1/ENG2), modulation system, effects, and preset management.

## Development Commands

### Running the Development Server
```sh
npm run dev
```
Starts Vite dev server with HMR at http://localhost:5173. Use `--host` flag (already in package.json) to expose on local network.

### Building for Production
```sh
npm run build
```
Runs TypeScript type-check (`tsc -b`) then creates optimized production bundle in `docs/` directory (configured for GitHub Pages deployment).

### Testing
```sh
npm test              # Run all tests once (CI mode)
npm run test:watch    # Run tests in watch mode during development
```
Uses Vitest with jsdom environment. Tests colocated with source files as `*.test.ts[x]`.

### Quality Checks
```sh
npm run typecheck     # TypeScript no-emit type checking
npm run lint          # ESLint check
npm run format        # Prettier formatting
```

**Pre-push checklist:** All of these should pass before committing:
```sh
npm run lint && npm run typecheck && npm test && npm run build
```

## Architecture

### Directory Structure
- `src/audio-engine/` - Web Audio API DSP logic (pure TypeScript, framework-agnostic)
  - `engine.ts` - Core SynthEngine class, types, and default patch
  - `phaseVocoder.ts` - Time-stretching/pitch-shifting for sampler
  - `expressionTargets.ts` - XY expression control mapping
- `src/state/` - Zustand store with persistence middleware
- `src/ui/` - React components (PascalCase.tsx naming)
- `src/patches/` - Factory preset definitions
- `public/` - Static assets (impulse responses, etc.)
- `docs/` - Build output directory (GitHub Pages serves from here)

### TypeScript Path Aliases
Configured in tsconfig.json and vite.config.ts:
- `@audio/*` → `src/audio-engine/*`
- `@state/*` → `src/state/*`
- `@ui/*` → `src/ui/*`
- `@patches/*` → `src/patches/*`

Use these aliases when importing across module boundaries.

### Audio Engine Architecture

The audio engine is built on native Web Audio API nodes with custom DSP:

1. **Voice Architecture**: Each note triggers a voice that creates its own audio graph:
   - OSC1 + OSC2 (with sub-oscillator and ring modulation options)
   - FM synthesis (OSC2 modulates OSC1)
   - Mixer controls OSC1/OSC2 balance
   - Shared filter (BiquadFilterNode)
   - ADSR envelope applied to VCA (GainNode)
   - Effects chain (delay, reverb via ConvolverNode)

2. **Oscillator Modes**:
   - `analog`: Classic waveforms (sine, square, saw, triangle, noise)
   - `macro`: Complex synthesis models (supersaw, FM2op, wavetable, formant, etc.)
   - `sampler`: Audio sample playback with phase vocoder pitch-shifting

3. **Modulation System**:
   - Two LFOs with assignable waveforms and rates
   - XY expression control (CapsLock + trackpad)
   - Step sequencer output
   - Velocity and gate signals
   - Mod matrix routes sources to targets (filter cutoff, envelope times, macro params, etc.)

4. **Important**: AudioContext must be initialized on user gesture (not at module import). The engine handles this in `SynthEngine.resumeContext()`.

### State Management

Uses Zustand with localStorage persistence:
- Single store in `src/state/store.ts`
- Main state: current patch, engine mode, settings, MIDI config
- Patch normalization and validation on load (handles legacy formats)
- Actions: updatePatch, loadPreset, setPowerOn, MIDI handlers, etc.

The store persists the working patch to localStorage so it survives page reloads.

### Testing Strategy

- **Audio engine tests**: Mock Web Audio API objects (AudioContext, nodes) in jsdom environment
- **DSP math**: Test ADSR envelope curves, frequency calculations, modulation routing
- **UI tests**: React Testing Library for component behavior and user interactions
- **Guards**: Wrap Web Audio access in try/catch or mock for Node/jsdom environments

When adding features that involve Web Audio, add corresponding tests that mock the audio context.

## Key Technical Details

### Web Audio API Usage
- Native nodes preferred over heavy dependencies (OscillatorNode, BiquadFilterNode, GainNode, ConvolverNode, AnalyserNode)
- Avoid accessing AudioContext at module import time - initialize lazily on user interaction
- Use `setTargetAtTime` for smooth parameter changes to prevent clicks/pops
- Limit polyphony (defaults vary by mode) to maintain performance

### Macro Engine Models
The macro engine (`src/audio-engine/engine.ts`) implements multiple synthesis models:
- `va`, `fold`, `supersaw`, `pwm` - Virtual analog variations
- `fm2op` - Two-operator FM synthesis
- `pluck` - Karplus-Strong physical modeling
- `wavetable` - Morphable wavetable synthesis
- `harmonic`, `chord`, `dirichlet` - Additive synthesis variations
- `formant` - Vowel-like formant synthesis

Each model uses three macro parameters (harmonics, timbre, morph) that control different aspects of the sound.

### Expression Control System
- CapsLock toggles XY expression mode
- Trackpad/touch movements map to two assignable parameters
- Smoothly interpolates between patch value and expression value
- On CapsLock release, parameters fade back to stored patch values
- Configured in ExpressionPanel, implemented in ExpressionSurface

### Preset Management
- Factory presets defined in `src/patches/presets.ts`
- Export format: JSON with full patch state
- Import: validates and normalizes legacy formats
- Store preset JSONs in `src/patches/` and add to presets array

## Development Guidelines

### Code Style
- TypeScript strict mode enabled - avoid `any`
- Functional React components with hooks
- PascalCase for components/files, camelCase for functions/variables
- SCREAMING_SNAKE_CASE for true constants
- 2-space indentation, single quotes (enforced by Prettier)

### Separation of Concerns
- Keep audio logic in `src/audio-engine/` - pure TypeScript, no React/UI dependencies
- UI components in `src/ui/` should only handle presentation and user interaction
- State management in `src/state/` - single source of truth
- Throttle/debounce frequent parameter updates (e.g., knob movements) to avoid excessive re-renders

### Commit Conventions
Follow Conventional Commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `refactor:` - Code restructuring without behavior change
- `chore:` - Build/tooling changes
- `docs:` - Documentation updates

Keep commits focused and atomic.

## Deployment

- Production build outputs to `docs/` directory
- GitHub Pages serves from `docs/` on main branch
- Base URL configured as `./` (relative) for GitHub Pages subpath support
- No runtime environment variables or secrets needed (fully static)
- Enable GitHub Pages in repo settings: main → /docs

## Common Pitfalls

1. **AudioContext not resuming**: Always check if context is suspended and call `resumeContext()` on user gesture
2. **Parameter clicking**: Use `setTargetAtTime` or `exponentialRampToValueAtTime` instead of setting `.value` directly
3. **Memory leaks**: Properly disconnect and clean up audio nodes when voices end
4. **Test failures in CI**: Mock Web Audio API objects that don't exist in jsdom
5. **Import errors**: Use TypeScript path aliases (`@audio/*`, etc.) consistently - don't mix relative and absolute paths
6. **Preset loading**: Always normalize loaded patches with `normalizeOscillator`, `normalizeModMatrix`, etc. to handle legacy formats
