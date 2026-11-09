/**
 * Jar style art (design/gdd/jar-styles.md §3.4, §4; sprint 12 S3).
 *
 * The sand textures are defined here, once, as a table of overlay layers. `sandTextureCss()` turns the
 * table into the CSS block between the `style-art:sand` markers in `style.css`, and
 * `tests/unit/ui/style-art.test.ts` fails if that block and this table ever differ, then checks the
 * §4 overlay cap (each layer's alpha ≤ 0.25, a unit's mean relative luminance within 6% of plain sand)
 * on the same table. To change a texture: edit the table, then run
 * `UPDATE_STYLE_ART=1 npx vitest run tests/unit/ui/style-art.test.ts` to rewrite the CSS block.
 *
 * Glass and cork pieces are plain CSS (the `style-art:pieces` block in `style.css`): they never
 * touch a sand colour, so there is nothing numeric to cap.
 *
 * This file is DOM-free except `applyStyleAttrs`, so the table and the estimate run in Node.
 */

/** An sRGB colour, 0–255 per channel. */
export type Rgb = readonly [number, number, number];

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

/**
 * A speckle drawn the way today's grain is: `radial-gradient(rgba(…) r0px, transparent r1px)`, an
 * ellipse sized to the tile's aspect (farthest-corner), centred in a `w`×`h` px tile offset by `x`,`y`.
 * Solid to `r0`, fading to clear at `r1` (horizontal radius).
 */
export interface GrainLayer {
  readonly kind: 'grain';
  readonly rgb: Rgb;
  readonly alpha: number;
  readonly r0: number;
  readonly r1: number;
  readonly w: number;
  readonly h: number;
  readonly x: number;
  readonly y: number;
}

/** An ellipse of explicit radii `rx`×`ry` px (a sparkle arm or core), solid to `inner` (0–1) of the radius. */
export interface DotLayer {
  readonly kind: 'dot';
  readonly rgb: Rgb;
  readonly alpha: number;
  readonly rx: number;
  readonly ry: number;
  readonly inner: number;
  readonly w: number;
  readonly h: number;
  readonly x: number;
  readonly y: number;
}

/** A ring of radius `r` and thickness `t` px around (`cx`,`cy`) in the tile, with `soft` px fades: an arc of a wave mark. */
export interface RingLayer {
  readonly kind: 'ring';
  readonly rgb: Rgb;
  readonly alpha: number;
  readonly r: number;
  readonly t: number;
  readonly soft: number;
  readonly cx: number;
  readonly cy: number;
  readonly w: number;
  readonly h: number;
  readonly x: number;
  readonly y: number;
}

/** A horizontal band across the unit, `from`–`to` in % of its height, with `soft` % fades. */
export interface BandLayer {
  readonly kind: 'band';
  readonly rgb: Rgb;
  readonly alpha: number;
  readonly from: number;
  readonly to: number;
  readonly soft: number;
}

/** One overlay layer of a sand texture. */
export type SandLayer = GrainLayer | DotLayer | RingLayer | BandLayer;

/** The paid sand pieces (ids as in `game-config.json` → `styles.slots.sand`, minus the default `plain`). */
export const SAND_IDS = ['fine', 'glint', 'layered', 'ripple'] as const;
/** A paid sand piece id. */
export type SandId = (typeof SAND_IDS)[number];

/** §4: each texture layer's alpha is at most this. */
export const SAND_ALPHA_CAP = 0.25;
/** §4: a unit's mean relative luminance moves by at most this fraction against plain sand. */
export const SAND_LUMINANCE_CAP = 0.06;

/**
 * Today's grain, the `plain` piece: a mirror of the `.unit` rule in style.css, which stays hand-written
 * so the default look cannot change. The test checks the two agree; it is the baseline for §4.
 */
