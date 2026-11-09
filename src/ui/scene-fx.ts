/**
 * Animated scene layers (design/gdd/scenes.md 2.1a, sprint 7 B5 and sprint 8 P1): falling snow,
 * rising lanterns, New Year fireworks, soft rain, winter lights, meteors and aurora bands, drawn
 * on one canvas behind all UI.
 *
 * Rules every layer follows (scenes.md "Rules for every animated layer"):
 * - The canvas sits at `z-index: -1` inside the home screen while it is shown, and behind
 *   `#app` otherwise, so it is never above the board, toolbar or dialogs. It takes no input.
 * - Under `prefers-reduced-motion` it draws one still frame and never animates or bursts.
 * - It stops while `document.hidden` and restarts when the page is shown again.
 * - At most 30 frames a second and {@link MAX_PARTICLES} particles, bursts included.
 * - Bursts are queued for the next frame, so reactions never delay input.
 * Colour-only scenes (tier 1) have no layer here; their decoration is static CSS.
 */

/** Hard cap on live particles across ambient and burst particles. */
export const MAX_PARTICLES = 60;
const FRAME_MS = 1000 / 30;

type LayerKind = 'snow' | 'lanterns' | 'fireworks' | 'rain' | 'lights' | 'meteors' | 'aurora';

/** The scenes that have an animated layer, by scene id. */
const LAYERS: Readonly<Record<string, LayerKind>> = {
  wintersnow: 'snow',
  harvestmoon: 'lanterns',
  newyear: 'fireworks',
  softrain: 'rain',
  winterlights: 'lights',
  meteorshower: 'meteors',
  auroranight: 'aurora',
};

/** Meteors travel down and to the left (a unit vector). */
const METEOR_DIR = { x: -0.86, y: 0.51 } as const;
/** Ambient meteors are this colour; seal meteors take the jar's sand colour. */
const STARLIGHT = '#eef1ff';
/** Aurora night: three bands (height as a share of the screen, thickness px, sway px, colour as `r, g, b`). */
const BANDS = [
  { at: 0.1, thick: 110, sway: 16, rgb: '95, 214, 168' },
  { at: 0.18, thick: 90, sway: 22, rgb: '120, 200, 220' },
  { at: 0.26, thick: 70, sway: 14, rgb: '160, 130, 230' },
] as const;
/** Aurora night: slices per band (3 x 16 = 48 of the 60-particle budget; ripples use the rest). */
const AURORA_COLS = 16;
const MAX_RIPPLES = 4;

/** Winter lights: the bulb colours, cycled along the string. */
const BULBS = ['#ffd27a', '#ff9a85', '#a6e3c4', '#9cc4ff'] as const;
/** Winter lights: how many swags the string hangs in, and how many bulbs in all. */
const SWAGS = 3;
const BULB_COUNT = 18;
/**
 * Winter lights (sprint 9 M1, D54): the string hangs just under the top HUD row, never behind
 * it. A bulb's glow reaches 8 px above the wire, so the hooks sit this far below the HUD's
 * bottom edge, and the swags dip at most {@link MAX_SAG} px, less if the jars start sooner.
 */
const HUD_CLEAR = 10;
const MAX_SAG = 16;
const MIN_SAG = 6;

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  phase: number;
  /** Seconds left for burst sparks; Infinity for ambient particles. */
  life: number;
  color: string;
  /** Meteor shower seal meteors: drawn wider, with a halo and a white core (sprint 9 M1). */
  bold?: boolean;
}

/**
 * Seal reactions (sprint 9 M1, D54: brighter, a little larger, still short).
 * Meteor shower: one meteor per seal; speed px/s, tail px, life s, stroke width px.
 */
