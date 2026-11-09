/**
 * The level map (design/gdd/level-map.md, D47–D52): a winding beach path of level stones,
 * bottom to top in level order, with a new scenery band every `map.bandSize` levels. Opens
 * from Home's Play, centred on the next level; the fixed "Play · Level N" button starts it.
 * Only the stones near the viewport are in the DOM, so the path is endless.
 * The rules (states, specials, window, names) are the pure core/map.ts; this draws them.
 */
import { type MechanicId } from '../../core/levels';
import { type Stone, type StoneWords, mapWindow, sceneryAt, stoneAt, stoneName } from '../../core/map';
import { t } from '../strings';
import { $, closeLayer, homeEl, layers, openLayer, reducedMotion } from '../dom';
import { FX_MS, revealStretch, stretchDots } from '../fx-plan';
import { mapFx, popIn, revealStretchFx, screenHold, screenIn, screenOut, settle } from '../fx';
import { startLevel } from './board';
import { showHome } from './home';
import { audio, config, state } from '../state';

const mapEl = $('map');
const scrollEl = $('map-scroll');
const trackEl = $('map-track');
const cardEl = $('stone-card');
const playBtn = $<HTMLButtonElement>('btn-map-play');
const replayBtn = $<HTMLButtonElement>('btn-stone-replay');

/** Presentation only: how far the path swings from the centre (fraction of the width) and its wave length in stones. */
const SWING = 0.24;
const WAVE = 7;
/** Smallest gap between stones, in rem, so large text never makes stones overlap (§3: 150% text). */
const MIN_PITCH_REM = 4.75;
/** Stones rendered beyond each edge of the viewport. */
const BUFFER = 3;
const SVG_NS = 'http://www.w3.org/2000/svg';

/** The track's geometry for the current open: level range, stone spacing (px) and padding. */
const geo = { first: 1, last: 1, pitch: 80, pad: 40, height: 0 };
/** The stone that holds the roving tab stop. */
let focusLevel = 1;
/** The stone a card was opened for. */
let cardLevel = 0;
let frame = 0;
const stones = new Map<number, HTMLButtonElement>();
const bands = new Map<number, HTMLElement>();
const pathSvg = document.createElementNS(SVG_NS, 'svg');
pathSvg.classList.add('map-path');
pathSvg.setAttribute('aria-hidden', 'true');
/** The stretch fading in after a first clear (sprint 10 F5); the path below draws the old state until it ends. */
let revealing: { from: number; to: number } | null = null;
let revealSvg: SVGSVGElement | null = null;

const WORDS: StoneWords = {
  level: t.level,
  cleared: t.map.stone.cleared,
  next: t.map.stone.next,
  locked: t.map.stone.locked,
  perfect: t.map.stone.perfect,
  tall: t.map.stone.tall,
  shell: t.map.stone.shell,
  newJar: (id: MechanicId) => t.map.stone.newJar(t.map.jars[id]),
};

/** Small marks drawn on stones (decorative; the stone's name says the same). */
const ICON = {
  perfect: '<svg viewBox="0 0 20 20" aria-hidden="true"><path class="i-shell" d="M10 18 2.5 8.5a8 7 0 0 1 15 0Z"/><path class="i-rib" d="M10 18 6 6.5M10 18V4.5M10 18l4-11.5"/></svg>',
  lock: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect class="i-lock" x="4" y="9" width="12" height="9" rx="2"/><path class="i-shackle" d="M6.5 9V6.5a3.5 3.5 0 0 1 7 0V9"/></svg>',
  tall: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect class="i-jar" x="6.5" y="1.5" width="7" height="17" rx="2.5"/><path class="i-sand" d="M7.5 11h5v5.5a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5Z"/></svg>',
  shell: '<svg viewBox="0 0 20 20" aria-hidden="true"><path class="i-shell" d="M10 18 2.5 8.5a8 7 0 0 1 15 0Z"/><path class="i-rib" d="M10 18 6 6.5M10 18V4.5M10 18l4-11.5"/></svg>',
  newJar: '<svg viewBox="0 0 20 20" aria-hidden="true"><path class="i-jar" d="M6 3h8M7 3v3c-1.8.9-2.5 2.2-2.5 3.8V16a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V9.8c0-1.6-.7-2.9-2.5-3.8V3"/><path class="i-star" d="M10 8.5l.9 1.9 2 .3-1.5 1.4.4 2-1.8-1-1.8 1 .4-2-1.5-1.4 2-.3Z"/></svg>',
} as const;

