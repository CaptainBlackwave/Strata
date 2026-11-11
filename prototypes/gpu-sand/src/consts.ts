// PROTOTYPE - NOT FOR PRODUCTION
// Question: can a GPU board (Pixi) and a falling-sand pour look and run well enough for Strata?
// Date: 2026-11-11

/** Design-space board size. Everything is laid out in these units, then scaled to the canvas. */
export const BW = 412;
export const BH = 820;

/** Sand grid: one cell is CELL design px. Interior of a jar is GW x GH cells. */
export const CELL = 1.8;
export const GW = 40;
export const GH = 96;
export const HEAD = 8; // empty rows above a full jar
export const IW = GW * CELL; // 72
export const IH = GH * CELL; // 172.8
export const WALL = 5;
export const BASE = 9;

export const HIDDEN = 9; // palette index of the neutral "?" sand

/** Palette: 9 colours + neutral. Chosen to stay apart in hue and lightness. */
export const PAL_HEX = [
  0xe5483f, // coral
  0xf29a2e, // amber
  0xf5d442, // sun
  0x58b858, // leaf
  0x24b3a4, // teal
  0x3f8fe6, // sky
  0x5a55d4, // indigo
  0xd8509f, // magenta
  0x8d6038, // driftwood
  0xcdbb92, // neutral (hidden)
];
export const PAL_RGB = PAL_HEX.map((h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255]);
export const PAL_CSS = PAL_HEX.map((h) => '#' + h.toString(16).padStart(6, '0'));

export function unitRows(cap: number): number {
  return Math.floor((GH - HEAD) / cap);
}

/** Colour-blind pattern mask for palette index c at cell (x, y). Tile is 8 x 8 cells. */
export function pat(c: number, x: number, y: number): boolean {
  const u = x & 7;
  const v = y & 7;
  const du = u - 3.5;
  const dv = v - 3.5;
  switch (c) {
    case 0: return du * du + dv * dv <= 3.2;
    case 1: return ((u + v) & 7) < 2;
    case 2: return ((u === 3 || u === 4) && v >= 1 && v <= 6) || ((v === 3 || v === 4) && u >= 1 && u <= 6);
    case 3: return v < 2;
    case 4: return ((u + (v < 4 ? v : 8 - v)) & 7) < 2;
    case 5: { const d = du * du + dv * dv; return d >= 5 && d <= 9.5; }
    case 6: return u < 2;
    case 7: { const d = Math.abs(du) + Math.abs(dv); return d >= 2.5 && d <= 3.7; }
    case 8: return (((u >> 2) + (v >> 2)) & 1) === 0;
    default: return false;
  }
}
