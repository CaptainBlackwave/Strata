// Story: production/sprints/sprint-20.md H3 (D168, D169): the Home tab bar's unlock rules, dots and keys.
import { describe, expect, it } from 'vitest';
import { type HomeTabsInput, HOME_TABS, homeTabs, landingTab, tabDots, tabKey } from '../../../../src/ui/logic/home-tabs';

/** A player just past the tutorial on level 1 with nothing collected. */
const fresh = (over: Partial<HomeTabsInput> = {}): HomeTabsInput => ({
  tutorialDone: true, level: 1, shells: 0, unseenShells: 0, badges: 0, scenesOwned: 1, stylesOpen: false, scenesNew: false, stylesNew: false, ...over,
});

describe('homeTabs (D168)', () => {
  it('shows no tab bar before the tutorial is done (D169)', () => {
    expect(homeTabs(fresh({ tutorialDone: false }))).toEqual([]);
    expect(homeTabs(fresh({ tutorialDone: false, level: 40, shells: 9, badges: 3 }))).toEqual([]);
  });
  it('right after the tutorial: Play, Today and Profile, no Collection while it is empty', () => {
    expect(homeTabs(fresh())).toEqual(['play', 'today', 'profile']);
  });
  it.each([
    ['a shell', { shells: 1 }],
    ['a badge', { badges: 1 }],
    ['the map (level 2)', { level: 2 }],
    ['jar styles', { stylesOpen: true }],
    ['a second scene', { scenesOwned: 2 }],
    ['an affordable scene', { scenesNew: true }],
  ] as const)('Collection appears with %s', (_, over) => {
    expect(homeTabs(fresh(over))).toEqual(HOME_TABS);
  });
  it('keeps the bar order', () => {
    expect(homeTabs(fresh({ shells: 3, level: 50 }))).toEqual(['play', 'today', 'collection', 'profile']);
  });
});

describe('tabDots (new-flags only)', () => {
  it('no dot with nothing new', () => {
    expect([...tabDots(fresh({ shells: 2, level: 5 }))]).toEqual([]);
  });
  it('Collection carries the dot for an unseen shell, a Scenes or a Jar styles "New" mark', () => {
    expect([...tabDots(fresh({ shells: 2, unseenShells: 1 }))]).toEqual(['collection']);
    expect([...tabDots(fresh({ scenesNew: true }))]).toEqual(['collection']);
    expect([...tabDots(fresh({ stylesOpen: true, stylesNew: true }))]).toEqual(['collection']);
  });
  it('a styles mark before styles open does not count', () => {
    expect([...tabDots(fresh({ level: 5, stylesNew: true }))]).toEqual([]);
  });
  it('a tab that does not show has no dot', () => {
    expect([...tabDots(fresh({ tutorialDone: false, scenesNew: true }))]).toEqual([]);
  });
});

describe('landingTab', () => {
  it('lands on the tab asked for when it shows, else Play', () => {
    expect(landingTab('today', ['play', 'today', 'profile'])).toBe('today');
    expect(landingTab('collection', ['play', 'today', 'profile'])).toBe('play');
    expect(landingTab('profile', [])).toBe('play');
  });
});

describe('tabKey (WAI-ARIA tabs)', () => {
  it('arrows move and wrap', () => {
    expect(tabKey('ArrowRight', 0, 4)).toBe(1);
    expect(tabKey('ArrowRight', 3, 4)).toBe(0);
    expect(tabKey('ArrowLeft', 0, 4)).toBe(3);
    expect(tabKey('ArrowDown', 1, 3)).toBe(2);
    expect(tabKey('ArrowUp', 1, 3)).toBe(0);
  });
  it('Home and End go to the ends', () => {
    expect(tabKey('Home', 2, 4)).toBe(0);
    expect(tabKey('End', 0, 3)).toBe(2);
  });
  it('other keys, or no tabs, do nothing', () => {
    expect(tabKey('Enter', 0, 4)).toBeNull();
    expect(tabKey('a', 0, 4)).toBeNull();
    expect(tabKey('ArrowRight', 0, 0)).toBeNull();
  });
});
