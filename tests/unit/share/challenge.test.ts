// Story: production/sprints/sprint-14.md H3; design/gdd/sharing.md §3.2, §4, §5 (D116, D120, D121).
// Challenge links: `?challenge=N&pours=P`. The rules are pure (logic/launch.ts, logic/challenge.ts).
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { challengeOffer, challengeVerdict, versusOnStart } from '../../../src/ui/logic/challenge';
import { parseLaunch, shareLink } from '../../../src/ui/logic/launch';
import { freshOnboarding, keepShare, onboardingOf, takeShare } from '../../../src/ui/logic/onboarding';
import { t } from '../../../src/ui/strings';

const LIMITS = config.sharing.challenge;

describe('challenge links in the launch address (sharing §3.2)', () => {
  it('the config holds the limits', () => {
    expect(LIMITS).toEqual({ maxPours: 999, maxLevel: 1_000_000 });
  });
  it('reads a level and the sender\'s pours', () => {
    expect(parseLaunch('?challenge=80&pours=34', LIMITS)).toEqual({ kind: 'challenge', level: 80, pours: 34 });
  });
  it('clamps pours to 1-999 (§4)', () => {
    expect(parseLaunch('?challenge=80&pours=0', LIMITS)).toEqual({ kind: 'challenge', level: 80, pours: 1 });
    expect(parseLaunch('?challenge=80&pours=5000', LIMITS)).toEqual({ kind: 'challenge', level: 80, pours: 999 });
  });
  it('pours that are not a whole number open the level as a plain replay', () => {
    for (const p of ['abc', '2.5', '', '1e3x']) expect(parseLaunch(`?challenge=80&pours=${p}`, LIMITS), p).toEqual({ kind: 'level', level: 80 });
    expect(parseLaunch('?challenge=80', LIMITS)).toEqual({ kind: 'level', level: 80 });
  });
  it('ignores a level that is not 1 to 1,000,000', () => {
    for (const n of ['0', '-3', '2.5', '1000001', 'abc', '', '1e2', ' 5']) expect(parseLaunch(`?challenge=${n}&pours=10`, LIMITS), n).toEqual({ kind: 'none' });
  });
  it('the QA route ?level=N still wins, then challenge, then daily and weekly', () => {
    expect(parseLaunch('?level=5&challenge=80&pours=3', LIMITS)).toEqual({ kind: 'level', level: 5 });
    expect(parseLaunch('?challenge=80&pours=3&daily=2026-11-11', LIMITS)).toMatchObject({ kind: 'challenge' });
  });
  it('the share link carries only the level and the pours', () => {
    expect(shareLink('https://x.github.io/Strata/?daily=2026-11-01#map', { challenge: 80, pours: 34 })).toBe('https://x.github.io/Strata/?challenge=80&pours=34');
  });
});

describe('challengeOffer: what the receiver sees (§3.2, D121)', () => {
  it('a level they have reached or cleared: beat it', () => {
    expect(challengeOffer(80, 34, 81)).toEqual({ kind: 'beat', level: 80, pours: 34 });
    expect(challengeOffer(80, 34, 80)).toEqual({ kind: 'beat', level: 80, pours: 34 });
  });
  it('a level ahead of them: an invitation to play on, and the challenge is dropped', () => {
    expect(challengeOffer(80, 34, 12)).toEqual({ kind: 'ahead', level: 80, mine: 12 });
  });
});

describe('challengeVerdict (§4)', () => {
  it('beat, matched or behind, by how many', () => {
    expect(challengeVerdict(31, 34)).toEqual({ kind: 'beat', by: 3 });
    expect(challengeVerdict(34, 34)).toEqual({ kind: 'matched', by: 0 });
    expect(challengeVerdict(40, 34)).toEqual({ kind: 'behind', by: 6 });
  });
});

describe('a challenge link before the tutorial waits for it (as daily links, D82)', () => {
  it('is kept, then handed over once', () => {
    const o = keepShare(freshOnboarding(), { kind: 'challenge', level: 80, pours: 34 }, false);
    expect(o.pendingShare).toEqual({ challenge: 80, pours: 34 });
    const taken = takeShare(o);
    expect(taken.share).toEqual({ challenge: 80, pours: 34 });
    expect(taken.onboarding.pendingShare).toBeNull();
  });
  it('is not kept once the tutorial is done', () => {
    expect(keepShare(freshOnboarding(), { kind: 'challenge', level: 80, pours: 34 }, true).pendingShare).toBeNull();
  });
  it('a saved one is repaired: a good one kept, a bad one dropped', () => {
    expect(onboardingOf({ pendingShare: { challenge: 80, pours: 34 } }, false).pendingShare).toEqual({ challenge: 80, pours: 34 });
    for (const bad of [{ challenge: 0, pours: 3 }, { challenge: 80, pours: 0 }, { challenge: 80, pours: 1000 }, { challenge: '80', pours: 3 }, { challenge: 80 }]) {
      expect(onboardingOf({ pendingShare: bad }, false).pendingShare, JSON.stringify(bad)).toBeNull();
    }
  });
});

describe('the challenge words (strings.ts)', () => {
  it('the receiver\'s cards', () => {
    expect(t.friend.beatText(80, 34)).toBe('A friend cleared level 80 in 34 pours. Beat it?');
    expect(t.friend.aheadText(80, 12)).toBe('A friend is on level 80. You’re on level 12.');
    expect(t.friend.playLevel(12)).toBe('Play level 12');
  });
  it('the target under the pour counter, and the verdict', () => {
    expect(t.friend.target(34)).toBe('Beat 34');
    expect(t.friend.verdict({ kind: 'beat', by: 3 }, 31)).toBe('31 pours: you beat it by 3');
    expect(t.friend.verdict({ kind: 'matched', by: 0 }, 34)).toBe('34 pours: you matched it');
    expect(t.friend.verdict({ kind: 'behind', by: 1 }, 35)).toBe('35 pours: 1 more than your friend');
  });
  it('the share text and card', () => {
    expect(t.friend.shareText(80, 34, 'https://x/?challenge=80&pours=34')).toBe('Can you beat my 34 pours on Strata level 80?\nhttps://x/?challenge=80&pours=34');
    expect(t.shareCard.level(80, 34, true)).toEqual({ headline: 'Level 80', sub: 'Perfect ✓', lines: ['34 pours', 'Can you beat it?'] });
    expect(t.shareCard.level(80, 1, false)).toEqual({ headline: 'Level 80', sub: '', lines: ['1 pour', 'Can you beat it?'] });
  });
});

describe('versusOnStart: a challenge lasts only for the start it came with (strata-fd8)', () => {
  const v = { level: 5, pours: 34 };
  it('the challenge card starts its level with the target', () => {
    expect(versusOnStart(5, v)).toEqual(v);
  });
  it('any other start clears it, even a later replay of the same level', () => {
    expect(versusOnStart(5, null)).toBeNull();
    expect(versusOnStart(6, null)).toBeNull();
  });
  it('a target for another level is never attached', () => {
    expect(versusOnStart(6, v)).toBeNull();
  });
});
