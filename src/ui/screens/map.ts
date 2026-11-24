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
import { mapHintOnOpen } from './onboarding';
import { shareChallenge } from './friend';
import { dailyKey } from '../clock';
import { type Box, type FestiveConfig, type FestiveDecor, decorSpots, festiveDecorFor, lightRun, mapDecorOn, mapLightsOn, sagWire } from '../logic/festive';

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
/** The December lights (sprint 31, D241, §2.4): their own layer over the path, under the stones. */
const lightsSvg = document.createElementNS(SVG_NS, 'svg');
lightsSvg.classList.add('map-lights');
lightsSvg.setAttribute('aria-hidden', 'true');
/** One twinkle's length, s (style.css `bulb-twinkle`): a redrawn bulb picks up its phase from the clock, so scrolling never restarts it. */
const TWINKLE_S = 4.8;
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

/**
 * The December decorations (sprint 31): flat seaside-Christmas art in the scenery's style, fixed festive
 * colours with an outline in the scene's ink so they read on day and night bands. `viewBox` 0 0 60 70,
 * standing on y 66. Decorative only: inside the band, which is aria-hidden and takes no taps.
 */
const DECOR: Record<FestiveDecor, string> = {
  tree:
    '<svg viewBox="0 0 60 70"><ellipse class="d-shadow" cx="30" cy="66" rx="19" ry="3.5"/><rect class="d-trunk" x="26.5" y="55" width="7" height="11" rx="1"/>' +
    '<path class="d-fir" d="M30 22 51 58Q30 63 9 58Z"/><path class="d-fir" d="M30 13 46 42Q30 47 14 42Z"/><path class="d-fir" d="M30 7 41 28Q30 32 19 28Z"/>' +
    '<path class="d-tinsel" d="M17 39Q30 45 42.5 36M12.5 55Q30 61 47.5 51"/>' +
    '<circle class="d-red" cx="21" cy="51" r="2.6"/><circle class="d-gold" cx="35" cy="54" r="2.6"/><circle class="d-blue" cx="42" cy="47" r="2.3"/><circle class="d-gold" cx="22" cy="35" r="2.3"/><circle class="d-red" cx="35" cy="33" r="2.3"/><circle class="d-blue" cx="28" cy="23" r="2"/>' +
    '<path class="d-star" d="M30 0 31.3 3.2 34.8 3.5 32.1 5.7 32.9 9.1 30 7.2 27.1 9.1 27.9 5.7 25.2 3.5 28.7 3.2Z"/></svg>',
  snowman:
    '<svg viewBox="0 0 60 70"><ellipse class="d-shadow" cx="30" cy="66" rx="17" ry="3.5"/><path class="d-stick" d="M19.5 45 8 37M11 39.2 8.5 34.5M40.5 45 52 36.5M48.8 38.8 50.5 33.8"/>' +
    '<circle class="d-snow" cx="30" cy="53" r="13"/><circle class="d-snow" cx="30" cy="32" r="9.5"/>' +
    '<path class="d-red" d="M21.5 38.5Q30 43.5 38.5 38.5V42Q30 47 21.5 42ZM33 42.5 35.5 53 39.5 52 36.8 41.5Z"/>' +
    '<circle class="d-coal" cx="26.8" cy="29.5" r="1.3"/><circle class="d-coal" cx="33.2" cy="29.5" r="1.3"/><circle class="d-coal" cx="30" cy="49" r="1.4"/><circle class="d-coal" cx="30" cy="55" r="1.4"/>' +
    '<path class="d-carrot" d="M30 32.2 37.5 34 30 35.6Z"/>' +
    '<rect class="d-hat" x="24" y="10" width="12" height="12.5" rx="1.5"/><rect class="d-red" x="24" y="18" width="12" height="2.8"/><rect class="d-hat" x="20.5" y="21.5" width="19" height="3.2" rx="1.2"/></svg>',
  presents:
    '<svg viewBox="0 0 60 70"><ellipse class="d-shadow" cx="30" cy="66" rx="25" ry="3.5"/>' +
    '<rect class="d-red" x="6" y="40" width="27" height="26" rx="1.5"/><path class="d-ribbon" d="M17.5 40h4v26h-4ZM6 50.5h27v4H6Z"/>' +
    '<rect class="d-green" x="33" y="48" width="21" height="18" rx="1.5"/><path class="d-ribbon-pale" d="M41.5 48h4v18h-4Z"/>' +
    '<rect class="d-blue" x="11.5" y="25" width="17" height="15" rx="1.2"/><path class="d-ribbon-pale" d="M18 25h4v15h-4Z"/>' +
    '<path class="d-ribbon-pale" d="M20 25C13 17 10 24 20 25 30 24 27 17 20 25Z"/><path class="d-ribbon" d="M43.5 48C37 41 34.5 47.5 43.5 48 52.5 47.5 50 41 43.5 48Z"/></svg>',
};

