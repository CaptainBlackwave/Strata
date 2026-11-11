// Story: production/sprints/sprint-16.md T2 (D136): the streak-only Sea Lantern glass and Lighthouse Night scene are
// never sold, kept by save repair, and shown as "Streak reward · day N" until granted.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { newWallet, type EconomyConfig } from '../../../src/core/economy';
import { type StylesConfig, buyStyle, defaultStyles, earnedDay, isStyleOwned, stylesOf, wearStyle } from '../../../src/core/styles';
import { type ThemeConfig, activeTheme, buyTheme, isOwned, themeById } from '../../../src/core/themes';
import { badgeProgressOf } from '../../../src/core/badges';
import { styleAction } from '../../../src/ui/logic/styles-sheet';

const scfg = config as unknown as StylesConfig;
const tcfg = config as unknown as ThemeConfig;
const rich = { ...newWallet(config as unknown as EconomyConfig), coins: 1_000_000 };
const OPEN = scfg.styles.unlockLevel;

describe('Sea Lantern glass (glass:sealantern)', () => {
  it('is a streak-only piece earned on day 30', () => {
    expect(earnedDay('glass', 'sealantern', scfg)).toBe(30);
    expect(earnedDay('glass', 'seaglass', scfg)).toBeUndefined();
  });
  it('cannot be bought, even with coins to spare and the shop open', () => {
    const r = buyStyle(rich, defaultStyles(scfg), OPEN, 'glass', 'sealantern', scfg);
    expect(r.ok).toBe(false);
    expect(r.wallet).toBe(rich);
  });
  it('is not owned until the track grants it, and is then kept by repair and wearable', () => {
    expect(isStyleOwned(defaultStyles(scfg), 'glass', 'sealantern', scfg)).toBe(false);
    const repaired = stylesOf({ owned: ['glass:sealantern'], worn: { glass: 'sealantern', cork: 'cork', sand: 'plain' } }, scfg);
    expect(repaired.owned).toEqual(['glass:sealantern']);
    expect(repaired.worn.glass).toBe('sealantern');
    expect(wearStyle(defaultStyles(scfg), 'glass', 'sealantern', scfg).worn.glass).toBe('clear');
  });
  it('a worn but unowned Sea Lantern falls back to clear glass on repair', () => {
    expect(stylesOf({ owned: [], worn: { glass: 'sealantern' } }, scfg).worn.glass).toBe('clear');
  });
  it('the sheet says "earned" (no Buy) when not granted, and "wear" / "wearing" once owned', () => {
    expect(styleAction(defaultStyles(scfg), 1_000_000, OPEN, 'glass', 'sealantern', scfg)).toBe('earned');
    const owned = { owned: ['glass:sealantern'], worn: { ...defaultStyles(scfg).worn } };
    expect(styleAction(owned, 0, 1, 'glass', 'sealantern', scfg)).toBe('wear');
    expect(styleAction({ ...owned, worn: { ...owned.worn, glass: 'sealantern' } }, 0, 1, 'glass', 'sealantern', scfg)).toBe('wearing');
  });
});

describe('Lighthouse Night scene (lighthousenight)', () => {
  const night = themeById(tcfg, 'lighthousenight');
  it('is a streak-only sky scene earned on day 100, with no clock hours', () => {
    expect(night.id).toBe('lighthousenight');
    expect(night.earned).toBe(100);
    expect(night.kind).toBe('sky');
    expect(night.hours).toBeUndefined();
  });
  it('is not free: unowned until granted, even with price 0', () => {
    expect(isOwned(night, ['midday'])).toBe(false);
    expect(isOwned(night, ['midday', 'lighthousenight'])).toBe(true);
    expect(isOwned(themeById(tcfg, 'midday'), [])).toBe(true);
  });
  it('cannot be bought', () => {
    const r = buyTheme(rich, ['midday'], 'lighthousenight', tcfg);
    expect(r.ok).toBe(false);
    expect(r.owned).toEqual(['midday']);
  });
  it('shows only when selected and owned; the clock never picks it', () => {
    expect(activeTheme({ owned: ['midday'], selected: 'lighthousenight', auto: false }, 22, tcfg)).toBe('midday');
    expect(activeTheme({ owned: ['midday', 'lighthousenight'], selected: 'lighthousenight', auto: false }, 22, tcfg)).toBe('lighthousenight');
    for (let h = 0; h < 24; h++) expect(activeTheme({ owned: ['midday', 'lighthousenight'], selected: 'midday', auto: true }, h, tcfg, '2026-11-11')).not.toBe('lighthousenight');
  });
  it('does not count towards the scenes-owned badge until granted', () => {
    const base = { level: 1, stats: { jarsSealed: 0, pours: 0, perfectClears: 0, dailiesSolved: 0 }, perfect: [], shells: [], themes: { owned: ['midday'] }, scenesPlayed: [], seenMechanics: [], daily: { best: 0 } };
    const p = badgeProgressOf(base as never, config as never);
    expect(p.scenesOwned).toBe(1);
  });
});
