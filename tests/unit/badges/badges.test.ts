// Design: design/gdd/badges.md §3 (rules, counting, back-fill), §8 (Logic). Sprint 11 A2, D76.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { allShells } from '../../../src/core/collection';
import {
  type Badge,
  type BadgeInput,
  type BadgeProgress,
  type BadgeSourceConfig,
  BADGE_FAMILIES,
  awardBadges,
  backfillBadges,
  badgeProgress,
  badgeProgressOf,
  earnedBadges,
  isEarned,
  isWeeklyBadgeId,
  newlyEarned,
  repairBadges,
  weeklyBadgeId,
} from '../../../src/core/badges';
import { emptyStats } from '../../../src/core/profile';
import { t } from '../../../src/ui/strings';

const cfg = config as unknown as BadgeSourceConfig;
const LIST: readonly Badge[] = cfg.badges.list;
const byId = (id: string) => LIST.find((b) => b.id === id)!;

/** Progress with every value at 0. */
function zero(over: Partial<BadgeProgress> = {}): BadgeProgress {
  return { levels: 0, jarsSealed: 0, pours: 0, perfectClears: 0, tallPerfect: 0, shells: 0, sets: 0, scenesOwned: 0, scenesPlayed: 0, ownedScenesPlayed: 0, mechanicsSeen: 0, dailiesSolved: 0, bestStreak: 0, ...over };
}

/** A save-like input for a brand-new player. */
function input(over: Partial<BadgeInput> = {}): BadgeInput {
  return { level: 1, perfect: [], shells: [], stats: emptyStats(), daily: { best: 0 }, themes: { owned: [cfg.themes.default] }, scenesPlayed: [], seenMechanics: [], ...over };
}

describe('the catalogue (badges.md §3.1)', () => {
  it('has 20 to 30 badges with unique ids, in all five families', () => {
    expect(LIST.length).toBeGreaterThanOrEqual(20);
    expect(LIST.length).toBeLessThanOrEqual(30);
    expect(new Set(LIST.map((b) => b.id)).size).toBe(LIST.length);
    for (const f of BADGE_FAMILIES.filter((x) => x !== 'weekly')) expect(LIST.some((b) => b.family === f)).toBe(true);
    expect(LIST.some((b) => b.family === 'weekly')).toBe(false); // weekly badges are generated, not listed (§3.9)
  });
  it('names every badge through the string table, with a name and a description', () => {
    for (const b of LIST) {
      const text = (t.badges as Record<string, { name: string; desc: string }>)[b.name];
      expect(text, b.id).toBeDefined();
      expect(text.name.length).toBeGreaterThan(0);
      expect(text.name.length).toBeLessThanOrEqual(18);
      expect(text.desc.length).toBeGreaterThan(0);
    }
  });
  it('carries no reward of any kind (D76): only id, family, name and rule', () => {
    for (const b of LIST) expect(Object.keys(b).sort()).toEqual(['family', 'id', 'name', 'rule']);
  });
  it('asks for no more than the game has (shells, sets, scenes, special jars)', () => {
    const totals: Partial<Record<string, number>> = { shells: allShells(cfg).length, sets: cfg.collection.sets.length, scenesOwned: cfg.themes.list.length, scenesPlayed: cfg.themes.list.length, mechanicsSeen: cfg.mechanics.list.length };
    for (const b of LIST) {
      if (b.rule.kind === 'count') {
        expect(b.rule.count, b.id).toBeGreaterThanOrEqual(1);
        expect(b.rule.count, b.id).toBeLessThanOrEqual(totals[b.rule.of] ?? Infinity);
      } else {
        expect(b.rule.min).toBeGreaterThanOrEqual(2);
        expect(b.rule.min).toBeLessThanOrEqual(cfg.themes.list.length);
      }
    }
  });
});