const SEAL_METEOR = { speed: 300, tail: 125, life: 0.9, width: 3 } as const;
/** Aurora night: one ripple per seal; life s, ring speed px/s, peak gain, ring width (2 sigma squared, px squared), max alpha. */
const SEAL_RIPPLE = { life: 1.6, speed: 260, gain: 2.2, spread: 16200, maxAlpha: 0.85 } as const;

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let kind: LayerKind | null = null;
let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let ambient: Particle[] = [];
let sparks: Particle[] = [];
let raf = 0;
let last = 0;
let clock = 0;
let w = 0;
let h = 0;
let lantern: HTMLCanvasElement | null = null;
const bulbSprites = new Map<string, HTMLCanvasElement>();
const auroraSprites = new Map<string, HTMLCanvasElement>();
let nextMeteor = 0;
let wired = false;
/** Winter lights: the wire's height at the hooks and its deepest dip below them, from {@link hangString}. */
let hookY = 14;
let sag = MAX_SAG;
let hudWatch: ResizeObserver | null = null;

/**
 * Starts the layer for scene `id`, or stops the current one if the scene has none.
 * Calling it again with the scene already running does nothing.
 */
export function startSceneFx(id: string): void {
  const next = LAYERS[id] ?? null;
  if (next === kind && (next === null || canvas)) return;
  stopSceneFx();
  kind = next;
  if (!kind) return;
  wire();
  canvas = document.createElement('canvas');
  canvas.className = 'scene-fx';
  canvas.setAttribute('aria-hidden', 'true');
  ctx = canvas.getContext('2d');
  mount();
  resize();
  seed();
  if (kind === 'lights') watchHud();
  resume();
}

/** Removes the layer and stops its frame loop. */
export function stopSceneFx(): void {
  cancelAnimationFrame(raf);
  raf = 0;
  hudWatch?.disconnect();
  hudWatch = null;
  canvas?.remove();
  canvas = null;
  ctx = null;
  kind = null;
  ambient = [];
  sparks = [];
}

/** The id of the running layer, for QA (`null` when the scene has none). */
export function sceneFxKind(): string | null {
  return kind;
}

/**
 * The tier 3 reaction when a jar seals, queued for the next frame: New Year, a small burst
 * above the jar in its sand colour; Meteor shower, one bold meteor (halo and white core)
 * streaking just over the jar in that colour for 0.9 s; Aurora night, a bright ripple
 * spreading along the bands from the jar for 1.6 s. Nothing for other scenes or under
 * reduced motion. Each is one particle against the MAX_PARTICLES cap.
 */
export function sceneSealBurst(jar: Element, color: string): void {
  if (reduced() || (kind !== 'fireworks' && kind !== 'meteors' && kind !== 'aurora')) return;
  const r = jar.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  if (kind === 'fireworks') queueBurst(cx, r.top - 6, [color, '#fff6d8'], 14, 70);
  else if (kind === 'meteors') {
    // Starts up and to the right so the head crosses just above the jar's mouth about halfway through.
    const m = SEAL_METEOR;
    queueMeteor({ ...newMeteor(cx + 115, r.top - 125, color, m.speed, m.tail, m.life), bold: true });
  } else if (canvas && sparks.length < MAX_RIPPLES && ambient.length + sparks.length < MAX_PARTICLES)
    sparks.push({ x: cx, y: 0, vx: 0, vy: 0, r: 0, phase: SEAL_RIPPLE.life, life: SEAL_RIPPLE.life, color: '' });
}

/**
 * The fuller display when the win card opens (New Year only, owner decision 2026-11-08):
 * a short burst on its own canvas inside the win overlay, above its dimmed backdrop and
 * below the card, so the card's text is never covered. It lasts about 3.5 s, then the
 * canvas removes itself. Same limits as the ambient layer: no more than MAX_PARTICLES,
 * 30 fps, nothing under reduced motion, stopped while the page is hidden.
 */