export const PLAIN_GRAIN: readonly GrainLayer[] = [
  { kind: 'grain', rgb: WHITE, alpha: 0.22, r0: 0.8, r1: 1.2, w: 6, h: 6, x: 0, y: 0 },
  { kind: 'grain', rgb: BLACK, alpha: 0.14, r0: 0.8, r1: 1.2, w: 7, h: 5, x: 3, y: 2 },
];

/** Sparkle: a small four-point star (two thin arms and a core) in a `w`×`h` tile. */
function sparkle(arm: number, alpha: number, w: number, h: number, x: number, y: number): DotLayer[] {
  return [
    { kind: 'dot', rgb: WHITE, alpha, rx: arm, ry: 0.45, inner: 0.15, w, h, x, y },
    { kind: 'dot', rgb: WHITE, alpha, rx: 0.45, ry: arm, inner: 0.15, w, h, x, y },
    { kind: 'dot', rgb: WHITE, alpha, rx: 0.9, ry: 0.9, inner: 0.45, w, h, x, y },
  ];
}

/**
 * The paid sand textures, drawn over the sand colour and under any colour pattern. Light and dark
 * layers are balanced so the average shade stays put (§4). Layers listed first draw on top.
 */
export const SAND_TEXTURES: Readonly<Record<SandId, readonly SandLayer[]>> = {
  /** A finer, denser speckle: smaller dots on tighter tiles, three layers instead of two. */
  fine: [
    { kind: 'grain', rgb: WHITE, alpha: 0.2, r0: 0.45, r1: 0.8, w: 4, h: 4, x: 0, y: 0 },
    { kind: 'grain', rgb: BLACK, alpha: 0.16, r0: 0.45, r1: 0.8, w: 5, h: 4, x: 2, y: 1 },
    { kind: 'grain', rgb: WHITE, alpha: 0.12, r0: 0.4, r1: 0.7, w: 3, h: 3, x: 1, y: 2 },
  ],
  /** A few tiny still sparkles over today's grain: two sparse, offset sets so they do not line up. */
  glint: [
    ...sparkle(2.4, 0.25, 26, 22, 0, 0),
    ...sparkle(1.8, 0.22, 34, 29, 13, 15),
    ...PLAIN_GRAIN,
  ],
  /** Faint strata within each unit: a light, a dark and a light band, over today's grain. */
  layered: [
    { kind: 'band', rgb: WHITE, alpha: 0.12, from: 24, to: 29, soft: 4 },
    { kind: 'band', rgb: BLACK, alpha: 0.13, from: 52, to: 56, soft: 4 },
    { kind: 'band', rgb: WHITE, alpha: 0.08, from: 77, to: 81, soft: 3 },
    ...PLAIN_GRAIN,
  ],
  /** Soft wave marks: a chain of shallow arcs, each a light crest over a dark trough, over today's grain. */
  ripple: [
    { kind: 'ring', rgb: WHITE, alpha: 0.12, r: 10, t: 0.7, soft: 0.5, cx: 9, cy: -5, w: 18, h: 10, x: 0, y: 0 },
    { kind: 'ring', rgb: BLACK, alpha: 0.12, r: 10, t: 0.7, soft: 0.5, cx: 9, cy: -3.8, w: 18, h: 10, x: 0, y: 0 },
    ...PLAIN_GRAIN,
  ],
};

/** Short number text for CSS: at most 3 decimals, no trailing zeros. */
function n(v: number): string {
  return String(Number(v.toFixed(3)));
}

