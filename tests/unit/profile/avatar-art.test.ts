// Design: design/gdd/player-profile.md §3.6 and §8 (every avatar and frame has its own artwork)
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { ProfileConfig } from '../../../src/core/profile';
import { AVATAR_IDS, FRAME_IDS, STAT_ICONS, portraitSvg } from '../../../src/ui/avatars';

const cfg = config as unknown as ProfileConfig;
/** Strips the per-call clip ids so two drawings can be compared. */
const art = (svg: string) => svg.replace(/av\d+c?/g, '');

describe('profile artwork', () => {
  it('every avatar and frame in the catalog has a drawing, and no drawing is unused', () => {
    expect([...AVATAR_IDS].sort()).toEqual(cfg.profile.avatars.map((a) => a.id).sort());
    expect([...FRAME_IDS].sort()).toEqual(cfg.profile.frames.map((f) => f.id).sort());
  });
  it('every avatar × frame pair draws differently', () => {
    const svgs = cfg.profile.avatars.flatMap((a) => cfg.profile.frames.map((f) => art(portraitSvg(a, f.id))));
    expect(new Set(svgs).size).toBe(cfg.profile.avatars.length * cfg.profile.frames.length);
  });
  it('unknown ids fall back to the default drawings instead of failing', () => {
    expect(art(portraitSvg({ id: 'nope', bg: '#ffffff' }, 'nope'))).toBe(art(portraitSvg({ id: 'sand-jar', bg: '#ffffff' }, 'sand')).replace(/data-avatar="sand-jar" data-frame="sand"/, 'data-avatar="nope" data-frame="nope"'));
  });
  it('clip ids are unique per drawing, so two portraits on one page never share one', () => {
    const a = portraitSvg(cfg.profile.avatars[0], 'sand');
    const b = portraitSvg(cfg.profile.avatars[0], 'sand');
    expect(a.match(/id="(av\d+)"/)![1]).not.toBe(b.match(/id="(av\d+)"/)![1]);
  });
  it('every stat on the profile has an icon', () => {
    for (const k of ['levels', 'perfectClears', 'streak', 'bestStreak', 'dailiesSolved', 'shells', 'sets', 'scenes', 'pours', 'coinsEarned', 'boostersUsed']) expect(STAT_ICONS[k], k).toBeTruthy();
  });
});
