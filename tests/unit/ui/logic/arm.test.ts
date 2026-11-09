// Sprint 10 F6 (TD-12, docs/tech-debt.md): the booster price confirm and Restart's second tap,
// as pure state machines with the time injected (src/ui/logic/arm.ts). UX-board-7 and F6.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import type { BoosterId, EconomyConfig } from '../../../../src/core/economy';
import {
  BOOSTER_IDLE,
  BOOSTER_TRANSITIONS,
  type BoosterTap,
  RESTART_IDLE,
  RESTART_TRANSITIONS,
  type RestartArm,
  type RestartTap,
  stepBooster,
  stepRestart,
} from '../../../../src/ui/logic/arm';

const cfg = config as unknown as EconomyConfig;
const WINDOW = 3000; // the window length belongs to the call site; any value works here
const T0 = 10_000;

/** A tap on booster `id` with nothing in the way: no charges, and coins for exactly one purchase. */
function tap(id: BoosterId, over: Partial<BoosterTap> = {}): BoosterTap {
  const price = cfg.boosters[id].price;
  return { type: 'tap', id, now: T0, windowMs: WINDOW, blocked: false, assistBusy: false, canUndo: true, charges: 0, coins: price, price, free: cfg.boosters[id].free === true, ...over };
}

describe('stepBooster: idle, armed (with the price), then bought or expired', () => {
  it('arms on the first tap with 0 charges and enough coins, carrying the price and the deadline', () => {
    const r = stepBooster(BOOSTER_IDLE, tap('hint'));
    expect(r.effect).toBe('confirm');
    expect(r.next).toEqual({ state: 'armed', id: 'hint', price: cfg.boosters.hint.price, until: T0 + WINDOW });
  });

  it('buys on the second tap within the window, and returns to idle', () => {
    const armed = stepBooster(BOOSTER_IDLE, tap('hint')).next;
    const r = stepBooster(armed, tap('hint', { now: T0 + WINDOW - 1 }));
    expect(r.effect).toBe('buy');
    expect(r.next).toEqual(BOOSTER_IDLE);
  });

  it('a second tap at or after the deadline asks again instead of buying', () => {
    const armed = stepBooster(BOOSTER_IDLE, tap('hint')).next;
    const r = stepBooster(armed, tap('hint', { now: T0 + WINDOW }));
    expect(r.effect).toBe('confirm');
    expect(r.next).toEqual({ state: 'armed', id: 'hint', price: cfg.boosters.hint.price, until: T0 + 2 * WINDOW });
  });

  it('expires on the time-out, and the next tap arms again', () => {
    const armed = stepBooster(BOOSTER_IDLE, tap('shuffle')).next;
    const r = stepBooster(armed, { type: 'expire' });
    expect(r).toEqual({ next: BOOSTER_IDLE, effect: 'expired' });
    expect(stepBooster(r.next, tap('shuffle', { now: T0 + 1 })).effect).toBe('confirm');
  });

  it('disarms on any other action (a pour, Undo, Restart, a new board): the next tap arms again', () => {
    const armed = stepBooster(BOOSTER_IDLE, tap('extraJar')).next;
    const r = stepBooster(armed, { type: 'cancel' });
    expect(r).toEqual({ next: BOOSTER_IDLE, effect: 'disarmed' });
    expect(stepBooster(r.next, tap('extraJar', { now: T0 + 1 })).effect).toBe('confirm');
  });

  it('expire and cancel on idle change nothing', () => {
    expect(stepBooster(BOOSTER_IDLE, { type: 'expire' })).toEqual({ next: BOOSTER_IDLE, effect: 'none' });
    expect(stepBooster(BOOSTER_IDLE, { type: 'cancel' })).toEqual({ next: BOOSTER_IDLE, effect: 'none' });
  });

  it('tapping a different booster while one is armed arms the new one instead', () => {
    const armed = stepBooster(BOOSTER_IDLE, tap('hint')).next;
    const r = stepBooster(armed, tap('shuffle', { now: T0 + 1 }));
    expect(r.effect).toBe('confirm');
    expect(r.next).toMatchObject({ state: 'armed', id: 'shuffle' });
  });

  it('a stored charge is used at once, without a confirm, and disarms any armed booster', () => {
    expect(stepBooster(BOOSTER_IDLE, tap('hint', { charges: 1 }))).toEqual({ next: BOOSTER_IDLE, effect: 'use' });
    const armed = stepBooster(BOOSTER_IDLE, tap('hint')).next;
    expect(stepBooster(armed, tap('shuffle', { charges: 2 }))).toEqual({ next: BOOSTER_IDLE, effect: 'use' });
  });

  it('a free Undo never asks for a confirm, even with no coins', () => {
    expect(cfg.boosters.undo.free).toBe(true);
    expect(stepBooster(BOOSTER_IDLE, tap('undo', { coins: 0 }))).toEqual({ next: BOOSTER_IDLE, effect: 'use' });
  });

  it('Undo with nothing to undo says so and leaves an armed booster armed', () => {
    const armed = stepBooster(BOOSTER_IDLE, tap('hint')).next;
    expect(stepBooster(armed, tap('undo', { canUndo: false }))).toEqual({ next: armed, effect: 'noUndo' });
  });

  it('not enough coins skips the confirm and is refused', () => {
    const price = cfg.boosters.hint.price;
    expect(stepBooster(BOOSTER_IDLE, tap('hint', { coins: price - 1 }))).toEqual({ next: BOOSTER_IDLE, effect: 'refuse' });
  });

  it('a blocked board (busy, a jar returning, the tutorial, a won board) ignores the tap and keeps the state', () => {
    const armed = stepBooster(BOOSTER_IDLE, tap('hint')).next;
    expect(stepBooster(armed, tap('hint', { blocked: true }))).toEqual({ next: armed, effect: 'ignore' });
    expect(stepBooster(BOOSTER_IDLE, tap('extraJar', { blocked: true }))).toEqual({ next: BOOSTER_IDLE, effect: 'ignore' });
  });

  it('while an assist is thinking, Hint and Shuffle taps are ignored but Undo and Jar are not (TD-13)', () => {
    expect(stepBooster(BOOSTER_IDLE, tap('hint', { assistBusy: true })).effect).toBe('ignore');
    expect(stepBooster(BOOSTER_IDLE, tap('shuffle', { assistBusy: true })).effect).toBe('ignore');
    expect(stepBooster(BOOSTER_IDLE, tap('extraJar', { assistBusy: true })).effect).toBe('confirm');
    expect(stepBooster(BOOSTER_IDLE, tap('undo', { assistBusy: true })).effect).toBe('use');
  });

  it('the transition table names every state and event, and stepBooster lands only on listed states', () => {
    const armed = stepBooster(BOOSTER_IDLE, tap('hint')).next;
    for (const [from, s] of [['idle', BOOSTER_IDLE], ['armed', armed]] as const) {
      expect(BOOSTER_TRANSITIONS[from].expire).toEqual(['idle']);
      expect(BOOSTER_TRANSITIONS[from].cancel).toEqual(['idle']);
      expect(BOOSTER_TRANSITIONS[from].expire).toContain(stepBooster(s, { type: 'expire' }).next.state);
      for (const t of [tap('hint'), tap('hint', { now: T0 + 1 }), tap('shuffle', { charges: 1 }), tap('undo', { canUndo: false }), tap('hint', { blocked: true })]) {
        expect(BOOSTER_TRANSITIONS[from].tap).toContain(stepBooster(s, t).next.state);
      }
    }
  });
});

