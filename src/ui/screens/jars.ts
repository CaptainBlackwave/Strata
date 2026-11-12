/** Jar rendering: building the jars for the board size, redrawing one, mechanic effects, selection and refusals. */
import { type Board, type Jar, isSealed } from '../../core/board';
import { burst, sealShimmer, corkSparkle } from '../fx';
import { sceneSealBurst } from '../scene-fx';
import { computeLayout } from '../layout';
import { t } from '../strings';
import { boardEl, reducedMotion, showToast } from '../dom';
import { FLIP_MS } from '../logic/flip';
import { jarSummary } from '../logic/jar-label';
import { CLAM_OPEN_MS, shellCount } from '../logic/clam';
import { DRY_MS, wetHex, wetLeft } from '../logic/wet';
import { TIDE_MS, riseFrom, tideCount } from '../logic/tide';
import { audio, config, state } from '../state';
import { type DomDrawKeys, domDrawKeys, domRedraw } from '../board-gpu/dirty';
import { gpuCancelFlips, gpuClamOpen, gpuFlip, gpuHop, gpuInvalidate, gpuLayout, gpuNope, gpuSeal, gpuTide } from '../board-gpu/hooks';

/** How long a refused jar keeps its static red outline (ms): presentation only. */
const NOPE_MS = 700;
/** Colour-blind patterns defined in style.css (.pat-0 … .pat-13), one per palette colour (tests/unit/core/config-schema.test.ts keeps the two counts equal). */
const PATTERNS = config.palette.length;

/**
 * The hourglass jar's badge (D96): a small hourglass glyph and the pours left until its next
 * flip, in the empty `<b>`. Drawn for Strata; the glyph is two bulbs and a waist, nothing more.
 */
export const HOURGLASS_MARK =
  '<span class="hourglass-mark" aria-hidden="true"><svg viewBox="0 0 10 14" focusable="false">' +
  '<path class="hg-frame" d="M1.5 1h7M1.5 13h7M2.5 1c0 3.6 2.5 4.4 2.5 6S2.5 9.4 2.5 13M7.5 1c0 3.6-2.5 4.4-2.5 6s2.5 2.4 2.5 6"/>' +
  '<path class="hg-sand" d="M3.3 12.4c.2-1.7 1.1-2.5 1.7-3 .6.5 1.5 1.3 1.7 3z"/></svg><b></b></span>';

/**
 * The sieve jar's band (D96): a collar round the jar's neck in its band colour (`--band`), with a
 * mesh drawn over it so it never reads as sand. With colour patterns on it carries its colour's
 * pattern too. Drawn for Strata.
 */
export const SIEVE_BAND = '<span class="sieve-band" aria-hidden="true"><span class="sieve-mesh"></span></span>';

/**
 * The clam jar's shell (D96, §2.6): while the clam is closed a ribbed shell covers the glass, so
 * its sand cannot be seen, and the pours left until it opens sit on the shell in the empty `<b>`.
 * Drawn for Strata: a fan of ribs and growth rings from a hinge at the jar's foot, its crown domed.
 */
export const CLAM_SHELL = '<span class="clam-shell" aria-hidden="true"><span class="clam-ribs"></span><b></b></span>';

/**
 * A wet unit's mark (D189, §2.7): a small drop and the pours left until it dries, in the empty
 * `<b>`, on the unit itself so it travels with the sand. Drawn for Strata: one teardrop path.
 */
export const WET_MARK =
  '<i class="wet-mark" aria-hidden="true"><svg viewBox="0 0 10 13" focusable="false">' +
  '<path d="M5 .8C3.6 3.3 1.3 5.9 1.3 8.4a3.7 3.7 0 0 0 7.4 0C8.7 5.9 6.4 3.3 5 .8z"/></svg><b></b></i>';

/**
 * The tide jar's mark (D194, §2.8): a pill on the jar's base with a small wave and the pours left
 * until the tide turns, in the empty `<b>`; a sealed tide jar (D195) shows the wave alone, faded.
 * Drawn for Strata: two rolling wave lines, nothing more.
 */