/** A wreath with a red bow for the lighthouse tower: drawn in the lighthouse's own viewBox, laid over it. */
const WREATH =
  '<svg viewBox="0 0 80 110"><circle class="d-wreath" cx="36" cy="42" r="5.6"/><circle class="d-red" cx="32.4" cy="38.6" r="1"/><circle class="d-red" cx="40" cy="40" r="1"/><circle class="d-red" cx="35" cy="47" r="1"/>' +
  '<path class="d-tail" d="M36 47.2 34 52.5M36 47.2 38 52.5"/><path class="d-red" d="M36 47.2 32.4 45.2 32.6 49.4ZM36 47.2 39.6 45.2 39.4 49.4Z"/></svg>';

/** Decorations stand where the path keeps to this fraction of the width or more (the land is on the left). */
const DECOR_MIN_X = 0.65;

/** The December decorations in band `band` (`lo..hi` of its levels on the track), as HTML: empty out of season. */
function festiveDecor(band: number, id: string, first: number, last: number, lo: number, hi: number, top: number, place: (at: number) => string): string {
  if (!mapDecorOn(dailyKey(state.clock), config as unknown as FestiveConfig)) return '';
  let html = '';
  decorSpots(first, last, pathX, DECOR_MIN_X).forEach((lv, slot) => {
    if (lv - 1 < lo || lv > hi) return;
    // Between stone `lv - 1` and `lv`, where the path is far over to the right.
    html += `<span class="decor" aria-hidden="true" style="top:${yOf(lv) + geo.pitch / 2 - top}px">${DECOR[festiveDecorFor(band, slot)]}</span>`;
  });
  if (id === 'lighthouse') for (const at of SCENERY.lighthouse.landAt ?? []) html += `<span class="motif motif-land decor-wreath" aria-hidden="true" style="${place(at)}">${WREATH}</span>`;
  return html;
}

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
  html += festiveDecor(band, b.id, b.first, b.last, lo, hi, top, place);
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
  drawLights(from, to, width);
}

/** One bulb (sprint 31 art pass): a glass drop hanging from its socket at the wire, 6.6 px across. */
const BULB =
  '<path class="bulb-glass" d="M-1.8 2.2C-3.3 3.8-3.4 6.6-1.9 8.9-1.2 10-.5 10.6 0 10.8.5 10.6 1.2 10 1.9 8.9 3.4 6.6 3.3 3.8 1.8 2.2Z"/>' +
  '<ellipse class="bulb-shine" cx="-1.1" cy="5.4" rx=".7" ry="1.5"/><rect class="bulb-cap" x="-1.8" y="-.6" width="3.6" height="3.2" rx=".8"/>';
/** How far a bulb hangs below the wire, px (BULB's tip), so the lights keep it clear of stones and their marks. */
const BULB_DROP = 11;
/** Each bulb colour's glow: a soft radial fade, under the bulb. */
const GLOWS = `<defs>${[0, 1, 2, 3]
  .map((k) => `<radialGradient id="map-glow-${k}"><stop offset="0" style="stop-color:var(--bulb-${k});stop-opacity:.95"/><stop offset=".4" style="stop-color:var(--bulb-${k});stop-opacity:.5"/><stop offset="1" style="stop-color:var(--bulb-${k});stop-opacity:0"/></radialGradient>`)
  .join('')}</defs>`;

/**
 * The boxes of stones `from..to` and their marks (tags, lock, Perfect), track px, for the lights to keep
 * clear of: each as drawn, so a large next stone (and its ring) or large text keeps its own clearance.
 */