/**
 * Scenery art per band (D48): simple CSS-classed SVG shapes coloured by the scene tokens.
 * `land` sits by the left edge, `sea` over the water on the right; `at` lists where each piece
 * stands as fractions of the band's height (bottom = 1). An id with no art shows the plain shore.
 */
const SCENERY: Record<string, { land?: string; sea?: string; landAt?: number[]; seaAt?: number[] }> = {
  rockpools: {
    land: '<svg viewBox="0 0 80 70"><ellipse class="m-rock" cx="30" cy="40" rx="27" ry="17"/><ellipse class="m-pool" cx="30" cy="40" rx="15" ry="7.5"/><ellipse class="m-rock" cx="62" cy="58" rx="12" ry="8"/><circle class="m-shine" cx="25" cy="38" r="2"/></svg>',
    sea: '<svg viewBox="0 0 60 50"><ellipse class="m-rock" cx="30" cy="30" rx="20" ry="11"/><path class="m-foam" d="M8 34q6 5 12 0t12 0 12 0 10 0"/></svg>',
    landAt: [0.08, 0.38, 0.68],
    seaAt: [0.22, 0.52, 0.84],
  },
  dunes: {
    land: '<svg viewBox="0 0 80 70"><path class="m-dune" d="M0 70V40q22-24 46-6t34 8v28Z"/><path class="m-dune2" d="M0 70V54q20-12 40 0t40 4v12Z"/><path class="m-grass" d="M22 34l-3-12M25 33l1-13M28 33l4-10M54 40l-2-10M57 40l2-11"/></svg>',
    landAt: [0.05, 0.22, 0.4, 0.58, 0.76, 0.93],
  },
  pier: {
    sea: '<svg viewBox="0 0 120 50"><rect class="m-wood" x="0" y="18" width="120" height="8" rx="2"/><path class="m-post" d="M14 26v20M44 26v20M74 26v20M104 26v20"/><path class="m-plank" d="M10 18v8M25 18v8M40 18v8M55 18v8M70 18v8M85 18v8M100 18v8"/></svg>',
    seaAt: [0.12, 0.42, 0.72],
  },
  lighthouse: {
    land: '<svg viewBox="0 0 80 110"><ellipse class="m-rock" cx="36" cy="100" rx="34" ry="12"/><path class="m-white" d="M26 92l4-62h12l4 62Z"/><path class="m-red" d="M28.5 70l1-15h13l1 15ZM27.3 90l.6-9h16.2l.6 9Z"/><rect class="m-lamp" x="29" y="20" width="14" height="10" rx="2"/><path class="m-red" d="M27 20l9-8 9 8Z"/></svg>',
    sea: '<svg viewBox="0 0 60 50"><ellipse class="m-rock" cx="30" cy="30" rx="20" ry="11"/><path class="m-foam" d="M8 34q6 5 12 0t12 0 12 0 10 0"/></svg>',
    landAt: [0.45],
    seaAt: [0.15, 0.75],
  },
  cove: {
    land: '<svg viewBox="0 0 80 90"><path class="m-pool" d="M0 5q46 10 46 40T0 85Z"/><path class="m-foam" d="M0 12q38 9 38 33T0 78"/><path class="m-rock" d="M0 0q30 2 34 10Q10 8 0 14ZM0 90q30-2 34-10Q10 82 0 76Z"/></svg>',
    landAt: [0.15, 0.5, 0.85],
  },
};

/** The x position of a stone, as a fraction of the track width: a gentle wave. */
function pathX(level: number): number {
  return 0.5 + SWING * Math.sin(((level - 1) * 2 * Math.PI) / WAVE);
}

/** The y of a stone's centre, in px from the track's top. Level `first` sits at the bottom. */
function yOf(level: number): number {
  return geo.height - geo.pad - (level - geo.first) * geo.pitch - geo.pitch / 2;
}

/** The level whose row covers track y `y`, clamped to the track. */
function levelAtY(y: number): number {
  const lv = geo.first + Math.floor((geo.height - geo.pad - y) / geo.pitch);
  return Math.min(geo.last, Math.max(geo.first, lv));
}

/** Sizes the track: about `stonesPerScreen` stones a screen, fewer at large text (never overlapping). */
function measure(): void {
  const w = mapWindow(state.save.level, config);
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  geo.first = w.first;
  geo.last = w.last;
  geo.pitch = Math.max(scrollEl.clientHeight / config.map.stonesPerScreen, MIN_PITCH_REM * rem);
  geo.pad = Math.max(scrollEl.clientHeight / 2 - geo.pitch / 2, geo.pitch);
  geo.height = (geo.last - geo.first + 1) * geo.pitch + 2 * geo.pad;
  trackEl.style.height = `${geo.height}px`;
}

