/**
 * A seasonal event's Home card and chooser, as words and states (sprint 17, D141-D147;
 * design/gdd/events.md), DOM-free so they are unit-tested. The rules are the pure core/events.ts.
 * Sprint 31 (D237, D240, D242, D241): prize boards ("of 24") and Winter Tide's Christmas Day tile,
 * the Home card order (gift before start card), the event board's label and the December scene order.
 */
import { dayNumber } from '../../core/daily';
import { type EventDef, type EventsConfig, type EventsState, activeEvent, isFestiveBoard, openBoards, prizeBoards, prizeBoardsCleared } from '../../core/events';
import { t } from '../strings';

/** One board of the chooser. */
export interface EventBoardView {
  /** 1-based. */
  readonly n: number;
  readonly state: 'open' | 'cleared' | 'locked';
  /** What the tile shows under the number: "Open", "✓ 31", "Dec 14", or "Christmas Day" on the festive tile. */
  readonly status: string;
  /** The tile's spoken name, e.g. "Board 14, opens Dec 14". */
  readonly label: string;
  /** Winter Tide's Christmas Day board (D237): a bonus, set apart from the prize boards. */
  readonly festive: boolean;
}

/** Everything the card and the chooser show for the event running today. */
export interface EventView {
  readonly event: EventDef;
  readonly name: string;
  readonly year: number;
  readonly day: number;
  readonly open: number;
  /** Prize boards cleared (1..prizeBoards): a bonus board never moves it. */
  readonly cleared: number;
  /** Prize boards (24 for Winter Tide, 12 for New Tide). */
  readonly total: number;
  /** "Board 12 open · 9 of 24 cleared". */
  readonly sub: string;
  /** "Ends in 19 days", "Ends tomorrow" or "Last day". */
  readonly days: string;
  /** "Clear all 24 for the Frost jar glass and the Winter Tide badge", or "Prize collected". */
  readonly prize: string;
  readonly prizeCollected: boolean;
  /** The bonus board's note under the tiles ("A Christmas Day bonus board, …"), or '' with no festive board. */
  readonly note: string;
  readonly boards: EventBoardView[];
  /** The board focus goes to: the first open board not cleared, else board 1. */
  readonly focus: number;
}

/** `MM-DD` plus `offset` days in `year`, as [month index 0-11, day of month], on the UTC calendar. */
function shifted(year: number, md: string, offset: number): [number, number] {
  const [m, d] = md.split('-').map(Number);
  const date = new Date(Date.UTC(year, m - 1, d + offset));
  return [date.getUTCMonth(), date.getUTCDate()];
}

/**
 * The view for `date` (`YYYY-MM-DD`, UTC), or null when no event runs (no Home card). Progress counts
 * only when saved for the running year. The prize reads as collected once its badge is in `badges`.
 * Example: `eventView(save.events, save.badges, dailyKey(state.clock), config)`.
 */
export function eventView(saved: EventsState, badges: readonly string[], date: string, config: EventsConfig): EventView | null {
  const active = activeEvent(date, config);
  if (!active) return null;
  const { event, year, day } = active;
  const name = t.event.names[event.id] ?? event.id;
  const mine = saved[event.id]?.year === year ? saved[event.id] : null;
  const clearedList = mine?.cleared ?? [];
  const open = openBoards(event, day);
  const total = prizeBoards(event);
  const cleared = prizeBoardsCleared(clearedList, event);
  const endYear = event.to < event.from ? year + 1 : year;
  const left = dayNumber(`${endYear}-${event.to}`) - dayNumber(date);
  const boards: EventBoardView[] = Array.from({ length: event.boards }, (_, i) => {
    const n = i + 1;
    const festive = isFestiveBoard(event, n);
    const withNote = (label: string) => (festive ? t.event.festiveTileLabel(label) : label);
    if (clearedList.includes(n)) {
      const pours = mine?.pours[String(n)] ?? 0;
      return { n, state: 'cleared', status: t.event.boardCleared(pours), label: withNote(t.event.boardClearedLabel(n, pours)), festive };
    }
    if (n <= open) return { n, state: 'open', status: festive ? t.event.festiveTile : t.event.boardOpen, label: withNote(t.event.boardOpenLabel(n)), festive };
    const [m, d] = shifted(year, event.from, n - 1);
    const month = t.event.monthsShort[m];
    return { n, state: 'locked', status: festive ? t.event.festiveTile : t.event.boardLocked(month, d), label: withNote(t.event.boardLockedLabel(n, month, d)), festive };
  });
  const [slot, id] = (event.prize.style ?? '').split(':');
  const piece = t.event.piece(t.styles.names[slot]?.[id] ?? id ?? '', t.styles.slots[slot] ?? slot ?? '');
  const badgeName = event.prize.badge ? (t.event.badges[event.prize.badge]?.name ?? name) : name;
  const prizeCollected = !!event.prize.badge && badges.includes(event.prize.badge);
  const firstOpen = boards.find((b) => b.state === 'open');
  return {
    event,
    name,
    year,
    day,
    open,
    cleared,
    total,
    sub: t.event.cardLine(open, event.boards, cleared, total),
    days: t.event.daysLeft(left),
    // In a later year the prize is already yours before this year's set is done (sprint 31 C2 finding 5).
    prize: prizeCollected ? (cleared >= total ? t.event.prizeCollected : t.event.prizeKept) : t.event.prize(total, piece, badgeName),
    prizeCollected,
    note: boards.some((b) => b.festive) ? t.event.festiveNote : '',
    boards,
    focus: firstOpen?.n ?? 1,
  };
}

