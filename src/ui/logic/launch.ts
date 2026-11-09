/**
 * The launch address and the share link (sprint 11 O3, D78), DOM-free. A link carries one key
 * and nothing else: `?daily=YYYY-MM-DD` opens that daily, `?weekly=YYYY-Www` (parsed now, for the
 * weekly set of D77) a week, and the QA route `?level=N` a level (D3). Save data never goes in a URL.
 */

/** What a launch address asks for. Anything malformed is `none`, which opens Home as usual. */
export type Launch =
  | { readonly kind: 'none' }
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'daily'; readonly date: string }
  | { readonly kind: 'weekly'; readonly week: string };

/** The one key a share link carries. */
export type ShareKey = { readonly daily: string } | { readonly weekly: string };

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const WEEK = /^(\d{4})-W(\d{2})$/;

/** Whether `s` is a real calendar date as `YYYY-MM-DD`. Example: `isDateKey('2026-02-29') // false`. */
export function isDateKey(s: string): boolean {
  const m = DATE.exec(s);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** ISO weeks in `year`: 53 when 28 December falls in week 53, else 52. */
function isoWeeksIn(year: number): number {
  const jan1 = new Date(Date.UTC(year, 0, 1)).getUTCDay(); // 0 Sunday .. 6 Saturday
  const leap = new Date(Date.UTC(year, 1, 29)).getUTCMonth() === 1;
  return jan1 === 4 || (leap && jan1 === 3) ? 53 : 52;
}

/** Whether `s` is an ISO week as `YYYY-Www` (W01..W52, or W53 in a year that has one). Example: `isWeekKey('2026-W46')`. */
export function isWeekKey(s: string): boolean {
  const m = WEEK.exec(s);
  if (!m) return false;
  const week = Number(m[2]);
  return week >= 1 && week <= isoWeeksIn(Number(m[1]));
}

/**
 * Reads a launch address's query (`location.search`). `?level=N` wins, as the QA route always
 * did; then a valid `daily`, then a valid `weekly`. Example: `parseLaunch('?daily=2026-11-09')`.
 */
export function parseLaunch(search: string): Launch {
  const q = new URLSearchParams(search);
  const level = Number(q.get('level'));
  if (Number.isInteger(level) && level >= 1) return { kind: 'level', level };
  const daily = q.get('daily');
  if (daily !== null && isDateKey(daily)) return { kind: 'daily', date: daily };
  const weekly = q.get('weekly');
  if (weekly !== null && isWeekKey(weekly)) return { kind: 'weekly', week: weekly };
  return { kind: 'none' };
}

/**
 * The share link for `key`: the page's origin and path from `href` (no host is hard-coded), with
 * its query and hash replaced by the one key. Example:
 * `shareLink(location.href, { daily: '2026-11-09' }) // 'https://…/Strata/?daily=2026-11-09'`.
 */
export function shareLink(href: string, key: ShareKey): string {
  const url = new URL(href);
  url.search = '';
  url.hash = '';
  if ('daily' in key) url.searchParams.set('daily', key.daily);
  else url.searchParams.set('weekly', key.weekly);
  return url.href;
}

/**
 * Which daily a `?daily=` link opens: always today's (the daily follows UTC), and `over` when the
 * link named an earlier day, so a gentle note says so first. A later day (a clock running ahead)
 * opens today's without a note. Example: `dailyLaunch('2026-11-02', '2026-11-09').over // true`.
 */
export function dailyLaunch(requested: string, today: string): { readonly date: string; readonly over: boolean } {
  return { date: today, over: requested < today };
}
