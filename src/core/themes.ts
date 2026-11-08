/**
 * Time-of-day scenes: buying with coins, the "Match my clock" schedule, and the
 * contrast check that keeps every scene readable. Pure functions only.
 * Implements design/competitive-roadmap.md item C10 (sprint 4 decisions S4-1 to S4-4).
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

/** One scene. `hours` is [from, to) on the local clock and may wrap past midnight. */
export interface Theme {
  readonly id: string;
  readonly name: string;
  readonly price: number;
  readonly hours: readonly [number, number];
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

/** The scene whose clock range contains `hour` (0-23). */
export function themeForHour(hour: number, config: ThemeConfig): string {
  const hit = config.themes.list.find(({ hours: [from, to] }) => (from <= to ? hour >= from && hour < to : hour >= from || hour < to));
  return hit?.id ?? config.themes.default;
}

/**
 * The scene to show now. Manual: the selected scene, if owned. Auto: the clock's scene
 * if owned, otherwise the selected one. Anything invalid falls back to the default.
 * Example: `activeTheme(save.themes, new Date().getHours(), config)`.
 */
export function activeTheme(state: ThemeState, hour: number, config: ThemeConfig): string {
  const owns = (id: string) => id === config.themes.default || state.owned.includes(id);
  const known = (id: string) => config.themes.list.some((t) => t.id === id);
  const selected = known(state.selected) && owns(state.selected) ? state.selected : config.themes.default;
  if (!state.auto) return selected;
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