function clearTrack(): void {
  for (const el of stones.values()) el.remove();
  for (const el of bands.values()) el.remove();
  stones.clear();
  bands.clear();
}

/** One stone button. Its state comes from core/map.ts; its look from classes. */
function makeStone(level: number): HTMLButtonElement {
  const s = stoneAt(level, state.save, config);
  const el = document.createElement('button');
  el.type = 'button';
  el.className = `stone stone-${s.state}${s.perfect ? ' stone-perfect' : ''}`;
  el.dataset.level = String(level);
  el.style.left = `${pathX(level) * 100}%`;
  el.style.top = `${yOf(level)}px`;
  el.tabIndex = level === focusLevel ? 0 : -1;
  el.setAttribute('aria-label', stoneName(s, WORDS));
  const tags = [s.specials.tall && ICON.tall, s.specials.shell && ICON.shell, s.specials.debut && ICON.newJar].filter(Boolean).join('');
  el.innerHTML =
    `<span class="stone-num" aria-hidden="true">${level}</span>` +
    (s.perfect ? `<span class="stone-mark" aria-hidden="true">${ICON.perfect}</span>` : '') +
    (s.state === 'locked' ? `<span class="stone-lock" aria-hidden="true">${ICON.lock}</span>` : '') +
    (tags ? `<span class="stone-tags" aria-hidden="true">${tags}</span>` : '');
  return el;
}

/** One scenery band: a tinted stretch of shore with its art and name (D48). */
function makeBand(band: number): HTMLElement {
  const b = sceneryAt(band * config.map.bandSize + 1, config);
  const lo = Math.max(geo.first, b.first);
  const hi = Math.min(geo.last, b.last);
  const top = hi === geo.last ? 0 : yOf(hi) - geo.pitch / 2;
  const bottom = lo === geo.first ? geo.height : yOf(lo) + geo.pitch / 2;
  const el = document.createElement('div');
  el.className = `band band-${b.id}${band % 2 ? ' band-odd' : ''}`;
  el.setAttribute('aria-hidden', 'true');
  el.style.top = `${top}px`;
  el.style.height = `${bottom - top}px`;
  const art = SCENERY[b.id] ?? {};
  // Positions are fractions of a full band, so a band cut short at the track's top keeps its art in place.
  const full = config.map.bandSize * geo.pitch;
  const place = (at: number) => `top:${bottom - at * full - top}px`;
  let html = '';
  for (const at of art.landAt ?? []) if (bottom - at * full - top > -40) html += `<span class="motif motif-land" style="${place(at)}">${art.land}</span>`;
  for (const at of art.seaAt ?? []) if (bottom - at * full - top > -40) html += `<span class="motif motif-sea" style="${place(at)}">${art.sea}</span>`;
  // The band's first stone sits just above the band line, beside the label: put the label on the other side.
  const side = pathX(lo) < 0.5 ? ' band-name-right' : '';
  html += `<span class="band-name${side}">${t.map.scenery[b.id] ?? ''}</span>`;
  el.innerHTML = html;
  return el;
}

/** The SVG path data through stones `a..b` (empty when `b <= a`). */
function segD(a: number, b: number, width: number): string {
  if (b <= a) return '';
  const pt = (lv: number) => [pathX(lv) * width, yOf(lv)] as const;
  let d = `M${pt(a).join(' ')}`;
  for (let lv = a + 1; lv <= b; lv++) {
    const [x0, y0] = pt(lv - 1);
    const [x1, y1] = pt(lv);
    const my = (y0 + y1) / 2;
    d += `C${x0} ${my} ${x1} ${my} ${x1} ${y1}`;
  }
  return d;
}

/** Draws the path through `lo..hi`: solid to the next stone, dashed beyond it. */
function drawPath(lo: number, hi: number): void {
  const width = trackEl.clientWidth;
  const from = Math.max(geo.first, lo - 1);
  const to = Math.min(geo.last, hi + 1);
  const next = revealing ? revealing.from : state.save.level; // while the new stretch fades in, it is drawn as before
  const done = segD(from, Math.min(to, next), width);
  const ahead = segD(Math.max(from, next), to, width);
  pathSvg.setAttribute('width', String(width));
  pathSvg.setAttribute('height', String(geo.height));
  pathSvg.innerHTML = `<path class="path-edge" d="${done}${ahead}"/><path class="path-done" d="${done}"/><path class="path-ahead" d="${ahead}"/>`;
}

