/**
 * The Home hero's owner (sprint 20, D167, D169, D173; design/ux/home.md): a tiny sorting game that
 * plays itself on a small second instance of the board's own renderer (board-gpu/renderer.ts: the
 * same glass, sand simulation, lift and tip, cork drop and glow). Every `paceMs` it plays the solver's
 * next pour; when the board is solved it rests, fades out, deals the next seeded board and fades in.
 * It plays only while Home, its Play tab and the browser tab are visible, and never under reduced
 * motion, where it is a still of the board mid-sort. On Classic, without WebGL or with the context
 * lost, the same still is drawn with the board's DOM jars. The rules are logic/home-hero.ts.
 */
import { type Board, isSealed, pour } from '../../core/board';
import { mixSeed } from '../../core/rng';
import { gpuMotion, lookFor, realisticAvailable } from '../board-gpu/hooks';
import { hexToRgb } from '../board-gpu/paint';
import { jarGeometry } from '../board-gpu/geometry';
import type { GpuBoard } from '../board-gpu/renderer';
import { defaultDims, sandConfig } from '../sand';
import { HERO_START, type HeroDeal, type HeroLoop, heroDeal, heroLayout, heroMode, heroRuns, heroStill, heroTuning, nextPhase, phaseMs, remixSeed } from '../logic/home-hero';
import { $, homeEl, reducedMotion } from '../dom';
import { config, state } from '../state';
import { t } from '../strings';

/** The `--buried` colour in style.css, if the custom property can't be read. */
const BURIED_FALLBACK = '#b9a88d';
/** How long the seal glow stays after its run (ms), then it is cleared. */
const GLOW_HOLD_MS = 500;

let gpu: GpuBoard | null = null;
let loading: Promise<void> | null = null;
let lost = false;
let onPlay = true;
let wired = false;
let shown: 'live' | 'still' | null = null;
let deal: HeroDeal = heroDeal(heroTuning, remixSeed(heroTuning, 0));
let board: Board = deal.board;
let loop: HeroLoop = HERO_START;
let timer = 0;
let playing = false;
/** The board the canvas shows is the reduced-motion still. */
let showingStill = false;

const stage = () => $('hero-stage');
const stageSize = () => ({ width: stage().clientWidth, height: stage().clientHeight });

/** The jar geometries for the stage, in its own coordinates. */
function geometries(b: Board) {
  const { width, height } = stageSize();
  return heroLayout(width, height, b.jars.length, b.capacity).map((box) => {
    const glass = { left: box.left, top: box.top, width: box.width, height: box.height };
    const lip = box.width * 0.18; // the DOM jar's button rises this far over its glass (the cork's room)
    return jarGeometry(glass, box.unitHeight, b.capacity, defaultDims(), { left: box.left, top: box.top - lip, width: box.width, height: box.height + lip });
  });
}

/** The still in the board's DOM jar look: worn styles, patterns and corks all show. */
function stillHtml(b: Board): string {
  const patterns = state.save.settings.patterns;
  const jar = (units: readonly number[]) => {
    const sealed = units.length > 0 && isSealed({ units, hidden: 0 }, b.capacity);
    const sand = units.map((c) => `<span class="unit${patterns ? ` pat-${c % config.palette.length}` : ''}" style="--c:${config.palette[c].hex};background:${config.palette[c].hex}"></span>`).join('');
    return `<span class="jar${sealed ? ' sealed' : ''}"><span class="cork"></span><span class="glass"><span class="sand">${sand}</span><span class="shine"></span></span></span>`;
  };
  return `<span class="hero-still" aria-hidden="true">${b.jars.map((j) => jar(j.units)).join('')}</span>`;
}