export function sceneWinDisplay(colors: readonly string[]): void {
  if (kind === 'meteors' || kind === 'aurora') return skyWinDisplay(kind, colors);
  if (kind !== 'fireworks' || reduced() || !colors.length || document.hidden) return;
  const host = document.getElementById('win');
  if (!host) return;
  host.querySelector('canvas.scene-fx-win')?.remove();
  const c = document.createElement('canvas');
  c.className = 'scene-fx-win';
  c.setAttribute('aria-hidden', 'true');
  host.prepend(c);
  const g = c.getContext('2d');
  if (!g) return c.remove();
  const W = window.innerWidth;
  const H = window.innerHeight;
  c.width = W;
  c.height = H;
  const parts: Particle[] = [];
  const burst = (x: number, y: number, cols: readonly string[], n: number, speed: number) => {
    for (let i = 0; i < Math.min(n, MAX_PARTICLES - parts.length); i++) {
      const a = (i / n) * Math.PI * 2 + rand(-0.2, 0.2);
      const v = speed * rand(0.55, 1);
      parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(3, 4.6), phase: 0, life: rand(1.1, 1.5), color: cols[i % cols.length] });
    }
  };
  // Five bursts hugging the card (it sits at about 34-66% of the height): three above, two below.
  const spots: readonly (readonly [number, number])[] = [[0.24, 0.26], [0.76, 0.24], [0.5, 0.17], [0.22, 0.76], [0.78, 0.74]];
  // Two rounds of the five spots, 280 ms apart: about 3.5 s in all.
  const SHOTS = spots.length * 2;
  const timers = Array.from({ length: SHOTS }, (_, k) => {
    const [fx, fy] = spots[k % spots.length];
    return window.setTimeout(() => burst(W * fx, H * fy, [colors[k % colors.length], colors[(k + 1) % colors.length], '#fff6d8'], 12, 170), 650 + k * 280);
  });
  let prev = 0;
  let id = 0;
  const started = performance.now();
  const end = () => {
    cancelAnimationFrame(id);
    timers.forEach((t) => window.clearTimeout(t));
    document.removeEventListener('visibilitychange', end);
    c.remove();
  };
  document.addEventListener('visibilitychange', end); // hidden page: stop and clean up
  const tick = (now: number) => {
    id = requestAnimationFrame(tick);
    if (now - started > 650 + SHOTS * 280 + 1700 || !c.isConnected) return end();
    if (prev && now - prev < FRAME_MS - 2) return; // hold to 30 fps
    const dt = prev ? Math.min((now - prev) / 1000, 0.1) : 0;
    prev = now;
    g.clearRect(0, 0, W, H);
    for (let i = parts.length - 1; i >= 0; i--) {
      const s = parts[i];
      s.life -= dt;
      if (s.life <= 0) {
        parts.splice(i, 1);
        continue;
      }
      s.vx *= 1 - 1.6 * dt;
      s.vy = s.vy * (1 - 1.6 * dt) + 60 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const alpha = Math.min(1, s.life * 1.2);
      g.fillStyle = s.color;
      g.globalAlpha = alpha * 0.3; // a soft halo so each spark reads against the dim backdrop
      g.beginPath();
      g.arc(s.x, s.y, s.r * 2.4, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = alpha;
      g.beginPath();
      g.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  };
  id = requestAnimationFrame(tick);
}

/**
 * The tier 3 win display for the sky scenes (sprint 8 P1), on the same terms as New Year's
 * (owner decision D40): its own canvas inside the win overlay, above the dim backdrop and
 * below the card, about 4 s, then it removes itself. Meteor shower: a short shower of a dozen
 * meteors in the board's sand colours above and below the card. Aurora night: the bands drawn
 * above and below the card with a brighter wave sweeping across them. Nothing under reduced
 * motion; stops while the page is hidden; at most 30 fps and MAX_PARTICLES.
 */
function skyWinDisplay(which: 'meteors' | 'aurora', colors: readonly string[]): void {
  if (reduced() || !colors.length || document.hidden) return;
  const host = document.getElementById('win');
  if (!host) return;
  host.querySelector('canvas.scene-fx-win')?.remove();
  const c = document.createElement('canvas');
  c.className = 'scene-fx-win';
  c.setAttribute('aria-hidden', 'true');
  host.prepend(c);
  const g = c.getContext('2d');
  if (!g) return c.remove();
  const W = window.innerWidth;
  const H = window.innerHeight;
  c.width = W;
  c.height = H;
  const TOTAL = which === 'meteors' ? 4200 : 3800;
  const parts: Particle[] = [];
  // Meteor shower: 12 meteors, 230 ms apart, alternating above (4-26%) and below (72-90%) the card.
  const timers =
    which === 'meteors'
      ? Array.from({ length: 12 }, (_, k) =>
          window.setTimeout(() => {
            if (parts.length >= MAX_PARTICLES) return;
            const y = k % 2 ? rand(0.72, 0.9) * H : rand(0.04, 0.26) * H;
            parts.push(newMeteor(rand(0.45, 1.1) * W, y, colors[k % colors.length], rand(300, 420), rand(80, 130), rand(0.8, 1.1)));
          }, 500 + k * 230),
        )
      : [];
  let prev = 0;
  let id = 0;
  const started = performance.now();
  const end = () => {
    cancelAnimationFrame(id);
    timers.forEach((t) => window.clearTimeout(t));
    document.removeEventListener('visibilitychange', end);
    c.remove();
  };
  document.addEventListener('visibilitychange', end); // hidden page: stop and clean up
  const tick = (now: number) => {
    id = requestAnimationFrame(tick);
    const t = now - started;
    if (t > TOTAL || !c.isConnected) return end();
    if (prev && now - prev < FRAME_MS - 2) return; // hold to 30 fps
    const dt = prev ? Math.min((now - prev) / 1000, 0.1) : 0;
    prev = now;
    g.clearRect(0, 0, W, H);
    if (which === 'meteors') {
      for (let i = parts.length - 1; i >= 0; i--) {
        const m = parts[i];
        m.life -= dt;
        if (m.life <= 0) {
          parts.splice(i, 1);
          continue;
        }
        m.x += m.vx * dt;
        m.y += m.vy * dt;
        drawMeteor(g, m, 2.6);
      }
    } else {
      // Fade in over 0.4 s and out over the last 0.6 s; the bright wave crosses in about 3 s.
      const env = Math.max(0, Math.min(1, t / 400, (TOTAL - t) / 600));
      const waveX = (-0.2 + (1.4 * t) / 3000) * W;
      const colW = (W / AURORA_COLS) * 1.7;
      const rows = [0.06, 0.15, 0.76] as const;
      rows.forEach((at, b) => {
        const band = BANDS[b];
        const img = auroraSprite(band.rgb);
        for (let k = 0; k < AURORA_COLS; k++) {
          const x = ((k + 0.5) / AURORA_COLS) * W;
          const d = x - waveX;
          const gain = 1.6 * Math.exp(-(d * d) / (2 * (0.16 * W) ** 2));
          g.globalAlpha = Math.min(0.85, 0.3 * (1 + gain)) * env;
          const sway = Math.sin((x / W) * 4.2 + t * 0.0006 + b) * band.sway;
          g.drawImage(img, x - colW / 2, at * H + sway, colW, band.thick);
        }
      });
      g.globalAlpha = 1;
    }
  };
  id = requestAnimationFrame(tick);
}

// ---- Internals -------------------------------------------------------------

function wire(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('visibilitychange', () => (document.hidden ? pause() : resume()));
  window.addEventListener('resize', () => {
    if (!canvas) return;
    resize();
    if (reduced()) still();
  });
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => {
    if (!canvas) return;
    pause();
    sparks = [];
    resume();
  });
  const home = document.getElementById('home');
  if (home) new MutationObserver(() => canvas && mount()).observe(home, { attributes: true, attributeFilter: ['hidden'] });
}

