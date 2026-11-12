/**
 * The Home hero's owner (sprint 21 H1, D175, D176; design/ux/home.md): the three logo jars, a button
 * that starts the player's level. The CSS logo jars (`.hero-logo` in index.html) always stand in the
 * stage, so Classic, no WebGL and the moment before the renderer's chunk loads all show them. On
 * Realistic a small second instance of the board's renderer (board-gpu/renderer.ts) draws the same
 * jars once, as a still, over the CSS ones, which are then hidden. The only motion is a rare soft
 * sparkle on the sand, a DOM glint played by the Web Animations API: between sparkles nothing runs
 * but one timeout (the renderer draws only on change, so its loop sleeps), and under reduced motion,
 * off Home, off the Play tab or with the browser tab hidden there is no timer at all. The rules are
 * logic/home-hero.ts.
 */
import { gpuMotion, lookFor, realisticAvailable } from '../board-gpu/hooks';
import { hexToRgb } from '../board-gpu/paint';
import { jarGeometry } from '../board-gpu/geometry';
import type { GpuBoard } from '../board-gpu/renderer';
import { defaultDims } from '../sand';
import { heroLayout, heroMode, heroTuning, logoBoard, sparkleDelay, sparkleRuns, sparkleSpot } from '../logic/home-hero';
import { $, homeEl, reducedMotion } from '../dom';
import { config, state } from '../state';
import { t } from '../strings';

/** The `--buried` colour in style.css, if the custom property can't be read. */
const BURIED_FALLBACK = '#b9a88d';

const board = logoBoard();
let gpu: GpuBoard | null = null;
let loading: Promise<void> | null = null;
let lost = false;
let onPlay = true;
let wired = false;
let shown: 'realistic' | 'css' | null = null;
let timer = 0;
let sparkles = 0;

const stage = () => $('hero-stage');
const stageSize = () => ({ width: stage().clientWidth, height: stage().clientHeight });
const boxes = () => {
  const { width, height } = stageSize();
  return heroLayout(width, height, board.capacity);
};

/** The jar geometries for the stage, in its own coordinates. */
function geometries() {
  return boxes().map((box) => jarGeometry({ left: box.left, top: box.top, width: box.width, height: box.height }, box.unitHeight, board.capacity, defaultDims()));
}

function setMode(mode: 'realistic' | 'css'): void {
  shown = mode;
  $('home-hero').dataset.mode = mode;
}

function showCss(): void {
  stopSparkle();
  if (gpu) gpu.canvas.hidden = true;
  setMode('css');
}

function load(): Promise<void> {
  loading ??= import('../board-gpu/renderer')
    .then(async ({ GpuBoard }) => {
      const neutral = getComputedStyle(document.body).getPropertyValue('--buried').trim() || BURIED_FALLBACK;
      gpu = await GpuBoard.create({
        host: stage(),
        palette: config.palette.map((c) => hexToRgb(c.hex)),
        paletteHex: config.palette.map((c) => c.hex),
        neutral: hexToRgb(neutral),
        motion: gpuMotion(),
        reducedMotion,
        dims: defaultDims(),
        viewSize: stageSize,
        className: 'hero-canvas',
        onContext: (isLost) => {
          lost = isLost;
          renderHero();
        },
      });
    })
    .catch(() => {
      gpu = null;
    });
  return loading;
}

/** Draws the still: one layout, then the renderer sleeps until the next change. */
function drawStill(): void {
  if (!gpu || stage().clientWidth < 10) return;
  gpu.setLook(lookFor(homeEl));
  gpu.layout(geometries(), board, null);
}

function stopSparkle(): void {
  window.clearTimeout(timer);
  timer = 0;
  for (const s of stage().querySelectorAll('.hero-sparkle')) s.remove();
}

/** Plays one sparkle on the sand, then schedules the next. */
function sparkle(): void {
  timer = 0;
  const n = sparkles++;
  const spot = sparkleSpot(boxes(), board.capacity, n);
  const el = document.createElement('span');
  el.className = 'hero-sparkle';
  el.setAttribute('aria-hidden', 'true');
  el.style.cssText = `left:${spot.x}px;top:${spot.y}px;width:${spot.size}px;height:${spot.size}px`;
  stage().append(el);
  const anim = el.animate(
    [
      { opacity: 0, transform: 'translate(-50%, -50%) scale(0.4) rotate(0deg)' },
      { opacity: 0.95, transform: 'translate(-50%, -50%) scale(1) rotate(20deg)', offset: 0.45 },
      { opacity: 0, transform: 'translate(-50%, -50%) scale(0.6) rotate(45deg)' },
    ],
    { duration: heroTuning.sparkleMs, easing: 'ease-in-out' },
  );
  const done = () => el.remove();
  anim.onfinish = done;
  anim.oncancel = done;
  schedule(sparkleDelay(heroTuning, sparkles));
}

function schedule(ms: number): void {
  window.clearTimeout(timer);
  timer = window.setTimeout(sparkle, ms);
}

/** Starts or stops the sparkle timer for what can be seen now. */
function sync(): void {
  const runs = sparkleRuns({ realistic: shown === 'realistic' && !!gpu, homeShown: !homeEl.hidden, onPlay, pageVisible: !document.hidden, reduced: reducedMotion() });
  if (runs && !timer) schedule(sparkleDelay(heroTuning, sparkles === 0 ? 0 : sparkles));
  else if (!runs && timer) stopSparkle();
  else if (!runs) for (const s of stage().querySelectorAll('.hero-sparkle')) s.remove();
}

/** Picks the look now and shows it. Called by `showHome`, on a Settings change and on a lost context. */
export function renderHero(): void {
  wire();
  stage().setAttribute('aria-label', state.save.tutorialDone ? t.homeScreen.heroLabel(state.save.level) : t.homeScreen.heroLabelTutorial);
  const mode = heroMode({ search: location.search, webgl: realisticAvailable(), realistic: state.save.settings.realistic, lost: lost || (gpu?.contextLost ?? false) });
  if (mode === 'css') return showCss();
  void load().then(() => {
    if (!gpu) return showCss(); // WebGL failed after all
    gpu.canvas.hidden = false;
    if (shown !== 'realistic') {
      setMode('realistic');
      drawStill();
    }
    sync();
  });
}

/** The Play tab was shown (true) or another tab (false): the sparkle runs only on Play. */
export function setHeroOnPlay(on: boolean): void {
  onPlay = on;
  sync();
}

/** Listens, once, for what starts or stops the sparkle or redraws the still. */
function wire(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('visibilitychange', sync);
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', sync);
  new MutationObserver(sync).observe(homeEl, { attributes: true, attributeFilter: ['hidden'] });
  const relook = () => {
    if (shown === 'realistic' && gpu && gpu.setLook(lookFor(homeEl))) drawStill();
  };
  const looks = new MutationObserver(relook);
  looks.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  looks.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  looks.observe(homeEl, { attributes: true, attributeFilter: ['data-glass', 'data-sand', 'data-cork'] });
  let size = '';
  new ResizeObserver(() => {
    const now = `${stage().clientWidth}x${stage().clientHeight}`;
    if (now === size) return;
    size = now;
    if (shown === 'realistic') drawStill();
  }).observe(stage());
  $('set-realistic').addEventListener('change', renderHero);
  $('set-patterns').addEventListener('change', relook);
}
