/**
 * The launch address and the share link (sprint 11 O3, D78), DOM-free. A link carries one key
 * and nothing else: `?daily=YYYY-MM-DD` opens that daily, `?weekly=YYYY-Www` (parsed now, for the
 * weekly set of D77) a week, `?challenge=N&pours=P` a friend's challenge on level N (sprint 14 H3,
 * sharing §3.2), and the QA route `?level=N` a level (D3). Save data never goes in a URL.
 */
import gameConfig from '../../config/game-config.json';

/** The bounds of a challenge link (`sharing.challenge` in game-config.json). */
export interface ChallengeLimits {
  readonly maxPours: number;
  readonly maxLevel: number;
}

/** The shipped limits. */
export const CHALLENGE_LIMITS: ChallengeLimits = gameConfig.sharing.challenge;

/** What a launch address asks for. Anything malformed is `none`, which opens Home as usual. */
export type Launch =
  | { readonly kind: 'none' }
  | { readonly kind: 'level'; readonly level: number }
  | { readonly kind: 'daily'; readonly date: string }
  | { readonly kind: 'weekly'; readonly week: string }
  | { readonly kind: 'challenge'; readonly level: number; readonly pours: number };

/** The one key a share link carries. */
export type ShareKey = { readonly daily: string } | { readonly weekly: string } | { readonly challenge: number; readonly pours: number };

const WHOLE = /^[1-9]\d*$/;

/** Whether `n` is a level a challenge may name: a whole number from 1 to `maxLevel`. */
export function isChallengeLevel(n: unknown, limits: ChallengeLimits = CHALLENGE_LIMITS): n is number {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= limits.maxLevel;
}

/** Whether `n` is a pour count a challenge may carry: a whole number from 1 to `maxPours`. */
export function isChallengePours(n: unknown, limits: ChallengeLimits = CHALLENGE_LIMITS): n is number {
  return Number.isInteger(n) && (n as number) >= 1 && (n as number) <= limits.maxPours;
}

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
 * did; then a valid `challenge`, then `daily`, then `weekly`. A challenge's pours are clamped to
 * 1 to `maxPours`; pours that are not a whole number open its level as a plain replay (§4).
 * Example: `parseLaunch('?challenge=80&pours=34') // { kind: 'challenge', level: 80, pours: 34 }`.
 */
export function parseLaunch(search: string, limits: ChallengeLimits = CHALLENGE_LIMITS): Launch {
  const q = new URLSearchParams(search);
  const level = Number(q.get('level'));
  if (Number.isInteger(level) && level >= 1) return { kind: 'level', level };
  const challenge = q.get('challenge') ?? '';
  if (WHOLE.test(challenge) && isChallengeLevel(Number(challenge), limits)) {
    const pours = q.get('pours') ?? '';
    if (!/^\d+$/.test(pours)) return { kind: 'level', level: Number(challenge) };
    return { kind: 'challenge', level: Number(challenge), pours: Math.min(limits.maxPours, Math.max(1, Number(pours))) };
  }
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
  else if ('weekly' in key) url.searchParams.set('weekly', key.weekly);
  else {
    url.searchParams.set('challenge', String(key.challenge));
    url.searchParams.set('pours', String(key.pours));
  }
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
