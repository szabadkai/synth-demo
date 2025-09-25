import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tsconfigPaths from 'vite-tsconfig-paths';
export default defineConfig({
    // Use relative URLs so assets load correctly on GitHub Pages under a subpath
    base: './',
    build: {
        outDir: 'docs',
        emptyOutDir: true,
    },
    plugins: [react(), tsconfigPaths()],
    test: {
        environment: 'jsdom',
        globals: true,
    },
});