/** Behind the home screen's content while it shows, else behind the game (`#app`). */
function mount(): void {
  if (!canvas) return;
  const home = document.getElementById('home');
  const parent = home && !home.hidden ? home : document.body;
  if (canvas.parentElement !== parent) parent.prepend(canvas);
  if (kind === 'lights') rehang();
}

/**
 * Winter lights: measures where the string can hang. On Home it sits under the top row
 * (profile chip and Settings); on the board, under the HUD ("Level N", Restart, coins,
 * Settings, pours). The swag depth shrinks if the logo or the jars start close below.
 */
function hangString(): void {
  const home = document.getElementById('home');
  const onHome = !!home && !home.hidden;
  const hud = document.querySelector(onHome ? '#home .home-top' : '.hud');
  const below = document.querySelector(onHome ? '#home .logo-jars' : '#board');
  const hudBottom = hud ? hud.getBoundingClientRect().bottom : 0;
  hookY = Math.round(hudBottom + HUD_CLEAR);
  const room = below ? below.getBoundingClientRect().top - hookY - 16 : MAX_SAG;
  sag = Math.max(MIN_SAG, Math.min(MAX_SAG, room));
}

/** Re-measures the string and, under reduced motion, redraws the one still frame in place. */
function rehang(): void {
  if (kind !== 'lights' || !canvas) return;
  hangString();
  if (reduced()) still();
}

