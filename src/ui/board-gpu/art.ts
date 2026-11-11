/**
 * The jar's glass art for the GPU board (sprint 19 S2), drawn once per layout on 2D canvases and
 * used as textures: the tinted back, the lit front (rim light, inner shadow, highlight streak, thick
 * base), the contact shadow, and the "?" on hidden sand. Drawn for Strata from the jar's own
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

/** Draws the art for jars of geometry `g` at `res` device pixels per CSS px. */
export function drawJarArt(g: JarGeometry, res: number): JarArt {
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

  // Behind the sand: a faint tint of glass and the dark back of the opening.
  const [back, b] = canvas(width, height, res);
  b.translate(-left, -top);
  b.beginPath();
  inner(b);
  let gr = b.createLinearGradient(-iw / 2, 0, iw / 2, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.22)');
  gr.addColorStop(0.45, 'rgba(214,236,236,0.08)');
  gr.addColorStop(1, 'rgba(70,105,115,0.1)');
  b.fillStyle = gr;
  b.fill();
  b.beginPath();
  b.ellipse(0, -ih + rim * 0.7, iw / 2, rim * 0.45, 0, 0, Math.PI * 2);
  b.fillStyle = 'rgba(40,62,70,0.16)';
  b.fill();

  // In front of the sand.
  const [front, f] = canvas(width, height, res);
  f.translate(-left, -top);
  // 1. Light on the sand through a cylinder: dark edges, a lit left, a darker base and an inner shadow under the rim.
  f.save();
  f.beginPath();
  inner(f);
  f.clip();
  gr = f.createLinearGradient(-iw / 2, 0, iw / 2, 0);
  gr.addColorStop(0, 'rgba(20,30,40,0.2)');
  gr.addColorStop(0.16, 'rgba(20,30,40,0)');
  gr.addColorStop(0.66, 'rgba(20,30,40,0)');
  gr.addColorStop(1, 'rgba(20,30,40,0.26)');
  f.fillStyle = gr;
  f.fillRect(-iw / 2, -ih, iw, ih);
  gr = f.createLinearGradient(-iw / 2, -ih, iw / 2, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.14)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.08)');
  f.fillStyle = gr;
  f.fillRect(-iw / 2, -ih, iw, ih);
  const foot = Math.min(22, ih * 0.14);
  gr = f.createLinearGradient(0, -foot, 0, 0);
  gr.addColorStop(0, 'rgba(20,30,40,0)');
  gr.addColorStop(1, 'rgba(20,30,40,0.2)');
  f.fillStyle = gr;
  f.fillRect(-iw / 2, -foot, iw, foot);
  const lip = Math.min(14, ih * 0.1);
  gr = f.createLinearGradient(0, -ih, 0, -ih + lip);
  gr.addColorStop(0, 'rgba(20,30,40,0.24)');
  gr.addColorStop(1, 'rgba(20,30,40,0)');
  f.fillStyle = gr;
  f.fillRect(-iw / 2, -ih, iw, lip);
  f.restore();

  // 2. The glass wall (outer minus inner) and its thick base.
  f.beginPath();
  outer(f);
  inner(f);
  gr = f.createLinearGradient(-ox, 0, ox, 0);
  gr.addColorStop(0, 'rgba(250,255,255,0.78)');
  gr.addColorStop(0.5, 'rgba(196,224,228,0.42)');
  gr.addColorStop(1, 'rgba(150,186,194,0.66)');
  f.fillStyle = gr;
  f.fill('evenodd');
  f.save();
  f.beginPath();
  outer(f);
  f.clip();
  gr = f.createLinearGradient(0, 0, 0, g.base);
  gr.addColorStop(0, 'rgba(255,255,255,0.2)');
  gr.addColorStop(1, 'rgba(255,255,255,0.75)');
  f.fillStyle = gr;
  f.fillRect(-ox, 0, ox * 2, g.base);
  f.restore();

  // 3. The silhouette: a dark edge so the glass reads on the pale beach, and a rim light over it.
  f.beginPath();
  outer(f);
  f.strokeStyle = 'rgba(62,82,90,0.5)';
  f.lineWidth = 1.4;
  f.stroke();
  f.beginPath();
  rr(f, -ox + 0.9, -ih + 0.9, ox * 2 - 1.8, ih + g.base - 1.8, 2, rbo - 0.9);
  gr = f.createLinearGradient(-ox, -ih, ox, 0);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.5, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0.22)');
  f.strokeStyle = gr;
  f.lineWidth = 1.2;
  f.stroke();
  // The inner edge: a light and dark pair gives the wall its thickness.
  f.beginPath();
  inner(f);
  gr = f.createLinearGradient(-iw / 2, 0, iw / 2, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.6)');
  gr.addColorStop(0.5, 'rgba(30,55,65,0.22)');
  gr.addColorStop(1, 'rgba(30,50,60,0.4)');
  f.strokeStyle = gr;
  f.lineWidth = 1;
  f.stroke();

  // 4. The rim flange and the front arc of the opening.
  f.beginPath();
  rr(f, -ox - 2, -ih - rim * 0.3, (ox + 2) * 2, rim, rim * 0.45, rim * 0.45);
  gr = f.createLinearGradient(-ox, 0, ox, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0.92)');
  gr.addColorStop(0.5, 'rgba(220,240,244,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0.66)');
  f.fillStyle = gr;
  f.fill();
  f.strokeStyle = 'rgba(62,82,90,0.48)';
  f.lineWidth = 1;
  f.stroke();
  f.beginPath();
  f.ellipse(0, -ih + rim * 0.7, iw / 2 + 0.5, rim * 0.45, 0, 0, Math.PI);
  f.strokeStyle = 'rgba(255,255,255,0.72)';
  f.lineWidth = 1.1;
  f.stroke();

  // 5. Highlight streaks, softly blurred.
  f.save();
  f.filter = 'blur(0.9px)';
  const sw = Math.max(3, iw * 0.09);
  gr = f.createLinearGradient(0, -ih + 10, 0, -foot);
  gr.addColorStop(0, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.7, 'rgba(255,255,255,0.36)');
  gr.addColorStop(1, 'rgba(255,255,255,0.04)');
  f.fillStyle = gr;
  f.beginPath();
  rr(f, -iw / 2 + iw * 0.08, -ih + 10, sw, ih * 0.78, sw / 2, sw / 2);
  f.fill();
  f.beginPath();
  f.ellipse(-iw / 2 + iw * 0.08 + sw / 2, -ih + 6, sw * 0.55, sw * 0.35, 0, 0, Math.PI * 2);
  f.fillStyle = 'rgba(255,255,255,0.95)';
  f.fill();
  f.fillStyle = 'rgba(255,255,255,0.3)';
  f.beginPath();
  rr(f, iw / 2 - iw * 0.13, -ih + ih * 0.16, sw * 0.4, ih * 0.58, sw * 0.2, sw * 0.2);
  f.fill();
  f.restore();
  // The base's reflection line.
  f.beginPath();
  f.moveTo(-iw / 2 + rb * 0.8, g.base * 0.45);
  f.lineTo(iw / 2 - rb * 0.8, g.base * 0.45);
  f.strokeStyle = 'rgba(255,255,255,0.65)';
  f.lineWidth = 1.1;
  f.stroke();

  // The contact shadow under the base: a soft cast shadow and a dark core.
  const shadowWidth = width * 1.5;
  const shadowHeight = Math.max(10, width * 0.36);
  const [shadow, s] = canvas(shadowWidth, shadowHeight, res);
  s.translate(shadowWidth / 2, shadowHeight / 2);
  s.save();
  s.translate(width * 0.06, 0);
  s.scale(1, shadowHeight / shadowWidth);
  gr = s.createRadialGradient(0, 0, 0, 0, 0, shadowWidth / 2);
  gr.addColorStop(0, 'rgba(60,44,24,0.3)');
  gr.addColorStop(0.55, 'rgba(60,44,24,0.12)');
  gr.addColorStop(1, 'rgba(60,44,24,0)');
  s.fillStyle = gr;
  s.fillRect(-shadowWidth / 2, -shadowWidth / 2, shadowWidth, shadowWidth);
  s.restore();
  s.save();
  s.scale(1, (shadowHeight * 0.55) / ox / 2);
  gr = s.createRadialGradient(0, 0, 0, 0, 0, ox * 1.1);
  gr.addColorStop(0, 'rgba(40,28,14,0.42)');
  gr.addColorStop(1, 'rgba(40,28,14,0)');
  s.fillStyle = gr;
  s.fillRect(-ox * 1.2, -ox * 1.2, ox * 2.4, ox * 2.4);
  s.restore();

  return { back, front, shadow, left, top, width, height, shadowWidth, shadowHeight, innerRadius: rb };
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
