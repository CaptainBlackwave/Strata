/**
 * Animated scene layers (design/gdd/scenes.md 2.1a, sprint 7 B5): falling snow, rising
 * lanterns and New Year fireworks, drawn on one canvas behind all UI.
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

type LayerKind = 'snow' | 'lanterns' | 'fireworks';

/** The scenes that have an animated layer, by scene id. */
const LAYERS: Readonly<Record<string, LayerKind>> = { wintersnow: 'snow', harvestmoon: 'lanterns', newyear: 'fireworks' };

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
}

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
let wired = false;

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
  resume();
}

/** Removes the layer and stops its frame loop. */
export function stopSceneFx(): void {
  cancelAnimationFrame(raf);
  raf = 0;
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

/** A small burst above a sealed jar, in the jar's sand colour (New Year only). */
export function sceneSealBurst(jar: Element, color: string): void {
  if (kind !== 'fireworks' || reduced()) return;
  const r = jar.getBoundingClientRect();
  queueBurst(r.left + r.width / 2, r.top - 6, [color, '#fff6d8'], 14, 70);
}

/** The fuller display when the win card opens: bursts around the card in the board's colours (New Year only). */
export function sceneWinDisplay(colors: readonly string[]): void {
  if (kind !== 'fireworks' || reduced() || !colors.length) return;
  const spots: readonly (readonly [number, number])[] = [[0.22, 0.16], [0.78, 0.14], [0.5, 0.09], [0.15, 0.84], [0.85, 0.82]];
  spots.forEach(([fx, fy], k) => {
    window.setTimeout(() => queueBurst(w * fx, h * fy, [colors[k % colors.length], colors[(k + 1) % colors.length], '#fff6d8'], 16, 110), k * 320);
  });
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
  }
}

/** Lanterns rise along the sides, away from the home screen's centred text. */
function newLantern(y: number): Particle {
  const side = Math.random() < 0.5 ? rand(0.03, 0.22) : rand(0.78, 0.97);
  return { x: side * w, y, vx: 0, vy: -rand(9, 17), r: rand(0.75, 1.1), phase: rand(0, 6.3), life: Infinity, color: '' };
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
  sparks = [];
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
  } else if (kind === 'lanterns') {
    ambient = ambient.map((p) => (p.y < h * 0.12 ? newLantern(h + 20) : p));
    for (const p of ambient) {
      p.y += p.vy * dt;
      p.x += Math.sin(clock * 0.5 + p.phase) * 4 * dt;
    }
  }
  for (const s of sparks) {
    s.life -= dt;
    s.vx *= 1 - 1.6 * dt;
    s.vy = s.vy * (1 - 1.6 * dt) + 60 * dt;
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