function stoneBoxes(from: number, to: number): Box[] {
  const t0 = trackEl.getBoundingClientRect();
  const boxes: Box[] = [];
  const add = (el: Element, pad: number) => {
    const r = el.getBoundingClientRect();
    boxes.push([r.left - t0.left - pad, r.top - t0.top - pad, r.right - t0.left + pad, r.bottom - t0.top + pad]);
  };
  for (let lv = from; lv <= to; lv++) {
    const el = stones.get(lv);
    if (!el) continue;
    add(el, el.classList.contains('stone-next') ? 8 : 3);
    for (const m of el.querySelectorAll('.stone-tags, .stone-lock, .stone-mark')) add(m, 3);
  }
  return boxes;
}

/**
 * The December lights through stones `from..to` (§2.4): from `festive.from` to `festive.to` (UTC), a
 * drooping wire beside the path with a hanging bulb every 21 px, kept clear of every stone and its marks. Each bulb glows and fades out of phase with its neighbours; under
 * reduced motion they stay still.
 */
function drawLights(from: number, to: number, width: number): void {
  if (!mapLightsOn(dailyKey(state.clock), config as unknown as FestiveConfig) || to <= from) {
    if (lightsSvg.firstChild) lightsSvg.replaceChildren();
    return;
  }
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  // The circle keeps stones not in the DOM clear; the boxes fit the drawn ones closely, so the string runs long.
  const gap = Math.max(30, 1.9 * rem);
  const pt = (lv: number) => [pathX(lv) * width, yOf(lv)] as const;
  const avoid = stoneBoxes(from, to);
  const now = performance.now() / 1000;
  let wire = '';
  let bulbs = '';
  for (let lv = from + 1; lv <= to; lv++) {
    const run = lightRun(pt(lv - 1), pt(lv), gap, 21, 15, BULB_DROP, avoid);
    if (run.wire.length > 1) wire += sagWire([run.wire[0], ...run.bulbs, run.wire[run.wire.length - 1]], 2.5);
    run.bulbs.forEach(([x, y], k) => {
      const n = lv * 3 + k;
      const delay = -(((now + n * 1.7) % TWINKLE_S) + TWINKLE_S) % TWINKLE_S;
      const tilt = ((n % 3) - 1) * 12; // hung by hand: a little this way and that
      bulbs +=
        `<g class="bulb bulb-${n % 4}" style="animation-delay:${delay.toFixed(2)}s" transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${tilt})">` +
        `<circle class="bulb-halo" cy="6.5" r="12" fill="url(#map-glow-${n % 4})"/>${BULB}</g>`;
    });
  }
  lightsSvg.setAttribute('width', String(width));
  lightsSvg.setAttribute('height', String(geo.height));
  lightsSvg.classList.toggle('still', reducedMotion());
  lightsSvg.innerHTML = `${GLOWS}<path class="light-wire" d="${wire}"/>${bulbs}`;
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
  mapHintOnOpen(); // the first open says what the path is (O2)
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
  $('btn-stone-challenge').hidden = s.state !== 'cleared' || s.best === undefined; // sharing §3.2
  openLayer(cardEl, s.state === 'cleared' ? replayBtn : $('btn-stone-close'), opener);
}

/** A stone tap: the next one plays; the others open their card (D49). */
function onStone(el: HTMLButtonElement): void {
  const level = Number(el.dataset.level);
  stones.get(focusLevel)?.setAttribute('tabindex', '-1');
  focusLevel = level;
  el.tabIndex = 0;
  const s = stoneAt(level, state.save, config);
  if (s.state === 'next') return playFromMap(level, false);
  audio.unlock();
  audio.play(s.state === 'locked' ? 'locked' : 'mapStone');
  openCard(s, el);
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
  trackEl.append(pathSvg, lightsSvg);
  trackEl.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLButtonElement>('.stone');
    if (el) onStone(el);
  });
  playBtn.addEventListener('click', () => playFromMap(state.save.level, false));
  $('btn-map-home').addEventListener('click', closeMap);
  $('btn-stone-close').addEventListener('click', () => closeLayer(cardEl));
  replayBtn.addEventListener('click', () => playFromMap(cardLevel, true));
  $('btn-stone-challenge').addEventListener('click', () => {
    const best = state.save.best[String(cardLevel)];
    if (best !== undefined) shareChallenge(cardLevel, best, $('btn-stone-challenge'));
  });
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
