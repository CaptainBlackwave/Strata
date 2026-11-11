/** The pour animation, with its reduced-motion shortcut and its recovery path. */
import { pourAmount } from '../../core/board';
import { burst, pourGrains, sandPile } from '../fx';
import { reducedMotion, wait } from '../dom';
import { makeTiltFill, renderSelectedState } from './jars';
import { showWin } from './win';
import { ANIM, audio, config, state } from '../state';

export async function animatePour(from: number, to: number): Promise<void> {
  state.busy = true;
  const src = state.jarEls[from];
  const dst = state.jarEls[to];
  const srcJar = state.session.board.jars[from];
  const color = config.palette[srcJar.units.at(-1)!].hex;
  const targetLen = state.session.board.jars[to].units.length;

  if (reducedMotion()) {
    const n = pourAmount(state.session.board, from, to);
    state.session.pour(from, to);
    audio.play('pour', { units: n });
    audio.play('land', { pitch: targetLen, units: n }); // the sound follows the sand moved, as with motion
    finishPour(from);
    return;
  }

  const s = src.getBoundingClientRect();
  const d = dst.getBoundingClientRect();
  const side = d.left + d.width / 2 >= s.left + s.width / 2 ? 1 : -1;
  const r = s.height / 2;
  const rad = (ANIM.tilt * Math.PI) / 180;
  const mouthX = d.left + d.width / 2 - side * 3;
  const mouthY = d.top - 10;
  const dx = mouthX - side * r * Math.sin(rad) - (s.left + s.width / 2);
  const dy = mouthY + r * Math.cos(rad) - (s.top + s.height / 2);
  const lifted = getComputedStyle(src).transform;
  src.classList.add('pouring');
  const tilt = makeTiltFill(src, from);
  const ease = 'cubic-bezier(.3,.7,.4,1)';

  const go = src.animate(
    [{ transform: lifted === 'none' ? 'none' : lifted }, { transform: `translate(${dx}px, ${dy}px) rotate(${side * ANIM.tilt}deg)` }],
    { duration: ANIM.lift, easing: ease, fill: 'forwards' },
  );
  const tiltIn = tilt.fill.animate(tilt.keyframes(0, rad, side), { duration: ANIM.lift, easing: ease, fill: 'forwards' });
  await go.finished;

  // Stream of sand from the mouth to the target's surface.
  const glass = dst.querySelector('.glass') as HTMLElement;
  const g = glass.getBoundingClientRect();
  const surface = g.bottom - 4 - targetLen * state.unitHeight;
  const stream = document.createElement('div');
  stream.className = 'stream';
  stream.style.left = `${mouthX - 3}px`;
  stream.style.top = `${mouthY}px`;
  stream.style.height = `${Math.max(8, surface - mouthY)}px`;
  stream.style.setProperty('--c', color);
  document.body.appendChild(stream);
  const moved = pourAmount(state.session.board, from, to);
  audio.play('pour', { units: moved });
  // Sprint 18 F1: the stream is a thin trickle with grains falling down it, over the stream and flow.
  pourGrains(mouthX, mouthY, surface, color, moved, ANIM.streamIn + ANIM.flow);
  await stream.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: ANIM.streamIn, easing: 'ease-in', fill: 'forwards' }).finished;

  const before = state.session.board.jars[from].units.length;
  state.session.pour(from, to);
  const after = state.session.board.jars[from].units.length;
  // Drain the poured stripes from the tilted fill.
  tilt.stripes.slice(after, before).forEach((el) => el.animate([{ height: `${state.unitHeight}px` }, { height: '0px' }], { duration: ANIM.flow, fill: 'forwards' }));
  burst({ x: mouthX, y: surface - (before - after) * state.unitHeight * 0.5, colors: [color], count: 10, spread: 22, angle: 0, cone: 160, size: 4, duration: 420, gravity: 14 });
  audio.play('land', { pitch: targetLen, units: before - after });
  sandPile(g, surface - (before - after) * state.unitHeight, color); // F1: lands as a soft pile that levels out
  await wait(ANIM.flow);

  stream.style.transformOrigin = 'bottom';
  await stream.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: ANIM.streamOut, fill: 'forwards' }).finished;
  stream.remove();

  // Let the player act again while the jar flies home.
  state.returning.add(from);
  src.classList.add('returning');
  finishPour(from);
  const back = src.animate([{ transform: `translate(${dx}px, ${dy}px) rotate(${side * ANIM.tilt}deg)` }, { transform: 'none' }], {
    duration: ANIM.back,
    easing: 'cubic-bezier(.4,0,.3,1)',
    fill: 'forwards',
  });
  const tiltOut = tilt.fill.animate(tilt.keyframes(rad, 0, side), { duration: ANIM.back, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' });
  await back.finished;
  go.cancel();
  back.cancel();
  tiltIn.cancel();
  tiltOut.cancel();
  tilt.remove();
  src.classList.remove('pouring', 'returning');
  state.returning.delete(from);
  if (state.pendingWin) showWin();
}

/** Puts a jar and the input lock back to rest after a pour animation failed part-way. */
export function recoverPour(from: number): void {
  state.returning.delete(from);
  state.jarEls[from]?.classList.remove('pouring', 'returning');
  finishPour(from);
}

export function finishPour(from: number): void {
  if (state.selected === from) state.selected = null;
  renderSelectedState();
  state.busy = false;
  if (state.pendingWin && reducedMotion()) showWin();
}