export const TIDE_MARK =
  '<span class="tide-mark" aria-hidden="true"><svg viewBox="0 0 14 10" focusable="false">' +
  '<path d="M1 3.6c2-2.2 4-2.2 6 0s4 2.2 6 0M1 7.6c2-2.2 4-2.2 6 0s4 2.2 6 0"/></svg><b></b></span>';

let tapHandler: (i: number) => void = () => {};

/** Registers what a tap on jar `i` does. The board sets it at boot, so this file need not import the board. */
export function onJarTapDo(handler: (i: number) => void): void {
  tapHandler = handler;
}

export function buildJars(): void {
  const board = state.session.board;
  const rect = boardEl.getBoundingClientRect();
  const layout = computeLayout({ width: rect.width, height: rect.height, jars: board.jars.length, capacity: board.capacity });
  state.unitHeight = layout.unitHeight;
  const s = boardEl.style;
  s.setProperty('--jar-w', `${layout.jarWidth}px`);
  s.setProperty('--unit-h', `${layout.unitHeight}px`);
  s.setProperty('--jar-h', `${layout.jarHeight}px`);
  s.setProperty('--gap-x', `${layout.gapX}px`);
  s.setProperty('--gap-y', `${layout.gapY}px`);
  s.setProperty('--cols', String(layout.cols));

  boardEl.replaceChildren();
  const rows = document.createElement('div');
  rows.className = 'rows';
  state.jarEls = board.jars.map((_, i) => {
    const jar = document.createElement('button');
    jar.type = 'button';
    jar.className = 'jar';
    jar.dataset.index = String(i);
    jar.innerHTML =
      '<span class="cork" aria-hidden="true"></span><span class="padlock" aria-hidden="true"></span><span class="funnel-mark" aria-hidden="true"></span>' +
      '<span class="glass"><span class="sand"></span><span class="ice" aria-hidden="true"></span><span class="shine"></span></span>' +
      '<span class="hint-badge" aria-hidden="true"></span>' +
      HOURGLASS_MARK +
      TIDE_MARK +
      SIEVE_BAND +
      CLAM_SHELL;
    jar.addEventListener('click', () => tapHandler(i));
    rows.appendChild(jar);
    return jar;
  });
  boardEl.appendChild(rows);
  renderAllJars();
  gpuLayout(); // sprint 19 S2: the canvas board (when on) lines up with the new buttons
}

export function renderAllJars(shake = false): void {
  state.session.board.jars.forEach((_, i) => {
    updateJar(i);
    if (shake && !reducedMotion()) state.jarEls[i].animate([{ translate: '0 0' }, { translate: '0 -6px' }, { translate: '0 0' }], { duration: 260, delay: i * 25 });
  });
  if (shake) gpuHop(); // sprint 19 S5: the canvas jars hop too
}

/** A unit's drawn colour: buried sand is neutral, wet sand (D189, §2.7) its darker damp tone. */
export function unitColor(color: number, buried: boolean, wet = false): string {
  return buried ? 'var(--buried)' : wet ? wetHex(config.palette[color].hex) : config.palette[color].hex;
}

/** What each jar button was last drawn from (sprint 21 P2). A rebuilt button starts unknown, so it is drawn in full. */
const drawn = new WeakMap<HTMLElement, { keys: DomDrawKeys; selected: boolean }>();

/**
 * Redraws jar `i`. Units at index `growFrom` and above animate in. Only what changed since the
 * button was last drawn is touched (strata-8j3): an unchanged jar costs no DOM writes, so a pour
 * on a 16-jar board restyles and repaints the jars it moved, not all of them.
 */
export function updateJar(i: number, growFrom = Infinity): void {
  const board: Board = state.session.board;
  const jar = board.jars[i];
  const el = state.jarEls[i];
  if (!el) return;
  const sealed = isSealed(jar, board.capacity);
  const selected = state.selected === i;
  const keys = domDrawKeys(jar, { sealed, patterns: state.save.settings.patterns, unitHeight: state.unitHeight });
  const last = drawn.get(el);
  const todo = domRedraw(last?.keys ?? null, keys, last?.selected ?? false, selected, growFrom < jar.units.length);
  if (!todo.sand && !todo.rest && !todo.selection) return;
  drawn.set(el, { keys, selected });
  if (todo.sand) drawSand(el, jar, growFrom);
  if (todo.rest) {
    el.classList.toggle('sealed', sealed);
    if (!sealed) el.classList.remove('just-sealed');
    renderMechanics(el, jar);
    // A closed clam's sand is hidden from the screen reader too (D96, §2.6).
    // Wet units name their pours left; a complete jar still wet says it seals when dry (§2.7).
    el.setAttribute('aria-label', t.jarLabel(i, jarSummary(jar, sealed, (c) => config.palette[c].id, board.capacity)));
  }
  if (todo.selection) {
    el.classList.toggle('selected', selected);
    el.setAttribute('aria-pressed', String(selected));
  }
  gpuInvalidate(); // sprint 19 S2: redraws this jar on the canvas board, if it changed
}

