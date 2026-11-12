/**
 * The wooden shelves under each row of jars on the canvas board (sprint 25 U4, direction B).
 * The DOM lays the planks out (`.jar-shelf` in jars.ts and style.css); the canvas reads their boxes
 * and paints the same plank under its jars, once per layout. Pure Canvas 2D: no Pixi here, so the
 * drawing can be tested and the renderer only wraps it in a texture.
 */
import type { Rect } from './geometry';

/** The plank's colours. Wood is art: the same in every scene. Keep in step with style.css `.jar-shelf`. */
export const SHELF_WOOD = { hi: '#d9b27a', lo: '#b58a52', lip: '#8f6736' } as const;

/** The plank's lip below its face, in CSS px (style.css `--shelf-lip`). */
export const SHELF_LIP = 3;

/** Extra room under the lip for the soft shadow, in CSS px. */
export const SHELF_SHADOW = 8;

/**
 * The canvas box a shelf needs: its face plus the lip and the shadow under it.
 * Example: `shelfBox({ left: 10, top: 200, width: 300, height: 10 })` is 21 px tall.
 */
export function shelfBox(r: Rect): Rect {
  return { left: r.left, top: r.top, width: r.width, height: r.height + SHELF_LIP + SHELF_SHADOW };
}

/**
 * Paints one plank `width` × `height` CSS px (face only; the lip and shadow are added below it) at
 * `res` device pixels per CSS px, into a new canvas. Example: `drawShelf(300, 10, 2).height // 42`
 */
export function drawShelf(width: number, height: number, res: number, doc: Document = document): HTMLCanvasElement {
  const box = shelfBox({ left: 0, top: 0, width, height });
  const canvas = doc.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(box.width * res));
  canvas.height = Math.max(1, Math.ceil(box.height * res));
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(res, res);
  const r = height / 2;
  // The soft shadow on the wall behind, then the lip, then the face (as the CSS box-shadows stack).
  ctx.save();
  ctx.shadowColor = 'rgba(60, 40, 20, 0.28)';
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = SHELF_LIP + 2;
  ctx.fillStyle = SHELF_WOOD.lip;
  roundRect(ctx, 0, SHELF_LIP, width, height, r);
  ctx.fill();
  ctx.restore();
  const face = ctx.createLinearGradient(0, 0, 0, height);
  face.addColorStop(0, SHELF_WOOD.hi);
  face.addColorStop(1, SHELF_WOOD.lo);
  ctx.fillStyle = face;
  roundRect(ctx, 0, 0, width, height, r);
  ctx.fill();
  return canvas;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
