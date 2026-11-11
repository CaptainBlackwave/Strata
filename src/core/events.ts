/**
 * Seasonal events (sprint 17, D141-D147; design/gdd/events.md). An event is a config entry with
 * yearly dates, a number of boards that open one a day (advent style), gentle recipes, small coins
 * along the way and a prize for clearing them all. It returns every year; progress is kept per
 * year. Pure and DOM-free.
 */
import { dailySteps, dayNumber } from './daily';
import { type GeneratedLevel, runFallbackSteps } from './generator';
import type { GameConfig, LevelSpec } from './levels';

/** One gentle board recipe (as a weekly board row). */
export interface EventRecipe {
  readonly colors: number;
  readonly capacity: number;
  readonly spare: number;
  readonly buriedDepth: number;
  /** `maxPoursFor(bandLevel)` caps the board's length, as for the weekly set. */
  readonly bandLevel: number;
}

/** What clearing every board gives. Each is granted once and kept for good. */
export interface EventPrize {
  /** A jar piece `slot:id`, earned only here (never sold). */
  readonly style?: string;
  /** A badge id added to the shelf. */
  readonly badge?: string;
}

/** One event in `events[]` of the config. Ids are saved: never rename one. */
export interface EventDef {
  readonly id: string;
  /** First and last day, `MM-DD`, UTC, every year. `to` before `from` runs into the next year. */
  readonly from: string;
  readonly to: string;
  readonly boards: number;
  /** NEVER change once an event has run: every player's boards would change. */
  readonly seedSalt: number;
  /** Board n uses `recipes[(n - 1) % recipes.length]`. */
  readonly recipes: readonly EventRecipe[];
  /** Coins after every `coinsEvery`-th board cleared that year. */
  readonly coinsEvery: number;
  readonly coins: number;
  readonly prize: EventPrize;
}

/** `events` in the config. */
export interface EventsConfig {
  readonly events: readonly EventDef[];
}

/** One event's progress for one year: boards cleared (1-based, ascending) and best pours by board. */
export interface EventProgress {
  readonly year: number;
  readonly cleared: readonly number[];
  readonly pours: Readonly<Record<string, number>>;
}

/** Saved progress, keyed by event id. */
export type EventsState = Readonly<Record<string, EventProgress>>;

/** No progress. */
export function emptyEventProgress(): EventProgress {
  return { year: 0, cleared: [], pours: {} };
}

/** The event with `id`, if the config has it. */
export function eventById(id: string, config: EventsConfig): EventDef | undefined {
  return config.events.find((e) => e.id === id);
}

/**
 * The event running on `date` (`YYYY-MM-DD`, UTC), its year (the year it started) and its day
 * (1 on the first day), or null. Example: `activeEvent('2026-12-12', config)` is Winter Tide, day 12.
 */
export function activeEvent(date: string, config: EventsConfig): { event: EventDef; year: number; day: number } | null {
  const year = Number(date.slice(0, 4));
  const md = date.slice(5);
  for (const event of config.events) {
    const wraps = event.to < event.from;
    const startYear = wraps && md <= event.to ? year - 1 : year;
    const start = `${startYear}-${event.from}`;
    const end = `${wraps ? startYear + 1 : startYear}-${event.to}`;
    if (date >= start && date <= end) return { event, year: startYear, day: dayNumber(date) - dayNumber(start) + 1 };
  }
  return null;
}

/** How many boards are open on event day `day`: one more each day, up to all of them (D145). */
export function openBoards(event: EventDef, day: number): number {
  return Math.max(0, Math.min(event.boards, Math.floor(day)));
}

/** An event board's spec, for its intro cards and its pour cap. */
export interface EventSpec extends LevelSpec {
  readonly event: string;
  readonly year: number;
  readonly board: number;
}

function hashKey(key: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Board `n` (1-based) of an event's `year`: its recipe, without special jars (gentle, D144). */
export function eventSpec(event: EventDef, year: number, n: number, config: GameConfig): EventSpec {
  const r = event.recipes[(n - 1) % event.recipes.length];
  return {
    level: r.bandLevel,
    event: event.id,
    year,
    board: n,
    colors: Math.min(r.colors, config.palette.length),
    capacity: r.capacity,
    spare: r.spare,
    buriedDepth: r.buriedDepth,
    challenge: r.capacity > 4,
    mechanics: [],
  };
}

/**
 * Board `n` of an event's `year`, the same for every player and never throwing (the daily's
 * fallback chain). Seeded by FNV-1a of `id-year#n` with the event's salt.
 * Example: `generateEventBoard(winter, 2026, 1, config).board`.
 */
export function generateEventBoard(event: EventDef, year: number, n: number, config: GameConfig): GeneratedLevel & { spec: EventSpec } {
  const spec = eventSpec(event, year, n, config);
  return runFallbackSteps(dailySteps(spec, config), hashKey(`${event.id}-${year}#${n}`, event.seedSalt), config, spec);
}

/** The result of {@link recordEventClear}. */
export interface EventClearResult {
  readonly state: EventProgress;
  readonly firstClear: boolean;
  readonly newBest: boolean;
  readonly prevBest: number | undefined;
  /** Coins earned by this clear (every `coinsEvery`-th first clear of the year). */
  readonly coins: number;
  /** This clear finished every board of the year. */
  readonly completedNow: boolean;
}

/**
 * Records clearing board `n` of `event` in `year` in `pours`. A different year than the saved one
 * starts fresh. A replay only lowers best pours. Example: the 6th first clear pays `event.coins`.
 */
export function recordEventClear(state: EventProgress, event: EventDef, year: number, n: number, pours: number): EventClearResult {
  const base = state.year === year ? state : { year, cleared: [], pours: {} };
  const key = String(n);
  const prevBest = base.pours[key];
  const firstClear = !base.cleared.includes(n);
  const cleared = firstClear ? [...base.cleared, n].sort((a, b) => a - b) : [...base.cleared];
  const best = prevBest === undefined || pours < prevBest ? pours : prevBest;
  const coins = firstClear && cleared.length % event.coinsEvery === 0 ? event.coins : 0;
  const completedNow = firstClear && cleared.length === event.boards;
  return { state: { year, cleared, pours: { ...base.pours, [key]: best } }, firstClear, newBest: prevBest !== undefined && pours < prevBest, prevBest, coins, completedNow };
}

/**
 * A saved `events` value made safe, field by field: unknown events are dropped; `year` must be a
 * whole number from 2000; `cleared` keeps boards 1..boards once, ascending; `pours` keeps
 * non-negative whole numbers of cleared boards.
 */
export function repairEvents(raw: unknown, config: EventsConfig): Record<string, EventProgress> {
  const out: Record<string, EventProgress> = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const event = eventById(id, config);
    if (!event || !v || typeof v !== 'object' || Array.isArray(v)) continue;
    const r = v as Record<string, unknown>;
    if (!Number.isInteger(r.year) || (r.year as number) < 2000) continue;
    const cleared = Array.isArray(r.cleared) ? [...new Set(r.cleared.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= event.boards))].sort((a, b) => a - b) : [];
    const pours: Record<string, number> = {};
    const p = r.pours && typeof r.pours === 'object' && !Array.isArray(r.pours) ? (r.pours as Record<string, unknown>) : {};
    for (const n of cleared) {
      const x = p[String(n)];
      if (Number.isInteger(x) && (x as number) >= 0) pours[String(n)] = x as number;
    }
    out[id] = { year: r.year as number, cleared, pours };
  }
  return out;
}