/** Rebuilds jar button `el`'s sand column from `jar`. Units at index `growFrom` and above animate in. */
function drawSand(el: HTMLElement, jar: Jar, growFrom: number): void {
  const sand = el.querySelector('.sand') as HTMLElement;
  sand.replaceChildren(
    ...jar.units.map((color, k) => {
      const u = document.createElement('span');
      u.className = 'unit';
      if (k < jar.hidden) {
        u.classList.add('buried');
      } else {
        const left = wetLeft(jar, k);
        u.style.setProperty('--c', left > 0 ? wetHex(config.palette[color].hex) : config.palette[color].hex);
        if (state.save.settings.patterns) u.classList.add(`pat-${color % PATTERNS}`);
        if (left > 0) {
          // Wet sand (D189, §2.7): damp and darker, with a drop and its pours left.
          u.classList.add('wet');
          u.dataset.wet = String(left);
          u.innerHTML = WET_MARK.replace('<b></b>', `<b>${left}</b>`);
        }
      }
      if (k >= growFrom) {
        u.classList.add('grow');
        u.style.animationDelay = `${(k - growFrom) * 70}ms`;
      }
      return u;
    }),
  );
}

/** Draws a jar's mechanic state, and plays the thaw/unlock effect when one ends. */
export function renderMechanics(el: HTMLElement, jar: Jar): void {
  const wasFrozen = el.dataset.frozen === '1';
  const wasLocked = el.dataset.lock !== undefined && el.dataset.lock !== '';
  el.classList.toggle('narrow', jar.cap !== undefined);
  el.classList.toggle('funnel', jar.funnel === true);
  el.classList.toggle('frozen', jar.frozen === true);
  el.classList.toggle('locked', jar.lock !== undefined);
  // The hourglass count is jar state, so every redraw (pour, Undo, Restart, Shuffle) refreshes it.
  el.classList.toggle('hourglass', jar.hourglass !== undefined);
  const left = jar.hourglass ? String(jar.hourglass.left) : '';
  if (el.dataset.left !== left) {
    el.dataset.left = left;
    (el.querySelector('.hourglass-mark b') as HTMLElement).textContent = left;
  }
  // The tide jar's wave and count (D194, §2.8): sealed, it is still (D195), so the wave shows alone, faded.
  el.classList.toggle('tide', jar.tide !== undefined);
  const turnsIn = tideCount(jar, state.session.board.capacity);
  el.classList.toggle('tide-still', jar.tide !== undefined && turnsIn === '');
  if (el.dataset.tide !== turnsIn) {
    el.dataset.tide = turnsIn;
    (el.querySelector('.tide-mark b') as HTMLElement).textContent = turnsIn;
  }
  // The sieve's band is jar state too (it never changes in play, but a rebuilt board may differ).
  el.classList.toggle('sieve', jar.sieve !== undefined);
  if (jar.sieve !== undefined) {
    const band = el.querySelector('.sieve-band') as HTMLElement;
    band.style.setProperty('--band', config.palette[jar.sieve].hex);
    band.className = `sieve-band${state.save.settings.patterns ? ` pat-${jar.sieve % PATTERNS}` : ''}`;
  }
  // A closed clam's shell and count (D96, §2.6). Undo of the opening pour closes it again here.
  el.classList.toggle('clam', jar.clam !== undefined);
  const opensIn = shellCount(jar);
  if (el.dataset.clam !== opensIn) {
    el.dataset.clam = opensIn;
    (el.querySelector('.clam-shell b') as HTMLElement).textContent = opensIn;
  }
  const glass = el.querySelector('.glass') as HTMLElement;
  if (jar.cap !== undefined) glass.style.height = `${state.unitHeight * jar.cap + Math.round(state.unitHeight * 0.45)}px`;
  else glass.style.removeProperty('height');
  const padlock = el.querySelector('.padlock') as HTMLElement;
  if (jar.lock !== undefined) {
    padlock.style.setProperty('--lock', config.palette[jar.lock].hex);
    padlock.className = `padlock${state.save.settings.patterns ? ` pat-${jar.lock % PATTERNS}` : ''}`;
  }
  if (wasFrozen && !jar.frozen) mechanicFx(el, 'thawing', t.thawed);
  if (wasLocked && jar.lock === undefined) mechanicFx(el, 'unlocking', t.unlocked);
  el.dataset.frozen = jar.frozen ? '1' : '';
  el.dataset.lock = jar.lock !== undefined ? String(jar.lock) : '';
}

