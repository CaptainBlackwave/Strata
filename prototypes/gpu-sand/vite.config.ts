// PROTOTYPE - NOT FOR PRODUCTION
// Question: can a GPU board (Pixi) and a falling-sand pour look and run well enough for Strata?
// Date: 2026-11-11
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { host: true, fs: { allow: ['../..'] } },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
});
