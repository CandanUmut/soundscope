import { defineConfig } from 'vite';

// SoundScope Vite config.
// `base` is set for GitHub Pages project sites (served from /<repo>/).
// Override with the BASE_PATH env var in CI if the repo name differs.
const base = process.env.BASE_PATH || '/soundscope/';

export default defineConfig({
  base,
  build: {
    target: 'es2020',
    outDir: 'dist',
    sourcemap: true
  },
  server: {
    port: 5173,
    host: true
  }
});
