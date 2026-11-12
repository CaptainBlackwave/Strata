// Story: production/sprints/sprint-11.md O1 (D78), production/sprints/sprint-21.md A1 (D179):
// the Add to Home Screen card's rules, DOM-free.
import { describe, expect, it } from 'vitest';
import { type Onboarding, type OnboardingConfig, countVisit, freshOnboarding, installCardDue, installPlatform, onboardingOf, recordInstallAsk, recordInstalled } from '../../../../src/ui/logic/onboarding';

const UA = {
  pixel: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  ipadDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
  instagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 300.0.0',
  firefoxDesktop: 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0',
};
const env = (userAgent: string, o: { standalone?: boolean; promptReady?: boolean; maxTouchPoints?: number } = {}) => ({ userAgent, standalone: false, promptReady: false, maxTouchPoints: 0, ...o });
const seen = (o: Partial<Onboarding> = {}): Onboarding => ({ ...freshOnboarding(), visits: 2, ...o });

describe('installPlatform (O1)', () => {
  it('is "installed" when running from the home screen, on any platform', () => {
    expect(installPlatform(env(UA.iphone, { standalone: true }))).toBe('installed');
    expect(installPlatform(env(UA.pixel, { standalone: true, promptReady: true }))).toBe('installed');
  });
  it('gives iPhone Safari the Share steps', () => {
    expect(installPlatform(env(UA.iphone))).toBe('ios');
  });
  it('treats an iPad that reports a desktop Mac as iOS by its touch points', () => {
    expect(installPlatform(env(UA.ipadDesktop, { maxTouchPoints: 5 }))).toBe('ios');
    expect(installPlatform(env(UA.ipadDesktop, { maxTouchPoints: 0 }))).toBe('none'); // a real Mac
  });
  it('offers nothing inside an in-app browser, which cannot add to the home screen', () => {
    expect(installPlatform(env(UA.instagram))).toBe('none');
  });
  it('uses the browser prompt on Android and Chrome only once it has been captured', () => {
    expect(installPlatform(env(UA.pixel, { promptReady: true }))).toBe('prompt');
    expect(installPlatform(env(UA.pixel))).toBe('none');
  });
  it('offers nothing where the browser has no install route', () => {
    expect(installPlatform(env(UA.firefoxDesktop))).toBe('none');
  });
});

/** The A1 tuning: after the 5th clear, at most twice, 7 days apart (game-config.json `onboarding`). */
const CFG: OnboardingConfig = { installAfterLevels: 5, installMaxAsks: 2, installGapDays: 7, homeHintLevel: 3 };
const DAY = 86_400_000;
/** 12 November 2026, noon UTC: a fixed clock reading. */
const NOW = Date.UTC(2026, 10, 12, 12);

describe('installCardDue (A1, D179)', () => {
  it('shows after the 5th level clear, on iPhone and where the browser offers its prompt', () => {
    expect(installCardDue(seen(), 5, CFG, 'ios', NOW)).toBe(true);
    expect(installCardDue(seen(), 5, CFG, 'prompt', NOW)).toBe(true);
  });
  it('waits until the 5th clear', () => {
    expect(installCardDue(seen(), 4, CFG, 'ios', NOW)).toBe(false);
  });
  it('shows on the visit of the 5th clear, even the first', () => {
    expect(installCardDue(seen({ visits: 1 }), 5, CFG, 'ios', NOW)).toBe(true);
  });
  it('never asks twice within 7 days', () => {
    const once = recordInstallAsk(seen(), NOW);
    expect(installCardDue(once, 9, CFG, 'ios', NOW)).toBe(false);
    expect(installCardDue(once, 9, CFG, 'ios', NOW + 7 * DAY - 1)).toBe(false);
    expect(installCardDue(once, 9, CFG, 'ios', NOW + 7 * DAY)).toBe(true);
  });
  it('asks at most twice, however long the player waits', () => {
    const twice = recordInstallAsk(recordInstallAsk(seen(), NOW), NOW + 8 * DAY);
    expect(twice.installAsks).toBe(2);
    expect(installCardDue(twice, 50, CFG, 'ios', NOW + 400 * DAY)).toBe(false);
  });
  it('waits when the clock is set back before the last ask', () => {
    expect(installCardDue(recordInstallAsk(seen(), NOW), 9, CFG, 'ios', NOW - 30 * DAY)).toBe(false);
  });
  it('never shows when running standalone or without an install route', () => {
    expect(installCardDue(seen(), 9, CFG, 'installed', NOW)).toBe(false);
    expect(installCardDue(seen(), 9, CFG, 'none', NOW)).toBe(false);
  });
  it('never shows again after appinstalled or an accepted prompt', () => {
    expect(installCardDue(recordInstalled(seen()), 9, CFG, 'prompt', NOW)).toBe(false);
  });
  it('is tuned from game-config.json', async () => {
    const config = (await import('../../../../src/config/game-config.json')).default as unknown as { onboarding: OnboardingConfig };
    expect(config.onboarding).toMatchObject({ installAfterLevels: 5, installMaxAsks: 2, installGapDays: 7 });
  });
});

