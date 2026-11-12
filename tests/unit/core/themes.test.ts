// Story: production/epics/sprint-4/EPIC.md (time-of-day scenes); production/sprints/sprint-7.md B5 (scene ladder);
// production/sprints/sprint-8.md P1 (the other 8 rungs) and P2 (southern hemisphere seasons)
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { newWallet } from '../../../src/core/economy';
import type { EconomyConfig } from '../../../src/core/economy';
import { type Theme, type ThemeConfig, type ThemeTokens, activeTheme, buyTheme, byIdOr, contrastRatio, inSeason, isOwned, localDateKey, themeById, themeForHour } from '../../../src/core/themes';
import type { UiThemeTokens } from '../../../src/ui/theme-tokens';

const cfg = config as unknown as ThemeConfig & EconomyConfig;
const ids = cfg.themes.list.map((t) => t.id);

describe('catalog', () => {
  it('ships Midday free plus Dawn, Sunset and Moonlit at rising prices', () => {
    expect(ids.slice(0, 4)).toEqual(['midday', 'dawn', 'sunset', 'moonlit']); // append-only (D27)
    const price = Object.fromEntries(cfg.themes.list.map((t) => [t.id, t.price]));
    expect(price.midday).toBe(0);
    expect(price.dawn).toBeLessThan(price.sunset);
    expect(price.sunset).toBeLessThan(price.moonlit);
  });
  it('the clock hours cover every hour of the day exactly once', () => {
    const hits = Array.from({ length: 24 }, (_, h) => cfg.themes.list.filter((t) => t.hours && inRange(h, t.hours)).length);
    expect(hits.every((n) => n === 1)).toBe(true);
  });
});

describe('the scene ladder (scenes.md 2.1a, sprint 7 B5)', () => {
  const byId = (id: string) => cfg.themes.list.find((t) => t.id === id)!;
  it('appends the first four ladder rungs with their ladder prices, kinds, tiers and windows', () => {
    expect(ids.slice(0, 8)).toEqual(['midday', 'dawn', 'sunset', 'moonlit', 'seafog', 'wintersnow', 'harvestmoon', 'newyear']); // append-only (D27)
    const rows = ['seafog', 'wintersnow', 'harvestmoon', 'newyear'].map((id) => {
      const t = byId(id);
      return [id, t.price, t.kind, t.tier, t.window ? `${t.window.from}..${t.window.to}` : null];
    });
    expect(rows).toEqual([
      ['seafog', 2500, 'weather', 1, null],
      ['wintersnow', 4500, 'season', 2, '12-01..02-29'],
      ['harvestmoon', 4600, 'holiday', 2, '09-15..10-15'],
      ['newyear', 5050, 'holiday', 3, '12-28..01-07'],
    ]);
  });
  it('appends the other eight rungs after them (sprint 8 P1), with their kinds, tiers and windows', () => {
    expect(ids.slice(8, 16)).toEqual(['highsummer', 'springblossom', 'autumnshore', 'rainbowafterrain', 'softrain', 'winterlights', 'meteorshower', 'auroranight']);
    const rows = ids.slice(8, 16).map((id) => {
      const t = byId(id);
      return [id, t.name, t.price, t.kind, t.tier, t.window ? `${t.window.from}..${t.window.to}` : null];
    });
    expect(rows).toEqual([
      ['highsummer', 'High summer', 2900, 'season', 1, '06-01..08-31'],
      ['springblossom', 'Spring blossom', 3300, 'season', 1, '03-01..05-31'],
      ['autumnshore', 'Autumn shore', 3800, 'season', 1, '09-01..11-30'],
      ['rainbowafterrain', 'Rainbow after rain', 4350, 'weather', 1, null],
      ['softrain', 'Soft rain', 4750, 'weather', 2, null],
      ['winterlights', 'Winter lights', 4900, 'holiday', 2, '12-01..01-06'],
      ['meteorshower', 'Meteor shower', 5200, 'sky', 3, '08-10..08-14'],
      ['auroranight', 'Aurora night', 5400, 'sky', 3, null],
    ]);
  });
  it('rungs 1-5 cost round50(2500 x 1.15^(n - 1)); rungs 6-12 round50(4350 x 1.031^k) since D100 (scenes.md 2.1a)', () => {
    const RUNGS = ['seafog', 'highsummer', 'springblossom', 'autumnshore', 'rainbowafterrain', 'wintersnow', 'harvestmoon', 'softrain', 'winterlights', 'newyear', 'meteorshower', 'auroranight'];
    const round50 = (x: number) => Math.round(x / 50) * 50;
    const expected = RUNGS.map((_, i) => (i < 5 ? round50(2500 * 1.15 ** i) : round50(4350 * 1.031 ** (i - 4))));
    expect(RUNGS.map((id) => byId(id).price)).toEqual(expected);
    expect(RUNGS.reduce((sum, id) => sum + byId(id).price, 0)).toBe(51250);
  });
  it('the picker lists the 16 sold scenes by price with no ties, so the order is stable (streak-only scenes sort last, sprint 16)', () => {
    const prices = cfg.themes.list.filter((t) => t.earned === undefined).map((t) => t.price);
    expect(new Set(prices).size).toBe(prices.length);
  });
  it('the original four keep their prices and stay plain time-of-day scenes', () => {
    expect(['midday', 'dawn', 'sunset', 'moonlit'].map((id) => byId(id).price)).toEqual([0, 300, 500, 800]);
    for (const id of ['midday', 'dawn', 'sunset', 'moonlit']) expect(byId(id).window).toBeUndefined();
  });
  it('the clock never picks a ladder scene', () => {
    const picked = new Set(Array.from({ length: 24 }, (_, h) => themeForHour(h, cfg)));
    expect([...picked].sort()).toEqual(['dawn', 'midday', 'moonlit', 'sunset']);
  });
});

