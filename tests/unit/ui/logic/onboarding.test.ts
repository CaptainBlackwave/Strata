// Story: production/sprints/sprint-11.md O1 (D78): the Add to Home Screen card's rules, DOM-free.
import { describe, expect, it } from 'vitest';
import { type Onboarding, countVisit, freshOnboarding, installCardDue, installPlatform, onboardingOf } from '../../../../src/ui/logic/onboarding';

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

describe('installCardDue (O1)', () => {
  it('shows after N cleared levels on a later visit', () => {
    expect(installCardDue(seen(), 3, 3, 'ios')).toBe(true);
    expect(installCardDue(seen(), 3, 3, 'prompt')).toBe(true);
  });
  it('waits until N levels are cleared', () => {
    expect(installCardDue(seen(), 2, 3, 'ios')).toBe(false);
  });
  it('never shows on the first visit', () => {
    expect(installCardDue(seen({ visits: 1 }), 9, 3, 'ios')).toBe(false);
  });
  it('shows once', () => {
    expect(installCardDue(seen({ installShown: true }), 9, 3, 'ios')).toBe(false);
  });
  it('never shows when installed or without an install route', () => {
    expect(installCardDue(seen(), 9, 3, 'installed')).toBe(false);
    expect(installCardDue(seen(), 9, 3, 'none')).toBe(false);
  });
});

describe('the onboarding save field (O1)', () => {
  it('starts with no visits and nothing shown', () => {
    expect(freshOnboarding()).toEqual({ visits: 0, installShown: false, offlineNoticed: false, mapHintSeen: false, boosterHintSeen: false });
  });
  it('is repaired field by field', () => {
    expect(onboardingOf({ visits: 4, installShown: 'yes', offlineNoticed: true }, true)).toEqual({ ...freshOnboarding(), visits: 4, offlineNoticed: true });
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
    expect((config as unknown as { onboarding: { installAfterLevels: number } }).onboarding.installAfterLevels).toBe(3);
  });
  it('a save from 0.10 has no field and loads as one earlier visit', () => {
    expect(loadSave(config, store({ level: 6, tutorialDone: true })).onboarding).toEqual({ ...freshOnboarding(), visits: 1 });
  });
  it('a saved field survives a load, repaired field by field', () => {
    expect(loadSave(config, store({ level: 6, onboarding: { visits: 3, installShown: true, mapHintSeen: 1 } })).onboarding).toEqual({ ...freshOnboarding(), visits: 3, installShown: true });
  });
});