function rgba(rgb: Rgb, a: number): string {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${n(a)})`;
}

/** The CSS `background-image`, `-size` and `-position` values for one layer. */
export function layerCss(l: SandLayer): { image: string; size: string; position: string } {
  const c = rgba(l.rgb, l.alpha);
  switch (l.kind) {
    case 'grain':
      return { image: `radial-gradient(${c} ${n(l.r0)}px, transparent ${n(l.r1)}px)`, size: `${n(l.w)}px ${n(l.h)}px`, position: `${n(l.x)}px ${n(l.y)}px` };
    case 'dot':
      return {
        image: `radial-gradient(${n(l.rx)}px ${n(l.ry)}px, ${c} ${n(l.inner * 100)}%, transparent)`,
        size: `${n(l.w)}px ${n(l.h)}px`,
        position: `${n(l.x)}px ${n(l.y)}px`,
      };
    case 'ring': {
      const a = l.r - l.t / 2;
      const b = l.r + l.t / 2;
      return {
        image: `radial-gradient(circle at ${n(l.cx)}px ${n(l.cy)}px, transparent ${n(a - l.soft)}px, ${c} ${n(a)}px ${n(b)}px, transparent ${n(b + l.soft)}px)`,
        size: `${n(l.w)}px ${n(l.h)}px`,
        position: `${n(l.x)}px ${n(l.y)}px`,
      };
    }
    case 'band':
      return {
        image: `linear-gradient(180deg, transparent ${n(l.from - l.soft)}%, ${c} ${n(l.from)}% ${n(l.to)}%, transparent ${n(l.to + l.soft)}%)`,
        size: '100% 100%',
        position: '0 0',
      };
  }
}

/**
 * The attribute sits on a container (`#board`, `#home` or a `.style-preview`), so every selector is
 * `[data-sand='id'] …`: units on the board and in previews (`.unit`), and the Home art (`.logo-jars i`).
 */
const anySand = `:is(${SAND_IDS.map((id) => `[data-sand='${id}']`).join(', ')})`;
const homeJars = (attr: string): string => `${attr} .logo-jars i`;

/** The marker lines around the generated block in style.css. */
export const SAND_CSS_BEGIN = '/* style-art:sand:begin';
export const SAND_CSS_END = '/* style-art:sand:end */';

/** The whole generated sand block for style.css, markers included. */
export function sandTextureCss(): string {
  const unit = `${anySand} .unit:not(.buried)`;
  const out: string[] = [
    `${SAND_CSS_BEGIN}: generated by sandTextureCss() in src/ui/style-art.ts; do not edit by hand.`,
    '   tests/unit/ui/style-art.test.ts fails if this block and the table differ, and checks the cap (jar-styles.md §4).',
    '   The texture is drawn on ::before over the sand colour; with colour patterns on, ::after draws the',
    '   unit\'s own .pat-* layers again on top (background-* inherit), so a pattern is never under a texture.',
    '   Buried units keep their own look. Nothing here animates. */',
    `${unit} {`,
    '  position: relative;',
    '}',
    `${unit}::before,`,
    `${anySand} .unit[class*='pat-']::after {`,
    "  content: '';",
    '  position: absolute;',
    '  inset: 0;',
    '  pointer-events: none;',
    '}',
    `${unit}::before {`,
    '  background-color: var(--c);',
    '  box-shadow: inherit;',
    '}',
    `${anySand} .unit[class*='pat-']::after {`,
    '  background-image: inherit;',
    '  background-size: inherit;',
    '  background-position: inherit;',
    '  background-repeat: inherit;',
    '}',
    `${homeJars(anySand)} {`,
    '  position: relative;',
    '}',
    `${homeJars(anySand)}::after {`,
    "  content: '';",
    '  position: absolute;',
    '  left: 0;',
    '  right: 0;',
    '  bottom: 0;',
    '  top: 16%;',
    '  border-radius: 0 0 17px 17px;',
    '  pointer-events: none;',
    '}',
  ];
  for (const id of SAND_IDS) {
    const layers = SAND_TEXTURES[id].map(layerCss);
    const attr = `[data-sand='${id}']`;
    out.push(
      `${attr} .unit:not(.buried)::before,`,
      `${homeJars(attr)}::after {`,
      `  background-image:\n${layers.map((l) => `    ${l.image}`).join(',\n')};`,
      `  background-size: ${layers.map((l) => l.size).join(', ')};`,
      `  background-position: ${layers.map((l) => l.position).join(', ')};`,
      '}',
    );
  }
  out.push(SAND_CSS_END);
  return out.join('\n');
}

