/**
 * Original seashell artwork, drawn as SVG from a shell's `kind` and two colours.
 * No raster assets; every shape is hand-authored here.
 * Implements design/competitive-roadmap.md item C7 (shell collection).
 */
import type { Shell, ShellEffect } from '../core/collection';

const INK = '#5a4632';
let clipId = 0;

/**
 * SVG markup for a shell. `locked` draws a soft silhouette instead (no effect).
 * A set effect adds a stone speckle (drawn here) or a glow (styled in CSS via `data-effect`).
 * Example: `shellSvg({ kind: 'ammonite', colors: ['#cfc0a3', '#8a7458'], effect: 'stone' })`
 */
export function shellSvg(shell: Pick<Shell, 'kind' | 'colors'> & { readonly effect?: ShellEffect }, locked = false): string {
  const [body, accent] = locked ? ['#d8cbb4', '#c9baa0'] : shell.colors;
  const inner = (DRAW[shell.kind] ?? DRAW.clam)(body, accent);
  const effect = locked ? undefined : shell.effect;
  const style = locked ? ' opacity="0.55"' : '';
  const mark = effect ? ` data-effect="${effect}" class="fx-${effect}"` : '';
  // The speckle is masked to the shell's own outline (drawn again in white) so it never spills.
  const maskId = effect === 'stone' ? `st${++clipId}` : '';
  const stone =
    effect === 'stone'
      ? `<mask id="${maskId}"><g fill="#fff" stroke="#fff" stroke-width="2.4">${(DRAW[shell.kind] ?? DRAW.clam)('#fff', '#fff')}</g></mask><g mask="url(#${maskId})">${STONE}</g>`
      : '';
  return `<svg viewBox="0 0 100 100" aria-hidden="true"${style}${mark}><g stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round">${inner}</g>${stone}</svg>`;
}