describe('every rule at count − 1 and at count (§3.1, §4)', () => {
  for (const b of LIST) {
    if (b.rule.kind !== 'count') continue;
    const { of, count } = b.rule;
    it(`${b.id}: ${of} ${count - 1} is not enough, ${count} earns it`, () => {
      expect(isEarned(b, zero({ [of]: count - 1 }))).toBe(false);
      expect(isEarned(b, zero({ [of]: count }))).toBe(true);
    });
  }
  it('every-shore: needs at least `min` owned scenes, every one of them won in', () => {
    const b = byId('every-shore');
    expect(b.rule.kind).toBe('everyOwnedScene');
    const min = b.rule.kind === 'everyOwnedScene' ? b.rule.min : 0;
    expect(isEarned(b, zero({ scenesOwned: min, ownedScenesPlayed: min - 1 }))).toBe(false);
    expect(isEarned(b, zero({ scenesOwned: min, ownedScenesPlayed: min }))).toBe(true);
    expect(isEarned(b, zero({ scenesOwned: min - 1, ownedScenesPlayed: min - 1 }))).toBe(false);
    expect(isEarned(b, zero({ scenesOwned: min + 1, ownedScenesPlayed: min }))).toBe(false);
  });
});

describe('badgeProgressOf: the stat each badge reads (§3.2)', () => {
  it('levels cleared is level − 1', () => {
    expect(badgeProgressOf(input({ level: 10 }), cfg).levels).toBe(9);
    expect(badgeProgressOf(input({ level: 11 }), cfg).levels).toBe(10);
  });
  it('tall Perfect counts only tall-jar levels in the Perfect list', () => {
    expect(badgeProgressOf(input({ perfect: [3, 9, 11] }), cfg).tallPerfect).toBe(0);
    expect(badgeProgressOf(input({ perfect: [3, 10, 11, 20] }), cfg).tallPerfect).toBe(2);
  });
  it('scenes owned include the free ones; scenes played count each known scene once', () => {
    const p = badgeProgressOf(input({ themes: { owned: ['midday', 'dawn', 'sunset'] }, scenesPlayed: ['dawn', 'seafog', 'nowhere'] }), cfg);
    expect(p.scenesOwned).toBe(3);
    expect(p.scenesPlayed).toBe(2);
    expect(p.ownedScenesPlayed).toBe(1);
  });
  it('a special jar is met by its intro card, or by passing its debut level', () => {
    expect(badgeProgressOf(input({ level: 21 }), cfg).mechanicsSeen).toBe(0);
    expect(badgeProgressOf(input({ level: 22 }), cfg).mechanicsSeen).toBe(1);
    expect(badgeProgressOf(input({ seenMechanics: ['frozen', 'unknown'] }), cfg).mechanicsSeen).toBe(1);
    expect(badgeProgressOf(input({ level: 200, seenMechanics: ['narrow'] }), cfg).mechanicsSeen).toBe(4);
  });
  it('the hourglass is not one of "all four special jars" (sprint 13 M1, D96)', () => {
    expect(badgeProgressOf(input({ level: 200, seenMechanics: ['hourglass'] }), cfg).mechanicsSeen).toBe(4);
    expect(badgeProgressOf(input({ level: 22, seenMechanics: ['hourglass'] }), cfg).mechanicsSeen).toBe(1);
  });
  it('reads the counters, shells, sets and best streak from the save', () => {
    const tidepool = cfg.collection.sets[0].shells.map((s) => s.id);
    const p = badgeProgressOf(input({ shells: tidepool, daily: { best: 7 }, stats: { ...emptyStats(), jarsSealed: 34, pours: 900, perfectClears: 3, dailiesSolved: 2 } }), cfg);
    expect(p).toMatchObject({ shells: 5, sets: 1, bestStreak: 7, jarsSealed: 34, pours: 900, perfectClears: 3, dailiesSolved: 2 });
  });
});

describe('progress lines (§3.8)', () => {
  it('caps the value at the target', () => {
    expect(badgeProgress(byId('jars-100'), zero({ jarsSealed: 34 }))).toEqual({ have: 34, need: 100 });
    expect(badgeProgress(byId('jars-100'), zero({ jarsSealed: 340 }))).toEqual({ have: 100, need: 100 });
  });
  it('every-shore needs at least `min`, or every owned scene', () => {
    expect(badgeProgress(byId('every-shore'), zero({ scenesOwned: 2, ownedScenesPlayed: 2 }))).toEqual({ have: 2, need: 4 });
    expect(badgeProgress(byId('every-shore'), zero({ scenesOwned: 6, ownedScenesPlayed: 5 }))).toEqual({ have: 5, need: 6 });
  });
  it('reads "34/100 jars"', () => {
    expect(t.badgeCount.jarsSealed(34, 100)).toBe('34/100 jars');
    expect(t.badgeCount.pours(1200, 10000)).toBe('1,200/10,000 pours');
  });
});