/** Winter lights: re-measure when the HUD or the top row changes size (large text, wrapping, a tag). */
function watchHud(): void {
  if (typeof ResizeObserver === 'undefined') return;
  hudWatch = new ResizeObserver(() => rehang());
  for (const sel of ['.hud', '#home .home-top', '#board']) {
    const el = document.querySelector(sel);
    if (el) hudWatch.observe(el);
  }
}

function resize(): void {
  if (!canvas || !ctx) return;
  // 1x backing store: soft particles need no retina detail, and raster cost scales with pixels (measured, B5 README).
  const dpr = 1;
  const oldW = w;
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  if (oldW && oldW !== w) for (const p of ambient) p.x = (p.x / oldW) * w;
  if (kind === 'lights') hangString();
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function seed(): void {
  ambient = [];
  if (kind === 'snow') {
    for (let i = 0; i < 46; i++) ambient.push({ x: rand(0, w), y: rand(-h * 0.1, h), vx: 0, vy: rand(14, 34), r: rand(1.4, 3.4), phase: rand(0, 6.3), life: Infinity, color: '#ffffff' });
  } else if (kind === 'lanterns') {
    for (let i = 0; i < 12; i++) ambient.push(newLantern(rand(h * 0.2, h * 1.02)));
  } else if (kind === 'fireworks') {
    for (let i = 0; i < 24; i++) ambient.push({ x: rand(0, w), y: rand(0, h * 0.62), vx: 0, vy: 0, r: rand(0.7, 1.6), phase: rand(0, 6.3), life: Infinity, color: i % 3 ? '#fff6d8' : '#e8c15a' });
  } else if (kind === 'rain') {
    // Thin slanted streaks; r is the streak length.
    for (let i = 0; i < 48; i++) {
      const vy = rand(380, 520);
      ambient.push({ x: rand(-0.1 * w, w), y: rand(-h * 0.1, h), vx: vy * 0.16, vy, r: rand(9, 17), phase: 0, life: Infinity, color: '' });
    }
  } else if (kind === 'meteors') {
    for (let i = 0; i < 26; i++) ambient.push({ x: rand(0, w), y: rand(0, h * 0.6), vx: 0, vy: 0, r: rand(0.6, 1.4), phase: rand(0, 6.3), life: Infinity, color: STARLIGHT });
    nextMeteor = 1.2;
  } else if (kind === 'aurora') {
    // Each band is AURORA_COLS overlapping slices; vy holds the band's sway, r its thickness.
    for (const band of BANDS)
      for (let k = 0; k < AURORA_COLS; k++)
        ambient.push({ x: ((k + 0.5) / AURORA_COLS) * w, y: band.at * h, vx: 0, vy: band.sway, r: band.thick, phase: band.at * 20, life: Infinity, color: band.rgb });
  } else if (kind === 'lights') {
    // A string of bulbs hanging in swags just under the top HUD row; each bulb sits just under the wire.
    for (let i = 0; i < BULB_COUNT; i++) ambient.push({ x: ((i + 0.5) / BULB_COUNT) * w, y: 0, vx: 0, vy: 0, r: 1, phase: rand(0, 6.3), life: Infinity, color: BULBS[i % BULBS.length] });
  }
}

/** Winter lights: the wire's height at `x` (three quadratic swags, `hookY` at the hooks, `hookY + sag` at the dips). */
function wireY(x: number): number {
  const span = w / SWAGS;
  const u = (x % span) / span;
  return hookY + 4 * sag * u * (1 - u);
}

/** Lanterns rise along the sides, away from the home screen's centred text. */
function newLantern(y: number): Particle {
  const side = Math.random() < 0.5 ? rand(0.03, 0.22) : rand(0.78, 0.97);
  return { x: side * w, y, vx: 0, vy: -rand(9, 17), r: rand(0.75, 1.1), phase: rand(0, 6.3), life: Infinity, color: '' };
}

/** A meteor whose head starts at (x, y): `r` is its tail length and `phase` its full life. */
function newMeteor(x: number, y: number, color: string, speed: number, tail: number, life: number): Particle {
  return { x, y, vx: METEOR_DIR.x * speed, vy: METEOR_DIR.y * speed, r: tail, phase: life, life, color };
}

function queueMeteor(m: Particle): void {
  if (!canvas || reduced() || ambient.length + sparks.length >= MAX_PARTICLES) return;
  sparks.push(m);
}

/**
 * A meteor's streak: a fading tail behind a bright head, eased in and out over its life.
 * A `bold` meteor (a seal reaction) adds a soft halo along the tail and around the head, and a
 * short white core, so it reads clearly in the jar's colour against the night sky.
 */
function drawMeteor(g: CanvasRenderingContext2D, m: Particle, width: number): void {
  const a = Math.sin(Math.PI * Math.max(0, Math.min(1, 1 - m.life / m.phase)));
  const tx = m.x - METEOR_DIR.x * m.r;
  const ty = m.y - METEOR_DIR.y * m.r;
  const grad = g.createLinearGradient(m.x, m.y, tx, ty);
  grad.addColorStop(0, m.color);
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  g.strokeStyle = grad;
  g.lineCap = 'round';
  if (m.bold) {
    g.globalAlpha = a * 0.3;
    g.lineWidth = width * 3.2;
    g.beginPath();
    g.moveTo(m.x, m.y);
    g.lineTo(tx, ty);
    g.stroke();
    g.fillStyle = m.color;
    g.beginPath();
    g.arc(m.x, m.y, width * 2.6, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = a;
  g.lineWidth = width;
  g.beginPath();
  g.moveTo(m.x, m.y);
  g.lineTo(tx, ty);
  g.stroke();
  if (m.bold) {
    const cx = m.x - METEOR_DIR.x * m.r * 0.45;
    const cy = m.y - METEOR_DIR.y * m.r * 0.45;
    const core = g.createLinearGradient(m.x, m.y, cx, cy);
    core.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
    core.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.strokeStyle = core;
    g.lineWidth = width * 0.5;
    g.beginPath();
    g.moveTo(m.x, m.y);
    g.lineTo(cx, cy);
    g.stroke();
  }
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(m.x, m.y, width * 0.75, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
}

function queueBurst(x: number, y: number, colors: readonly string[], count: number, speed: number): void {
  if (!canvas || reduced()) return;
  const room = MAX_PARTICLES - ambient.length - sparks.length;
  for (let i = 0; i < Math.min(count, room); i++) {
    const a = (i / count) * Math.PI * 2 + rand(-0.2, 0.2);
    const v = speed * rand(0.55, 1);
    sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: rand(1.4, 2.4), phase: 0, life: rand(0.7, 1.1), color: colors[i % colors.length] });
  }
}

function pause(): void {
  cancelAnimationFrame(raf);
  raf = 0;
}

function resume(): void {
  if (!canvas || raf || document.hidden) return;
  if (reduced()) {
    still();
    return;
  }
  last = 0;
  raf = requestAnimationFrame(frame);
}

/** The reduced-motion frame: the ambient particles where they were seeded, drawn once. */
function still(): void {
  // Meteor shower keeps one meteor, frozen mid-streak, so the still frame still reads as the scene.
  sparks = kind === 'meteors' ? [{ ...newMeteor(w * 0.72, h * 0.16, STARLIGHT, 0, 90, 1), life: 0.5 }] : [];
  draw();
}

function frame(now: number): void {
  raf = requestAnimationFrame(frame);
  if (last && now - last < FRAME_MS - 2) return; // hold to 30 fps
  const dt = last ? Math.min((now - last) / 1000, 0.1) : 0;
  last = now;
  step(dt);
  draw();
}

function step(dt: number): void {
  clock += dt;
  if (kind === 'snow') {
    for (const p of ambient) {
      p.y += p.vy * dt;
      p.x += Math.sin(clock * 0.8 + p.phase) * 10 * dt;
      if (p.y > h + 6) {
        p.y = -6;
        p.x = rand(0, w);
      }
    }
  } else if (kind === 'rain') {
    for (const p of ambient) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y > h + 20) {
        p.y = -20;
        p.x = rand(-0.1 * w, w);
      }
    }
  } else if (kind === 'lanterns') {
    ambient = ambient.map((p) => (p.y < h * 0.12 ? newLantern(h + 20) : p));
    for (const p of ambient) {
      p.y += p.vy * dt;
      p.x += Math.sin(clock * 0.5 + p.phase) * 4 * dt;
    }
  }
  if (kind === 'meteors') {
    nextMeteor -= dt;
    if (nextMeteor <= 0 && sparks.filter((s) => s.color === STARLIGHT).length < 2) {
      queueMeteor(newMeteor(rand(0.3, 1.1) * w, rand(0, 0.3) * h, STARLIGHT, rand(150, 230), rand(60, 100), rand(1.4, 2)));
      nextMeteor = rand(2.5, 5);
    }
  }
  const ballistic = kind === 'fireworks'; // burst sparks fall; meteors fly straight; aurora ripples only age
  for (const s of sparks) {
    s.life -= dt;
    if (ballistic) {
      s.vx *= 1 - 1.6 * dt;
      s.vy = s.vy * (1 - 1.6 * dt) + 60 * dt;
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }
  sparks = sparks.filter((s) => s.life > 0);
}

function draw(): void {
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  if (kind === 'snow') {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = 'rgba(70, 100, 140, 0.28)'; // a faint rim so flakes read on the pale sky
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (const p of ambient) {
      ctx.moveTo(p.x + p.r, p.y);
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    }
    ctx.fill();
    ctx.stroke();
  } else if (kind === 'lanterns') {
    const img = lanternSprite();
    for (const p of ambient) {
      // Fade in from the sea and out before the HUD.
      ctx.globalAlpha = Math.max(0, Math.min(1, (p.y - h * 0.12) / (h * 0.2), (h + 20 - p.y) / (h * 0.15))) * 0.8;
      const s = 26 * p.r;
      ctx.drawImage(img, p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;
  } else if (kind === 'rain') {
    ctx.strokeStyle = 'rgba(52, 72, 92, 0.3)';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    for (const p of ambient) {
      const k = p.r / p.vy;
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * k, p.y - p.r);
    }
    ctx.stroke();
  } else if (kind === 'lights') {
    const span = w / SWAGS;
    ctx.strokeStyle = 'rgba(20, 26, 40, 0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let k = 0; k < SWAGS; k++) {
      ctx.moveTo(k * span, hookY);
      ctx.quadraticCurveTo(k * span + span / 2, hookY + 2 * sag, (k + 1) * span, hookY);
    }
    ctx.stroke();
    for (const p of ambient) {
      // A slow, soft twinkle: never fully off, never a flash.
      ctx.globalAlpha = 0.5 + 0.45 * (0.5 + 0.5 * Math.sin(clock * 1.1 + p.phase));
      ctx.drawImage(bulbSprite(p.color), p.x - 12, wireY(p.x) + 4 - 12, 24, 24);
    }
    ctx.globalAlpha = 1;
  } else if (kind === 'meteors') {
    ctx.fillStyle = STARLIGHT;
    for (const p of ambient) {
      ctx.globalAlpha = 0.3 + 0.35 * (0.5 + 0.5 * Math.sin(clock * 1.3 + p.phase));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const m of sparks) drawMeteor(ctx, m, m.bold ? SEAL_METEOR.width : 1.8);
    ctx.globalAlpha = 1;
  } else if (kind === 'aurora') {
    const colW = (w / AURORA_COLS) * 1.7;
    for (const p of ambient) {
      const sway = Math.sin((p.x / w) * 4.2 + clock * 0.35 + p.phase) * p.vy;
      let gain = 0;
      for (const s of sparks) {
        // A ring of brightness moving out from the sealed jar, fading over its life (SEAL_RIPPLE).
        const d = Math.abs(p.x - s.x) - SEAL_RIPPLE.speed * (s.phase - s.life);
        gain += SEAL_RIPPLE.gain * Math.exp(-(d * d) / SEAL_RIPPLE.spread) * (s.life / s.phase);
      }
      // Ambient slices stay capped at 0.5; the ripple lifts the cap and lengthens the slice a little.
      const lift = Math.min(1, gain);
      ctx.globalAlpha = Math.min(0.5 + (SEAL_RIPPLE.maxAlpha - 0.5) * lift, (0.22 + 0.08 * Math.sin(clock * 0.6 + p.x * 0.01 + p.phase)) * (1 + gain));
      const tall = p.r * (1 + 0.2 * lift);
      ctx.drawImage(auroraSprite(p.color), p.x - colW / 2, p.y + sway - tall / 2, colW, tall);
    }
    ctx.globalAlpha = 1;
  } else if (kind === 'fireworks') {
    for (const p of ambient) {
      ctx.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(clock * 1.7 + p.phase));
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const s of sparks) {
      ctx.globalAlpha = Math.min(1, s.life * 1.6);
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}

/** One paper lantern with its glow, rendered once and reused (cheaper than per-frame gradients). */
function lanternSprite(): HTMLCanvasElement {
  if (lantern) return lantern;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const glow = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  glow.addColorStop(0, 'rgba(255, 196, 110, 0.55)');
  glow.addColorStop(1, 'rgba(255, 160, 80, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 64, 64);
  const body = g.createLinearGradient(0, 22, 0, 44);
  body.addColorStop(0, '#ffd48a');
  body.addColorStop(1, '#e8833a');
  g.fillStyle = body;
  g.beginPath();
  g.roundRect(24, 22, 16, 21, 6);
  g.fill();
  g.fillStyle = '#7a3b1e';
  g.fillRect(26, 20, 12, 3);
  g.fillRect(26, 42, 12, 2);
  lantern = c;
  return c;
}

/** One glowing bulb per colour, rendered once and reused (Winter lights). */
function bulbSprite(color: string): HTMLCanvasElement {
  const cached = bulbSprites.get(color);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const g = c.getContext('2d')!;
  const glow = g.createRadialGradient(12, 12, 1, 12, 12, 12);
  glow.addColorStop(0, color);
  glow.addColorStop(0.35, color);
  glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.globalAlpha = 0.45;
  g.fillStyle = glow;
  g.fillRect(0, 0, 24, 24);
  g.globalAlpha = 1;
  g.fillStyle = color;
  g.beginPath();
  g.ellipse(12, 13, 2.6, 3.4, 0, 0, Math.PI * 2);
  g.fill();
  bulbSprites.set(color, c);
  return c;
}

/** One aurora slice per colour: a curtain brightest near its lower edge, soft at both sides. Rendered once. */
function auroraSprite(rgb: string): HTMLCanvasElement {
  const cached = auroraSprites.get(rgb);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 128;
  const g = c.getContext('2d')!;
  const v = g.createLinearGradient(0, 0, 0, 128);
  v.addColorStop(0, 'rgba(' + rgb + ', 0)');
  v.addColorStop(0.55, 'rgba(' + rgb + ', 0.9)');
  v.addColorStop(0.8, 'rgba(' + rgb + ', 0.35)');
  v.addColorStop(1, 'rgba(' + rgb + ', 0)');
  g.fillStyle = v;
  g.fillRect(0, 0, 32, 128);
  g.globalCompositeOperation = 'destination-in';
  const hz = g.createLinearGradient(0, 0, 32, 0);
  hz.addColorStop(0, 'rgba(0, 0, 0, 0)');
  hz.addColorStop(0.5, 'rgba(0, 0, 0, 1)');
  hz.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = hz;
  g.fillRect(0, 0, 32, 128);
  auroraSprites.set(rgb, c);
  return c;
}