/** Speckled stone texture laid over a fossil (Ancient Cliffs). Deterministic dots. */
const STONE = `<g fill="#3d3226" fill-opacity="0.22" stroke="none">${Array.from({ length: 34 }, (_, i) => {
  const x = 18 + ((i * 37) % 64);
  const y = 18 + ((i * 53) % 64);
  const r = 0.9 + ((i * 7) % 5) * 0.35;
  return `<circle cx="${x}" cy="${y}" r="${r.toFixed(2)}"/>`;
}).join('')}</g>`;

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
  turban: (b, a) =>
    `<path d="M50 12 C72 14 86 34 84 56 C82 76 66 88 50 88 C34 88 18 76 16 56 C14 34 28 14 50 12 Z" fill="${b}"/>` +
    `<path d="M22 46 Q50 36 78 46 M18 62 Q50 52 82 62" fill="none" stroke="${a}" stroke-width="3"/>` +
    [30, 42, 54, 66, 78].map((x) => `<circle cx="${x}" cy="${44 - Math.abs(50 - x) * 0.18}" r="2.6" fill="${a}" stroke="none"/>`).join('') +
    `<path d="M40 22 Q50 14 60 22" fill="none" stroke="${a}" stroke-width="2.4"/>` +
    `<path d="M50 12 C72 14 86 34 84 56 C82 76 66 88 50 88 C34 88 18 76 16 56 C14 34 28 14 50 12 Z" fill="none"/>` +
    `<ellipse cx="50" cy="76" rx="13" ry="8" fill="${a}"/>`,
  cone: (b, a) =>
    `<path d="M18 28 Q50 12 82 28 L54 90 Q50 95 46 90 Z" fill="${b}"/>` +
    `<path d="M24 40 L32 34 L40 40 L48 34 L56 40 L64 34 L72 40 L76 38 M30 56 L37 50 L44 56 L51 50 L58 56 L65 50 L70 54 M38 72 L44 67 L50 72 L56 67 L62 71" fill="none" stroke="${a}" stroke-width="2.4"/>` +
    `<path d="M42 23 L50 10 L58 23" fill="${a}"/>` +
    `<path d="M18 28 Q50 12 82 28 L54 90 Q50 95 46 90 Z" fill="none"/>`,
  urchin: (b, a) =>
    Array.from({ length: 28 }, (_, i) => {
      const t = (Math.PI * 2 * i) / 28;
      return `<path d="M${(50 + Math.cos(t) * 33).toFixed(1)} ${(52 + Math.sin(t) * 30).toFixed(1)} L${(50 + Math.cos(t) * 44).toFixed(1)} ${(52 + Math.sin(t) * 40).toFixed(1)}" stroke="${a}" stroke-width="2"/>`;
    }).join('') +
    `<ellipse cx="50" cy="52" rx="34" ry="31" fill="${b}"/>` +
    [0, 72, 144, 216, 288]
      .map((deg) => [10, 18, 26].map((r) => `<circle cx="${(50 + Math.sin((deg * Math.PI) / 180) * r).toFixed(1)}" cy="${(52 - Math.cos((deg * Math.PI) / 180) * r * 0.9).toFixed(1)}" r="2.2" fill="${a}" stroke="none"/>`).join(''))
      .join('') +
    `<circle cx="50" cy="52" r="4" fill="${a}"/>`,
  heart: (b, a) => {
    const id = `sc${++clipId}`;
    const shape = 'M50 88 C20 68 10 48 18 31 C26 16 44 18 50 32 C56 18 74 16 82 31 C90 48 80 68 50 88 Z';
    return (
      `<clipPath id="${id}"><path d="${shape}"/></clipPath><path d="${shape}" fill="${b}"/>` +
      `<g clip-path="url(#${id})">${ribs(50, 90, 80, 30, 150, 9).replace(/stroke-width="1.6"/g, `stroke="${a}" stroke-width="2.2"`)}</g>` +
      `<path d="${shape}" fill="none"/><path d="M50 32 L50 86" fill="none" stroke-width="1.6"/>`
    );
  },
  tusk: (b, a) =>
    `<path d="M18 84 Q24 34 76 14 L86 26 Q40 42 32 88 Z" fill="${b}"/>` +
    [0.2, 0.38, 0.56, 0.74].map((k) => {
      const x1 = 18 + (76 - 18) * k;
      const y1 = 84 + (14 - 84) * k - 8 * Math.sin(Math.PI * k);
      return `<path d="M${(x1 + 2).toFixed(1)} ${(y1 + 1).toFixed(1)} l${(10 - 4 * k).toFixed(1)} ${(4 + 3 * k).toFixed(1)}" stroke="${a}" stroke-width="3"/>`;
    }).join('') +
    `<path d="M18 84 Q24 34 76 14 L86 26 Q40 42 32 88 Z" fill="none"/><ellipse cx="25" cy="86" rx="7" ry="4" fill="${a}"/>`,
  ammonite: (b, a) => {
    const id = `sc${++clipId}`;
    return (
      `<clipPath id="${id}"><circle cx="50" cy="50" r="38"/></clipPath><circle cx="50" cy="50" r="38" fill="${b}"/>` +
      `<g clip-path="url(#${id})">${Array.from({ length: 22 }, (_, i) => {
        const t = (Math.PI * 2 * i) / 22;
        return `<path d="M${(50 + Math.cos(t) * 18).toFixed(1)} ${(50 + Math.sin(t) * 18).toFixed(1)} Q${(50 + Math.cos(t + 0.18) * 30).toFixed(1)} ${(50 + Math.sin(t + 0.18) * 30).toFixed(1)} ${(50 + Math.cos(t + 0.1) * 40).toFixed(1)} ${(50 + Math.sin(t + 0.1) * 40).toFixed(1)}" fill="none" stroke="${a}" stroke-width="2"/>`;
      }).join('')}</g>` +
      `<path d="M50 50 m0 -5 a5 5 0 1 1 -5 5 a10 10 0 1 1 10 10 a17 17 0 1 1 -17 -17" fill="none" stroke-width="2.6"/>` +
      `<circle cx="50" cy="50" r="38" fill="none"/>`
    );
  },
};

/** Every shape that has a drawing (used by tests and the content checklist). */
export const SHELL_KINDS: readonly string[] = Object.keys(DRAW);
