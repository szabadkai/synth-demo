# Repository Guidelines

## Project Structure & Module Organization
- `src/audio-engine/`: Web Audio/DSP logic (pure TS where possible).
- `src/ui/`: React components and controls (`*.tsx`).
- `src/state/`: Zustand store and selectors.
- `src/patches/`: Preset definitions and helpers.
- `public/` and `index.html`: Static assets and HTML shell.
- `docs/`: Project docs and static assets for documentation.

## Build, Test, and Development Commands
- `npm run dev`: Start Vite dev server with HMR.
- `npm run build`: Type-check (`tsc -b`) then create production build.
- `npm run preview`: Serve the built app locally for QA.
- `npm test`: Run Vitest in CI mode.
- `npm run test:watch`: Run Vitest in watch mode.
- `npm run typecheck`: TypeScript no‑emit type checking.
- `npm run lint` / `npm run format`: ESLint/Prettier for linting and formatting.

## Coding Style & Naming Conventions
- TypeScript everywhere; avoid `any` (rule enabled). Prefer explicit types.
- Formatting via Prettier; 2‑space indentation, single quotes, semicolons by default.
- React: function components with hooks; component/file names in `PascalCase.tsx`.
- Functions/variables in `camelCase`; constants in `SCREAMING_SNAKE_CASE`.
- Keep audio logic framework‑agnostic under `src/audio-engine`; UI logic in `src/ui`.

## Testing Guidelines
- Frameworks: Vitest + React Testing Library (`jsdom`).
- Location/pattern: colocate tests next to code as `*.test.ts[x]` (e.g., `src/audio-engine/engine.test.ts`).
- Scope: prioritize DSP math/routing and critical UI interactions. Mock or guard Web Audio in `jsdom`.
- Run locally: `npm test` (CI) or `npm run test:watch` (dev). Add regression tests with bug fixes.

## Commit & Pull Request Guidelines
- Commits: Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`). Keep changes focused and atomic.
- Before pushing: `npm run lint && npm run typecheck && npm test && npm run build` should pass.
- PRs: clear description, linked issue, screenshots/GIFs for UI changes, and notes on testing/edge cases. Update README/docs and presets when relevant.

## Security & Configuration Tips
- Do not access `AudioContext` at module import; initialize on explicit user gesture.
- No secrets or runtime env vars expected; keep repo public‑safe. Place new presets in `src/patches/`.
- Prefer native Web Audio nodes; avoid adding heavy deps without discussion.