/**
 * The map's arrival touches (sprint 10 F5): a replay's new Perfect mark pops in, and the
 * stretch unlocked since the last visit fades in as dots, then solid path. Pending touches
 * are used up here even without motion, so they never play late.
 */
function arrivalFx(): void {
  const perfect = mapFx.perfect;
  const stretch = revealStretch(mapFx.reveal, state.save.level);
  mapFx.perfect = 0;
  mapFx.reveal = null;
  const mark = perfect ? stones.get(perfect)?.querySelector('.stone-mark') : null;
  if (mark) popIn(mark);
  if (!stretch || stretch.from < geo.first) return;
  const width = trackEl.clientWidth;
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.classList.add('map-path', 'map-path-reveal');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', String(width));
  svg.setAttribute('height', String(geo.height));
  const dots = stretchDots(stretch.from, stretch.to, (lv) => [pathX(lv) * width, yOf(lv)]);
  svg.innerHTML = `<path class="path-done" d="${segD(stretch.from, stretch.to, width)}"/>` + dots.map(([x, y]) => `<circle class="path-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"/>`).join('');
  revealing = stretch;
  revealSvg = svg;
  render();
  pathSvg.after(svg);
  const end = () => {
    if (revealSvg !== svg) return;
    revealing = null;
    revealSvg = null;
    svg.remove();
    render();
  };
  if (!revealStretchFx(svg.querySelector('.path-done')!, [...svg.querySelectorAll('.path-dot')], end)) end();
}

/** Puts the stones and bands near the viewport in the DOM and removes the rest (virtualised, §3). */
function render(): void {
  frame = 0;
  if (mapEl.hidden) return;
  const top = scrollEl.scrollTop;
  const lo = Math.max(geo.first, levelAtY(top + scrollEl.clientHeight) - BUFFER);
  const hi = Math.min(geo.last, levelAtY(top) + BUFFER);
  const focused = document.activeElement;
  for (const [lv, el] of stones) {
    if ((lv < lo || lv > hi) && el !== focused) {
      el.remove();
      stones.delete(lv);
    }
  }
  for (let lv = lo; lv <= hi; lv++) ensureStone(lv);
  const size = config.map.bandSize;
  const bLo = Math.floor((lo - 1) / size);
  const bHi = Math.floor((hi - 1) / size);
  for (const [b, el] of bands) {
    if (b < bLo || b > bHi) {
      el.remove();
      bands.delete(b);
    }
  }
  for (let b = bLo; b <= bHi; b++) {
    if (!bands.has(b)) {
      const el = makeBand(b);
      trackEl.insertBefore(el, pathSvg);
      bands.set(b, el);
    }
  }
  drawPath(lo, hi);
}

/** The stone for `level`, created if it is not in the DOM yet. */
function ensureStone(level: number): HTMLButtonElement {
  let el = stones.get(level);
  if (!el) {
    el = makeStone(level);
    trackEl.append(el);
    stones.set(level, el);
  }
  return el;
}

function scheduleRender(): void {
  if (!frame) frame = window.requestAnimationFrame(render);
}

