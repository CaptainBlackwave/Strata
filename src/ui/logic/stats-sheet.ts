/**
 * The "Your stats" sheet (sprint 18 S1, D150): what a player can copy and send to the team, as
 * plain text. Nothing is sent automatically. Pure and DOM-free; the labels come from strings.ts.
 */
import type { Stats } from '../../core/profile';

/** What the sheet reads, all from the save and the device. */
export interface StatsInput {
  readonly version: string;
  readonly level: number;
  readonly streak: number;
  readonly bestStreak: number;
  readonly stats: Stats;
  readonly shells: number;
  readonly badges: number;
  readonly goalsDone: number;
  readonly goalsTotal: number;
  readonly dailySolvedToday: boolean;
  /** Event boards cleared this year, or null outside an event. */
  readonly event: { readonly name: string; readonly cleared: number; readonly total: number } | null;
  readonly coins: number;
  readonly browser: string;
  readonly screen: { readonly width: number; readonly height: number; readonly ratio: number };
  /** `YYYY-MM-DD` UTC. */
  readonly today: string;
}

/** The sheet's words. */
export interface StatsLabels {
  readonly title: string;
  readonly progress: string;
  readonly today: string;
  readonly boosters: string;
  readonly device: string;
  readonly yes: string;
  readonly no: string;
  readonly rows: Readonly<Record<StatRowKey, string>>;
}

/** Every row the sheet can show, in order within its section. */
export type StatRowKey =
  | 'level' | 'streak' | 'bestStreak' | 'perfectClears' | 'dailiesSolved' | 'shells' | 'badges' | 'jarsSealed'
  | 'date' | 'goals' | 'dailyToday' | 'event'
  | 'boostersUsed' | 'coinsEarned' | 'coins' | 'pours'
  | 'version' | 'browser' | 'screen';

/** One section of the sheet: a heading and label/value rows. */
export interface StatsSection {
  readonly heading: string;
  readonly rows: readonly { readonly key: StatRowKey; readonly label: string; readonly value: string }[];
}

const n0 = (n: number) => n.toLocaleString('en');

/**
 * The sheet's sections: progress, today, boosters and coins, device. The event row shows only while
 * an event runs. Example: `statsSections(input, labels)[0].rows[0]` is the level.
 */
export function statsSections(i: StatsInput, l: StatsLabels): StatsSection[] {
  const row = (key: StatRowKey, value: string) => ({ key, label: l.rows[key], value });
  const today = [row('date', i.today), row('goals', `${i.goalsDone}/${i.goalsTotal}`), row('dailyToday', i.dailySolvedToday ? l.yes : l.no)];
  if (i.event) today.push({ key: 'event', label: i.event.name, value: `${i.event.cleared}/${i.event.total}` });
  return [
    { heading: l.progress, rows: [row('level', n0(i.level)), row('streak', n0(i.streak)), row('bestStreak', n0(i.bestStreak)), row('perfectClears', n0(i.stats.perfectClears)), row('dailiesSolved', n0(i.stats.dailiesSolved)), row('shells', n0(i.shells)), row('badges', n0(i.badges)), row('jarsSealed', n0(i.stats.jarsSealed))] },
    { heading: l.today, rows: today },
    { heading: l.boosters, rows: [row('boostersUsed', n0(i.stats.boostersUsed)), row('coinsEarned', n0(i.stats.coinsEarned)), row('coins', n0(i.coins)), row('pours', n0(i.stats.pours))] },
    { heading: l.device, rows: [row('version', i.version), row('browser', i.browser), row('screen', `${i.screen.width}×${i.screen.height} @${i.screen.ratio}x`)] },
  ];
}

/** The sheet as plain text to copy: a title line, then each section with `label: value` lines. */
export function statsText(i: StatsInput, l: StatsLabels): string {
  return [l.title, ...statsSections(i, l).flatMap((s) => ['', s.heading, ...s.rows.map((r) => `${r.label}: ${r.value}`)])].join('\n');
}

/**
 * A short browser name from a user agent, e.g. "Safari 18 (iOS)", "Chrome 131 (Android)",
 * "Firefox 133". Unknown ones give "Other". Never includes anything identifying beyond that.
 */
export function browserName(ua: string): string {
  const os = /iPhone|iPad|iPod/.test(ua) ? ' (iOS)' : /Android/.test(ua) ? ' (Android)' : /Mac OS X/.test(ua) ? ' (macOS)' : /Windows/.test(ua) ? ' (Windows)' : /Linux/.test(ua) ? ' (Linux)' : '';
  const m = /Firefox\/(\d+)/.exec(ua) ?? /FxiOS\/(\d+)/.exec(ua);
  if (m) return `Firefox ${m[1]}${os}`;
  const e = /Edg\/(\d+)/.exec(ua);
  if (e) return `Edge ${e[1]}${os}`;
  const c = /(?:Chrome|CriOS)\/(\d+)/.exec(ua);
  if (c) return `Chrome ${c[1]}${os}`;
  const s = /Version\/(\d+)[^ ]* (?:Mobile\/\S+ )?Safari/.exec(ua);
  if (s) return `Safari ${s[1]}${os}`;
  return `Other${os}`;
}