/** A layer's alpha at a point: (x, y) in px inside its tile, or for a band, y in % of the unit height. */
export function layerAlphaAt(l: SandLayer, x: number, y: number): number {
  const ramp = (d: number, solid: number, clear: number): number => (d <= solid ? 1 : d >= clear ? 0 : (clear - d) / (clear - solid));
  switch (l.kind) {
    case 'grain': {
      const rx = l.r1;
      const ry = (l.r1 * l.h) / l.w; // farthest-corner ellipse keeps the tile's aspect
      const d = Math.hypot((x - l.w / 2) / rx, (y - l.h / 2) / ry) * l.r1;
      return l.alpha * ramp(d, l.r0, l.r1);
    }
    case 'dot': {
      const d = Math.hypot((x - l.w / 2) / l.rx, (y - l.h / 2) / l.ry);
      return l.alpha * ramp(d, l.inner, 1);
    }
    case 'ring': {
      const d = Math.hypot(x - l.cx, y - l.cy);
      const a = l.r - l.t / 2;
      const b = l.r + l.t / 2;
      if (d < a) return l.alpha * (1 - ramp(d, a - l.soft, a));
      return l.alpha * ramp(d, b, b + l.soft);
    }
    case 'band': {
      if (y < l.from) return l.alpha * (1 - ramp(y, l.from - l.soft, l.from));
      return l.alpha * ramp(y, l.to, l.to + l.soft);
    }
  }
}

/** The share of a layer's area at each alpha: a histogram of (alpha, fraction), sampled on a fine grid. */
export function layerCoverage(l: SandLayer, step = 0.05): readonly (readonly [number, number])[] {
  const bins = new Map<number, number>();
  let total = 0;
  const add = (a: number) => {
    const k = Math.round(a * 1000) / 1000;
    bins.set(k, (bins.get(k) ?? 0) + 1);
    total++;
  };
  if (l.kind === 'band') {
    for (let y = step / 2; y < 100; y += step) add(layerAlphaAt(l, 0, y));
  } else {
    for (let y = step / 2; y < l.h; y += step) for (let x = step / 2; x < l.w; x += step) add(layerAlphaAt(l, x, y));
  }
  return [...bins].map(([a, c]) => [a, c / total] as const);
}

function hexRgb(hex: string): Rgb {
  const v = parseInt(hex.replace('#', ''), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}

function toLinear(v: number): number {
  const s = v / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/**
 * Estimated mean relative luminance (WCAG Y, 0–1) of a unit of sand colour `hex` under `layers`.
 * Each layer is blended in sRGB as the browser does, the area is averaged in linear light (as the eye
 * does), and layers are treated as not overlapping (their coverage is small and they are offset).
 */
export function meanUnitLuminance(hex: string, layers: readonly SandLayer[], step = 0.05): number {
  const base = hexRgb(hex);
  const lin = base.map(toLinear);
  const mean = [...lin];
  for (const l of layers) {
    for (const [a, frac] of layerCoverage(l, step)) {
      if (a === 0) continue;
      for (let ch = 0; ch < 3; ch++) {
        const blended = base[ch] * (1 - a) + l.rgb[ch] * a;
        mean[ch] += frac * (toLinear(blended) - lin[ch]);
      }
    }
  }
  return 0.2126 * mean[0] + 0.7152 * mean[1] + 0.0722 * mean[2];
}

/** The worn style ids, one per slot. */
export interface WornStyles {
  readonly glass: string;
  readonly cork: string;
  readonly sand: string;
}

/**
 * Sets the style attributes the CSS keys on (`data-glass`, `data-cork`, `data-sand`) on a container:
 * `#board`, `#home` or a `.style-preview`. A default id draws today's look.
 */
export function applyStyleAttrs(el: HTMLElement, worn: WornStyles): void {
  el.dataset.glass = worn.glass;
  el.dataset.cork = worn.cork;
  el.dataset.sand = worn.sand;
}