describe('inSeason', () => {
  const scene = (window?: Theme['window']): Theme => ({ ...cfg.themes.list[0], id: 'x', window });
  it('a window inside one year includes both end days', () => {
    const t = scene({ from: '09-15', to: '10-15' });
    expect(['2026-09-14', '2026-09-15', '2026-10-01', '2026-10-15', '2026-10-16'].map((d) => inSeason(t, d))).toEqual([false, true, true, true, false]);
  });
  it('a window may wrap the year end', () => {
    const t = scene({ from: '12-28', to: '01-07' });
    expect(['2026-12-27', '2026-12-28', '2026-12-31', '2027-01-01', '2027-01-07', '2027-01-08', '2027-06-01'].map((d) => inSeason(t, d))).toEqual([
      false, true, true, true, true, false, false,
    ]);
  });
  it('a window ending on 02-29 covers Feb 28 in common years and Feb 29 in leap years', () => {
    const t = scene({ from: '12-01', to: '02-29' });
    expect(['2026-11-30', '2026-12-01', '2027-02-28', '2027-03-01', '2028-02-29', '2028-03-01'].map((d) => inSeason(t, d))).toEqual([
      false, true, true, false, true, false,
    ]);
  });
  it('a scene with no window, or a malformed date, is never in season', () => {
    expect(inSeason(scene(undefined), '2026-12-30')).toBe(false);
    expect(inSeason(scene({ from: '12-28', to: '01-07' }), 'not-a-date')).toBe(false);
  });
  it('localDateKey uses the local calendar date', () => {
    expect(localDateKey(new Date(2027, 0, 5, 23, 30))).toBe('2027-01-05');
    expect(localDateKey(new Date(2026, 11, 31, 0, 5))).toBe('2026-12-31');
  });
});

describe('activeTheme with a date (holiday scenes take over Match my clock)', () => {
  const all = ['midday', 'moonlit', 'seafog', 'wintersnow', 'harvestmoon', 'newyear'];
  it('an owned holiday scene in season replaces the clock scene', () => {
    expect(activeTheme({ owned: all, selected: 'midday', auto: true }, 12, cfg, '2026-09-20')).toBe('harvestmoon');
    expect(activeTheme({ owned: all, selected: 'midday', auto: true }, 22, cfg, '2027-01-03')).toBe('newyear');
  });
  it('out of season, or not owned, the clock decides as before', () => {
    expect(activeTheme({ owned: all, selected: 'midday', auto: true }, 22, cfg, '2026-10-16')).toBe('moonlit');
    expect(activeTheme({ owned: ['midday', 'moonlit'], selected: 'midday', auto: true }, 22, cfg, '2027-01-03')).toBe('moonlit');
  });
  it('season and weather scenes never take over the clock', () => {
    expect(activeTheme({ owned: all, selected: 'seafog', auto: true }, 12, cfg, '2027-02-01')).toBe('midday'); // Winter Snow in season
  });
  it('when two holiday windows overlap, the higher price wins', () => {
    const list = [...cfg.themes.list, { ...cfg.themes.list[0], id: 'cheaper', price: 100, kind: 'holiday', window: { from: '12-20', to: '01-02' } } as Theme];
    const c: ThemeConfig = { themes: { ...cfg.themes, list } };
    expect(activeTheme({ owned: [...all, 'cheaper'], selected: 'midday', auto: true }, 12, c, '2026-12-30')).toBe('newyear');
    expect(activeTheme({ owned: [...all, 'cheaper'], selected: 'midday', auto: true }, 12, c, '2026-12-22')).toBe('cheaper');
  });
  it('manual mode ignores the date, and leaving the date out keeps the old behaviour', () => {
    expect(activeTheme({ owned: all, selected: 'seafog', auto: false }, 12, cfg, '2027-01-03')).toBe('seafog');
    expect(activeTheme({ owned: all, selected: 'midday', auto: true }, 22, cfg)).toBe('moonlit');
  });
});