/** Scrolls so `level` is centred; instant on open and under reduced motion (§3). */
function centre(level: number, smooth = false): void {
  const top = yOf(level) - scrollEl.clientHeight / 2;
  scrollEl.scrollTo({ top, behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
}

/** Moves the roving tab stop (and focus) to `level`, scrolling it into view if needed. */
function focusStone(level: number): void {
  const lv = Math.min(geo.last, Math.max(geo.first, level));
  stones.get(focusLevel)?.setAttribute('tabindex', '-1');
  focusLevel = lv;
  const y = yOf(lv);
  if (y < scrollEl.scrollTop + geo.pitch / 2 || y > scrollEl.scrollTop + scrollEl.clientHeight - geo.pitch / 2) centre(lv, true);
  const el = ensureStone(lv);
  el.tabIndex = 0;
  el.focus({ preventScroll: true });
  scheduleRender();
}

/**
 * Opens the map over Home, centred on `level` (the next level by default, §2.1). Home stays
 * underneath, so Escape and the back button return to it. A restored save re-centres here (§3).
 */
export function openMap(level: number = state.save.level): void {
  if (!layers.has(homeEl)) {
    showHome();
    settle(homeEl);
    screenHold(homeEl); // the map fades in over the board; Home under it waits out of sight
  }
  playBtn.textContent = t.play(state.save.level);
  $('map-coins').textContent = String(state.save.wallet.coins);
  focusLevel = level;
  clearTrack();
  openLayer(mapEl, playBtn, $('btn-play'));
  screenIn(mapEl, FX_MS.mapRise); // sprint 10 F5: a short fade and rise
  measure();
  centre(level);
  render();
  arrivalFx();
}

/** Back to Home (Escape or the back button). */
export function closeMap(): void {
  screenOut(mapEl); // sprint 10 F5: the map fades off Home
  closeLayer(mapEl, false);
  showHome();
}

/** Starts `level` from the map: the next level, or a replay of a cleared one (D50). */
function playFromMap(level: number, replay: boolean): void {
  audio.unlock();
  closeLayer(cardEl, false);
  screenOut(mapEl); // sprint 10 F5: the map fades off the board
  closeLayer(mapEl, false);
  closeLayer(homeEl, false);
  startLevel(level, false, replay);
}

/** Fills and opens the tap card for a cleared or locked stone. */
function openCard(s: Stone, opener: HTMLElement): void {
  cardLevel = s.level;
  $('stone-title').textContent = t.level(s.level);
  const text = $('stone-text');
  if (s.state === 'cleared') {
    const vis = document.createElement('span');
    vis.setAttribute('aria-hidden', 'true');
    vis.textContent = `${t.map.best(s.best)} · ${s.perfect ? t.map.perfectYes : t.map.perfectNo}`;
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = `${t.map.best(s.best)}, ${s.perfect ? t.map.perfectYesSr : t.map.perfectNoSr}`;
    text.replaceChildren(vis, sr);
  } else {
    text.textContent = t.map.unlocksAfter(s.level - 1);
  }
  const items = [
    s.specials.tall && [ICON.tall, t.map.special.tall],
    s.specials.shell && [ICON.shell, t.map.special.shell],
    s.specials.debut && [ICON.newJar, t.map.special.newJar(t.map.jars[s.specials.debut])],
  ].filter((x): x is [string, string] => !!x);
  $('stone-specials').replaceChildren(
    ...items.map(([icon, label]) => {
      const li = document.createElement('li');
      li.innerHTML = icon;
      li.append(label);
      return li;
    }),
  );
  $('stone-specials').hidden = items.length === 0;
  replayBtn.hidden = s.state !== 'cleared';
  openLayer(cardEl, s.state === 'cleared' ? replayBtn : $('btn-stone-close'), opener);
}

/** A stone tap: the next one plays; the others open their card (D49). */
function onStone(el: HTMLButtonElement): void {
  const level = Number(el.dataset.level);
  stones.get(focusLevel)?.setAttribute('tabindex', '-1');
  focusLevel = level;
  el.tabIndex = 0;
  const s = stoneAt(level, state.save, config);
  if (s.state === 'next') playFromMap(level, false);
  else openCard(s, el);
}

/**
 * The map's keys (§5): arrow keys move between stones, Enter plays the next level (a focused
 * button activates itself natively), Escape goes back to Home.
 */
export function onMapKey(e: KeyboardEvent): void {
  const onButton = document.activeElement instanceof HTMLButtonElement;
  const onStoneEl = onButton && (document.activeElement as HTMLElement).classList.contains('stone');
  if (e.key === 'Escape') {
    e.preventDefault();
    closeMap();
  } else if (e.key === 'Enter' && !onButton) {
    e.preventDefault();
    playFromMap(state.save.level, false);
  } else if (['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'].includes(e.key)) {
    e.preventDefault();
    const step = e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1;
    focusStone(onStoneEl ? focusLevel + step : focusLevel);
  }
}

/** The tap card's keys: Escape closes it. */
export function onStoneCardKey(e: KeyboardEvent): void {
  if (e.key === 'Escape') closeLayer(cardEl);
}

/** Wires the map: stone taps, the Play and back buttons, the tap card, scrolling and resizing. */
export function wireMap(): void {
  trackEl.append(pathSvg);
  trackEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLButtonElement>('.stone');
    if (el) onStone(el);
  });
  playBtn.addEventListener('click', () => playFromMap(state.save.level, false));
  $('btn-map-home').addEventListener('click', closeMap);
  $('btn-stone-close').addEventListener('click', () => closeLayer(cardEl));
  replayBtn.addEventListener('click', () => playFromMap(cardLevel, true));
  scrollEl.addEventListener('scroll', scheduleRender, { passive: true });
  window.addEventListener('resize', () => {
    if (mapEl.hidden) return;
    const keep = levelAtY(scrollEl.scrollTop + scrollEl.clientHeight / 2);
    clearTrack();
    measure();
    centre(keep);
    render();
  });
}