/**
 * An event board's name on the board screen and its win card (D237): "Winter Tide · Christmas Day" on
 * the festive board, else "Winter Tide · Board 6". Example: `eventBoardLabel(winter, 25)`.
 */
export function eventBoardLabel(event: EventDef | undefined, id: string, n: number): string {
  const name = t.event.names[id] ?? id;
  return event && isFestiveBoard(event, n) ? t.event.festiveLabel(name) : t.event.label(name, n);
}

/**
 * The board screen's header for an event board, split like the weekly's (sprint 31 C2 finding 2):
 * the label is the board ("Board 6", or "Christmas Day" on the festive board) and the tag on the right
 * is the event's name, so "Winter Tide · Board 6" is never cut off at 412px.
 * Example: `eventBoardHeader(winter, 'wintertide', 25) // { label: 'Christmas Day', tag: 'Winter Tide' }`.
 */
export function eventBoardHeader(event: EventDef | undefined, id: string, n: number): { label: string; tag: string } {
  const tag = t.event.names[id] ?? id;
  return { label: event && isFestiveBoard(event, n) ? t.event.festiveTile : t.event.boardShort(n), tag };
}

/**
 * The win card's progress for an event (D237): prize boards cleared in `year`, and how many the prize
 * needs, so a bonus board reads "24 of 24" and never "25 of 24". Example: `eventWinCount(save.events, winter, 2026)`.
 */
export function eventWinCount(saved: EventsState, event: EventDef, year: number): { cleared: number; total: number } {
  const mine = saved[event.id]?.year === year ? saved[event.id] : null;
  return { cleared: prizeBoardsCleared(mine?.cleared ?? [], event), total: prizeBoards(event) };
}

/** A one-time card on Home (sprint 31): the Christmas Day gift, or an event's start card. */
export type HomeNotice = { readonly kind: 'gift'; readonly id: string } | { readonly kind: 'start'; readonly id: string; readonly year: number };

/** What Home shows now, and which start card to mark seen without showing (events.md §3.10). */
export interface HomeNoticePlan {
  readonly show: HomeNotice | null;
  /** A start card due today that the gift displaced: marked seen for its year, never shown (D242). */
  readonly markSeen: { readonly id: string; readonly year: number } | null;
}

/**
 * One card at a time (events.md §3.9-§3.10, D238, D242): nothing before the tutorial; the gift first,
 * and a start card due the same day is marked seen; else the start card. `gift` is the gift due
 * today and `start` the start card due today (core/gifts.ts `dueGift`, core/events.ts `startCardDue`).
 * Example: `homeNotice(true, 'christmas', { id: 'wintertide', year: 2026 })` shows the gift and marks Winter Tide seen.
 */
export function homeNotice(tutorialDone: boolean, gift: string | null, start: { id: string; year: number } | null): HomeNoticePlan {
  if (!tutorialDone) return { show: null, markSeen: null };
  if (gift) return { show: { kind: 'gift', id: gift }, markSeen: start };
  return { show: start ? { kind: 'start', id: start.id, year: start.year } : null, markSeen: null };
}

/**
 * The scene picker's order (D241): the festive scenes first, in `first`'s order, then the usual order
 * (streak-only scenes last, then by price). `first` is empty outside December. Pure: no purchase change.
 * Example: `sceneOrder(config.themes.list, ['wintersnow', 'winterlights'])`.
 */
export function sceneOrder<T extends { readonly id: string; readonly price: number; readonly earned?: number }>(list: readonly T[], first: readonly string[]): T[] {
  const rank = (id: string) => {
    const i = first.indexOf(id);
    return i < 0 ? first.length : i;
  };
  return [...list].sort((a, b) => rank(a.id) - rank(b.id) || (a.earned ?? 0) - (b.earned ?? 0) || a.price - b.price);
}
