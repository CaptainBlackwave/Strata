// Story: 0.11.1 first-run fixes (D81 R1, D82 R2 and R4), DOM-free. Review: production/qa/sprint-11/first-run-review.md.
import { describe, expect, it } from 'vitest';
import { type Onboarding, freshOnboarding, homeHintDue, keepShare, onboardingOf, scenesNewDue, takeShare } from '../../../../src/ui/logic/onboarding';

const HINT_LEVEL = 3;
const o = (over: Partial<Onboarding> = {}): Onboarding => ({ ...freshOnboarding(), ...over });

describe('homeHintDue (R1, D81)', () => {
  it('is due on the first clear of the hint level, in level mode', () => {
    expect(homeHintDue(o(), { mode: 'level', level: HINT_LEVEL, firstClear: true }, HINT_LEVEL)).toBe(true);
  });
  it('is not due once seen', () => {
    expect(homeHintDue(o({ homeHintSeen: true }), { mode: 'level', level: HINT_LEVEL, firstClear: true }, HINT_LEVEL)).toBe(false);
  });
  it('is not due on another level, a replay, or another mode', () => {
    expect(homeHintDue(o(), { mode: 'level', level: HINT_LEVEL - 1, firstClear: true }, HINT_LEVEL)).toBe(false);
    expect(homeHintDue(o(), { mode: 'level', level: HINT_LEVEL, firstClear: false }, HINT_LEVEL)).toBe(false);
    expect(homeHintDue(o(), { mode: 'daily', level: HINT_LEVEL, firstClear: true }, HINT_LEVEL)).toBe(false);
  });
  it('is not due on a later level: a player already past the hint level has found Home', () => {
    expect(homeHintDue(o(), { mode: 'level', level: HINT_LEVEL + 5, firstClear: true }, HINT_LEVEL)).toBe(false);
  });
});

describe('scenesNewDue (R4, D82)', () => {
  it('is due when the cheapest scene not owned is affordable', () => {
    expect(scenesNewDue(o(), 300, [300, 500])).toBe(true);
    expect(scenesNewDue(o(), 450, [500, 300])).toBe(true);
  });
  it('is not due below the cheapest price, with nothing left to buy, or once seen', () => {
    expect(scenesNewDue(o(), 299, [300, 500])).toBe(false);
    expect(scenesNewDue(o(), 10_000, [])).toBe(false);
    expect(scenesNewDue(o({ scenesNewSeen: true }), 10_000, [300])).toBe(false);
  });
});

describe('keepShare and takeShare (R2, D82)', () => {
  it('keeps a daily or weekly link opened before the tutorial', () => {
    expect(keepShare(o(), { kind: 'daily', date: '2026-11-09' }, false).pendingShare).toEqual({ daily: '2026-11-09' });
    expect(keepShare(o(), { kind: 'weekly', week: '2026-W46' }, false).pendingShare).toEqual({ weekly: '2026-W46' });
  });
  it('keeps nothing after the tutorial (the link opens at once), or for other launches', () => {
    const before = o();
    expect(keepShare(before, { kind: 'daily', date: '2026-11-09' }, true)).toBe(before);
    expect(keepShare(before, { kind: 'level', level: 4 }, false)).toBe(before);
    expect(keepShare(before, { kind: 'none' }, false)).toBe(before);
  });
  it('a newer link replaces an older one', () => {
    const first = keepShare(o(), { kind: 'daily', date: '2026-11-08' }, false);
    expect(keepShare(first, { kind: 'weekly', week: '2026-W46' }, false).pendingShare).toEqual({ weekly: '2026-W46' });
  });
  it('takeShare hands the link over once and clears it', () => {
    const kept = keepShare(o(), { kind: 'daily', date: '2026-11-09' }, false);
    const r = takeShare(kept);
    expect(r.share).toEqual({ daily: '2026-11-09' });
    expect(r.onboarding.pendingShare).toBeNull();
    expect(takeShare(r.onboarding).share).toBeNull();
  });
});

describe('onboardingOf repairs the new fields', () => {
  it('defaults them on an old save', () => {
    const r = onboardingOf({ visits: 3, installShown: true }, true);
    expect(r).toMatchObject({ homeHintSeen: false, scenesNewSeen: false, pendingShare: null });
  });
  it('keeps valid values and drops malformed links', () => {
    expect(onboardingOf({ homeHintSeen: true, scenesNewSeen: true, pendingShare: { daily: '2026-11-09' } }, false)).toMatchObject({ homeHintSeen: true, scenesNewSeen: true, pendingShare: { daily: '2026-11-09' } });
    expect(onboardingOf({ pendingShare: { weekly: '2026-W46' } }, false).pendingShare).toEqual({ weekly: '2026-W46' });
    expect(onboardingOf({ pendingShare: { daily: '2026-02-30' } }, false).pendingShare).toBeNull();
    expect(onboardingOf({ pendingShare: { weekly: 'soon' } }, false).pendingShare).toBeNull();
    expect(onboardingOf({ pendingShare: 'https://example.com' }, false).pendingShare).toBeNull();
    expect(onboardingOf({ homeHintSeen: 'yes' }, false).homeHintSeen).toBe(false);
  });
});
