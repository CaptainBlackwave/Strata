// Story: production/sprints/sprint-14.md H4; design/gdd/sharing.md §3.4 (D116, D120).
// Share at a few high points: a completed shell set, a daily streak milestone, a new badge.
// Never a pop-up, never a reward: the moments are quiet buttons on the win card.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { isStreakMilestone, shareMoments } from '../../../src/ui/logic/moments';
import { siteLink } from '../../../src/ui/logic/launch';
import { t } from '../../../src/ui/strings';

const MILESTONES = config.sharing.streakMilestones;

describe('streak milestones (sharing §3.4)', () => {
  it('are days 7, 30, 60 and 100, from config', () => {
    expect(MILESTONES).toEqual([7, 30, 60, 100]);
  });
  it('only those exact days count', () => {
    expect([6, 7, 8, 30, 31, 60, 100, 101, 0].map((d) => isStreakMilestone(d, MILESTONES))).toEqual([false, true, false, true, false, true, true, false, false]);
  });
});

describe('shareMoments: what a win offers, in order', () => {
  it('nothing on an ordinary win', () => {
    expect(shareMoments({ setName: null, streak: null, badges: [] }, MILESTONES)).toEqual([]);
  });
  it('a completed set, a streak milestone (daily only) and the first new badge', () => {
    expect(shareMoments({ setName: 'Tide Pool', streak: 30, badges: ['firstSeal', 'jarStacker'] }, MILESTONES)).toEqual([
      { kind: 'set', name: 'Tide Pool' },
      { kind: 'streak', days: 30 },
      { kind: 'badge', id: 'firstSeal' },
    ]);
  });
  it('a streak that is not a milestone, or no streak (not a daily), offers nothing', () => {
    expect(shareMoments({ setName: null, streak: 29, badges: [] }, MILESTONES)).toEqual([]);
    expect(shareMoments({ setName: null, streak: null, badges: [] }, MILESTONES)).toEqual([]);
  });
});

describe('the moment words (strings.ts), and the link that goes with them', () => {
  it('a set', () => {
    expect(t.moment.card({ kind: 'set', name: 'Tide Pool' }, '')).toEqual({ headline: 'Tide Pool set', sub: 'Shell collection', lines: ['Complete', 'Every shell found'] });
    expect(t.moment.shareText({ kind: 'set', name: 'Tide Pool' }, '', 'https://x/')).toBe('I completed the Tide Pool shell set in Strata, a calm seaside sand-sort puzzle.\nhttps://x/');
  });
  it('a streak', () => {
    expect(t.moment.card({ kind: 'streak', days: 30 }, '')).toEqual({ headline: '30-day streak', sub: 'Daily puzzle', lines: ['30 days', 'One calm puzzle a day'] });
    expect(t.moment.row({ kind: 'streak', days: 30 }, '')).toBe('30-day streak!');
  });
  it('a badge, by its name', () => {
    expect(t.moment.card({ kind: 'badge', id: 'firstSeal' }, 'First Seal')).toEqual({ headline: 'New badge', sub: 'First Seal', lines: ['Badge earned', 'Earned by play'] });
    expect(t.moment.label({ kind: 'badge', id: 'firstSeal' }, 'First Seal')).toBe('Share: New badge, First Seal');
  });
  it('the link is the plain site address: no key, query or hash', () => {
    expect(siteLink('https://x.github.io/Strata/?challenge=3&pours=4#map')).toBe('https://x.github.io/Strata/');
  });
});
