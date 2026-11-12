/**
 * Home's bottom tab bar (sprint 20 H3, D168; design/ux/home.md §3, §6): which tabs show, which carry
 * a "new" dot, and the tablist's arrow, Home and End keys. Pure and DOM-free, so the unlock rules are
 * unit-tested; screens/home-tabs.ts only shows them.
 */

/** The four Home tabs, in bar order. */
export type HomeTab = 'play' | 'today' | 'collection' | 'profile';

/** Every tab in bar order. */
export const HOME_TABS: readonly HomeTab[] = ['play', 'today', 'collection', 'profile'];

/** What the unlock rules and the dots read, from the live save. */
export interface HomeTabsInput {
  /** The tutorial is done: before it, Home has no tab bar (first visit, D169). */
  readonly tutorialDone: boolean;
  /** `save.level`, the next level: from 2 the beach path map exists (D51). */
  readonly level: number;
  /** Shells found. */
  readonly shells: number;
  /** Shells found since the cabinet was last opened (`shells - seenShells`). */
  readonly unseenShells: number;
  /** Badges earned. */
  readonly badges: number;
  /** Scenes owned, the starting scene included. */
  readonly scenesOwned: number;
  /** Jar styles are open (from their unlock level, jar-styles.md §3.2). */
  readonly stylesOpen: boolean;
  /** The quiet "New" mark is due on Scenes (D82 R4). */
  readonly scenesNew: boolean;
  /** The one-time "New" mark is due on Jar styles. */
  readonly stylesNew: boolean;
}

/**
 * The tabs that show, in bar order. A tab appears only once it holds something (D168):
 * - none before the tutorial is done: Home is the hero and Play alone;
 * - **Play**, **Today** (the daily, the weekly set, goals, streak rewards) and **Profile** (profile,
 *   stats, Settings) from the end of the tutorial;
 * - **Collection** once any of its parts holds something: a shell, a badge, the map (level 2 on),
 *   jar styles, a second scene, or a scene the player can afford (the Scenes "New" mark).
 * Example: `homeTabs({ ...input, tutorialDone: true, level: 1 })` gives Play, Today and Profile.
 */
export function homeTabs(i: HomeTabsInput): HomeTab[] {
  if (!i.tutorialDone) return [];
  const collection = i.shells > 0 || i.badges > 0 || i.level >= 2 || i.stylesOpen || i.scenesOwned > 1 || i.scenesNew;
  return HOME_TABS.filter((tab) => tab !== 'collection' || collection);
}

/**
 * The tabs that carry a "new" dot, from the existing new-flags only: Collection while a shell is
 * unseen, or Scenes or Jar styles shows its "New" mark. A tab that does not show has no dot.
 */
export function tabDots(i: HomeTabsInput): ReadonlySet<HomeTab> {
  const dots = new Set<HomeTab>();
  if (i.unseenShells > 0 || i.scenesNew || (i.stylesOpen && i.stylesNew)) dots.add('collection');
  const shown = new Set(homeTabs(i));
  return new Set([...dots].filter((tab) => shown.has(tab)));
}

/** The tab to show when `wanted` is asked for: it, if it shows, else Play. */
export function landingTab(wanted: HomeTab, tabs: readonly HomeTab[]): HomeTab {
  return tabs.includes(wanted) ? wanted : 'play';
}

/**
 * The tablist's keys (WAI-ARIA tabs, automatic activation): ArrowRight and ArrowDown move to the next
 * tab and ArrowLeft and ArrowUp to the previous one, wrapping; Home and End go to the first and last.
 * Returns the index to move to, or null for any other key. Example: `tabKey('End', 0, 4) // 3`.
 */
export function tabKey(key: string, index: number, count: number): number | null {
  if (count <= 0) return null;
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
      return (index + 1) % count;
    case 'ArrowLeft':
    case 'ArrowUp':
      return (index - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}
