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

/** Smallest padlock box (CSS px): below it the shackle and keyhole stop reading (strata-5lq). */
export const PADLOCK_MIN = { w: 17, h: 14 } as const;

/** The padlock box for a jar `w` wide: style.css's 0.46w by 0.38w, never smaller than {@link PADLOCK_MIN}. */
export function padlockBox(w: number): { bw: number; bh: number } {
  return { bw: Math.max(PADLOCK_MIN.w, w * 0.46), bh: Math.max(PADLOCK_MIN.h, w * 0.38) };
}

/** The padlock in the key colour (`.padlock`): an ink-edged box, its shackle and keyhole; the key colour's pattern when on. */
export function drawPadlock(w: number, color: string, ink: string, pattern: number | null, res: number): PadlockArt {
  const { bw, bh } = padlockBox(w);
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

/** The cork pieces (config `styles.slots.cork`), as style.css draws them on a sealed jar. */
export type CorkId = 'cork' | 'driftwood' | 'rope' | 'scallop' | 'brass';

/**
 * A sealed jar's cork (`.cork` and the `[data-cork]` pieces in style.css), `w` × `h` CSS px:
 * the plain cork, grey driftwood with its grain and knot, cork bound with rope, a scallop shell,
 * or a brass cap. The edge is drawn inside the box, as the DOM's 2 px border.
 */
export function drawCork(id: string, w: number, h: number, res: number): HTMLCanvasElement {
  const [c, g] = canvas(w, h, res);
  const piece = (['cork', 'driftwood', 'rope', 'scallop', 'brass'] as const).find((x) => x === id) ?? 'cork';
  const shape = () => {
    if (piece === 'scallop') {
      g.beginPath();
      g.moveTo(0, h - 3);
      g.ellipse(w / 2, h * 0.9, w / 2, h * 0.9, 0, Math.PI, 0);
      g.lineTo(w, h - 3);
      g.quadraticCurveTo(w, h, w - 3, h);
      g.lineTo(3, h);
      g.quadraticCurveTo(0, h, 0, h - 3);
      g.closePath();
    } else {
      const [rt, rb] = piece === 'driftwood' || piece === 'brass' ? [3, 2] : [5, 3];
      rr(g, 0, 0, w, h, rt, rb);
    }
  };
  const vertical = (stops: readonly (readonly [number, string])[]) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    for (const [at, col] of stops) gr.addColorStop(at, col);
    return gr;
  };
  const dots = () => {
    g.fillStyle = 'rgba(0,0,0,0.18)';
    for (let y = 2; y < h; y += 4) for (let x = 2.5; x < w; x += 5) g.fillRect(x - 0.6, y - 0.6, 1.2, 1.2);
  };
  shape();
  g.save();
  g.clip();
  const corkBase = [[0, '#d8a86b'], [1, '#b7834a']] as const;
  let edge = '#8a6136';
  if (piece === 'cork' || piece === 'rope') {
    g.fillStyle = vertical(corkBase);
    g.fillRect(0, 0, w, h);
    dots();
  }
  if (piece === 'rope') {
    // A band of twisted rope across the middle, and its knot at the right.
    const bh = h * 0.46;
    const by = (h - bh) * 0.45;
    g.save();
    g.beginPath();
    g.rect(0, by, w, bh);
    g.clip();
    g.fillStyle = '#b8955c';
    g.fillRect(0, by, w, bh);
    g.strokeStyle = '#eedfb6';
    g.lineWidth = 1.4 * Math.sin(Math.PI / 3);
    for (let x = -bh; x < w + bh; x += 2.8 / Math.sin(Math.PI / 3)) {
      g.beginPath();
      g.moveTo(x, by + bh);
      g.lineTo(x + bh / Math.tan(Math.PI / 3), by);
      g.stroke();
    }
    g.restore();
    g.beginPath();
    g.arc(w * 0.86, h * 0.52, 2.4, 0, Math.PI * 2);
    g.fillStyle = '#9c7c48';
    g.fill();
    g.beginPath();
    g.arc(w * 0.86, h * 0.52, 1.6, 0, Math.PI * 2);
    g.fillStyle = '#e9d6a6';
    g.fill();
  }
  if (piece === 'driftwood') {
    g.fillStyle = vertical([[0, '#c2bbb0'], [1, '#8f887d']]);
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(64,58,52,0.3)';
    for (let x = 0; x < w; x += 3.5) g.fillRect(x, 0, 1, h);
    const kn = g.createRadialGradient(w * 0.7, h * 0.55, 0, w * 0.7, h * 0.55, w * 0.22);
    kn.addColorStop(0, 'rgba(64,58,52,0.45)');
    kn.addColorStop(0.7, 'rgba(64,58,52,0)');
    g.save();
    g.translate(w * 0.7, h * 0.55);
    g.scale(1, (h * 0.34) / (w * 0.22));
    g.translate(-w * 0.7, -h * 0.55);
    g.fillStyle = kn;
    g.fillRect(0, 0, w, h * 2);
    g.restore();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, 0, w, 1);
    edge = '#5f584f';
  }
  if (piece === 'scallop') {
    // Rays from the foot, pale and rose, 8° and 5° wide, and a soft shade round the rim.
    const hx = w / 2;
    for (let a = 0; a < 180; a += 13) {
      for (const [from, span, col] of [[0, 8, '#fbe7d8'], [8, 5, '#e6b298']] as const) {
        g.beginPath();
        g.moveTo(hx, h);
        g.arc(hx, h, Math.hypot(w, h), Math.PI + ((a + from) * Math.PI) / 180, Math.PI + ((a + from + span) * Math.PI) / 180);
        g.closePath();
        g.fillStyle = col;
        g.fill();
      }
    }
    const sh = g.createRadialGradient(hx, h, h * 0.55, hx, h, h * 1.05);
    sh.addColorStop(0, 'rgba(120,60,40,0)');
    sh.addColorStop(1, 'rgba(120,60,40,0.16)');
    g.fillStyle = sh;
    g.fillRect(0, 0, w, h);
    edge = '#b17860';
  }
  if (piece === 'brass') {
    g.fillStyle = vertical([[0, '#f8e1a0'], [0.15, '#f8e1a0'], [0.38, '#dcae55'], [0.7, '#bb8a33'], [1, '#9a6f22']]);
    g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(90,58,12,0.22)';
    for (let x = 0; x < w; x += 3) g.fillRect(x, h * 0.62, 1, h * 0.38);
    g.fillStyle = 'rgba(255,250,225,0.75)';
    g.fillRect(0, 0, w, 1.5);
    g.fillStyle = 'rgba(70,45,8,0.3)';
    g.fillRect(0, h - 1, w, 1);
    edge = '#6c4d18';
  }
  g.restore();
  // The 2 px edge, inside the box.
  g.save();
  shape();
  g.clip();
  shape();
  g.strokeStyle = edge;
  g.lineWidth = 4;
  g.stroke();
  g.restore();
  return c;
}

