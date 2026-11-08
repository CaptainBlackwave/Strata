// Story: production/epics/sprint-4/EPIC.md (time-of-day scenes)
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { newWallet } from '../../../src/core/economy';
import type { EconomyConfig } from '../../../src/core/economy';
import { type ThemeConfig, type ThemeTokens, activeTheme, buyTheme, contrastRatio, themeForHour } from '../../../src/core/themes';
import type { UiThemeTokens } from '../../../src/ui/theme-tokens';

const cfg = config as unknown as ThemeConfig & EconomyConfig;
const ids = cfg.themes.list.map((t) => t.id);

describe('catalog', () => {
  it('ships Midday free plus Dawn, Sunset and Moonlit at rising prices', () => {
    expect(ids).toEqual(['midday', 'dawn', 'sunset', 'moonlit']);
    const price = Object.fromEntries(cfg.themes.list.map((t) => [t.id, t.price]));
    expect(price.midday).toBe(0);
    expect(price.dawn).toBeLessThan(price.sunset);
    expect(price.sunset).toBeLessThan(price.moonlit);
  });
  it('the clock hours cover every hour of the day exactly once', () => {
    const hits = Array.from({ length: 24 }, (_, h) => cfg.themes.list.filter((t) => inRange(h, t.hours)).length);
    expect(hits.every((n) => n === 1)).toBe(true);
  });
});

function inRange(h: number, [from, to]: readonly [number, number]): boolean {
  return from <= to ? h >= from && h < to : h >= from || h < to;
}

describe('buyTheme', () => {
  const w = { ...newWallet(cfg), coins: 1000 };
  it('buys a scene for its price', () => {
    const r = buyTheme(w, ['midday'], 'sunset', cfg);
    expect(r.ok).toBe(true);
    expect(r.owned).toEqual(['midday', 'sunset']);
    expect(r.wallet.coins).toBe(1000 - 500);
  });
  it('refuses, changing nothing, when already owned, too expensive or unknown', () => {
    for (const [owned, id, coins] of [
      [['midday', 'dawn'], 'dawn', 1000],
      [['midday'], 'moonlit', 799],
      [['midday'], 'nope', 1000],
    ] as const) {
      const wallet = { ...w, coins };
      const r = buyTheme(wallet, owned as unknown as string[], id, cfg);
      expect(r.ok).toBe(false);
      expect(r.wallet).toBe(wallet);
    }
  });
});

describe('themeForHour and activeTheme', () => {
  it('maps the clock: dawn 5-9, midday 9-17, sunset 17-20, moonlit 20-5', () => {
    expect([4, 5, 8, 9, 16, 17, 19, 20, 23, 0].map((h) => themeForHour(h, cfg))).toEqual([
      'moonlit', 'dawn', 'dawn', 'midday', 'midday', 'sunset', 'sunset', 'moonlit', 'moonlit', 'moonlit',
    ]);
  });
  it('manual mode uses the selected scene', () => {
    expect(activeTheme({ owned: ['midday', 'dawn'], selected: 'dawn', auto: false }, 22, cfg)).toBe('dawn');
  });
  it('auto mode follows the clock but only through owned scenes, falling back to the selected one', () => {
    const s = { owned: ['midday', 'moonlit'], selected: 'midday', auto: true };
    expect(activeTheme(s, 22, cfg)).toBe('moonlit');
    expect(activeTheme(s, 6, cfg)).toBe('midday'); // dawn not owned
  });
  it('an unowned or unknown selection falls back to the default', () => {
    expect(activeTheme({ owned: ['midday'], selected: 'moonlit', auto: false }, 12, cfg)).toBe('midday');
  });
});

describe('readability (WCAG contrast) in every scene', () => {
  for (const theme of cfg.themes.list) {
    const k = theme.tokens;
    it(`${theme.id}: body text, soft text, buttons and toasts are readable`, () => {
      expect(contrastRatio(k.ink, k.card)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(k.ink, k.bgTop)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(k.ink, k.bgBottom)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(k.inkSoft, k.card)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(k.accentInk, k.accent)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(k.toastFg, k.toastBg)).toBeGreaterThanOrEqual(4.5);
    });
  }
  // Sprint 6 F4 (production/qa/sprint-6-findings.md: AX-6, AX-7, AX-8, AX-9, AX-10, UX-all-5).
  for (const theme of cfg.themes.list) {
    const k = theme.tokens as ThemeTokens & UiThemeTokens;
    it(`${theme.id}: sets every UI token (accent text, coral text, focus ring)`, () => {
      expect(k.accentText).toMatch(/^#[0-9a-f]{6}$/i);
      expect(k.coralText).toMatch(/^#[0-9a-f]{6}$/i);
      expect(k.focus).toMatch(/^#[0-9a-f]{6}$/i);
    });
    it(`${theme.id}: accent text, small accent labels and coral text reach 4.5:1`, () => {
      for (const bg of [k.card, k.surface2]) {
        expect(contrastRatio(k.accentText!, bg)).toBeGreaterThanOrEqual(4.5); // notes, kicker, "Next shell"
        expect(contrastRatio(k.coralText!, bg)).toBeGreaterThanOrEqual(4.5); // name error, streak line
      }
      expect(contrastRatio(k.accentInk, k.accentText!)).toBeGreaterThanOrEqual(4.5); // tag, level badge, weekday, counts
    });
    it(`${theme.id}: text on surface-2 and soft text on the background are readable`, () => {
      expect(contrastRatio(k.ink, k.surface2)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(k.inkSoft, k.surface2)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(k.inkSoft, k.bgBottom)).toBeGreaterThanOrEqual(3);
    });
    it(`${theme.id}: the focus ring reaches 3:1 on every surface it sits on`, () => {
      for (const bg of [k.card, k.surface2, k.bgTop, k.bgBottom]) expect(contrastRatio(k.focus!, bg)).toBeGreaterThanOrEqual(3);
    });
  }

  /**
   * Fixed colours in style.css that don't follow the scene, with the fixed tint they sit on
   * (`.shell-set.complete`, `.badge.price`, `.discard-btn`). Keep this list in step with the CSS.
   */
  const FIXED: readonly (readonly [what: string, fg: string, bg: string, min: number])[] = [
    ['completed set: ink on the mint tint (top)', '#4a3b2c', '#e8f5f0', 4.5],
    ['completed set: ink on the mint tint (bottom)', '#4a3b2c', '#cfe9e1', 4.5],
    ['completed set: soft ink on the mint tint', '#6b5a47', '#cfe9e1', 4.5],
    ['completed set: focus ring on the mint tint', '#2a6fdb', '#cfe9e1', 3],
    ['booster price badge', '#5a3d0c', '#f6c453', 4.5],
    ['Discard button label', '#ffffff', '#b3412b', 4.5],
  ];
  for (const [what, fg, bg, min] of FIXED) {
    it(`fixed colours: ${what} reaches ${min}:1`, () => {
      expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  }

  it('contrastRatio matches known values', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 0);
    expect(contrastRatio('#777777', '#777777')).toBeCloseTo(1, 5);
  });
});
