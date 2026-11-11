/**
 * Falling-sand simulation for the GPU board (sprint 19 S1, docs/architecture/adr-0001-gpu-sand-board.md).
 * Pure and deterministic: no Pixi, no DOM, no timers. The renderer calls `step` and reads the views.
 */
export * from './config';
export * from './grid';
export * from './pour-sim';