describe('the onboarding save field (O1)', () => {
  it('starts with no visits and nothing shown', () => {
    expect(freshOnboarding()).toEqual({ visits: 0, installAsks: 0, installLastAsk: null, installed: false, offlineNoticed: false, mapHintSeen: false, boosterHintSeen: false, homeHintSeen: false, scenesNewSeen: false, stylesNewSeen: false, pendingShare: null });
  });
  it('is repaired field by field', () => {
    expect(onboardingOf({ visits: 4, installShown: 'yes', offlineNoticed: true }, true)).toEqual({ ...freshOnboarding(), visits: 4, offlineNoticed: true });
    expect(onboardingOf({ installAsks: 2.5, installLastAsk: 'soon', installed: 1 }, false)).toEqual(freshOnboarding());
    expect(onboardingOf({ installAsks: 2, installLastAsk: NOW, installed: true }, false)).toMatchObject({ installAsks: 2, installLastAsk: NOW, installed: true });
    expect(onboardingOf({ installAsks: 1e9 }, false).installAsks).toBe(99);
  });
  it('a save that saw the one-time card before 0.20 counts one ask, a week ago or more (A1)', () => {
    expect(onboardingOf({ visits: 3, installShown: true }, true)).toMatchObject({ installAsks: 1, installLastAsk: null });
    expect(installCardDue(onboardingOf({ visits: 3, installShown: true }, true), 9, CFG, 'ios', NOW)).toBe(true);
    expect(onboardingOf({ visits: -2 }, true).visits).toBe(1);
    expect(onboardingOf('junk', false)).toEqual(freshOnboarding());
  });
  it('counts a save from before this update as one earlier visit', () => {
    expect(onboardingOf(undefined, true).visits).toBe(1);
    expect(onboardingOf(undefined, false).visits).toBe(0);
  });
  it('counts visits without growing without bound', () => {
    expect(countVisit(freshOnboarding()).visits).toBe(1);
    expect(countVisit(seen({ visits: 1_000_000 })).visits).toBe(1_000_000);
  });
});

describe('loadSave keeps and repairs onboarding (O1)', async () => {
  const { freshSave, loadSave } = await import('../../../../src/ui/storage');
  const config = (await import('../../../../src/config/game-config.json')).default as unknown as Parameters<typeof freshSave>[0];
  const store = (v: unknown) => ({ getItem: () => JSON.stringify(v), setItem: () => undefined });
  it('a new device starts fresh, and the card waits for N levels from game-config.json', () => {
    expect(freshSave(config).onboarding).toEqual(freshOnboarding());
    expect((config as unknown as { onboarding: { installAfterLevels: number } }).onboarding.installAfterLevels).toBe(5);
  });
  it('a save from 0.10 has no field and loads as one earlier visit', () => {
    expect(loadSave(config, store({ level: 6, tutorialDone: true })).onboarding).toEqual({ ...freshOnboarding(), visits: 1 });
  });
  it('a saved field survives a load, repaired field by field', () => {
    expect(loadSave(config, store({ level: 6, onboarding: { visits: 3, installShown: true, mapHintSeen: 1 } })).onboarding).toEqual({ ...freshOnboarding(), visits: 3, installAsks: 1 });
  });
});
