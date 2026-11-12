/**
 * The jar mechanics' marks for the GPU board (sprint 19 S3), drawn on 2D canvases to match
 * style.css: the ice (frozen), the padlock (locked), the funnel mark, the sieve band and the clam
 * shell. Each returns a canvas at `res` device px per CSS px; sizes follow the DOM rules, from the
 * jar's width `w` (`--jar-w`). Text (the hourglass and clam counts) stays in the DOM, so it follows
 * the player's text size.
 */
import { PATTERNS } from './patterns';

function canvas(w: number, h: number, res: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * res));
  c.height = Math.max(1, Math.ceil(h * res));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  ctx.scale(res, res);
  return [c, ctx];
}

function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rTop: number, rBot: number): void {
  g.beginPath();
  g.moveTo(x + rTop, y);
  g.lineTo(x + w - rTop, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rTop);
  g.lineTo(x + w, y + h - rBot);
  g.quadraticCurveTo(x + w, y + h, x + w - rBot, y + h);
  g.lineTo(x + rBot, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rBot);
  g.lineTo(x, y + rTop);
  g.quadraticCurveTo(x, y, x + rTop, y);
  g.closePath();
}

/** Lays colour pattern `index` over the current clip, in CSS px from (`x`, `y`) (the DOM's `.pat-*` on a mark). */
function fillPattern(g: CanvasRenderingContext2D, index: number, x: number, y: number, w: number, h: number): void {
  const ink = PATTERNS[index % PATTERNS.length];
  for (let py = 0; py < h; py += 1) {
    for (let px = 0; px < w; px += 1) {
      const p = ink(px + 0.5, py + 0.5, h);
      if (p.a <= 0) continue;
      g.fillStyle = `rgba(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]},${p.a})`;
      g.fillRect(x + px, y + py, 1, 1);
    }
  }
}

/** The frost over a frozen jar's whole glass (`.ice`): pale blue ice, a white snowflake, a white inner edge. */
export function drawIce(w: number, h: number, rTop: number, rBot: number, res: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h, res);
  rr(g, 0, 0, w, h, rTop, rBot);
  // 160deg: from the top left toward the bottom right.
  const gr = g.createLinearGradient(w * 0.33, 0, w * 0.67, h);
  gr.addColorStop(0, 'rgba(235,248,255,0.92)');
  gr.addColorStop(0.6, 'rgba(186,222,245,0.78)');
  gr.addColorStop(1, 'rgba(214,236,250,0.9)');
  g.fillStyle = gr;
  g.fill();
  g.save();
  g.clip();
  rr(g, 1, 1, w - 2, h - 2, Math.max(0, rTop - 1), Math.max(0, rBot - 1));
  g.strokeStyle = 'rgba(255,255,255,0.8)';
  g.lineWidth = 2;
  g.stroke();
  g.restore();
  // The snowflake: 62% of the width, centred at 38% of the height (viewBox 40, stroke 2.4).
  const s = (w * 0.62) / 40;
  g.save();
  g.translate(w / 2 - 20 * s, h * 0.38 - 20 * s);
  g.scale(s, s);
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.4;
  g.lineCap = 'round';
  g.beginPath();
  for (const [x1, y1, x2, y2] of [[20, 6, 20, 34], [8, 13, 32, 27], [8, 27, 32, 13]]) {
    g.moveTo(x1, y1);
    g.lineTo(x2, y2);
  }
  g.moveTo(16, 8); g.lineTo(20, 12); g.lineTo(24, 8);
  g.moveTo(16, 32); g.lineTo(20, 28); g.lineTo(24, 32);
  g.stroke();
  g.restore();
  return c;
}

/** A padlock's box and its placement: the canvas, and the box's size (the shackle sits above it). */
export interface PadlockArt {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  /** The box's top, from the canvas top (room for the shackle). */
  readonly boxTop: number;
  readonly boxWidth: number;
  readonly boxHeight: number;
}

/** The padlock in the key colour (`.padlock`): an ink-edged box, its shackle and keyhole; the key colour's pattern when on. */
export function drawPadlock(w: number, color: string, ink: string, pattern: number | null, res: number): PadlockArt {
  const bw = w * 0.46;
  const bh = w * 0.38;
  const sh = bh * 0.7;
  const pad = 2;
  const width = bw + 2 * pad;
  const height = sh + bh + 2 * pad;
  const [c, g] = canvas(width, height, res);
  const x = pad;
  const y = pad + sh;
  // The shackle: 58% wide, 70% tall, round on top.
  const sw = bw * 0.58;
  g.beginPath();
  g.moveTo(x + (bw - sw) / 2, y + 1);
  g.lineTo(x + (bw - sw) / 2, y - sh + sw / 2);
  g.arc(x + bw / 2, y - sh + sw / 2, sw / 2, Math.PI, 0);
  g.lineTo(x + (bw + sw) / 2, y + 1);
  g.strokeStyle = ink;
  g.lineWidth = 2.5;
  g.stroke();
  rr(g, x, y, bw, bh, 6, 6);
  g.fillStyle = color;
  g.fill();
  g.save();
  g.clip();
  if (pattern !== null) fillPattern(g, pattern, x, y, bw, bh);
  g.fillStyle = 'rgba(0,0,0,0.18)';
  g.fillRect(x, y + bh - 3, bw, 3);
  g.restore();
  rr(g, x + 1.25, y + 1.25, bw - 2.5, bh - 2.5, 5, 5);
  g.strokeStyle = ink;
  g.lineWidth = 2.5;
  g.stroke();
  // The keyhole.
  rr(g, x + bw / 2 - 2, y + bh * 0.3, 4, bh * 0.36, 2, 2);
  g.fillStyle = ink;
  g.fill();
  return { canvas: c, width, height, boxTop: y, boxWidth: bw, boxHeight: bh };
}

