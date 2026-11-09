// Design: design/gdd/badges.md §3.8 (CSS/SVG medallions). Sprint 11 A2, D76.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { BadgeConfig } from '../../../src/core/badges';
import { BADGE_GLYPHS, badgeRank, badgeSvg, glyphKey } from '../../../src/ui/badge-art';

const cfg = config as unknown as BadgeConfig;

describe('badge medallions', () => {
  it('every catalogue badge has its own glyph drawing and the weekly family has one too', () => {
    for (const b of cfg.badges.list) expect(BADGE_GLYPHS, b.id).toContain(glyphKey(b));
    expect(BADGE_GLYPHS).toContain('weekly');
  });
  it('ranks badges of one stat by count, as one to four dots', () => {
    const rank = (id: string) => badgeRank(cfg.badges.list.find((b) => b.id === id)!, cfg);
    expect([rank('levels-10'), rank('levels-50'), rank('levels-100'), rank('levels-250')]).toEqual([1, 2, 3, 4]);
    expect(rank('every-shore')).toBe(1);
  });
  it('no two catalogue badges draw the same medallion', () => {
    const art = cfg.badges.list.map((b) => badgeSvg(b, cfg));
    expect(new Set(art).size).toBe(art.length);
  });
});
