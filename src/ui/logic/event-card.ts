/**
 * A seasonal event's Home card and chooser, as words and states (sprint 17, D141-D147;
 * design/gdd/events.md), DOM-free so they are unit-tested. The rules are the pure core/events.ts.
 */
import { dayNumber } from '../../core/daily';
import { type EventDef, type EventsConfig, type EventsState, activeEvent, openBoards } from '../../core/events';
import { t } from '../strings';

/** One board of the chooser. */
export interface EventBoardView {
  /** 1-based. */
  readonly n: number;
  readonly state: 'open' | 'cleared' | 'locked';
  /** What the tile shows under the number: "Open", "✓ 31" or "Dec 14". */
  readonly status: string;
  /** The tile's spoken name, e.g. "Board 14, opens Dec 14". */
  readonly label: string;
}

/** Everything the card and the chooser show for the event running today. */
export interface EventView {
  readonly event: EventDef;
  readonly name: string;
  readonly year: number;
  readonly day: number;
  readonly open: number;
  readonly cleared: number;
  readonly total: number;
  /** "Board 12 open · 9 of 24 cleared". */
  readonly sub: string;
  /** "Ends in 19 days", "Ends tomorrow" or "Last day". */
  readonly days: string;
  /** "Clear all 24 for the Frost jar glass and the Winter Tide badge", or "Prize collected". */
  readonly prize: string;
  readonly prizeCollected: boolean;
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
  const total = event.boards;
  const endYear = event.to < event.from ? year + 1 : year;
  const left = dayNumber(`${endYear}-${event.to}`) - dayNumber(date);
  const boards: EventBoardView[] = Array.from({ length: total }, (_, i) => {
    const n = i + 1;
    if (clearedList.includes(n)) {
      const pours = mine?.pours[String(n)] ?? 0;
      return { n, state: 'cleared', status: t.event.boardCleared(pours), label: t.event.boardClearedLabel(n, pours) };
    }
    if (n <= open) return { n, state: 'open', status: t.event.boardOpen, label: t.event.boardOpenLabel(n) };
    const [m, d] = shifted(year, event.from, n - 1);
    const month = t.event.monthsShort[m];
    return { n, state: 'locked', status: t.event.boardLocked(month, d), label: t.event.boardLockedLabel(n, month, d) };
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
    cleared: clearedList.length,
    total,
    sub: t.event.cardSub(open, total, clearedList.length),
    days: t.event.daysLeft(left),
    prize: prizeCollected ? t.event.prizeCollected : t.event.prize(total, piece, badgeName),
    prizeCollected,
    boards,
    focus: firstOpen?.n ?? 1,
  };
}
