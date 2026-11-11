// Story: production/sprints/sprint-17.md E2 (D146): the Frost glass prize is never sold, kept by repair,
// and the Jar styles sheet shows it locked as "Winter Tide prize · December"; the Winter Tide badge is kept
// by the save repair but never awarded by a badge rule.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type EconomyConfig, newWallet } from '../../../src/core/economy';
import { type StylesConfig, buyStyle, defaultStyles, stylesOf } from '../../../src/core/styles';
import { type BadgeConfig, type EventBadgeConfig, awardBadges, badgeProgressOf, eventBadgeIds, repairBadges } from '../../../src/core/badges';
import { type EventsConfig } from '../../../src/core/events';
import { lockText, styleAction } from '../../../src/ui/logic/styles-sheet';

const scfg = config as unknown as StylesConfig;
const rich = { ...newWallet(config as unknown as EconomyConfig), coins: 1_000_000 };
const OPEN = scfg.styles.unlockLevel;

describe('Frost glass (glass:frost)', () => {
  it('cannot be bought, even with coins and the shop open', () => {
    expect(buyStyle(rich, defaultStyles(scfg), OPEN, 'glass', 'frost', scfg).ok).toBe(false);
  });
  it('is kept and worn after repair once owned; unowned, a worn Frost falls back to clear', () => {
    const owned = stylesOf({ owned: ['glass:frost'], worn: { glass: 'frost' } }, scfg);
    expect(owned.owned).toEqual(['glass:frost']);
    expect(owned.worn.glass).toBe('frost');
    expect(stylesOf({ owned: [], worn: { glass: 'frost' } }, scfg).worn.glass).toBe('clear');
  });
  it('the sheet shows it locked as the event prize, never a price', () => {
    expect(styleAction(defaultStyles(scfg), 1_000_000, OPEN, 'glass', 'frost', scfg)).toBe('earned');
    expect(lockText('glass', 'frost', scfg, (config as unknown as EventsConfig).events)).toBe('Winter Tide prize · December');
    expect(lockText('glass', 'sealantern', scfg)).toBe('Streak reward · day 30');
    expect(lockText('glass', 'seaglass', scfg)).toBe('');
  });
  it('once owned it is wearable', () => {
    const s = { owned: ['glass:frost'], worn: { ...defaultStyles(scfg).worn } };
    expect(styleAction(s, 0, 1, 'glass', 'frost', scfg)).toBe('wear');
  });
});

describe('Winter Tide badge (event-wintertide)', () => {
  const bcfg = config as unknown as BadgeConfig & EventBadgeConfig;
  it('is an event prize badge, kept by the save repair', () => {
    expect(eventBadgeIds(bcfg)).toEqual(['event-wintertide']);
    expect(repairBadges(['event-wintertide', 'event-nope', 'first-seal'], bcfg)).toEqual(['event-wintertide', 'first-seal']);
  });
  it('is never awarded by a badge rule, however much progress there is', () => {
    const huge = { levels: 1e6, jarsSealed: 1e6, pours: 1e6, perfectClears: 1e6, tallPerfect: 1e6, shells: 1e6, sets: 1e6, scenesOwned: 1e6, scenesPlayed: 1e6, ownedScenesPlayed: 1e6, mechanicsSeen: 1e6, dailiesSolved: 1e6, bestStreak: 1e6 };
    expect(awardBadges([], huge as ReturnType<typeof badgeProgressOf>, bcfg).badges).not.toContain('event-wintertide');
  });
});
