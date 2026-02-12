# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build Output
- Production builds output to `docs/` directory (not `dist`) for GitHub Pages deployment
- Base URL is `./` (relative) for GitHub Pages subpath support

## TypeScript Path Aliases
Configured in tsconfig.json - use these for cross-module imports:
- `@audio/*` → `src/audio-engine/*`
- `@state/*` → `src/state/*`
- `@ui/*` → `src/ui/*`
- `@patches/*` → `src/patches/*`

## Web Audio Critical Rules
- **Never** access AudioContext at module import time - initialize lazily on user gesture
- Use `setTargetAtTime` or `exponentialRampToValueAtTime` for parameter changes (never set `.value` directly) to prevent clicks/pops
- Mock Web Audio API objects in tests (jsdom doesn't provide them)

## Patch Normalization
When loading presets, always normalize with:
- `normalizeOscillator()` - handles missing mode/macro/sampler fields
- `normalizeModMatrix()` - validates mod sources/targets, generates IDs
- `normalizeSequencer()` - clamps length, rootMidi, validates steps

## Testing
- Vitest configured with `globals: true` - no need to import describe/it/expect
- Tests colocated with source: `*.test.ts[x]` pattern
- Run single test file: `npx vitest run path/to/test.test.ts`

## Pre-push Checklist
```sh
npm run lint && npm run typecheck && npm test && npm run build
```
