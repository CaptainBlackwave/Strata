// Story: production/sprints/sprint-14.md H2; design/gdd/sharing.md §3.1 (D116, D120, D122).
// The share picture's plan is pure (src/ui/logic/share-card.ts), so its words, colours and
// fallbacks are tested here; the canvas drawing is checked by screenshot.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type ThemeConfig, contrastRatio } from '../../../src/core/themes';
import { type CardText, cardAddress, cardJarColors, cardPlan, shareChannel } from '../../../src/ui/logic/share-card';
import { t } from '../../../src/ui/strings';

const themes = (config as unknown as ThemeConfig).themes.list;
const midday = themes.find((s) => s.id === 'midday')!.tokens;
const palette = config.palette;
const SIZE = config.sharing.card;
const text: CardText = { headline: 'Daily · 11 Nov', sub: 'Tricky', lines: ['Solved in 34 pours', '5-day streak'], name: 'Saffron Gull 42', address: 'captainblackwave.github.io/Strata' };

describe('cardPlan (sharing §3.1)', () => {
  it('is a 1080 × 1350 portrait card, from config', () => {
    expect(SIZE).toEqual({ width: 1080, height: 1350 });
    const plan = cardPlan(text, midday, [3, 1, 0], palette, { patterns: false, showName: false, ...SIZE });
    expect([plan.width, plan.height]).toEqual([1080, 1350]);
  });
  it('leaves the name off unless the player switches it on (D122)', () => {
    expect(cardPlan(text, midday, [0, 1, 2], palette, { patterns: false, showName: false, ...SIZE }).name).toBeNull();
    expect(cardPlan(text, midday, [0, 1, 2], palette, { patterns: false, showName: true, ...SIZE }).name).toBe('Saffron Gull 42');
    expect(cardPlan({ ...text, name: '  ' }, midday, [0, 1, 2], palette, { patterns: false, showName: true, ...SIZE }).name).toBeNull();
  });
  it('draws three jars in the board colours, with patterns only when Colour patterns is on', () => {
    const off = cardPlan(text, midday, [3, 1, 0], palette, { patterns: false, showName: false, ...SIZE });
    expect(off.jars).toEqual([{ hex: palette[3].hex, pattern: null }, { hex: palette[1].hex, pattern: null }, { hex: palette[0].hex, pattern: null }]);
    const on = cardPlan(text, midday, [3, 1, 0], palette, { patterns: true, showName: false, ...SIZE });
    expect(on.jars.map((j) => j.pattern)).toEqual([3, 1, 0]);
  });
  it('carries the scene colours, and never the board or a solution', () => {
    const plan = cardPlan(text, midday, [0, 1, 2], palette, { patterns: false, showName: false, ...SIZE });
    expect(plan.colors).toMatchObject({ bgTop: midday.bgTop, bgBottom: midday.bgBottom, sea: midday.sea, card: midday.card, ink: midday.ink });
    expect(Object.keys(plan)).not.toContain('board');
    expect(Object.keys(plan)).not.toContain('moves');
  });
  it('every text colour on the card reads at 4.5:1 or better in every scene', () => {
    for (const scene of themes) {
      const c = cardPlan(text, scene.tokens, [0, 1, 2], palette, { patterns: false, showName: true, ...SIZE }).colors;
      for (const key of ['ink', 'inkSoft', 'accentText'] as const) expect(contrastRatio(c[key], c.card), `${scene.id} ${key}`).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe('cardJarColors', () => {
  it('takes the first distinct board colours', () => {
    expect(cardJarColors([4, 4, 2, 7, 2, 9], 3, palette.length)).toEqual([4, 2, 7]);
  });
  it('fills up from the palette when the board has fewer colours, never repeating one', () => {
    expect(cardJarColors([5], 3, palette.length)).toEqual([5, 0, 1]);
    expect(cardJarColors([], 3, palette.length)).toEqual([0, 1, 2]);
    expect(cardJarColors([0, 1], 3, palette.length)).toEqual([0, 1, 2]);
  });
});

describe('cardAddress', () => {
  it('is the page address without the scheme, query, hash or trailing slash', () => {
    expect(cardAddress('https://captainblackwave.github.io/Strata/?daily=2026-11-11#x')).toBe('captainblackwave.github.io/Strata');
    expect(cardAddress('http://localhost:5173/')).toBe('localhost:5173');
  });
});

describe('shareChannel: the fallbacks, in order (sharing §3.1)', () => {
  const file = { name: 'strata.png' };
  it('picture and text when the share sheet takes files', () => {
    expect(shareChannel({ share: () => undefined, canShare: () => true }, file)).toBe('files');
  });
  it('text only when the sheet refuses files, has no canShare, or there is no picture', () => {
    expect(shareChannel({ share: () => undefined, canShare: () => false }, file)).toBe('text');
    expect(shareChannel({ share: () => undefined }, file)).toBe('text');
    expect(shareChannel({ share: () => undefined, canShare: () => true }, null)).toBe('text');
  });
  it('the clipboard when there is no share sheet', () => {
    expect(shareChannel({}, file)).toBe('clipboard');
  });
  it('a canShare that throws counts as no files', () => {
    expect(shareChannel({ share: () => undefined, canShare: () => { throw new Error('x'); } }, file)).toBe('text');
  });
});

describe('the card words (strings.ts)', () => {
  it('daily: the short date and difficulty, pours and streak', () => {
    expect(t.shareCard.daily('2026-11-11', 'Tricky', 34, 5)).toEqual({ headline: 'Daily · 11 Nov', sub: 'Tricky', lines: ['Solved in 34 pours', '5-day streak'] });
    expect(t.shareCard.daily('2026-01-02', 'Easy', 1, 1).lines).toEqual(['Solved in 1 pour', '1-day streak']);
    expect(t.shareCard.daily('2026-11-12', 'medium', 29, 1).sub, 'config names are lowercase').toBe('Medium');
  });
  it('weekly: the week, the theme and each board, a dash for one not played', () => {
    expect(t.shareCard.weekly('2026-W46', 'Lock and Key', [31, 40, null, 52, null])).toEqual({ headline: 'Weekly set · W46', sub: 'Lock and Key', lines: ['31 · 40 · – · 52 · –', '3 of 5 cleared'] });
  });
  it('the preview sheet has its words', () => {
    for (const k of ['title', 'showName', 'alt', 'share'] as const) expect(typeof t.shareCard[k]).toBe(k === 'alt' ? 'function' : 'string');
  });
});
