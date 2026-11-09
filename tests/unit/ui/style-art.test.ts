// Jar style art (design/gdd/jar-styles.md §3.4, §4; sprint 12 S3).
// The sand textures live in one table (src/ui/style-art.ts). This test keeps the CSS block generated
// from it in step with style.css, and checks the §4 overlay cap on that same table, so the cap is
// tested on exactly what the browser draws. UPDATE_STYLE_ART=1 rewrites the block after a table edit.
// The project has no Node type definitions, and vitest empties CSS imports, so read the file directly.
// @ts-expect-error node:fs types are not installed
import { readFileSync as readFs, writeFileSync as writeFs } from 'node:fs';
import { describe, expect, it } from 'vitest';

const readFileSync = readFs as (path: URL, enc: string) => string;
const writeFileSync = writeFs as (path: URL, data: string) => void;
const env = (globalThis as unknown as { process: { env: Record<string, string | undefined> } }).process.env;
import gameConfig from '../../../src/config/game-config.json';
import {
  PLAIN_GRAIN,
  SAND_ALPHA_CAP,
  SAND_CSS_BEGIN,
  SAND_CSS_END,
  SAND_IDS,
  SAND_LUMINANCE_CAP,
  SAND_TEXTURES,
  layerCss,
  meanUnitLuminance,
  sandTextureCss,
} from '../../../src/ui/style-art';

const CSS_PATH = new URL('../../../src/ui/style.css', import.meta.url);
const config = gameConfig as unknown as {
  palette: { id: string; hex: string }[];
  styles: { slots: Record<'glass' | 'cork' | 'sand', { id: string; price: number }[]> };
};

function readCss(): string {
  let css = readFileSync(CSS_PATH, 'utf8');
  const start = css.indexOf(SAND_CSS_BEGIN);
  const end = css.indexOf(SAND_CSS_END);
  if (env.UPDATE_STYLE_ART && start >= 0 && end > start) {
    css = css.slice(0, start) + sandTextureCss() + css.slice(end + SAND_CSS_END.length);
    writeFileSync(CSS_PATH, css);
  }
  return css;
}

function between(css: string, begin: string, end: string): string {
  const a = css.indexOf(begin);
  const b = css.indexOf(end, a);
  expect(a, `marker ${begin} missing from style.css`).toBeGreaterThanOrEqual(0);
  expect(b, `marker ${end} missing from style.css`).toBeGreaterThan(a);
  return css.slice(a, b + end.length);
}

const css = readCss();
const sandBlock = between(css, SAND_CSS_BEGIN, SAND_CSS_END);
const piecesBlock = between(css, '/* style-art:pieces:begin', '/* style-art:pieces:end */');

describe('sand textures: CSS and table stay in step', () => {
  it('style.css holds exactly the block generated from the table', () => {
    // On failure: run UPDATE_STYLE_ART=1 npx vitest run tests/unit/ui/style-art.test.ts
    expect(sandBlock).toBe(sandTextureCss());
  });

  it('the table has every paid sand piece in the config, and nothing else', () => {
    const paid = config.styles.slots.sand.filter((p) => p.price > 0).map((p) => p.id);
    expect([...SAND_IDS].sort()).toEqual([...paid].sort());
    expect(Object.keys(SAND_TEXTURES).sort()).toEqual([...paid].sort());
  });

  it('PLAIN_GRAIN mirrors the hand-written default grain on .unit', () => {
    const unitRule = css.slice(css.indexOf('\n.unit {'), css.indexOf('}', css.indexOf('\n.unit {')));
    for (const l of PLAIN_GRAIN) {
      const c = layerCss(l);
      expect(unitRule).toContain(c.image);
    }
    expect(unitRule.replace(/\s+/g, ' ')).toContain(`background-size: ${PLAIN_GRAIN.map((l) => layerCss(l).size.replace(/px/g, 'px')).join(', ')};`);
    expect(unitRule.replace(/\s+/g, ' ')).toContain(`background-position: 0 0, 3px 2px;`);
  });
});

describe('sand overlay cap (jar-styles.md §4)', () => {
  it(`every texture layer has alpha ≤ ${SAND_ALPHA_CAP} in the table`, () => {
    for (const id of SAND_IDS) for (const l of SAND_TEXTURES[id]) expect(l.alpha, id).toBeLessThanOrEqual(SAND_ALPHA_CAP);
  });

  it(`every colour in the generated CSS has alpha ≤ ${SAND_ALPHA_CAP} (read from style.css)`, () => {
    const alphas = [...sandBlock.matchAll(/rgba\(\s*\d+,\s*\d+,\s*\d+,\s*([\d.]+)\s*\)/g)].map((m) => Number(m[1]));
    expect(alphas.length).toBeGreaterThan(0);
    for (const a of alphas) expect(a).toBeLessThanOrEqual(SAND_ALPHA_CAP);
    expect(sandBlock).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i); // no opaque colour: the sand colour is var(--c)
  });

  it(`each texture moves every sand colour's mean relative luminance by ≤ ${SAND_LUMINANCE_CAP * 100}% against plain sand`, () => {
    const worst: Record<string, number> = {};
    for (const id of SAND_IDS) {
      for (const { id: colour, hex } of config.palette) {
        const plain = meanUnitLuminance(hex, PLAIN_GRAIN);
        const styled = meanUnitLuminance(hex, SAND_TEXTURES[id]);
        const change = Math.abs(styled - plain) / plain;
        worst[id] = Math.max(worst[id] ?? 0, change);
        expect(change, `${id} on ${colour}`).toBeLessThanOrEqual(SAND_LUMINANCE_CAP);
      }
    }
    expect(Object.keys(worst)).toHaveLength(SAND_IDS.length);
  });

  it('the estimate notices a texture that breaks the cap (the check can fail)', () => {
    const heavy = [{ kind: 'band', rgb: [255, 255, 255], alpha: 0.25, from: 0, to: 60, soft: 0 } as const];
    const hex = config.palette.find((p) => p.id === 'denim')!.hex;
    const change = (meanUnitLuminance(hex, heavy) - meanUnitLuminance(hex, PLAIN_GRAIN)) / meanUnitLuminance(hex, PLAIN_GRAIN);
    expect(change).toBeGreaterThan(SAND_LUMINANCE_CAP);
  });
});

describe('style pieces in style.css (jar-styles.md §3.4)', () => {
  const styleBlock = css.slice(css.indexOf('/* ==== Sprint 12 S3: jar styles'));

  it('every paid glass and cork piece has a rule, and no default id is styled (today\'s look stays)', () => {
    for (const slot of ['glass', 'cork'] as const) {
      for (const p of config.styles.slots[slot]) {
        const sel = `[data-${slot}='${p.id}']`;
        if (p.price > 0) expect(piecesBlock, sel).toContain(sel);
        else expect(styleBlock, sel).not.toContain(sel);
      }
    }
    expect(styleBlock).not.toContain(`[data-sand='plain']`);
  });

  it('colour patterns draw above every sand texture', () => {
    expect(sandBlock).toContain(".unit[class*='pat-']::after {\n  background-image: inherit;");
  });

  it('no style animates or transitions (reduced motion and battery)', () => {
    expect(styleBlock).not.toMatch(/(^|[\s;{])(animation|transition)(-[a-z-]+)?\s*:|@keyframes/m);
  });
});
