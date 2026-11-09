/**
 * Original profile artwork, drawn as SVG: eight seaside-object avatars, six frames and
 * the small stat icons. No characters or creatures (decision D5), no raster assets.
 * Implements design/gdd/player-profile.md §3.6 (PP-4, PP-6).
 */
import type { AvatarItem } from '../core/profile';

const INK = '#5a4632';
const SAND = { terracotta: '#c8553d', saffron: '#f2a541', lagoon: '#2a9d8f', denim: '#3d5a98', cream: '#fffaf1', straw: '#f2c46b', cork: '#c99a63', lemon: '#f4e04d' };
let uid = 0;

type Draw = (id: string) => string;

/** One drawing per avatar id, in a 100×100 box, centred inside a circle of radius 41. */
const AVATARS: Record<string, Draw> = {
  'sand-jar': (id) => {
    const jar = 'M37 34h26v36a8 8 0 0 1-8 8H45a8 8 0 0 1-8-8z';
    return `<clipPath id="${id}"><path d="${jar}"/></clipPath>
      <path d="${jar}" fill="${SAND.cream}" fill-opacity="0.7" stroke="none"/>
      <g clip-path="url(#${id})" stroke="none"><rect x="30" y="64" width="40" height="20" fill="${SAND.terracotta}"/><rect x="30" y="53" width="40" height="11" fill="${SAND.saffron}"/><rect x="30" y="43" width="40" height="10" fill="${SAND.lagoon}"/></g>
      <path d="${jar}" fill="none"/><rect x="40" y="25" width="20" height="9" rx="2.5" fill="${SAND.cork}"/>`;
  },
  'beach-hut': () => `<rect x="34" y="46" width="32" height="28" fill="${SAND.cream}"/>
      <g stroke="none" fill="${SAND.lagoon}"><rect x="34" y="46" width="6" height="28"/><rect x="47" y="46" width="6" height="28"/><rect x="60" y="46" width="6" height="28"/></g>
      <rect x="34" y="46" width="32" height="28" fill="none"/><rect x="44.5" y="58" width="11" height="16" rx="2" fill="${SAND.saffron}"/>
      <path d="M29 47 50 28l21 19z" fill="${SAND.terracotta}"/><path d="M26 74h48" fill="none"/>`,
  sailboat: () => `<path d="M50 24v38" fill="none"/><path d="M53 28l17 30H53z" fill="${SAND.cream}"/><path d="M47 34 32 58h15z" fill="${SAND.saffron}"/>
      <path d="M28 62h44l-7 10H35z" fill="${SAND.terracotta}"/>
      <path d="M24 77q6-4 12 0t12 0 12 0 12 0 4 0" fill="none" stroke="${SAND.lagoon}" stroke-width="3"/>`,
  'sun-hat': () => `<ellipse cx="50" cy="61" rx="29" ry="9" fill="${SAND.straw}"/>
      <path d="M36 59c0-14 6-22 14-22s14 8 14 22z" fill="${SAND.straw}"/>
      <path d="M36.4 51h27.2l.4 6H36z" fill="${SAND.terracotta}"/><path d="M60 52l7 9-4 1z" fill="${SAND.terracotta}"/>`,
  lighthouse: () => `<path d="M30 33l9 2M70 33l-9 2M33 24l7 6M67 24l-7 6" fill="none" stroke="${SAND.saffron}" stroke-width="3"/>
      <path d="M42 40h16l4 36H38z" fill="${SAND.cream}"/>
      <g stroke="none" fill="${SAND.terracotta}"><path d="M40.9 50h18.2l1 9H39.9z"/><path d="M39.1 66h21.8l1.1 10H38z"/></g>
      <path d="M42 40h16l4 36H38z" fill="none"/><rect x="43" y="31" width="14" height="9" rx="1" fill="${SAND.lemon}"/>
      <path d="M41 31l9-8 9 8z" fill="${SAND.terracotta}"/><path d="M32 76h36" fill="none"/>`,
  sandcastle: () => `<path d="M28 76V48h3v-4h3v4h2v-4h3v4h3v28z" fill="${SAND.straw}"/><path d="M58 76V48h3v-4h3v4h2v-4h3v4h3v28z" fill="${SAND.straw}"/>
      <path d="M40 76V40h4v-5h4v5h4v-5h4v5h4v36z" fill="${SAND.straw}"/><path d="M45 76v-8a5 5 0 0 1 10 0v8z" fill="${SAND.cork}"/>
      <path d="M50 35V23" fill="none"/><path d="M50 23l10 3.5-10 3.5z" fill="${SAND.terracotta}"/><path d="M24 76h52" fill="none"/>`,
  anchor: () => `<g fill="none" stroke="${SAND.denim}" stroke-width="5"><circle cx="50" cy="29" r="5"/><path d="M50 34v39M40 44h20M30 60c2 10 10 14 20 14s18-4 20-14"/></g>
      <path d="M25 63l5-8 6 5zM75 63l-5-8-6 5z" fill="${SAND.denim}" stroke="none"/>`,
  lantern: () => `<path d="M43 30a7 7 0 0 1 14 0" fill="none"/><rect x="41" y="36" width="18" height="28" rx="3" fill="#fff1bf"/>
      <path d="M50 42c4 5 5 9 0 14-5-5-4-9 0-14z" fill="${SAND.saffron}"/><path d="M46 36v28M54 36v28" fill="none" stroke-opacity="0.45"/>
      <path d="M39 30h22l-3 6H42z" fill="${SAND.terracotta}"/><path d="M39 64h22l-2 6H41z" fill="${SAND.terracotta}"/>`,
};

