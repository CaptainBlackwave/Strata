/**
 * Original seashell artwork, drawn as SVG from a shell's `kind` and two colours.
 * No raster assets; every shape is hand-authored here.
 * Implements design/competitive-roadmap.md item C7 (shell collection).
 */
import type { Shell } from '../core/collection';

const INK = '#5a4632';
let clipId = 0;

/** SVG markup for a shell. `locked` draws a soft silhouette instead. */
export function shellSvg(shell: Pick<Shell, 'kind' | 'colors'>, locked = false): string {
  const [body, accent] = locked ? ['#d8cbb4', '#c9baa0'] : shell.colors;
  const inner = (DRAW[shell.kind] ?? DRAW.clam)(body, accent);
  const style = locked ? ' opacity="0.55"' : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"${style}><g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${inner}</g></svg>`;
}

type Draw = (body: string, accent: string) => string;

const ribs = (cx: number, cy: number, r: number, from: number, to: number, n: number) =>
  Array.from({ length: n }, (_, i) => {
    const a = ((from + ((to - from) * (i + 0.5)) / n) * Math.PI) / 180;
    return `<path d="M${cx} ${cy} L${(cx + Math.cos(a) * r).toFixed(1)} ${(cy - Math.sin(a) * r).toFixed(1)}" fill="none" stroke-width="1.6"/>`;
  }).join('');