function rtap(over: Partial<RestartTap> = {}): RestartTap {
  return { type: 'tap', now: T0, windowMs: WINDOW, blocked: false, moves: 1, ...over };
}

describe('stepRestart: the second-tap window (F6)', () => {
  it('a board with no pours made restarts at once', () => {
    expect(stepRestart(RESTART_IDLE, rtap({ moves: 0 }))).toEqual({ next: RESTART_IDLE, effect: 'restart' });
  });

  it('with pours made, the first tap asks and the second within the window restarts', () => {
    const first = stepRestart(RESTART_IDLE, rtap());
    expect(first).toEqual({ next: { state: 'armed', until: T0 + WINDOW }, effect: 'confirm' });
    expect(stepRestart(first.next, rtap({ now: T0 + WINDOW - 1 }))).toEqual({ next: RESTART_IDLE, effect: 'restart' });
  });

  it('a second tap at or after the deadline asks again', () => {
    const armed = stepRestart(RESTART_IDLE, rtap()).next;
    expect(stepRestart(armed, rtap({ now: T0 + WINDOW }))).toEqual({ next: { state: 'armed', until: T0 + 2 * WINDOW }, effect: 'confirm' });
  });

  it('expires on the time-out and disarms on any other action', () => {
    const armed: RestartArm = stepRestart(RESTART_IDLE, rtap()).next;
    expect(stepRestart(armed, { type: 'expire' })).toEqual({ next: RESTART_IDLE, effect: 'expired' });
    expect(stepRestart(armed, { type: 'cancel' })).toEqual({ next: RESTART_IDLE, effect: 'disarmed' });
    expect(stepRestart(RESTART_IDLE, { type: 'cancel' })).toEqual({ next: RESTART_IDLE, effect: 'none' });
  });

  it('a blocked board (busy, a jar returning, the tutorial) ignores the tap and keeps the state', () => {
    const armed = stepRestart(RESTART_IDLE, rtap()).next;
    expect(stepRestart(armed, rtap({ blocked: true }))).toEqual({ next: armed, effect: 'ignore' });
    expect(stepRestart(RESTART_IDLE, rtap({ blocked: true, moves: 0 }))).toEqual({ next: RESTART_IDLE, effect: 'ignore' });
  });

  it('the transition table covers both states', () => {
    expect(RESTART_TRANSITIONS.idle.tap).toEqual(['idle', 'armed']);
    expect(RESTART_TRANSITIONS.armed.tap).toEqual(['idle', 'armed']);
    expect(RESTART_TRANSITIONS.armed.expire).toEqual(['idle']);
    expect(RESTART_TRANSITIONS.armed.cancel).toEqual(['idle']);
  });
});
