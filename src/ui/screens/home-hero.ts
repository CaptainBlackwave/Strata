/**
 * The Home hero's owner (sprint 20 H2, D167, D169; design/ux/home.md §5.5): picks the live
 * Realistic-sand scene or the still picture, and runs the scene only while Home, its Play tab and the
 * browser tab are visible, and never under reduced motion. The rules are logic/home-hero.ts; the
 * scene is board-gpu/hero-scene.ts, loaded with Pixi only when it is needed.
 */
import { realisticAvailable } from '../board-gpu/hooks';
import { hexToRgb } from '../board-gpu/paint';
import type { GlassLook } from '../board-gpu/art';
import type { HeroScene } from '../board-gpu/hero-scene';
import { defaultDims, sandConfig } from '../sand';
import { heroMode, heroRuns, heroTuning } from '../logic/home-hero';
import { $, homeEl, reducedMotion } from '../dom';
import { config, state } from '../state';

/** The `--buried` colour in style.css, if the custom property can't be read. */
const BURIED_FALLBACK = '#b9a88d';
/** Night scenes, where the glass is drawn for the dark (as on the board). */
const NIGHT_SCENES = new Set(['moonlit', 'harvestmoon', 'newyear', 'lighthousenight', 'meteorshower', 'auroranight', 'winterlights']);

let scene: HeroScene | null = null;
let loading: Promise<void> | null = null;
let lost = false;
let onPlay = true;
let wired = false;
let shown: 'live' | 'still' | null = null;

const stage = () => $('hero-stage');

/** The scene's glass colours, read through a probe in Home (the worn glass's `--style-*` over the scene's tokens). */
function readLook(): { glass: GlassLook; sand: string; patterns: boolean } {
  const probe = document.createElement('i');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  homeEl.appendChild(probe);
  const read = (expr: string, fallback: string): string => {
    probe.style.color = 'transparent';
    probe.style.color = expr;
    const v = getComputedStyle(probe).color;
    return v && v !== 'rgba(0, 0, 0, 0)' && v !== 'transparent' ? v : fallback; // an unset token resolves to transparent in every browser form
  };
  const body = read('var(--glass)', 'rgba(255,255,255,0.38)');
  const night = NIGHT_SCENES.has(document.body.dataset.theme ?? '');
  const glass: GlassLook = {
    edge: read('var(--style-edge, var(--glass-edge))', 'rgba(90,70,50,0.55)'),
    body: read('var(--style-body, var(--glass))', body),
    band: read('var(--style-band, transparent)', 'rgba(0,0,0,0)'),
    rim: read('var(--style-rim, var(--glass))', body),
    shadow: night ? 'rgb(0,0,0)' : 'rgb(60,44,24)',
    night,
  };
  probe.remove();
  return { glass, sand: homeEl.dataset.sand ?? 'plain', patterns: state.save.settings.patterns };
}

/** The still picture: the board's own DOM jars (so worn styles and patterns show), and the funnel. */
function stillHtml(): string {
  const t = heroTuning;
  const jar = (units: readonly number[], side: boolean) =>
    `<span class="jar${side ? ' side' : ''}"><span class="glass"><span class="sand">${units
      .map((c) => `<span class="unit${state.save.settings.patterns ? ` pat-${c % config.palette.length}` : ''}" style="--c:${config.palette[c].hex};background:${config.palette[c].hex}"></span>`)
      .join('')}</span><span class="shine"></span></span></span>`;
  return `<div class="hero-still"><i class="funnel"></i>${jar(t.left, true)}${jar([...t.middle, t.tops[0]], false)}${jar(t.right, true)}</div>`;
}

function showStill(): void {
  scene?.stop();
  if (scene) scene.canvas.hidden = true;
  stage().querySelector('.hero-still')?.remove();
  stage().insertAdjacentHTML('beforeend', stillHtml());
  $('home-hero').dataset.mode = 'still';
  shown = 'still';
}

function load(): Promise<void> {
  loading ??= import('../board-gpu/hero-scene')
    .then(async ({ HeroScene }) => {
      const neutral = getComputedStyle(document.body).getPropertyValue('--buried').trim() || BURIED_FALLBACK;
      scene = await HeroScene.create({
        host: stage(),
        palette: config.palette.map((c) => hexToRgb(c.hex)),
        neutral: hexToRgb(neutral),
        dims: defaultDims(),
        sand: { ...sandConfig, stepsPerSecond: heroTuning.stepsPerSecond, spillPerStep: heroTuning.spillPerStep, airRows: heroTuning.airRows },
        tuning: heroTuning,
        reducedMotion,
        onContext: (isLost) => {
          lost = isLost;
          renderHero();
        },
      });
    })
    .catch(() => {
      scene = null;
    });
  return loading;
}

/** Starts or stops the live scene for what can be seen now. */
function sync(): void {
  if (shown !== 'live' || !scene) return;
  const runs = heroRuns({ homeShown: !homeEl.hidden, onPlay, pageVisible: !document.hidden, reduced: reducedMotion() });
  if (runs) scene.start();
  else if (reducedMotion() && !homeEl.hidden) scene.start(); // paints the settled still, once
  else scene.stop();
}

/** Picks live or still now and shows it. Called by `showHome`, on a Settings change and on a lost context. */
export function renderHero(): void {
  wire();
  const mode = heroMode({ search: location.search, webgl: realisticAvailable(), realistic: state.save.settings.realistic, lost: lost || (scene?.contextLost ?? false) });
  if (mode === 'still') {
    if (shown !== 'still') showStill();
    else stage().querySelector('.hero-still')!.outerHTML = stillHtml();
    return;
  }
  void load().then(() => {
    if (!scene) {
      showStill(); // WebGL failed after all
      return;
    }
    stage().querySelector('.hero-still')?.remove();
    scene.canvas.hidden = false;
    $('home-hero').dataset.mode = 'live';
    shown = 'live';
    scene.setLook(readLook());
    scene.layout();
    sync();
  });
}

/** The Play tab was shown (true) or another tab (false): the scene draws only on Play. */
export function setHeroOnPlay(on: boolean): void {
  onPlay = on;
  sync();
}

/** Listens, once, for what starts, stops or redraws the scene. */
function wire(): void {
  if (wired) return;
  wired = true;
  document.addEventListener('visibilitychange', sync);
  window.matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => (shown === 'live' ? (scene?.layout(), sync()) : undefined));
  new MutationObserver(sync).observe(homeEl, { attributes: true, attributeFilter: ['hidden'] });
  const relook = () => {
    if (shown === 'live' && scene) scene.setLook(readLook());
    else if (shown === 'still') renderHero();
  };
  const looks = new MutationObserver(relook);
  looks.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  looks.observe(document.body, { attributes: true, attributeFilter: ['data-theme'] });
  looks.observe(homeEl, { attributes: true, attributeFilter: ['data-glass', 'data-sand', 'data-cork'] });
  new ResizeObserver(() => (shown === 'live' ? scene?.layout() : undefined)).observe(stage());
  for (const id of ['set-realistic', 'set-patterns']) $(id).addEventListener('change', () => (id === 'set-patterns' ? relook() : renderHero()));
}
