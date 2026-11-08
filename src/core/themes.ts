/**
 * Time-of-day scenes: buying with coins, the "Match my clock" schedule, and the
 * contrast check that keeps every scene readable. Pure functions only.
 * Implements design/competitive-roadmap.md item C10 (sprint 4 decisions S4-1 to S4-4) and the
 * scene ladder's seasons and holidays (design/gdd/scenes.md 2.1a, D33; sprint 7 B5).
 */
import type { Wallet } from './economy';

/** Colour tokens a scene sets (applied as CSS custom properties). */
export interface ThemeTokens {
  readonly bgTop: string;
  readonly bgBottom: string;
  readonly sea: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly glass: string;
  readonly glassEdge: string;
  readonly card: string;
  readonly accent: string;
  readonly accentInk: string;
  readonly surface: string;
  readonly surface2: string;
  readonly toastBg: string;
  readonly toastFg: string;
  readonly sky: string;
  readonly themeColor: string;
}

/** What a scene is about. Only `time` scenes have clock hours; only `holiday` scenes take over the clock. */
export type ThemeKind = 'time' | 'season' | 'holiday' | 'weather' | 'sky';

/** A yearly date window, `MM-DD` to `MM-DD` inclusive. It may wrap the year end (`12-28` to `01-07`). */
export interface ThemeWindow {
  readonly from: string;
  readonly to: string;
}

/**
 * One scene. `hours` is [from, to) on the local clock and may wrap past midnight; scenes
 * without hours are never picked by the clock. `kind` defaults to `time` and `tier`
 * (1 colour-only, 2 one ambient layer, 3 layered and reactive) to 1.
 */
export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly hours?: readonly [number, number];
  readonly kind?: ThemeKind;
  readonly tier?: 1 | 2 | 3;
  readonly window?: ThemeWindow;
  readonly tokens: ThemeTokens;
}

/** The themes part of game-config.json. */
export interface ThemeConfig {
  readonly themes: { readonly default: string; readonly list: readonly Theme[] };
}

/** What the player owns and has chosen. */
export interface ThemeState {
  readonly owned: readonly string[];
  readonly selected: string;
  readonly auto: boolean;
}

/** The time-of-day scene whose clock range contains `hour` (0-23). Scenes without `hours` are skipped. */
export function themeForHour(hour: number, config: ThemeConfig): string {
  const hit = config.themes.list.find(({ hours }) => {
    if (!hours) return false;
    const [from, to] = hours;
    return from <= to ? hour >= from && hour < to : hour >= from || hour < to;
  });
  return hit?.id ?? config.themes.default;
}

/** The local calendar date as `YYYY-MM-DD` (the scene windows use the player's local date). */
export function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Whether `dateKey` (`YYYY-MM-DD`) falls inside the scene's window, both ends included.
 * A window may wrap the year end. A window ending `02-29` covers Feb 28 in common years.
 * Scenes with no window ("any time") are never "in season", and neither is a malformed date.
 * Example: `inSeason(newYear, '2027-01-03') === true`.
 */
export function inSeason(theme: Theme, dateKey: string): boolean {
  const md = /^\d{4}-(\d{2}-\d{2})$/.exec(dateKey)?.[1];
  if (!theme.window || !md) return false;
  const { from, to } = theme.window;
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/**
 * The scene to show now. Manual: the selected scene, if owned. Auto: an owned holiday
 * scene in season on `dateKey` (the highest price wins), else the clock's scene if owned,
 * else the selected one. Season and weather scenes never take over the clock. Anything
 * invalid falls back to the default. Leaving out `dateKey` skips the holiday step.
 * Example: `activeTheme(save.themes, now.getHours(), config, localDateKey(now))`.
 */
export function activeTheme(state: ThemeState, hour: number, config: ThemeConfig, dateKey?: string): string {
  const owns = (id: string) => id === config.themes.default || state.owned.includes(id);
  const known = (id: string) => config.themes.list.some((t) => t.id === id);
  const selected = known(state.selected) && owns(state.selected) ? state.selected : config.themes.default;
  if (!state.auto) return selected;
  if (dateKey) {
    const holiday = config.themes.list
      .filter((t) => t.kind === 'holiday' && owns(t.id) && inSeason(t, dateKey))
      .reduce<Theme | undefined>((best, t) => (!best || t.price > best.price ? t : best), undefined);
    if (holiday) return holiday.id;
  }
  const clock = themeForHour(hour, config);
  return owns(clock) ? clock : selected;
}

/** Buys a scene with coins. Fails, changing nothing, if owned, unknown or unaffordable. */
export function buyTheme(wallet: Wallet, owned: readonly string[], id: string, config: ThemeConfig) {
  const theme = config.themes.list.find((t) => t.id === id);
  if (!theme || owned.includes(id) || wallet.coins < theme.price) return { ok: false, wallet, owned };
  return { ok: true, wallet: { ...wallet, coins: wallet.coins - theme.price }, owned: [...owned, id] };
}

/** WCAG 2 contrast ratio between two `#rrggbb` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