function showDomStill(): void {
  stopLoop();
  if (gpu) gpu.canvas.hidden = true;
  stage().querySelector('.hero-still')?.remove();
  stage().insertAdjacentHTML('beforeend', stillHtml(heroStill(deal)));
  $('home-hero').dataset.mode = 'still';
  shown = 'still';
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
        config: { ...sandConfig, stepsPerSecond: heroTuning.stepsPerSecond, maxTiltDeg: heroTuning.maxTiltDeg, airRows: heroTuning.airRows },
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

/** Lays the canvas out for the board it should show now: the live board, or the still under reduced motion. */
function layoutCanvas(): void {
  if (!gpu || stage().clientWidth < 10) return;
  showingStill = reducedMotion();
  const b = showingStill ? heroStill(deal) : board;
  gpu.setLook(lookFor(homeEl));
  gpu.layout(geometries(b), b, null);
}

function clearTimer(): void {
  window.clearTimeout(timer);
  timer = 0;
}

/** Stops the loop where it is; a pour in flight finishes at once, so the board stays whole. */
function stopLoop(): void {
  clearTimer();
  playing = false;
  gpu?.completePour();
}

/** Enters `next` and schedules what follows it. */
function enter(next: HeroLoop): void {
  loop = next;
  if (!playing || !gpu) return;
  const canvas = gpu.canvas;
  if (loop.phase === 'pour') return void playMove();
  if (loop.phase === 'fadeOut') canvas.classList.add('faded');
  if (loop.phase === 'fadeIn') {
    deal = heroDeal(heroTuning, remixSeed(heroTuning, loop.loop));
    board = deal.board;
    layoutCanvas();
    canvas.classList.remove('faded');
  }
  timer = window.setTimeout(() => enter(nextPhase(loop, deal.moves.length)), phaseMs(loop.phase, heroTuning) ?? 0);
}

/** Plays the deal's next pour as Realistic sand; a pour that seals its jar drops the cork and glows. */
function playMove(): void {
  const g = gpu!;
  const move = deal.moves[loop.step];
  const before = board;
  g.playPour(move.from, move.to, before, mixSeed(deal.seed, loop.step), {
    spill: () => undefined,
    land: () => {
      board = pour(before, move.from, move.to).board;
      const jar = board.jars[move.to];
      const after = board;
      queueMicrotask(() => {
        g.sync(after, null);
        if (isSealed(jar, after.capacity) && !isSealed(before.jars[move.to], before.capacity)) {
          g.seal(move.to, jar, after.capacity);
          const motion = gpuMotion();
          const stop = g.winGlow([{ jar: move.to, at: motion.corkMs }]);
          window.setTimeout(stop, motion.corkMs + motion.glowMs + GLOW_HOLD_MS);
        }
      });
      return board;
    },
    release: () => undefined,
  }).then(
    () => playing && enter(nextPhase(loop, deal.moves.length)),
    () => playing && enter(nextPhase(loop, deal.moves.length)),
  );
}

/** Starts or stops the live hero for what can be seen now. */
function sync(): void {
  if (shown !== 'live' || !gpu) return;
  const runs = heroRuns({ homeShown: !homeEl.hidden, onPlay, pageVisible: !document.hidden, reduced: reducedMotion() });
  if (reducedMotion() !== showingStill) {
    stopLoop();
    layoutCanvas();
  }
  if (runs && !playing) {
    playing = true;
    gpu.canvas.classList.remove('faded');
    enter(loop.phase === 'pour' || loop.phase === 'fadeOut' ? { ...loop, phase: 'wait' } : loop);
  } else if (!runs && playing) stopLoop();
}

/** Picks live or still now and shows it. Called by `showHome`, on a Settings change and on a lost context. */
export function renderHero(): void {
  wire();
  stage().setAttribute('aria-label', state.save.tutorialDone ? t.homeScreen.heroLabel(state.save.level) : t.homeScreen.heroLabelTutorial);
  const mode = heroMode({ search: location.search, webgl: realisticAvailable(), realistic: state.save.settings.realistic, lost: lost || (gpu?.contextLost ?? false) });
  if (mode === 'still') return showDomStill();
  void load().then(() => {
    if (!gpu) return showDomStill(); // WebGL failed after all
    stage().querySelector('.hero-still')?.remove();
    gpu.canvas.hidden = false;
    $('home-hero').dataset.mode = 'live';
    if (shown !== 'live') {
      shown = 'live';
      stopLoop();
      layoutCanvas();
    }
    sync();
  });
}

/** The Play tab was shown (true) or another tab (false): the hero plays only on Play. */
export function setHeroOnPlay(on: boolean): void {
  onPlay = on;
  sync();
}

/** Listens, once, for what starts, stops or redraws the hero. */
function wire(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('visibilitychange', sync);
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => (shown === 'still' ? showDomStill() : sync()));
  new MutationObserver(sync).observe(homeEl, { attributes: true, attributeFilter: ['hidden'] });
  const relook = () => {
    if (shown === 'live' && gpu) gpu.setLook(lookFor(homeEl));
    else if (shown === 'still') showDomStill();
  };
  const looks = new MutationObserver(relook);
  looks.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  looks.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  looks.observe(homeEl, { attributes: true, attributeFilter: ['data-glass', 'data-sand', 'data-cork'] });
  let size = '';
  new ResizeObserver(() => {
    const now = `${stage().clientWidth}x${stage().clientHeight}`;
    if (now === size || shown !== 'live') return void (size = now);
    size = now;
    gpu?.completePour();
    layoutCanvas();
  }).observe(stage());
  $('set-realistic').addEventListener('change', renderHero);
  $('set-patterns').addEventListener('change', relook);
}
