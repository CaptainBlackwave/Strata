/**
 * The board's two second-tap confirms as pure state machines (sprint 10 F6, TD-12): a booster
 * bought with coins (UX-board-7) and Restart with pours on the board (F6). DOM-free: the caller
 * passes the time (`now`, ms on any monotonic clock) and the window length, and applies the
 * returned effect to the buttons, toasts and wallet. The caller also runs the time-out that
 * sends `expire`, so an armed button never outlives its window on screen.
 */
import type { BoosterId } from '../../core/economy';

/** A booster purchase: idle, or armed with its price until `until` (exclusive). */
export type BoosterArm = { readonly state: 'idle' } | { readonly state: 'armed'; readonly id: BoosterId; readonly price: number; readonly until: number };

/** No booster purchase is waiting. */
export const BOOSTER_IDLE: BoosterArm = { state: 'idle' };

/** A tap on a booster, with everything the decision reads. */
export interface BoosterTap {
  readonly type: 'tap';
  readonly id: BoosterId;
  readonly now: number;
  readonly windowMs: number;
  /** Busy, a jar returning, the tutorial, or a won board: the tap does nothing. */
  readonly blocked: boolean;
  /** Hint or Shuffle is waiting for the worker (TD-13): another Hint or Shuffle tap does nothing. */
  readonly assistBusy: boolean;
  readonly canUndo: boolean;
  readonly charges: number;
  readonly coins: number;
  readonly price: number;
  readonly free: boolean;
}

/** `expire`: the window's time-out ran. `cancel`: any other action (a pour, Undo, Restart's arm, a new board). */
export type BoosterEvent = BoosterTap | { readonly type: 'expire' } | { readonly type: 'cancel' };

/**
 * What the caller does. `confirm`: show the price and wait for a second tap. `buy`: the second
 * tap, spend coins. `use`: a stored charge or a free booster, at once. `refuse`: too few coins.
 * `noUndo`: nothing to undo. `ignore`: the tap does nothing. `expired` / `disarmed` / `none`:
 * the result of `expire` or `cancel`, on an armed or an idle machine.
 */
export type BoosterEffect = 'confirm' | 'buy' | 'use' | 'refuse' | 'noUndo' | 'ignore' | 'expired' | 'disarmed' | 'none';

/** One step: the next state and what to do. */
export interface BoosterStep {
  readonly next: BoosterArm;
  readonly effect: BoosterEffect;
}

/** The explicit transition table: from each state, the states each event can lead to. */
export const BOOSTER_TRANSITIONS: Readonly<Record<BoosterArm['state'], Readonly<Record<BoosterEvent['type'], readonly BoosterArm['state'][]>>>> = {
  idle: { tap: ['idle', 'armed'], expire: ['idle'], cancel: ['idle'] },
  armed: { tap: ['idle', 'armed'], expire: ['idle'], cancel: ['idle'] },
};

/**
 * Steps the booster confirm. With no charges left, a booster that costs coins the player has
 * arms on the first tap; a second tap on the same booster before `until` buys it. Too few coins
 * skips the confirm, since the spend is refused anyway. Undo with nothing to undo, a blocked
 * board and a second assist leave the state as it was.
 */
export function stepBooster(s: BoosterArm, e: BoosterEvent): BoosterStep {
  if (e.type !== 'tap') return { next: BOOSTER_IDLE, effect: s.state === 'idle' ? 'none' : e.type === 'expire' ? 'expired' : 'disarmed' };
  if (e.blocked) return { next: s, effect: 'ignore' };
  if ((e.id === 'hint' || e.id === 'shuffle') && e.assistBusy) return { next: s, effect: 'ignore' };
  if (e.id === 'undo' && !e.canUndo) return { next: s, effect: 'noUndo' };
  const armedHere = s.state === 'armed' && s.id === e.id && e.now < s.until;
  if (e.charges === 0 && !e.free && e.coins >= e.price && !armedHere) {
    return { next: { state: 'armed', id: e.id, price: e.price, until: e.now + e.windowMs }, effect: 'confirm' };
  }
  const effect: BoosterEffect = e.free || e.charges > 0 ? 'use' : e.coins >= e.price ? 'buy' : 'refuse';
  return { next: BOOSTER_IDLE, effect };
}

/** Restart's second tap: idle, or armed until `until` (exclusive). */
export type RestartArm = { readonly state: 'idle' } | { readonly state: 'armed'; readonly until: number };

/** Restart is not waiting for a second tap. */
export const RESTART_IDLE: RestartArm = { state: 'idle' };

/** A tap on Restart (the HUD button or the R key). */
export interface RestartTap {
  readonly type: 'tap';
  readonly now: number;
  readonly windowMs: number;
  /** Busy, a jar returning, or the tutorial: the tap does nothing. */
  readonly blocked: boolean;
  /** Pours made on this board; with none there is nothing to lose, so Restart acts at once. */
  readonly moves: number;
}

/** `expire`: the window's time-out ran. `cancel`: the board changed or a booster armed. */
export type RestartEvent = RestartTap | { readonly type: 'expire' } | { readonly type: 'cancel' };

/** `confirm`: ask and wait. `restart`: restart now. The rest as for boosters. */
export type RestartEffect = 'confirm' | 'restart' | 'ignore' | 'expired' | 'disarmed' | 'none';

/** One step: the next state and what to do. */
export interface RestartStep {
  readonly next: RestartArm;
  readonly effect: RestartEffect;
}

/** The explicit transition table: from each state, the states each event can lead to. */
export const RESTART_TRANSITIONS: Readonly<Record<RestartArm['state'], Readonly<Record<RestartEvent['type'], readonly RestartArm['state'][]>>>> = {
  idle: { tap: ['idle', 'armed'], expire: ['idle'], cancel: ['idle'] },
  armed: { tap: ['idle', 'armed'], expire: ['idle'], cancel: ['idle'] },
};

/**
 * Steps Restart's confirm. Restart can't be undone, so with pours on the board the first tap
 * arms it and a second tap before `until` restarts; with none it restarts at once.
 */
export function stepRestart(s: RestartArm, e: RestartEvent): RestartStep {
  if (e.type !== 'tap') return { next: RESTART_IDLE, effect: s.state === 'idle' ? 'none' : e.type === 'expire' ? 'expired' : 'disarmed' };
  if (e.blocked) return { next: s, effect: 'ignore' };
  if (e.moves === 0 || (s.state === 'armed' && e.now < s.until)) return { next: RESTART_IDLE, effect: 'restart' };
  return { next: { state: 'armed', until: e.now + e.windowMs }, effect: 'confirm' };
}