/**
 * A jar's glow in the win run (`.glass .win-glow`): a warm light in the middle of the glass in the
 * scene's `--glow-core`, and a soft halo round it in `--glow` (both `r, g, b`), `w` × `h` plus the halo.
 */
export function drawGlow(w: number, h: number, core: string, halo: string, res: number): { canvas: HTMLCanvasElement; pad: number } {
  const pad = 17;
  const [c, g] = canvas(w + 2 * pad, h + 2 * pad, res);
  g.save();
  g.filter = 'blur(7px)';
  rr(g, pad - 2, pad - 2, w + 4, h + 4, w * 0.14, w * 0.4);
  g.strokeStyle = `rgba(${halo},0.65)`;
  g.lineWidth = 6;
  g.stroke();
  g.restore();
  g.save();
  rr(g, pad, pad, w, h, w * 0.12, w * 0.38);
  g.clip();
  const gr = g.createRadialGradient(pad + w / 2, pad + h * 0.55, 0, pad + w / 2, pad + h * 0.55, Math.max(w, h) * 0.55);
  gr.addColorStop(0, `rgba(${core},0.55)`);
  gr.addColorStop(1, `rgba(${core},0)`);
  g.fillStyle = gr;
  g.fillRect(0, 0, w + 2 * pad, h + 2 * pad);
  g.restore();
  return { canvas: c, pad };
}

/** The look of the DOM's hourglass or tide count pill, read from it so it matches the text size. */
export interface PillLook {
  /** Which glyph the pill carries: the hourglass's bulbs, or the tide jar's wave (§2.8). Default hourglass. */
  readonly glyph?: 'hourglass' | 'wave';
  readonly width: number;
  readonly height: number;
  readonly bg: string;
  readonly fg: string;
  readonly border: string;
  readonly font: string;
  readonly text: string;
}

/** The hourglass or tide count pill (`.hourglass-mark`, `.tide-mark`), redrawn so it can travel with a pouring jar (strata-5lq). */
export function drawPill(p: PillLook, res: number): HTMLCanvasElement {
  const [c, g] = canvas(p.width, p.height, res);
  const r = p.height / 2;
  rr(g, 0.75, 0.75, p.width - 1.5, p.height - 1.5, r, r);
  g.fillStyle = p.bg;
  g.fill();
  g.strokeStyle = p.border;
  g.lineWidth = 1.5;
  g.stroke();
  const wave = p.glyph === 'wave';
  // The glyph: two bulbs and a waist, as HOURGLASS_MARK, or two wave lines, as TIDE_MARK.
  const gh = p.height * (wave ? 0.5 : 0.62);
  const gw = wave ? gh * 1.4 : gh * 0.72;
  const gx = p.height * 0.32;
  const gy = (p.height - gh) / 2;
  g.strokeStyle = p.fg;
  g.fillStyle = p.fg;
  g.lineWidth = 1.3;
  g.beginPath();
  if (wave) {
    for (const y of [gy + gh * 0.3, gy + gh * 0.8]) {
      g.moveTo(gx, y);
      g.bezierCurveTo(gx + gw * 0.15, y - gh * 0.3, gx + gw * 0.35, y - gh * 0.3, gx + gw * 0.5, y);
      g.bezierCurveTo(gx + gw * 0.65, y + gh * 0.3, gx + gw * 0.85, y + gh * 0.3, gx + gw, y);
    }
  } else {
    g.moveTo(gx, gy); g.lineTo(gx + gw, gy);
    g.moveTo(gx, gy + gh); g.lineTo(gx + gw, gy + gh);
    g.moveTo(gx + gw * 0.15, gy); g.lineTo(gx + gw * 0.85, gy + gh);
    g.moveTo(gx + gw * 0.85, gy); g.lineTo(gx + gw * 0.15, gy + gh);
  }
  g.stroke();
  g.font = p.font;
  g.textBaseline = 'middle';
  g.textAlign = 'left';
  g.fillText(p.text, gx + gw + p.height * 0.12, p.height / 2 + 0.5);
  return c;
}
