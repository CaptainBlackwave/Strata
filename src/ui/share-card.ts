/**
 * Draws the share picture (sprint 14 H2, design/gdd/sharing.md §3.1) from its pure plan
 * (logic/share-card.ts) with the canvas API: the scene's sky and sea, a card with the result,
 * three small sealed jars and the game's address. Text sits only on the card colour, where it
 * reaches 4.5:1 in every scene (tests/unit/share/share-card.test.ts).
 */
import type { CardJar, CardPlan } from './logic/share-card';
import { t } from './strings';

const FONT = "ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, -apple-system, sans-serif";

/** One colour-blind pattern as a canvas tile, after `.pat-N` in style.css (scaled up for the card). */
interface PatternSpec {
  readonly kind: 'lines' | 'dots' | 'checker' | 'grid' | 'rings' | 'cross';
  readonly light: boolean;
  readonly angle?: number;
  readonly line?: number;
  readonly gap?: number;
  readonly size?: number;
  readonly r?: number;
  readonly alpha: number;
}

/** `.pat-0` … `.pat-13`, in order (config-schema.test.ts keeps the palette and the CSS the same length). */
const PATTERNS: readonly PatternSpec[] = [
  { kind: 'lines', light: true, angle: 0, line: 2, gap: 7, alpha: 0.45 },
  { kind: 'dots', light: false, size: 8, r: 1.8, alpha: 0.35 },
  { kind: 'lines', light: true, angle: 45, line: 2, gap: 7, alpha: 0.5 },
  { kind: 'lines', light: false, angle: -45, line: 2, gap: 7, alpha: 0.3 },
  { kind: 'lines', light: true, angle: 90, line: 2, gap: 7, alpha: 0.5 },
  { kind: 'checker', light: true, size: 10, alpha: 0.3 },
  { kind: 'grid', light: false, line: 1.5, gap: 6, alpha: 0.3 },
  { kind: 'rings', light: false, size: 10, r: 3, alpha: 0.3 },
  { kind: 'cross', light: true, line: 1.5, gap: 6, alpha: 0.4 },
  { kind: 'lines', light: false, angle: 0, line: 5, gap: 10, alpha: 0.28 },
  { kind: 'dots', light: true, size: 11, r: 2.7, alpha: 0.6 },
  { kind: 'lines', light: true, angle: 90, line: 5, gap: 10, alpha: 0.4 },
  { kind: 'lines', light: false, angle: 30, line: 2, gap: 8, alpha: 0.3 },
  { kind: 'dots', light: false, size: 12, r: 2.9, alpha: 0.42 },
];
/** The card's jars are about this many times the size of a jar on the board. */
const PATTERN_SCALE = 2.5;

/** A repeating fill for pattern `index`, or null if the browser can't make one. */
function patternFill(ctx: CanvasRenderingContext2D, index: number): CanvasPattern | null {
  const p = PATTERNS[index % PATTERNS.length];
  const s = PATTERN_SCALE;
  const tile = document.createElement('canvas');
  const step = ((p.gap ?? p.size ?? 8) as number) * s;
  tile.width = tile.height = Math.round(step * 2);
  const c = tile.getContext('2d');
  if (!c) return null;
  c.fillStyle = c.strokeStyle = p.light ? `rgba(255,255,255,${p.alpha})` : `rgba(0,0,0,${p.alpha})`;
  const n = tile.width;
  if (p.kind === 'dots' || p.kind === 'rings') {
    for (const [x, y] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
      c.beginPath();
      c.arc(x * n, y * n, (p.r ?? 2) * s, 0, Math.PI * 2);
      if (p.kind === 'rings') {
        c.lineWidth = 1.2 * s;
        c.stroke();
      } else c.fill();
    }
  } else if (p.kind === 'checker') {
    const h = n / 2;
    c.fillRect(0, 0, h, h);
    c.fillRect(h, h, h, h);
  } else {
    c.lineWidth = (p.line ?? 2) * s;
    const angles = p.kind === 'grid' ? [0, 90] : p.kind === 'cross' ? [45, -45] : [p.angle ?? 0];
    for (const a of angles) {
      c.save();
      c.translate(n / 2, n / 2);
      c.rotate((a * Math.PI) / 180);
      for (let o = -n * 2; o <= n * 2; o += step) {
        c.beginPath();
        c.moveTo(-n * 2, o);
        c.lineTo(n * 2, o);
        c.stroke();
      }
      c.restore();
    }
  }
  return ctx.createPattern(tile, 'repeat');
}

