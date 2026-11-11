/**
 * Winter Tide's snowfall (sprint 18 W1, D151): about 40 light flakes on their own canvas, behind
 * the content of Home and of event boards, while Winter Tide runs. Never takes input, stops while
 * the tab is hidden, and never draws under reduced motion. The rules are fx-plan.ts `snowShows`.
 * Scenes keep their own layers (scene-fx.ts); over Winter snow, which already snows, this stays off.
 */
import { SNOW, snowShows } from './fx-plan';
import { sceneFxKind } from './scene-fx';

interface Flake {
  x: number;
  y: number;
  vy: number;
  r: number;
  phase: number;
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let flakes: Flake[] = [];
let raf = 0;
let last = 0;
let clock = 0;
let w = 0;
let h = 0;
let where: 'home' | 'event' | 'off' = 'off';
let eventId: string | null = null;
let wired = false;

/**
 * Shows or hides the snowfall for the screen now shown: `home`, an `event` board, or `off` (any
 * other board). `event` is the event running today (null for none). Safe to call often.
 * Example: `winterSnow('home', activeEvent(today, config)?.event.id ?? null)`.
 */
export function winterSnow(screen: 'home' | 'event' | 'off', event: string | null): void {
  where = screen;
  eventId = event;
  wire();
  apply();
}

/** The layer's state for QA: whether it is drawing now. */
export function winterSnowing(): boolean {
  return !!canvas && raf !== 0;
}

function apply(): void {
  const on = snowShows({ reduced: reduced(), hidden: document.hidden }, eventId, where, sceneFxKind() === 'snow');
  if (!on) return stop(!document.hidden || where === 'off' || eventId === null);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'scene-fx winter-fx';
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d');
    resize();
    flakes = Array.from({ length: SNOW.flakes }, () => ({ x: rand(0, w), y: rand(-h * 0.1, h), vy: rand(SNOW.speed[0], SNOW.speed[1]), r: rand(SNOW.radius[0], SNOW.radius[1]), phase: rand(0, 6.3) }));
  }
  mount();
  if (!raf) {
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
}

/** Stops drawing; with `remove`, takes the canvas away too (a hidden tab keeps it to resume). */
function stop(remove: boolean): void {
  cancelAnimationFrame(raf);
  raf = 0;
  if (remove) {
    canvas?.remove();
    canvas = null;
    ctx = null;
    flakes = [];
  }
}

/** Behind Home's content while Home shows, else behind the game (`#app`), like the scene layers. */
function mount(): void {
  if (!canvas) return;
  const home = document.getElementById('home');
  const parent = where === 'home' && home && !home.hidden ? home : document.body;
  if (canvas.parentElement !== parent) parent.prepend(canvas);
}

function resize(): void {
  if (!canvas || !ctx) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  w = window.innerWidth;
  h = window.innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function wire(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('visibilitychange', apply);
  window.addEventListener('resize', () => canvas && resize());
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', apply);
  // Home hidden (the map, a level) while the snow is Home's: stop drawing until Home or an event board asks again.
  const home = document.getElementById('home');
  if (home)
    new MutationObserver(() => {
      if (home.hidden && where === 'home') {
        where = 'off';
        apply();
      }
    }).observe(home, { attributes: true, attributeFilter: ['hidden'] });
}

function frame(now: number): void {
  raf = requestAnimationFrame(frame);
  if (now - last < 1000 / SNOW.fps - 2) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  clock += dt;
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  for (const f of flakes) {
    f.y += f.vy * dt;
    f.x += Math.sin(clock * 0.7 + f.phase) * 9 * dt;
    if (f.y > h + 4) {
      f.y = -4;
      f.x = rand(0, w);
    }
  }
  // A soft blue-grey rim under a white core, so a flake reads on light scenes as well as dark ones.
  ctx.fillStyle = 'rgba(130, 160, 195, 0.35)';
  ctx.beginPath();
  for (const f of flakes) {
    ctx.moveTo(f.x + f.r + 0.8, f.y);
    ctx.arc(f.x, f.y, f.r + 0.8, 0, Math.PI * 2);
  }
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
  ctx.beginPath();
  for (const f of flakes) {
    ctx.moveTo(f.x + f.r, f.y);
    ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
  }
  ctx.fill();
}