/** The funnel on a funnel jar's rim (`.funnel-mark`): a sand-coloured trapezoid, 0.95w by 0.42w, with a soft drop shadow. */
export function drawFunnelMark(w: number, res: number): HTMLCanvasElement {
  const fw = w * 0.95;
  const fh = w * 0.42;
  const [c, g] = canvas(fw, fh + 3, res);
  const path = () => {
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(fw, 0);
    g.lineTo(fw * 0.64, fh);
    g.lineTo(fw * 0.36, fh);
    g.closePath();
  };
  g.save();
  g.translate(0, 2);
  path();
  g.fillStyle = 'rgba(90,70,50,0.4)';
  g.fill();
  g.restore();
  path();
  const gr = g.createLinearGradient(0, 0, 0, fh);
  gr.addColorStop(0, '#f5ead8');
  gr.addColorStop(1, '#d9c3a5');
  g.fillStyle = gr;
  g.fill();
  return c;
}

/** The sieve's collar (`.sieve-band`): its band colour edged in ink, a woven mesh; with patterns on, the pattern over a mesh strip at its foot. */
export function drawSieveBand(width: number, height: number, color: string, ink: string, pattern: number | null, res: number): HTMLCanvasElement {
  const [c, g] = canvas(width, height + 2, res);
  rr(g, 0, 0, width, height, 5, 5);
  g.fillStyle = color;
  g.fill();
  g.save();
  g.clip();
  const meshTop = pattern === null ? 0 : height - 4;
  if (pattern !== null) fillPattern(g, pattern, 0, 0, width, height);
  for (let x = 0; x < width; x += pattern === null ? 4 : 3) {
    g.fillStyle = 'rgba(40,30,20,0.45)';
    g.fillRect(x, meshTop, 1, height - meshTop);
  }
  if (pattern === null) {
    for (let y = 0; y < height; y += 4) {
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(0, y, width, 1);
    }
  } else {
    g.fillStyle = 'rgba(40,30,20,0.5)';
    g.fillRect(0, meshTop, width, 1);
  }
  g.fillStyle = 'rgba(255,255,255,0.35)';
  g.fillRect(0, 0, width, 2);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.fillRect(0, height - 2, width, 2);
  g.restore();
  rr(g, 1, 1, width - 2, height - 2, 4, 4);
  g.strokeStyle = ink;
  g.lineWidth = 2;
  g.stroke();
  return c;
}

/**
 * A closed clam's shell over the whole glass (`.clam-shell`): ribs fanning from a hinge at the foot,
 * growth rings, a domed crown, warm shell colours, an edge and the hinge. `night` dims it as the DOM
 * does on night scenes.
 */
export function drawClamShell(width: number, height: number, w: number, night: boolean, res: number): HTMLCanvasElement {
  const [c, g] = canvas(width, height + 2, res);
  const rb = w * 0.38;
  const crown = w * 0.3;
  const shape = () => {
    g.beginPath();
    g.moveTo(0, crown);
    g.ellipse(width / 2, crown, width / 2, crown, 0, Math.PI, 0);
    g.lineTo(width, height - rb);
    g.quadraticCurveTo(width, height, width - rb, height);
    g.lineTo(rb, height);
    g.quadraticCurveTo(0, height, 0, height - rb);
    g.closePath();
  };
  g.save();
  g.translate(0, 2);
  shape();
  g.fillStyle = 'rgba(90,70,50,0.25)';
  g.fill();
  g.restore();
  shape();
  const gr = g.createRadialGradient(width / 2, height, 0, width / 2, height, Math.max(width, height) * 1.05);
  gr.addColorStop(0, '#e4c49e');
  gr.addColorStop(0.55, '#f3dfc4');
  gr.addColorStop(1, '#fcf1e2');
  g.fillStyle = gr;
  g.fill();
  g.save();
  g.clip();
  // Ribs: every 6.5deg from the hinge, a dark and a light line.
  const hx = width / 2;
  const hy = height;
  const len = Math.hypot(width, height) * 1.2;
  for (let a = 0; a <= 180; a += 6.5) {
    for (const [off, col] of [[0, 'rgba(122,82,48,0.3)'], [2, 'rgba(255,255,255,0.3)']] as const) {
      const t = ((a + off) * Math.PI) / 180;
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(hx - Math.cos(t) * len, hy - Math.sin(t) * len);
      g.strokeStyle = col;
      g.lineWidth = 1.1;
      g.stroke();
    }
  }
  // Growth rings every 0.34w.
  g.strokeStyle = 'rgba(122,82,48,0.14)';
  g.lineWidth = 1.5;
  for (let r = w * 0.34; r < height * 1.2; r += w * 0.34) {
    g.beginPath();
    g.ellipse(hx, hy + height * 0.04, r * 1.2, r, 0, Math.PI, 0);
    g.stroke();
  }
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fillRect(0, 0, width, 3);
  g.fillStyle = 'rgba(122,82,48,0.18)';
  g.fillRect(0, height - 3, width, 3);
  g.restore();
  shape();
  g.strokeStyle = '#94704c';
  g.lineWidth = 2;
  g.stroke();
  // The hinge.
  const hw = width * 0.38;
  const hh = Math.max(5, w * 0.14);
  g.beginPath();
  g.ellipse(hx, height - 2 - hh / 2, hw / 2, hh / 2, 0, 0, Math.PI * 2);
  g.fillStyle = '#d6b38b';
  g.fill();
  g.strokeStyle = '#94704c';
  g.lineWidth = 1.5;
  g.stroke();
  if (night) {
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(0,0,0,0.2)';
    g.fillRect(0, 0, width, height + 2);
  }
  return c;
}
