/**
 * The jar's glass art for the GPU board (sprint 19 S2), drawn once per layout on 2D canvases and
 * used as textures: the almost clear back, the soft matte front (a faint rim, one gentle highlight,
 * a thin outline and a frosted thick base, D162), the contact shadow, and the "?" on hidden sand. Drawn for Strata from the jar's own
 * geometry; no image files. Canvas space is jar-local CSS px (origin at the interior's bottom centre)
 * scaled by `res`, shifted by `ART_PAD`.
 */
import type { JarGeometry } from './geometry';

/** Room around the jar in the art canvases, in CSS px (rim flange, rim light, blur). */
export const ART_PAD = 6;

/** The art canvases for one jar size, with where their top-left sits in jar-local space. */
export interface JarArt {
  readonly back: HTMLCanvasElement;
  readonly front: HTMLCanvasElement;
  readonly shadow: HTMLCanvasElement;
  /** Jar-local position of the back and front canvases' top-left corner. */
  readonly left: number;
  readonly top: number;
  /** The CSS size of the back/front canvases. */
  readonly width: number;
  readonly height: number;
  /** The shadow canvas's CSS size; it is centred under the base. */
  readonly shadowWidth: number;
  readonly shadowHeight: number;
  /** The interior's bottom corner radius, in CSS px (the sand mask uses it too). */
  readonly innerRadius: number;
}

/** Rim flange height for a jar. */
function rimHeight(g: JarGeometry): number {
  return Math.max(4, Math.min(7, g.glass.width * 0.085));
}

/** The interior's bottom corner radius. */
export function innerRadius(g: JarGeometry): number {
  return Math.min(g.innerWidth * 0.24, 14);
}

function canvas(w: number, h: number, res: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * res));
  c.height = Math.max(1, Math.ceil(h * res));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('No 2D canvas');
  ctx.scale(res, res);
  return [c, ctx];
}

