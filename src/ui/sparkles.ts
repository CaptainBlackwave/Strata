/**
 * New Tide's sparkles (sprint 31, D240; feel-audio-ui.md): a few gentle gold sparkles on their own
 * canvas, behind the content of Home (or of a New Tide board), while New Tide runs. No snow. Never
 * takes input, stops while the tab is hidden, and never draws under reduced motion. Modelled on
 * winter.ts; the rules are fx-plan.ts `sparklesShow` and the tuning `SPARKLE`.
 */
import { SPARKLE, sparklesShow } from './fx-plan';

interface Sparkle {
  x: number;
  y: number;
  r: number;
  vy: number;
  life: number;
  age: number;
}

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const rand = (a: number, b: number) => a + Math.random() * (b - a);

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;
let sparkles: Sparkle[] = [];
let raf = 0;
let last = 0;
let w = 0;
let h = 0;
let where: 'home' | 'board' = 'home';
let wanted = false;
let wired = false;

/**
 * Shows or hides New Tide's sparkles on `where` (Home, or a New Tide board): `on` while New Tide
 * runs there, off otherwise. Safe to call often, as `winterSnow` is.
 * Example: `newTideSparkles('home', activeEvent(today, config)?.event.id === 'newtide')`.
 */
export function newTideSparkles(screen: 'home' | 'board', on: boolean): void {
  where = screen;
  wanted = on;
  wire();
  apply();
}

/** The layer's state for QA: whether it is drawing now. */
export function newTideSparkling(): boolean {
  return !!canvas && raf !== 0;
}

function spawn(s?: Sparkle): Sparkle {
  const n = s ?? ({} as Sparkle);
  n.x = rand(0, w);
  n.y = rand(h * 0.05, h * 0.95);
  n.r = rand(SPARKLE.radius[0], SPARKLE.radius[1]);
  n.vy = -rand(SPARKLE.drift[0], SPARKLE.drift[1]);
  n.life = rand(SPARKLE.life[0], SPARKLE.life[1]);
  n.age = s ? 0 : rand(0, n.life); // the first set starts out of phase
  return n;
}

function apply(): void {
  if (!sparklesShow({ reduced: reduced(), hidden: document.hidden }, wanted)) return stop(!document.hidden || !wanted);
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'scene-fx sparkle-fx';
    canvas.setAttribute('aria-hidden', 'true');
    ctx = canvas.getContext('2d');
    resize();
    sparkles = Array.from({ length: SPARKLE.count }, () => spawn());
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
    sparkles = [];
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
  // Home hidden (the map, a level) while the sparkles are Home's: stop until Home or a board asks again.
  const home = document.getElementById('home');
  if (home)
    new MutationObserver(() => {
      if (home.hidden && where === 'home' && wanted) {
        wanted = false;
        apply();
      }
    }).observe(home, { attributes: true, attributeFilter: ['hidden'] });
}

function frame(now: number): void {
  raf = requestAnimationFrame(frame);
  if (now - last < 1000 / SPARKLE.fps - 2) return;
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (!ctx) return;
  ctx.clearRect(0, 0, w, h);
  for (const s of sparkles) {
    s.age += dt;
    s.y += s.vy * dt;
    if (s.age >= s.life) spawn(s);
    // A soft rise and fall of light over its life: never a flash.
    const a = Math.sin((Math.PI * s.age) / s.life) ** 2;
    const r = s.r * (0.7 + 0.3 * a);
    // A warm halo (reads on light scenes), then a four-armed gold star with a pale core.
    ctx.globalAlpha = a * 0.35;
    ctx.fillStyle = 'rgb(214, 160, 50)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = a * 0.9;
    ctx.fillStyle = 'rgb(255, 214, 120)';
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - r * 1.6);
    ctx.quadraticCurveTo(s.x, s.y, s.x + r * 1.6, s.y);
    ctx.quadraticCurveTo(s.x, s.y, s.x, s.y + r * 1.6);
    ctx.quadraticCurveTo(s.x, s.y, s.x - r * 1.6, s.y);
    ctx.quadraticCurveTo(s.x, s.y, s.x, s.y - r * 1.6);
    ctx.fill();
    ctx.fillStyle = 'rgb(255, 248, 225)';
    ctx.beginPath();
    ctx.arc(s.x, s.y, r * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
