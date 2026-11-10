/** Jar rendering: building the jars for the board size, redrawing one, mechanic effects, selection and refusals. */
import { type Board, type Jar, isSealed } from '../../core/board';
import { burst, sealShimmer } from '../fx';
import { sceneSealBurst } from '../scene-fx';
import { computeLayout } from '../layout';
import { t } from '../strings';
import { boardEl, reducedMotion, showToast } from '../dom';
import { FLIP_MS } from '../logic/flip';
import { jarSummary } from '../logic/jar-label';
import { audio, config, state } from '../state';

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
      SIEVE_BAND +
      CLAM_SHELL;
    jar.addEventListener('click', () => tapHandler(i));
    rows.appendChild(jar);
    return jar;
  });
  boardEl.appendChild(rows);
  renderAllJars();
}

export function renderAllJars(shake = false): void {
  state.session.board.jars.forEach((_, i) => {
    updateJar(i);
    if (shake && !reducedMotion()) state.jarEls[i].animate([{ translate: '0 0' }, { translate: '0 -6px' }, { translate: '0 0' }], { duration: 260, delay: i * 25 });
  });
}

export function unitColor(color: number, buried: boolean): string {
  return buried ? 'var(--buried)' : config.palette[color].hex;
}

/** Redraws jar `i`. Units at index `growFrom` and above animate in. */
export function updateJar(i: number, growFrom = Infinity): void {
  const board: Board = state.session.board;
  const jar = board.jars[i];
  const el = state.jarEls[i];
  if (!el) return;
  const sand = el.querySelector('.sand') as HTMLElement;
  sand.replaceChildren(
    ...jar.units.map((color, k) => {
      const u = document.createElement('span');
      u.className = 'unit';
      if (k < jar.hidden) {
        u.classList.add('buried');
      } else {
        u.style.setProperty('--c', config.palette[color].hex);
        if (state.save.settings.patterns) u.classList.add(`pat-${color % PATTERNS}`);
      }
      if (k >= growFrom) {
        u.classList.add('grow');
        u.style.animationDelay = `${(k - growFrom) * 70}ms`;
      }
      return u;
    }),
  );
  const sealed = isSealed(jar, board.capacity);
  el.classList.toggle('sealed', sealed);
  if (!sealed) el.classList.remove('just-sealed');
  renderMechanics(el, jar);
  el.classList.toggle('selected', state.selected === i);
  el.setAttribute('aria-pressed', String(state.selected === i));
  // A closed clam's sand is hidden from the screen reader too (D96, §2.6).
  el.setAttribute('aria-label', t.jarLabel(i, jarSummary(jar, sealed, (c) => config.palette[c].id)));
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
  // The sieve's band is jar state too (it never changes in play, but a rebuilt board may differ).
  el.classList.toggle('sieve', jar.sieve !== undefined);
  if (jar.sieve !== undefined) {
    const band = el.querySelector('.sieve-band') as HTMLElement;
    band.style.setProperty('--band', config.palette[jar.sieve].hex);
    band.className = `sieve-band${state.save.settings.patterns ? ` pat-${jar.sieve % PATTERNS}` : ''}`;
  }
  // A closed clam's shell and count (D96, §2.6). Undo of the opening pour closes it again here.
  el.classList.toggle('clam', jar.clam !== undefined);
  const opensIn = jar.clam !== undefined ? String(jar.clam) : '';
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

/** Flip animations still playing or waiting, so a board change can stop them (Undo, Restart, Shuffle). */
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

/** Stops every flip animation: the board was redrawn by something other than a pour. */
export function cancelFlips(): void {
  for (const a of [...flips]) a.cancel();
}

export function setSelected(i: number | null): void {
  const prev = state.selected;
  state.selected = i;
  if (prev !== null) updateJar(prev);
  if (i !== null) updateJar(i);
}

export function renderSelectedState(): void {
  state.jarEls.forEach((el, i) => {
    el.classList.toggle('selected', state.selected === i);
    el.setAttribute('aria-pressed', String(state.selected === i));
  });
}

export function nope(i: number): void {
  const el = state.jarEls[i];
  el.classList.remove('nope');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('nope');
  window.clearTimeout(Number(el.dataset.nopeTimer));
  el.dataset.nopeTimer = String(window.setTimeout(() => el.classList.remove('nope'), NOPE_MS));
  audio.play('nope');
}

export function sealFx(i: number, color: string): void {
  const el = state.jarEls[i];
  el.classList.remove('just-sealed');
  void el.offsetWidth;
  el.classList.add('just-sealed');
  window.setTimeout(() => {
    sealShimmer(el, color); // a soft shimmer up the glass and a few motes (D68)
    sceneSealBurst(el, color); // tier 3 scenes: a firework, a meteor or an aurora ripple
    audio.play('seal');
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
    s.style.background = unitColor(c, k < jar.hidden);
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