const DRAW: Record<string, Draw> = {
  scallop: (b, a) => {
    const id = `sc${++clipId}`;
    const fan = 'M50 86 L16 44 Q22 14 50 12 Q78 14 84 44 Z';
    return (
      `<clipPath id="${id}"><path d="${fan}"/></clipPath><path d="${fan}" fill="${b}"/>` +
      `<g clip-path="url(#${id})">${ribs(50, 86, 80, 38, 142, 9).replace(/stroke-width="1.6"/g, `stroke="${a}" stroke-width="2.4"`)}</g>` +
      `<path d="${fan}" fill="none"/>` +
      `<path d="M38 86 h24 l-4 8 h-16 Z" fill="${a}"/>`
    );
  },
  clam: (b, a) =>
    `<path d="M14 58 Q14 22 50 20 Q86 22 86 58 Q86 80 50 82 Q14 80 14 58 Z" fill="${b}"/>` +
    [0.78, 0.58, 0.38].map((k) => `<path d="M${50 - 34 * k} ${60 + 4 * (1 - k)} Q50 ${60 - 38 * k} ${50 + 34 * k} ${60 + 4 * (1 - k)}" fill="none" stroke="${a}" stroke-width="2.4"/>`).join('') +
    `<path d="M14 58 Q14 22 50 20 Q86 22 86 58 Q86 80 50 82 Q14 80 14 58 Z" fill="none"/><circle cx="50" cy="80" r="4" fill="${a}"/>`,
  spiral: (b, a) =>
    `<path d="M50 10 Q64 30 80 60 Q86 80 50 86 Q14 80 20 60 Q36 30 50 10 Z" fill="${b}"/>` +
    `<path d="M30 46 Q50 54 72 44 M24 62 Q50 72 78 60 M38 30 Q50 36 62 28" fill="none" stroke="${a}" stroke-width="3"/>` +
    `<path d="M50 10 Q64 30 80 60 Q86 80 50 86 Q14 80 20 60 Q36 30 50 10 Z" fill="none"/><ellipse cx="54" cy="76" rx="9" ry="6" fill="${a}"/>`,
  limpet: (b, a) =>
    `<path d="M10 70 Q20 30 50 26 Q80 30 90 70 Q50 80 10 70 Z" fill="${b}"/>` +
    [18, 30, 42, 58, 70, 82].map((x) => `<path d="M50 30 L${x} ${x < 50 ? 66 + (50 - x) * 0.08 : 66 + (x - 50) * 0.08}" fill="none" stroke="${a}" stroke-width="2.4"/>`).join('') +
    `<path d="M10 70 Q20 30 50 26 Q80 30 90 70 Q50 80 10 70 Z" fill="none"/><circle cx="50" cy="30" r="4" fill="${a}"/>`,
  star: (b, a) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 ? 17 : 40;
      const t = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      return `${(50 + Math.cos(t) * r).toFixed(1)} ${(52 + Math.sin(t) * r).toFixed(1)}`;
    });
    const dots = [0, 2, 4, 6, 8].map((i) => {
      const t = (Math.PI * 2 * i) / 10 - Math.PI / 2;
      return `<circle cx="${(50 + Math.cos(t) * 24).toFixed(1)}" cy="${(52 + Math.sin(t) * 24).toFixed(1)}" r="3" fill="${a}" stroke="none"/>`;
    });
    return `<path d="M${pts.join(' L')} Z" fill="${b}"/>${dots.join('')}<circle cx="50" cy="52" r="5" fill="${a}"/>`;
  },
  dollar: (b, a) =>
    `<circle cx="50" cy="50" r="38" fill="${b}"/>` +
    [0, 72, 144, 216, 288]
      .map((deg) => `<ellipse cx="50" cy="34" rx="5" ry="12" fill="none" stroke="${a}" stroke-width="2.6" transform="rotate(${deg} 50 50)"/>`)
      .join('') +
    `<circle cx="50" cy="50" r="4" fill="${a}"/>`,
  razor: (b, a) =>
    `<g transform="rotate(-35 50 50)"><rect x="12" y="38" width="76" height="24" rx="12" fill="${b}"/>` +
    `<path d="M24 42 v16 M40 40 v20 M56 40 v20 M72 42 v16" stroke="${a}" stroke-width="2.4"/><rect x="12" y="38" width="76" height="24" rx="12" fill="none"/></g>`,
  moon: (b, a) =>
    `<circle cx="50" cy="52" r="36" fill="${b}"/>` +
    `<path d="M50 52 m0 -6 a6 6 0 1 1 -6 6 a12 12 0 1 1 12 12 a20 20 0 1 1 -20 -20" fill="none" stroke="${a}" stroke-width="3"/>` +
    `<ellipse cx="66" cy="72" rx="12" ry="9" fill="${a}"/>`,
  conch: (b, a) =>
    `<path d="M22 30 Q40 8 62 16 L78 14 L72 26 Q92 40 84 62 Q74 88 46 88 Q24 86 30 64 Q14 52 22 30 Z" fill="${b}"/>` +
    `<path d="M30 64 Q46 54 60 66 Q66 76 54 82" fill="${a}"/>` +
    `<path d="M30 34 l8 6 M44 24 l6 8 M60 22 l2 9" stroke="${a}" stroke-width="3"/>` +
    `<path d="M22 30 Q40 8 62 16 L78 14 L72 26 Q92 40 84 62 Q74 88 46 88 Q24 86 30 64 Q14 52 22 30 Z" fill="none"/>`,
  cowrie: (b, a) =>
    `<ellipse cx="50" cy="52" rx="30" ry="38" fill="${b}"/>` +
    [
      [38, 30],
      [60, 34],
      [34, 54],
      [66, 58],
      [44, 74],
      [58, 76],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="4.5" fill="${a}" stroke="none"/>`)
      .join('') +
    `<path d="M50 18 Q56 52 50 86" fill="none" stroke-width="3"/>` +
    [28, 40, 52, 64, 76].map((y) => `<path d="M47 ${y} h6" stroke-width="1.6"/>`).join(''),
  auger: (b, a) =>
    `<path d="M50 6 L66 82 Q50 92 34 82 Z" fill="${b}"/>` +
    [20, 34, 48, 62, 74].map((y, i) => `<path d="M${44 - i * 2.4} ${y + 4} Q50 ${y - 2} ${56 + i * 2.4} ${y + 4}" fill="none" stroke="${a}" stroke-width="2.6"/>`).join('') +
    `<path d="M50 6 L66 82 Q50 92 34 82 Z" fill="none"/>`,
  nautilus: (b, a) =>
    `<circle cx="52" cy="50" r="38" fill="${b}"/>` +
    [0, 30, 60, 90, 120, 150, 180, 210].map((deg) => `<path d="M52 50 L52 12" stroke="${a}" stroke-width="3" transform="rotate(${deg} 52 50)"/>`).join('') +
    `<path d="M52 50 m-10 0 a10 10 0 1 1 10 10 a18 18 0 1 1 -18 -18" fill="none" stroke-width="2.6"/>` +
    `<circle cx="52" cy="50" r="38" fill="none"/>`,
  abalone: (b, a) =>
    `<path d="M14 54 Q14 18 54 16 Q90 20 88 52 Q84 84 48 84 Q14 82 14 54 Z" fill="${b}"/>` +
    `<path d="M24 50 Q40 34 70 30" fill="none" stroke="${a}" stroke-width="10" stroke-opacity=".7"/>` +
    [
      [26, 40],
      [36, 32],
      [48, 26],
      [60, 24],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="${INK}" stroke="none"/>`)
      .join('') +
    `<path d="M14 54 Q14 18 54 16 Q90 20 88 52 Q84 84 48 84 Q14 82 14 54 Z" fill="none"/>`,
  oyster: (b, a) =>
    `<path d="M18 40 Q22 16 52 18 Q84 18 84 46 Q88 76 56 84 Q22 88 18 62 Q10 52 18 40 Z" fill="${b}"/>` +
    `<path d="M28 44 Q50 30 74 46 M26 60 Q50 48 76 62" fill="none" stroke="#9aa3a8" stroke-width="2.4"/>` +
    `<circle cx="52" cy="56" r="10" fill="${a}"/><circle cx="48" cy="52" r="3" fill="#fff" stroke="none"/>`,
};
