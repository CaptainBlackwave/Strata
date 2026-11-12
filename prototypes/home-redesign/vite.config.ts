// PROTOTYPE - NOT FOR PRODUCTION
// Question: is a calm hero-and-tabs Home clearly better than today's stacked Home? (sprint 20 H1)
// Date: 2026-11-12
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // The hero reuses the real sand painter from src/ui/, so the dev server may read the repo root.
  server: { host: true, port: 4560, strictPort: true, fs: { allow: ['../..'] } },
  build: { outDir: 'dist' },
});