describe('more ladder scenes and Match my clock (sprint 8 P1)', () => {
  const all = ids;
  it('Winter lights takes over in December, and New Year wins where the two overlap', () => {
    expect(activeTheme({ owned: all, selected: 'midday', auto: true }, 12, cfg, '2026-12-10')).toBe('winterlights');
    expect(activeTheme({ owned: all, selected: 'midday', auto: true }, 12, cfg, '2026-12-30')).toBe('newyear');
    expect(activeTheme({ owned: all, selected: 'midday', auto: true }, 12, cfg, '2027-01-07')).toBe('newyear'); // Winter lights ended 01-06
    expect(activeTheme({ owned: all, selected: 'midday', auto: true }, 12, cfg, '2027-01-08')).toBe('midday');
  });
  it('sky scenes get the badge but never take over the clock', () => {
    const meteor = cfg.themes.list.find((t) => t.id === 'meteorshower')!;
    expect(inSeason(meteor, '2026-08-12')).toBe(true);
    expect(activeTheme({ owned: all, selected: 'midday', auto: true }, 12, cfg, '2026-08-12')).toBe('midday');
  });
});

describe('southern hemisphere seasons (sprint 8 P2, D42)', () => {
  const byId = (id: string) => cfg.themes.list.find((t) => t.id === id)!;
  const south = { southern: true };
  const days = (id: string, dates: string[], opts?: { southern?: boolean }) => dates.map((d) => inSeason(byId(id), d, opts));
  it('season windows shift by six months, keeping whole months', () => {
    expect(days('highsummer', ['2026-11-30', '2026-12-01', '2027-01-15', '2027-02-28', '2027-03-01', '2026-07-01'], south)).toEqual([false, true, true, true, false, false]);
    expect(days('highsummer', ['2028-02-29'], south)).toEqual([true]); // leap day is still summer
    expect(days('wintersnow', ['2026-05-31', '2026-06-01', '2026-08-31', '2026-09-01', '2026-12-15'], south)).toEqual([false, true, true, false, false]);
    expect(days('springblossom', ['2026-08-31', '2026-09-01', '2026-11-30', '2026-12-01', '2026-04-01'], south)).toEqual([false, true, true, false, false]);
    expect(days('autumnshore', ['2026-02-28', '2026-03-01', '2026-05-31', '2026-06-01', '2026-10-01'], south)).toEqual([false, true, true, false, false]);
  });
  it('holiday and sky windows keep their dates', () => {
    expect(days('newyear', ['2026-12-30', '2026-06-30'], south)).toEqual([true, false]);
    expect(days('harvestmoon', ['2026-09-20', '2026-03-20'], south)).toEqual([true, false]);
    expect(days('winterlights', ['2026-12-10', '2026-06-10'], south)).toEqual([true, false]);
    expect(days('meteorshower', ['2026-08-12', '2026-02-12'], south)).toEqual([true, false]);
  });
  it('off by default: leaving the option out, or false, keeps the northern windows', () => {
    expect(days('highsummer', ['2026-07-01', '2026-12-15'])).toEqual([true, false]);
    expect(days('highsummer', ['2026-07-01', '2026-12-15'], { southern: false })).toEqual([true, false]);
  });
  it('Match my clock follows the switch, and season scenes still never take over', () => {
    expect(activeTheme({ owned: ids, selected: 'midday', auto: true }, 12, cfg, '2026-12-15', south)).toBe('winterlights'); // holiday, same dates
    expect(activeTheme({ owned: ['midday', 'highsummer'], selected: 'midday', auto: true }, 12, cfg, '2026-12-15', south)).toBe('midday');
    expect(activeTheme({ owned: ids, selected: 'midday', auto: true }, 12, cfg, '2026-12-30', south)).toBe('newyear');
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
    it(`${theme.id}: the volume slider's filled track and thumb (accent) and unfilled track (soft ink) reach 3:1 on the card (D72)`, () => {
      expect(contrastRatio(k.accent, k.card)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(k.inkSoft, k.card)).toBeGreaterThanOrEqual(3);
    });
    it(`${theme.id}: sets its seal-shimmer and win-glow tint as r, g, b triplets (D73)`, () => {
      const rgb = /^(\d{1,3}), (\d{1,3}), (\d{1,3})$/;
      for (const v of [k.glow, k.glowCore]) {
        const m = rgb.exec(v ?? '');
        expect(m, `${theme.id} ${v}`).not.toBeNull();
        expect(m!.slice(1).every((n) => Number(n) <= 255)).toBe(true);
      }
    });
    it(`${theme.id}: a locked or unaffordable buy button (ink on surface-2, 0.15.1 strata-r20) reaches 4.5:1`, () => {
      expect(contrastRatio(k.ink, k.surface2)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${theme.id}: the focus ring reaches 3:1 on every surface it sits on`, () => {
      for (const bg of [k.card, k.surface2, k.bgTop, k.bgBottom]) expect(contrastRatio(k.focus!, bg)).toBeGreaterThanOrEqual(3);
    });
  }

  /** `color-mix(in srgb, a p%, b)` for two #rrggbb colours. */
  const mix = (a: string, p: number, b: string): string => {
    const ch = (h: string, i: number) => parseInt(h.slice(1 + 2 * i, 3 + 2 * i), 16);
    return '#' + [0, 1, 2].map((i) => Math.round(ch(a, i) * p + ch(b, i) * (1 - p)).toString(16).padStart(2, '0')).join('');
  };
  // Sprint 25 U5 (audit S4): a completed shell set is tinted from the scene (style.css .shell-set.complete).
  for (const theme of cfg.themes.list) {
    const k = theme.tokens as ThemeTokens & UiThemeTokens;
    it(`${theme.id}: a completed shell set's tint keeps its ink, soft ink and focus ring readable`, () => {
      const tint = mix(k.accent, 0.16, k.surface2);
      expect(contrastRatio(k.ink, tint)).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(k.inkSoft, tint)).toBeGreaterThanOrEqual(3);
      expect(contrastRatio(k.focus!, tint)).toBeGreaterThanOrEqual(3);
    });
  }

  it('the glow is tinted per scene, not one colour for all (D73)', () => {
    const glows = new Set(cfg.themes.list.map((t) => (t.tokens as ThemeTokens & UiThemeTokens).glow));
    expect(glows.size).toBeGreaterThanOrEqual(12);
  });

  /**
   * Fixed colours in style.css that don't follow the scene, with the fixed tint they sit on
   * (`.badge.price`, `.discard-btn`). Keep this list in step with the CSS.
   */
  const FIXED: readonly (readonly [what: string, fg: string, bg: string, min: number])[] = [
    // Sprint 25 U5 (audit S4): the completed set's fixed mint tint is gone. It now follows the scene
    // (accent 16% into surface-2), so its contrast is checked per scene below, not pinned here.
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

describe('byIdOr, themeById and isOwned (TD-3)', () => {
  const free = cfg.themes.list.find((t) => t.price === 0)!;
  const paid = cfg.themes.list.find((t) => t.price > 0)!;

  it('byIdOr finds by id and falls back to the first entry for an unknown id', () => {
    expect(byIdOr(cfg.themes.list, paid.id)).toBe(paid);
    expect(byIdOr(cfg.themes.list, 'no-such-scene')).toBe(cfg.themes.list[0]);
  });

  it('themeById reads the config list', () => {
    expect(themeById(cfg, paid.id)).toBe(paid);
    expect(themeById(cfg, 'nope')).toBe(cfg.themes.list[0]);
  });

  it('a free scene is always owned; a priced one only when listed', () => {
    expect(isOwned(free, [])).toBe(true);
    expect(isOwned(paid, [])).toBe(false);
    expect(isOwned(paid, [paid.id])).toBe(true);
  });
});