/** Every avatar id that has artwork. */
export const AVATAR_IDS = Object.keys(AVATARS);

/** One ring per frame id: drawn between radius 41 and 49, outlined on both edges. */
const FRAMES: Record<string, () => string> = {
  sand: () => ring('#ecd3a6'),
  rope: () => `${ring('#d9b27a')}<circle cx="50" cy="50" r="45" fill="none" stroke="#a9804a" stroke-width="8" stroke-dasharray="2.6 3.2"/>`,
  'sea-glass': () => `${ring('#a6dcd0')}<path d="M18 36a34 34 0 0 1 20-20" fill="none" stroke="#fff" stroke-opacity="0.8" stroke-width="3" stroke-linecap="round"/>`,
  driftwood: () =>
    `${ring('#a77b55')}<circle cx="50" cy="50" r="43.4" fill="none" stroke="#7d5536" stroke-width="1.2" stroke-dasharray="12 7"/><circle cx="50" cy="50" r="46.6" fill="none" stroke="#7d5536" stroke-width="1.2" stroke-dasharray="8 10"/>`,
  coral: () =>
    `${ring('#f28482')}<g fill="#f6a8a3" stroke="${INK}" stroke-width="1.4">${Array.from({ length: 12 }, (_, i) => {
      const a = (i * Math.PI) / 6;
      return `<circle cx="${(50 + 45 * Math.cos(a)).toFixed(1)}" cy="${(50 + 45 * Math.sin(a)).toFixed(1)}" r="4.6"/>`;
    }).join('')}</g>`,
  gold: () =>
    `${ring('#e2b552')}<path d="M16 40a35 35 0 0 1 26-25" fill="none" stroke="#fff2b8" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="50" r="41.8" fill="none" stroke="#a87a22" stroke-width="1.4"/>`,
};

/** Every frame id that has artwork. */
export const FRAME_IDS = Object.keys(FRAMES);

function ring(fill: string): string {
  return `<circle cx="50" cy="50" r="45" fill="none" stroke="${fill}" stroke-width="8"/><g fill="none" stroke="${INK}" stroke-width="1.6"><circle cx="50" cy="50" r="49"/><circle cx="50" cy="50" r="41"/></g>`;
}

/**
 * An avatar inside its frame, as SVG markup. Unknown ids fall back to the first drawing.
 * Example: `portraitSvg({ id: 'lighthouse', bg: '#d7e6f2' }, 'rope')`.
 */
export function portraitSvg(avatar: Pick<AvatarItem, 'id' | 'bg'>, frameId: string): string {
  const id = `av${++uid}`;
  const art = (AVATARS[avatar.id] ?? AVATARS['sand-jar'])(`${id}c`);
  const frame = (FRAMES[frameId] ?? FRAMES.sand)();
  return `<svg viewBox="0 0 100 100" aria-hidden="true" data-avatar="${avatar.id}" data-frame="${frameId}"><clipPath id="${id}"><circle cx="50" cy="50" r="41"/></clipPath><circle cx="50" cy="50" r="41" fill="${avatar.bg}"/><g clip-path="url(#${id})" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${art}</g>${frame}</svg>`;
}

/** A small padlock drawn over locked picks. */
export const LOCK_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2.5" fill="${INK}"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" fill="none" stroke="${INK}" stroke-width="2.4"/></svg>`;

/** A die for "new random name". */
export const DICE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="3.5" width="17" height="17" rx="4"/><g fill="currentColor" stroke="none"><circle cx="8.5" cy="8.5" r="1.5"/><circle cx="15.5" cy="15.5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="15.5" cy="8.5" r="1.5"/><circle cx="8.5" cy="15.5" r="1.5"/></g></svg>`;

/** Line icons for the stats grid (24×24, stroked in the text colour). */
export const STAT_ICONS: Record<string, string> = {
  levels: '<path d="M8 3h8M9 3v3.5c-2 1-3 2.6-3 4.5v8a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-8c0-1.9-1-3.5-3-4.5V3"/><path d="M9.5 15l2 2 3.5-4"/>',
  perfectClears: '<path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z"/>',
  streak: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  bestStreak: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8"/>',
  dailiesSolved: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8.5 15l2.5 2.5 4.5-5"/>',
  shells: '<path d="M12 20c-5 0-8-3.5-8-8 0-3 2-6 4-7l4 3 4-3c2 1 4 4 4 7 0 4.5-3 8-8 8z"/><path d="M12 8v12M8 9l2 11M16 9l-2 11"/>',
  sets: '<rect x="3.5" y="4" width="17" height="16" rx="2.5"/><path d="M3.5 12h17M12 4v16"/>',
  scenes: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v17" /><path d="M12 3.5a8.5 8.5 0 0 0 0 17z" fill="currentColor"/>',
  pours: '<path d="M5 4h9l-1 4H6z"/><path d="M13 8c3 1 4 4 4 7"/><path d="M15 21h5l-1-6h-3z"/>',
  coinsEarned: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v9M9.5 9.5h4a1.5 1.5 0 0 1 0 3h-3a1.5 1.5 0 0 0 0 3h4"/>',
  boostersUsed: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
  jarsSealed: '<path d="M7 3.5h10M8 3.5v2h8v-2"/><rect x="6" y="5.5" width="12" height="15" rx="2.5"/><path d="M6 12h12"/>',
};
