/**
 * Dated gifts (sprint 31, D238; design/gdd/events.md §3.9, §4, §5): the Christmas Day gift. A gift is
 * a config entry with a yearly UTC day (`MM-DD`) and what it gives: coins, boosters and a jar piece
 * that is never sold. It is given once a year, on the first Home that day; the save records the year
 * it was last given, so it can't be claimed twice. There is no catch-up.
 * Pure and DOM-free: date in, gift out. The UI decides when to ask (after the tutorial, the gift card
 * first on Home) and writes the save.
 */
import { type BoosterId, type Wallet, addBoosters, addCoins } from './economy';
import { type Stats, bumpStats } from './profile';
import type { StyleState } from './styles';

/** One gift in `gifts[]` of the config. Ids are saved: never rename one. */
export interface GiftDef {
  readonly id: string;
  /** The day it is given, `MM-DD` on the UTC calendar, every year. */
  readonly date: string;
  readonly coins: number;
  /** Booster charges given, e.g. `{ hint: 1 }`. */
  readonly boosters?: Readonly<Partial<Record<BoosterId, number>>>;
  /** A jar piece `slot:id`, granted once and kept for good (a gift piece, never sold). */
  readonly style?: string;
}

/** `gifts` in the config. */
export interface GiftsConfig {
  readonly gifts: readonly GiftDef[];
}

/** Saved gifts: gift id to the year it was last given. Absent means never. */
export type GiftsGiven = Readonly<Record<string, number>>;

/** What {@link giveGift} gives: the new `given` map and the rewards. */
export interface GiftGrant {
  readonly gift: GiftDef;
  readonly year: number;
  /** The save's new `gifts` value (this gift stored as given in `year`). */
  readonly given: Record<string, number>;
  readonly coins: number;
  readonly boosters: Readonly<Partial<Record<BoosterId, number>>>;
  /** The jar piece `slot:id` granted now, or null when there is none or it is already owned. */
  readonly style: string | null;
}

/** The parts of the save a gift changes. */
export interface GiftTarget {
  readonly wallet: Wallet;
  readonly styles: StyleState;
  readonly gifts: Readonly<Record<string, number>>;
  readonly stats: Stats;
}

const yearOf = (y: unknown): number => (typeof y === 'number' && Number.isInteger(y) ? y : 0);

/**
 * The gift due on `date` (`YYYY-MM-DD`, UTC), or null: the first gift whose `MM-DD` is today and
 * whose stored year is below this year (an absent year counts as 0, so `<` and not `≠`: a clock
 * moved forward and back cannot claim twice). The caller checks the tutorial is done.
 * Example: `dueGift('2026-12-25', config.gifts, save.gifts)` is the Christmas gift, 2026.
 */
export function dueGift(date: string, gifts: readonly GiftDef[] | undefined, given: GiftsGiven): { gift: GiftDef; year: number } | null {
  const year = Number(date.slice(0, 4));
  const md = date.slice(5, 10);
  if (!Number.isInteger(year)) return null;
  for (const gift of gifts ?? []) {
    if (gift.date === md && yearOf(given[gift.id]) < year) return { gift, year };
  }
  return null;
}

/**
 * Gives `gift` for `year`: the new `given` map and the rewards. The jar piece is granted only when not
 * in `owned` already (a later year gives the coins and boosters only, §5). Pure: the UI applies it with
 * {@link applyGift} and saves. Example: `giveGift(due.gift, due.year, save.gifts, save.styles.owned)`.
 */
export function giveGift(gift: GiftDef, year: number, given: GiftsGiven, owned: readonly string[]): GiftGrant {
  const boosters: Partial<Record<BoosterId, number>> = {};
  for (const [id, n] of Object.entries(gift.boosters ?? {}) as [BoosterId, number][]) {
    const k = Math.max(0, Math.floor(n ?? 0));
    if (k > 0) boosters[id] = k;
  }
  return {
    gift,
    year,
    given: { ...given, [gift.id]: Math.max(yearOf(given[gift.id]), year) },
    coins: Math.max(0, Math.floor(gift.coins)),
    boosters,
    style: gift.style && !owned.includes(gift.style) ? gift.style : null,
  };
}

/**
 * Applies a {@link GiftGrant} to the save-like `state`: coins (counted as coins earned), boosters,
 * the jar piece added to `styles.owned` (as an event prize is, never worn by itself) and the new
 * `gifts`. Returns a new object; `state` is not modified. Example: `save = applyGift(save, grant)`.
 */
export function applyGift<S extends GiftTarget>(state: S, grant: GiftGrant): S {
  const wallet = addBoosters(addCoins(state.wallet, grant.coins), grant.boosters);
  const owned = grant.style && !state.styles.owned.includes(grant.style) ? [...state.styles.owned, grant.style] : [...state.styles.owned];
  return {
    ...state,
    wallet,
    styles: { owned, worn: { ...state.styles.worn } },
    gifts: { ...grant.given },
    stats: bumpStats(state.stats, { coinsEarned: grant.coins }),
  };
}

/**
 * A saved `gifts` value made safe (as `events` is repaired): unknown gift ids are dropped and a year
 * must be a whole number from 2000 (else treated as never given, §5).
 */
export function repairGifts(raw: unknown, gifts: readonly GiftDef[] | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, y] of Object.entries(raw as Record<string, unknown>)) {
    if ((gifts ?? []).some((g) => g.id === id) && Number.isInteger(y) && (y as number) >= 2000) out[id] = y as number;
  }
  return out;
}
