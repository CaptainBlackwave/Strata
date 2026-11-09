/**
 * Badge medallions (design/gdd/badges.md §3.8): a round seaside token with a rope rim, a glyph for
 * the stat the badge reads, and one to four dots for its rank among badges of that stat. Plain SVG,
 * coloured by the `data-family` rules in style.css, with fixed colours so each reads in every scene.
 */
import type { Badge, BadgeConfig } from '../core/badges';

/** Line glyphs on a 48×48 face, centred, stroked in the medallion's ink. Keyed by rule stat (or `everyOwnedScene`). */
const GLYPHS: Record<string, string> = {
  // A jar with its lid on.
  jarsSealed: '<path d="M18 13h12M19 13v3h10v-3"/><rect x="17" y="16" width="14" height="16" rx="3"/><path d="M17 25h14"/>',
  // A little flag on a dune.
  levels: '<path d="M14 32c4-4 16-4 20 0"/><path d="M22 29V13l9 4-9 4"/>',
  // A pouring jar and a falling grain.
  pours: '<path d="M14 14h11l-2 5h-7z"/><path d="M23 19c4 2 6 5 6 9"/><circle cx="29" cy="32" r="1.6" fill="currentColor"/>',
  // A five-point star.
  perfectClears: '<path d="M24 12l3.4 7 7.6.9-5.6 5.2 1.5 7.6L24 28.9l-6.9 3.8 1.5-7.6-5.6-5.2 7.6-.9z"/>',
  // A tall jar with a small star.
  tallPerfect: '<rect x="19" y="11" width="10" height="23" rx="3"/><path d="M24 18.5l1.3 2.6 2.8.4-2 2 .5 2.8-2.6-1.4-2.6 1.4.5-2.8-2-2 2.8-.4z"/>',
  // A scallop shell.
  shells: '<path d="M24 33c-6 0-10-4-10-9 0-4 3-8 6-9l4 3 4-3c3 1 6 5 6 9 0 5-4 9-10 9z"/><path d="M24 18v15M20 19l2 14M28 19l-2 14"/>',
  // A cabinet of four drawers.
  sets: '<rect x="14" y="13" width="20" height="20" rx="3"/><path d="M14 23h20M24 13v20"/>',
  // A half sun over the sea.
  scenesOwned: '<path d="M16 27a8 8 0 0 1 16 0z"/><path d="M13 31h22M24 14v3M15.5 18.5l2 2M32.5 18.5l-2 2"/>',
  // Two footprints in the sand.
  scenesPlayed: '<ellipse cx="19.5" cy="27" rx="3" ry="4.5"/><ellipse cx="28.5" cy="20" rx="3" ry="4.5"/><circle cx="19.5" cy="19.5" r="1"/><circle cx="28.5" cy="12.5" r="1"/>',
  // A narrow jar beside a padlock.
  mechanicsSeen: '<rect x="15" y="16" width="6" height="17" rx="2"/><rect x="24" y="22" width="10" height="9" rx="2"/><path d="M26 22v-3a3 3 0 0 1 6 0v3"/>',
  // A calendar page with a tick.
  dailiesSolved: '<rect x="14" y="14" width="20" height="19" rx="3"/><path d="M14 20h20M19 12v4M29 12v4M20 27l3 3 5-6"/>',
  // Three rolling waves.
  bestStreak: '<path d="M13 19c3-3 5 3 8 0s5 3 8 0 4 0 6 1"/><path d="M13 25c3-3 5 3 8 0s5 3 8 0 4 0 6 1"/><path d="M13 31c3-3 5 3 8 0s5 3 8 0 4 0 6 1"/>',
  // A compass rose.
  everyOwnedScene: '<circle cx="24" cy="23" r="10"/><path d="M24 15l3 8-3 8-3-8z"/>',
  // The weekly set (badges.md §3.9): five little jars in a row.
  weekly: '<path d="M14 30v-8M19 30v-10M24 30v-12M29 30v-10M34 30v-8"/><path d="M12 33h24"/>',
};

/** The glyph key of a badge: its rule's stat, or `everyOwnedScene`. */
export function glyphKey(badge: Badge): string {
  return badge.rule.kind === 'count' ? badge.rule.of : badge.rule.kind;
}

/** 1-based rank of a badge among catalogue badges reading the same stat, lowest count first (at most 4 dots). */
export function badgeRank(badge: Badge, config: BadgeConfig): number {
  if (badge.rule.kind !== 'count') return 1;
  const of = badge.rule.of;
  const counts = config.badges.list.flatMap((b) => (b.rule.kind === 'count' && b.rule.of === of ? [b.rule.count] : [])).sort((a, b) => a - b);
  return Math.min(4, counts.indexOf(badge.rule.count) + 1);
}

/** Every glyph key, for the art test. */
export const BADGE_GLYPHS: readonly string[] = Object.keys(GLYPHS);

/** A medallion as SVG markup: `family` picks the colours, `glyph` the drawing, `rank` the dots under it. */
export function medalSvg(family: string, glyph: string, rank = 1): string {
  const dots = Array.from({ length: rank }, (_, i) => `<circle cx="${24 + (i - (rank - 1) / 2) * 5}" cy="39" r="1.5"/>`).join('');
  return (
    `<svg class="badge-medal" data-family="${family}" viewBox="0 0 48 48" aria-hidden="true">` +
    '<circle class="bm-rim" cx="24" cy="24" r="23"/><circle class="bm-face" cx="24" cy="24" r="19"/><circle class="bm-rope" cx="24" cy="24" r="21"/>' +
    `<g class="bm-glyph">${GLYPHS[glyph] ?? GLYPHS.perfectClears}</g><g class="bm-dots">${dots}</g></svg>`
  );
}

/** The medallion of a catalogue badge. */
export function badgeSvg(badge: Badge, config: BadgeConfig): string {
  return medalSvg(badge.family, glyphKey(badge), badgeRank(badge, config));
}