describe('earning (§3.3)', () => {
  it('earnedBadges lists the met rules in catalogue order', () => {
    expect(earnedBadges(zero(), cfg)).toEqual([]);
    expect(earnedBadges(zero({ bestStreak: 7, jarsSealed: 1 }), cfg)).toEqual(['first-seal', 'streak-7']);
  });
  it('newlyEarned lists only ids not already saved, in catalogue order', () => {
    const after = zero({ bestStreak: 7, jarsSealed: 100, levels: 10 });
    expect(newlyEarned(['first-seal'], after, cfg)).toEqual(['jars-100', 'levels-10', 'streak-7']);
    expect(newlyEarned(['streak-7', 'levels-10', 'jars-100', 'first-seal'], after, cfg)).toEqual([]);
  });
  it('awardBadges appends the new ids after the saved ones, which keep their order and stay even when unmet', () => {
    const r = awardBadges(['streak-7', 'levels-50'], zero({ jarsSealed: 1, levels: 10 }), cfg);
    expect(r.fresh).toEqual(['first-seal', 'levels-10']);
    expect(r.badges).toEqual(['streak-7', 'levels-50', 'first-seal', 'levels-10']);
  });
});

describe('back-fill of an old save (§3.5)', () => {
  const tidepool = cfg.collection.sets[0].shells.map((s) => s.id);
  const old = input({ level: 60, perfect: [10, 20, 33], shells: [...tidepool, 'not-a-shell'], daily: { best: 8 }, stats: { ...emptyStats(), perfectClears: 30, pours: 1200, dailiesSolved: 3 }, seenMechanics: [], themes: { owned: ['midday', 'dawn'] } });
  it('awards exactly what the existing stats already meet, in catalogue order', () => {
    expect(backfillBadges({ ...old, badges: [] }, cfg)).toEqual(['levels-10', 'levels-50', 'pours-1000', 'perfect-1', 'perfect-25', 'tall-perfect-1', 'shells-1', 'sets-1', 'mechanics-1', 'daily-1', 'streak-7']);
  });
  it('awards each once: a second pass changes nothing', () => {
    const once = backfillBadges({ ...old, badges: [] }, cfg);
    expect(backfillBadges({ ...old, badges: once }, cfg)).toEqual(once);
  });
});

describe('save repair (§3.10)', () => {
  it('drops unknown ids, non-strings and duplicates, keeping the saved order', () => {
    expect(repairBadges(['streak-7', 'gold-cup', 7, 'first-seal', 'streak-7', null], cfg)).toEqual(['streak-7', 'first-seal']);
    expect(repairBadges('first-seal', cfg)).toEqual([]);
    expect(repairBadges(undefined, cfg)).toEqual([]);
  });
  it('keeps well-formed weekly ids (§3.9)', () => {
    expect(repairBadges(['weekly-2026-W46', 'weekly-2026-W54', 'weekly-26-W01', 'first-seal'], cfg)).toEqual(['weekly-2026-W46', 'first-seal']);
  });
});

describe('the weekly family, reserved (§3.9)', () => {
  it('builds and recognises weekly-YYYY-Www', () => {
    expect(weeklyBadgeId(2026, 46)).toBe('weekly-2026-W46');
    expect(weeklyBadgeId(2027, 1)).toBe('weekly-2027-W01');
    expect(isWeeklyBadgeId('weekly-2026-W53')).toBe(true);
    expect(isWeeklyBadgeId('weekly-2026-W00')).toBe(false);
    expect(isWeeklyBadgeId('weekly-2026-W54')).toBe(false);
    expect(isWeeklyBadgeId('weekly-2026-46')).toBe(false);
  });
});

describe('win-card and toast text (§3.6, §3.7)', () => {
  it('one combined line for several badges', () => {
    expect(t.newBadges(['First Seal'])).toBe('New badge: First Seal');
    expect(t.newBadges(['First Seal', 'Paddler'])).toBe('New badges: First Seal, Paddler');
  });
});
