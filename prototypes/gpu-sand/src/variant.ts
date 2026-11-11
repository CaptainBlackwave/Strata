// PROTOTYPE - NOT FOR PRODUCTION
// Question: can a GPU board (Pixi) and a falling-sand pour look and run well enough for Strata?
// Date: 2026-11-11
import type { Board, Color } from '../../../src/core/board';

/** What every board variant offers to the page. The page owns the rules; a variant only draws. */
export interface Variant {
  /** Show this exact board (no animation). */
  setBoard(b: Board): void;
  setSelected(i: number | null): void;
  /** Animate a pour of `moved` units of `color`, then show `next`. Resolves when the board is at rest. */
  pour(from: number, to: number, moved: number, color: Color, before: Board, next: Board): Promise<void>;
  setPatterns(on: boolean): void;
  destroy(): void;
}

export const speed = { scale: 1 };