/** A rounded rectangle path. */
function rounded(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | [number, number, number, number]): void {
  const [tl, tr, br, bl] = typeof r === 'number' ? [r, r, r, r] : r;
  ctx.beginPath();
  ctx.moveTo(x + tl, y);
  ctx.arcTo(x + w, y, x + w, y + h, tr);
  ctx.arcTo(x + w, y + h, x, y + h, br);
  ctx.arcTo(x, y + h, x, y, bl);
  ctx.arcTo(x, y, x + w, y, tl);
  ctx.closePath();
}

/** Writes `text` centred at `y`, shrinking the font until it fits `max` pixels wide. */
function fitText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, size: number, weight: number, color: string): void {
  let px = size;
  do {
    ctx.font = `${weight} ${px}px ${FONT}`;
    px -= 2;
  } while (ctx.measureText(text).width > max && px > 12);
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
}

/** One sealed jar: glass, its sand (patterned when Colour patterns is on) and a cork. */
function drawJar(ctx: CanvasRenderingContext2D, jar: CardJar, x: number, y: number, w: number, h: number, glass: string, edge: string): void {
  const bottom: [number, number, number, number] = [w * 0.16, w * 0.16, w * 0.48, w * 0.48];
  rounded(ctx, x, y, w, h, bottom);
  ctx.fillStyle = glass;
  ctx.fill();
  const pad = w * 0.1;
  const sandTop = y + h * 0.14;
  rounded(ctx, x + pad, sandTop, w - pad * 2, y + h - pad - sandTop, [6, 6, w * 0.38, w * 0.38]);
  ctx.fillStyle = jar.hex;
  ctx.fill();
  if (jar.pattern !== null) {
    const fill = patternFill(ctx, jar.pattern);
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
  }
  rounded(ctx, x, y, w, h, bottom);
  ctx.lineWidth = w * 0.06;
  ctx.strokeStyle = edge;
  ctx.stroke();
  // The cork, as on a sealed jar in play (style.css .cork).
  const cw = w * 0.64;
  rounded(ctx, x + (w - cw) / 2, y - w * 0.2, cw, w * 0.34, 8);
  ctx.fillStyle = '#c99a5b';
  ctx.fill();
  ctx.lineWidth = w * 0.045;
  ctx.strokeStyle = '#8a6136';
  ctx.stroke();
}

/** Draws `plan` on a new canvas of its size. Returns null when the browser has no 2D canvas. */
export function drawCard(plan: CardPlan): HTMLCanvasElement | null {
  const canvas = document.createElement('canvas');
  canvas.width = plan.width;
  canvas.height = plan.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const { width: W, height: H, colors: c } = plan;

  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, c.bgTop);
  sky.addColorStop(1, c.bgBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  ctx.beginPath();
  ctx.ellipse(W / 2, H + H * 0.06, W * 0.85, H * 0.27, 0, 0, Math.PI * 2);
  ctx.fillStyle = c.sea;
  ctx.fill();

  // The card with the result.
  const cx = W * 0.083;
  const cy = H * 0.085;
  const cw = W - cx * 2;
  const ch = H * 0.555;
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 8;
  rounded(ctx, cx, cy, cw, ch, 48);
  ctx.fillStyle = c.card;
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  const mid = W / 2;
  const max = cw - 100;
  ctx.font = `800 40px ${FONT}`;
  ctx.fillStyle = c.inkSoft;
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '10px';
  ctx.fillText(t.shareCard.brand, mid + 5, cy + 100);
  if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
  fitText(ctx, plan.headline, mid, cy + 200, max, 72, 800, c.ink);
  fitText(ctx, plan.sub, mid, cy + 272, max, 46, 700, c.accentText);
  const [first, ...rest] = plan.lines;
  if (first) fitText(ctx, first, mid, cy + 410, max, 88, 800, c.ink);
  rest.forEach((line, i) => fitText(ctx, line, mid, cy + 490 + i * 66, max, 50, 700, c.inkSoft));
  if (plan.name) fitText(ctx, plan.name, mid, cy + ch - 120, max, 40, 700, c.inkSoft);
  fitText(ctx, plan.address, mid, cy + ch - 54, max, 36, 700, c.accentText);

  // Three small sealed jars on the shore.
  const n = plan.jars.length;
  const jw = W * 0.14;
  const jh = jw * 1.85;
  const gap = jw * 0.45;
  const total = n * jw + (n - 1) * gap;
  const jy = H - jh - H * 0.07;
  plan.jars.forEach((jar, i) => drawJar(ctx, jar, (W - total) / 2 + i * (jw + gap), jy, jw, jh, c.glass, c.glassEdge));
  return canvas;
}

/** The plan drawn as a PNG, or null when the browser can't draw or encode it. */
export function cardBlob(plan: CardPlan): Promise<Blob | null> {
  const canvas = drawCard(plan);
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}