export function mechanicFx(el: HTMLElement, cls: string, label: string): void {
  showToast(label);
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), 900);
  audio.play('booster');
  const r = el.getBoundingClientRect();
  burst({ x: r.left + r.width / 2, y: r.top + r.height * 0.3, colors: ['#dff3ff', '#ffffff', '#b9e0f5'], count: 14, spread: r.width, size: 5, duration: 600, className: 'spark' });
}

/** Flip and clam-opening animations still playing or waiting, so a board change can stop them (Undo, Restart, Shuffle). */
const flips = new Set<Animation>();

/**
 * The hourglass flip on jar `i` (D96). The jar already shows its new order. Its sand column
 * turns over about its own middle (rotateX 180° → 0°), so it starts looking exactly like the old
 * order and ends in the new one, and the badge's glyph turns half over. The old look is held for
 * `delay` ms, while the pour around it finishes. Reduced motion: no motion, the new order is
 * simply drawn. The `flip` sound plays either way.
 */
export function flipFx(i: number, delay: number): void {
  const el = state.jarEls[i];
  if (!el) return;
  audio.play('flip', { delay: delay / 1000 });
  if (reducedMotion()) return;
  gpuFlip(i, delay); // sprint 19 S3: the canvas board turns its sand over too
  const timing: KeyframeAnimationOptions = { duration: FLIP_MS, delay, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'backwards' };
  const sand = el.querySelector('.sand') as HTMLElement;
  const glyph = el.querySelector('.hourglass-mark svg') as SVGElement | null;
  const runs = [
    sand.animate([{ transform: 'perspective(160px) rotateX(180deg)' }, { transform: 'perspective(160px) rotateX(0deg)' }], timing),
    ...(glyph ? [glyph.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(180deg)' }], { ...timing, fill: 'none' })] : []),
  ];
  for (const a of runs) {
    flips.add(a);
    a.addEventListener('finish', () => flips.delete(a));
    a.addEventListener('cancel', () => flips.delete(a));
  }
}

/**
 * A clam's shell swinging open on jar `i` (D96, §2.6). The jar is already drawn open (its sand
 * shows); `.clam-opening` keeps the shell drawn over it, closed for `delay` ms while the pour's
 * sand lands, then the shell tips back on its hinge at the foot and fades. Short and calm.
 * Reduced motion: no motion, the open jar is simply drawn. The `clamOpen` sound plays either way.
 * An Undo or other board change cancels it (cancelFlips), and the redraw closes the clam again.
 */
export function clamOpenFx(i: number, delay: number): void {
  const el = state.jarEls[i];
  if (!el) return;
  audio.play('clamOpen', { delay: delay / 1000 });
  if (reducedMotion()) return;
  gpuClamOpen(i, delay); // sprint 19 S3: and swings its shell open
  const shell = el.querySelector('.clam-shell') as HTMLElement;
  el.classList.add('clam-opening');
  const a = shell.animate(
    [
      { transform: 'perspective(240px) rotateX(0deg)', opacity: 1 },
      { transform: 'perspective(240px) rotateX(34deg)', opacity: 1, offset: 0.45 },
      { transform: 'perspective(240px) rotateX(78deg)', opacity: 0 },
    ],
    { duration: CLAM_OPEN_MS, delay, easing: 'cubic-bezier(.3,.6,.4,1)', fill: 'backwards' },
  );
  flips.add(a);
  const done = () => {
    flips.delete(a);
    el.classList.remove('clam-opening');
  };
  a.addEventListener('finish', done);
  a.addEventListener('cancel', done);
}

/**
 * Wet sand drying (D189, §2.7): a short soft shimmer sweeps across each unit of jar `i` that just
 * dried (`units`, indices bottom first), once the pour's sand has landed (`delay` ms). The units are
 * already drawn dry. On the Realistic board the sweep shows over the canvas the same way. Reduced
 * motion: the caller plays nothing (`dryDelay` is `null`). A board change cancels it with the flips.
 */
export function dryFx(i: number, units: readonly number[], delay: number): void {
  const el = state.jarEls[i];
  if (!el) return;
  const spans = el.querySelectorAll<HTMLElement>('.sand > .unit');
  for (const k of units) {
    const u = spans[k];
    if (!u) continue;
    u.querySelector('.dry-shimmer')?.remove();
    const sweep = document.createElement('i');
    sweep.className = 'dry-shimmer';
    sweep.setAttribute('aria-hidden', 'true');
    u.style.position = 'relative';
    u.appendChild(sweep);
    const a = sweep.animate(
      [
        { transform: 'translateX(-100%)', opacity: 0 },
        { opacity: 1, offset: 0.25 },
        { opacity: 0.85, offset: 0.7 },
        { transform: 'translateX(100%)', opacity: 0 },
      ],
      { duration: DRY_MS, delay: delay + k * 40, easing: 'cubic-bezier(.45,.05,.35,1)', fill: 'both' },
    );
    flips.add(a);
    const done = () => {
      flips.delete(a);
      sweep.remove();
    };
    a.addEventListener('finish', done);
    a.addEventListener('cancel', done);
  }
}

/**
 * The tide turning on jar `i` (D194, §2.8): the jar already shows its new order. After `delay` ms
 * (the pour around it done, as the hourglass flip) its top unit, which came from the bottom, slides
 * up through the column, narrowing as it passes, while every other unit drops one place, so it starts exactly like the old
 * order (`fill: 'backwards'`). Wet counts and colour patterns are on the unit spans, so they move
 * with their sand. The wave on the mark bobs once. The caller plays it only when the turn can be
 * seen (`risesVisibly`). Reduced motion: no motion, the new order is simply drawn. The `flip`
 * sound (sand sliding) plays either way. A board change cancels it with the flips.
 */
export function tideFx(i: number, delay: number): void {
  const el = state.jarEls[i];
  if (!el) return;
  audio.play('flip', { delay: delay / 1000 });
  if (reducedMotion()) return;
  gpuTide(i, delay); // the canvas board lifts its sand too
  const spans = [...el.querySelectorAll<HTMLElement>('.sand > .unit')];
  const n = spans.length;
  const timing: KeyframeAnimationOptions = { duration: TIDE_MS, delay, easing: 'cubic-bezier(.45,0,.25,1)', fill: 'backwards' };
  const runs: Animation[] = [];
  spans.forEach((u, k) => {
    const from = riseFrom(k, n);
    if (k === n - 1) {
      u.style.position = 'relative';
      u.style.zIndex = '1'; // the rising unit slides over the rest
    }
    // Units are laid bottom first (column-reverse), so "up" is a negative translate. The rising unit
    // narrows on its way up, so the units dropping past it stay in view.
    const y0 = `translateY(calc(${-from} * var(--unit-h)))`;
    runs.push(
      k === n - 1
        ? u.animate([{ transform: `${y0} scaleX(1)` }, { transform: `translateY(calc(${-from / 2} * var(--unit-h))) scaleX(0.5)`, offset: 0.5 }, { transform: 'translateY(0) scaleX(1)' }], timing)
        : u.animate([{ transform: y0 }, { transform: 'translateY(0)' }], timing),
    );
  });
  const glyph = el.querySelector('.tide-mark svg') as SVGElement | null;
  if (glyph) runs.push(glyph.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-22%)' }, { transform: 'translateY(0)' }], { ...timing, fill: 'none' }));
  for (const a of runs) {
    flips.add(a);
    const done = () => flips.delete(a);
    a.addEventListener('finish', done);
    a.addEventListener('cancel', done);
  }
}

/** Stops every flip and clam-opening animation: the board was redrawn by something other than a pour. */
export function cancelFlips(): void {
  for (const a of [...flips]) a.cancel();
  gpuCancelFlips();
}

export function setSelected(i: number | null): void {
  const prev = state.selected;
  state.selected = i;
  if (prev !== null) updateJar(prev);
  if (i !== null) updateJar(i);
}

export function renderSelectedState(): void {
  state.jarEls.forEach((el, i) => {
    const selected = state.selected === i;
    const last = drawn.get(el);
    if (last) {
      if (last.selected === selected) return; // already drawn this way
      drawn.set(el, { ...last, selected });
    }
    el.classList.toggle('selected', selected);
    el.setAttribute('aria-pressed', String(selected));
  });
  gpuInvalidate();
}

export function nope(i: number): void {
  const el = state.jarEls[i];
  el.classList.remove('nope');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('nope');
  window.clearTimeout(Number(el.dataset.nopeTimer));
  el.dataset.nopeTimer = String(window.setTimeout(() => el.classList.remove('nope'), NOPE_MS));
  gpuNope(i); // sprint 19 S5: the canvas jar shakes with its button
  audio.play('nope');
}

/**
 * A jar just sealed: the cork drops in (CSS, with a bounce and, sprint 18 F2, a sparkle), the shimmer,
 * and the chime, one scale step higher for each jar this board sealed before it (`step`, 0 for the first).
 */
export function sealFx(i: number, color: string, step = 0): void {
  const el = state.jarEls[i];
  el.classList.remove('just-sealed');
  void el.offsetWidth;
  el.classList.add('just-sealed');
  gpuSeal(i); // sprint 19 S5: the canvas cork drops in
  window.setTimeout(() => {
    sealShimmer(el, color); // a soft shimmer up the glass and a few motes (D68)
    sceneSealBurst(el, color); // tier 3 scenes: a firework, a meteor or an aurora ripple
    corkSparkle(el); // F2: where the cork lands (nothing under reduced motion)
    audio.play('seal', { step });
  }, reducedMotion() ? 0 : 180);
}

/**
 * The tilted fill: a world-level band of sand inside the tilting glass, so the
 * surface stays horizontal while the jar rotates (teardown V2-3).
 * Returns the element plus helpers to animate it in step with the jar.
 */
export function makeTiltFill(jarEl: HTMLElement, i: number) {
  const glass = jarEl.querySelector('.glass') as HTMLElement;
  const jar = state.session.board.jars[i];
  const Hg = glass.clientHeight;
  const W = glass.clientWidth;
  const fill = document.createElement('span');
  fill.className = 'tilt';
  const band = document.createElement('span');
  band.className = 'tilt-band';
  band.style.width = `${Hg * 3}px`;
  band.style.left = `${-Hg * 1.5}px`;
  const stripes = jar.units.map((c, k) => {
    const s = document.createElement('span');
    s.style.background = unitColor(c, k < jar.hidden, wetLeft(jar, k) > 0);
    s.style.height = `${state.unitHeight + (k === 0 ? 40 : 0)}px`;
    return s;
  });
  band.append(...stripes);
  fill.appendChild(band);
  glass.appendChild(fill);
  jarEl.classList.add('tilting');
  /** Transform at tilt angle `phi` (radians): counter-rotate, drop to the low point, squash with the tilt. */
  const at = (phi: number, sign: number) => {
    const E = (Hg / 2) * Math.abs(Math.cos(phi)) + (W / 2) * Math.sin(phi);
    const k = (2 * E) / Hg;
    return `rotate(${-sign * phi}rad) translateY(${E - 3}px) scaleY(${k.toFixed(4)})`;
  };
  const keyframes = (from: number, to: number, sign: number) =>
    Array.from({ length: 9 }, (_, n) => ({ transform: at(from + ((to - from) * n) / 8, sign) }));
  return {
    fill,
    stripes,
    keyframes,
    remove: () => {
      fill.remove();
      jarEl.classList.remove('tilting');
    },
  };
}