/** A rounded rectangle path with separate top and bottom radii. */
function rr(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, rTop: number, rBot: number): void {
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

/**
 * The glass's colours, resolved from the scene's tokens and the worn glass piece (style.css: the
 * `--style-*` properties of `[data-glass]`, over `--glass-edge` and `--glass`), so the outline reads
 * on light and dark scenes and each piece keeps its tint. Any CSS colour string.
 */
export interface GlassLook {
  /** The outline. */
  readonly edge: string;
  /** The glass body: the tint seen through empty glass. */
  readonly body: string;
  /** A faint band at the wall beside the sand (`transparent` for clear glass). */
  readonly band: string;
  /** The rim flange. */
  readonly rim: string;
  /** The contact shadow's colour, and a night scene (darker, stronger shadow). */
  readonly shadow: string;
  readonly night: boolean;
}

/** Clear glass on a daylight scene: today's tokens. */
export const DEFAULT_LOOK: GlassLook = {
  edge: 'rgba(90,70,50,0.55)', body: 'rgba(255,255,255,0.38)', band: 'transparent', rim: 'rgba(255,255,255,0.38)', shadow: 'rgb(60,44,24)', night: false,
};

/**
 * Draws the art for jars of geometry `g` at `res` device pixels per CSS px, in `look`. A funnel's glass
 * gets the DOM's faint horizontal stripes and dashed sides.
 */
export function drawJarArt(g: JarGeometry, res: number, look: GlassLook = DEFAULT_LOOK, funnel = false): JarArt {
  const iw = g.innerWidth;
  const ih = g.innerHeight;
  const ox = iw / 2 + g.wall;
  const rim = rimHeight(g);
  const rb = innerRadius(g);
  const rbo = rb + g.wall * 0.8;
  const left = -ox - ART_PAD;
  const top = -ih - rim - ART_PAD;
  const width = 2 * (ox + ART_PAD);
  const height = ih + rim + g.base + 2 * ART_PAD;
  const inner = (c: CanvasRenderingContext2D) => rr(c, -iw / 2, -ih, iw, ih, 0, rb);
  const outer = (c: CanvasRenderingContext2D) => rr(c, -ox, -ih, ox * 2, ih + g.base, 2, rbo);

  // Behind the sand: almost clear glass, the faintest cool tint (strata-bcr: empty glass must not look milky).
  const [back, b] = canvas(width, height, res);
  b.translate(-left, -top);
  b.beginPath();
  inner(b);
  b.save();
  b.globalAlpha = 0.2; // the body token is the DOM's whole glass fill; here it is only a breath of tint
  b.fillStyle = look.body;
  b.fill();
  b.restore();
  if (funnel) {
    // The funnel's glass: faint brown stripes, 6 px on, 6 px off (style.css `.funnel .glass`).
    b.save();
    b.clip();
    b.fillStyle = 'rgba(122,80,56,0.08)';
    for (let y = 0; y < ih + 12; y += 12) b.fillRect(-iw / 2, -y - 6, iw, 6);
    b.restore();
  }

  // In front of the sand: soft, frosted, matte glass (D162). The sand is the star.
  const [front, f] = canvas(width, height, res);
  f.translate(-left, -top);
  // 1. A little roundness on the sand: softly darker at the sides and the foot. No gloss.
  f.save();
  f.beginPath();
  inner(f);
  f.clip();
  let gr = f.createLinearGradient(-iw / 2, 0, iw / 2, 0);
  gr.addColorStop(0, 'rgba(30,38,44,0.12)');
  gr.addColorStop(0.2, 'rgba(30,38,44,0)');
  gr.addColorStop(0.75, 'rgba(30,38,44,0)');
  gr.addColorStop(1, 'rgba(30,38,44,0.16)');
  f.fillStyle = gr;
  f.fillRect(-iw / 2, -ih, iw, ih);
  const foot = Math.min(18, ih * 0.1);
  gr = f.createLinearGradient(0, -foot, 0, 0);
  gr.addColorStop(0, 'rgba(30,38,44,0)');
  gr.addColorStop(1, 'rgba(30,38,44,0.12)');
  f.fillStyle = gr;
  f.fillRect(-iw / 2, -foot, iw, foot);
  f.restore();

  // 2. The wall and base: an even frosted film, a touch lighter at the foot where the glass is thick.
  f.beginPath();
  outer(f);
  inner(f);
  f.save();
  f.globalAlpha = 0.75;
  f.fillStyle = look.rim;
  f.fill('evenodd');
  f.restore();
  f.save();
  f.beginPath();
  outer(f);
  f.clip();
  gr = f.createLinearGradient(0, 0, 0, g.base);
  gr.addColorStop(0, 'rgba(240,246,246,0.1)');
  gr.addColorStop(1, 'rgba(240,246,246,0.38)');
  f.fillStyle = gr;
  f.fillRect(-ox, 0, ox * 2, g.base);
  f.restore();

  // 3. The outline: a thin dark edge (reads on light scenes) with a faint light line inside it
  // (reads on dark scenes), and the inner edge, so the wall has a little thickness.
  f.beginPath();
  outer(f);
  f.strokeStyle = look.edge;
  f.lineWidth = 1.3;
  if (funnel) {
    // Dashed sides, a solid foot and top, as the DOM's `border-style: solid dashed`.
    f.save();
    f.setLineDash([4, 3]);
    f.stroke();
    f.restore();
  } else f.stroke();
  // The worn piece's band at the wall, beside the sand.
  f.save();
  f.beginPath();
  inner(f);
  f.clip();
  f.fillStyle = look.band;
  f.fillRect(-iw / 2, -ih, Math.max(1.5, iw * 0.06), ih);
  f.fillRect(iw / 2 - Math.max(1.5, iw * 0.06), -ih, Math.max(1.5, iw * 0.06), ih);
  f.restore();
  f.beginPath();
  rr(f, -ox + 1, -ih + 1, ox * 2 - 2, ih + g.base - 2, 2, rbo - 1);
  f.strokeStyle = 'rgba(255,255,255,0.3)';
  f.lineWidth = 0.9;
  f.stroke();
  f.beginPath();
  inner(f);
  f.save();
  f.globalAlpha = 0.4;
  f.strokeStyle = look.edge;
  f.lineWidth = 0.8;
  f.stroke();
  f.restore();

  // 4. A faint rim and the front of the opening.
  f.beginPath();
  rr(f, -ox - 1.5, -ih - rim * 0.3, (ox + 1.5) * 2, rim, rim * 0.45, rim * 0.45);
  f.fillStyle = look.rim;
  f.fill();
  f.strokeStyle = look.edge;
  f.lineWidth = 1;
  f.stroke();
  f.beginPath();
  f.ellipse(0, -ih + rim * 0.7, iw / 2, rim * 0.4, 0, 0, Math.PI);
  f.strokeStyle = 'rgba(255,255,255,0.3)';
  f.lineWidth = 0.9;
  f.stroke();

  // 5. One gentle highlight: a soft, wide, low band down the lit side.
  f.save();
  f.filter = 'blur(2px)';
  const sw = Math.max(4, iw * 0.13);
  gr = f.createLinearGradient(0, -ih + 12, 0, -foot);
  gr.addColorStop(0, 'rgba(255,255,255,0.2)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.1)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  f.fillStyle = gr;
  f.beginPath();
  rr(f, -iw / 2 + iw * 0.1, -ih + 12, sw, ih * 0.7, sw / 2, sw / 2);
  f.fill();
  f.restore();

  // The contact shadow under the base: a soft cast shadow and a dark core.
  const shadowWidth = width * 1.5;
  const shadowHeight = Math.max(10, width * 0.36);
  const [shadow, s] = canvas(shadowWidth, shadowHeight, res);
  s.translate(shadowWidth / 2, shadowHeight / 2);
  s.save();
  s.translate(width * 0.06, 0);
  s.scale(1, shadowHeight / shadowWidth);
  // The shadow takes the scene's ink; at night it is darker and a little stronger, so it still reads.
  const k = look.night ? 1.6 : 1;
  s.globalAlpha = Math.min(1, 0.3 * k);
  gr = s.createRadialGradient(0, 0, 0, 0, 0, shadowWidth / 2);
  gr.addColorStop(0, look.shadow);
  gr.addColorStop(0.55, withAlpha(look.shadow, 0.4));
  gr.addColorStop(1, withAlpha(look.shadow, 0));
  s.fillStyle = gr;
  s.fillRect(-shadowWidth / 2, -shadowWidth / 2, shadowWidth, shadowWidth);
  s.restore();
  s.save();
  s.scale(1, (shadowHeight * 0.55) / ox / 2);
  s.globalAlpha = Math.min(1, 0.42 * k);
  gr = s.createRadialGradient(0, 0, 0, 0, 0, ox * 1.1);
  gr.addColorStop(0, look.shadow);
  gr.addColorStop(1, withAlpha(look.shadow, 0));
  s.fillStyle = gr;
  s.fillRect(-ox * 1.2, -ox * 1.2, ox * 2.4, ox * 2.4);
  s.restore();

  return { back, front, shadow, left, top, width, height, shadowWidth, shadowHeight, innerRadius: rb };
}

/** `color` (any CSS colour a 2D canvas reads) at `alpha`, through the canvas's own colour parser. */
export function withAlpha(color: string, alpha: number): string {
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return color;
  c.fillStyle = '#000';
  c.fillStyle = color;
  const v = String(c.fillStyle);
  const hex = /^#([0-9a-f]{6})$/i.exec(v);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
  }
  const m = /rgba?\(([^)]+)\)/.exec(v);
  if (m) {
    const [r, g, b] = m[1].split(',').map((x) => parseFloat(x));
    return `rgba(${r},${g},${b},${alpha})`;
  }
  return color;
}

/** The "?" on a hidden unit, as today's DOM draws it: bold, `unitHeight × 0.55`, soft ink. */
export function drawMark(unitHeight: number, res: number): HTMLCanvasElement {
  const size = Math.max(8, unitHeight);
  const [c, g] = canvas(size, size, res);
  const font = getComputedStyle(document.body).fontFamily || 'system-ui, sans-serif';
  g.font = `800 ${Math.round(unitHeight * 0.55)}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(255,250,240,0.35)';
  g.fillText('?', size / 2 + 0.6, size / 2 + 0.8);
  g.fillStyle = 'rgba(74,59,44,0.6)';
  g.fillText('?', size / 2, size / 2);
  return c;
}
