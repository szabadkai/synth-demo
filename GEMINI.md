# Project: WebSynth Studio

## Overview

WebSynth Studio is a browser-based analogue-style synthesizer built with React, TypeScript, Vite, and the Web Audio API. It runs fully offline, supports preset management, and features configurable 2D expression control mapped to your device's trackpad.

The project is structured with the main application logic in the `src` directory, which is further divided into `audio-engine`, `ui`, `state`, and `patches`. Static assets are in the `public` directory, and the production build is output to the `docs` directory for GitHub Pages deployment.

## Building and Running

### Development

To run the development server:

```sh
npm install
npm run dev
```

### Building

To create a production build:

```sh
npm run build
```

The output will be in the `docs` directory.

### Testing

To run the test suite:

```sh
npm test
```

To run the tests in watch mode:

```sh
npm run test:watch
```

## Development Conventions

### Linting and Formatting

The project uses ESLint for linting and Prettier for formatting.

- To run the linter: `npm run lint`
- To format the code: `npm run format`

### Commits

The project follows the Conventional Commits specification.

### Tech Stack

- React
- TypeScript
- Vite
- Zustand
- Web Audio API
- Vitest
- React Testing Library
