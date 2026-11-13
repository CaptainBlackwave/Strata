// Sprint 25 U4: the wooden shelves. The DOM (.jar-shelf) and the canvas (board-gpu/shelf.ts) paint the
// same plank, so the Classic and Realistic boards match.
import { describe, expect, it } from 'vitest';
// @ts-expect-error node:fs types are not installed
import { readFileSync } from 'node:fs';
import { SHELF_LIP, SHELF_SHADOW, SHELF_WOOD, shelfBox } from '../../../../src/ui/board-gpu/shelf';

const css = (readFileSync as (path: URL, enc: string) => string)(new URL('../../../../src/ui/style.css', import.meta.url), 'utf8');

describe('wooden shelves (sprint 25 U4)', () => {
  it('the canvas fallback wood is the daytime --wood-* tokens, and the plank reads them', () => {
    // Arrange
    const root = css.slice(css.indexOf('\n:root {'), css.indexOf('\n}', css.indexOf('\n:root {')));
    const shelf = css.slice(css.indexOf('\n.jar-shelf {'), css.indexOf('}', css.indexOf('\n.jar-shelf {')));
    // Act / Assert
    expect(root).toContain(`--wood-top: ${SHELF_WOOD.top};`);
    expect(root).toContain(`--wood-bottom: ${SHELF_WOOD.bottom};`);
    expect(root).toContain(`--wood-lip: ${SHELF_WOOD.lip};`);
    expect(shelf).toMatch(/var\(--wood-top\), var\(--wood-bottom\)/);
    expect(css).toContain(`--shelf-lip: ${SHELF_LIP}px;`);
  });
  it('the canvas box starts at the plank face and adds the lip and shadow below it', () => {
    const face = { left: 12, top: 300, width: 280, height: 10 };
    expect(shelfBox(face)).toEqual({ left: 12, top: 300, width: 280, height: 10 + SHELF_LIP + SHELF_SHADOW });
  });
});

describe('wood grain (sprint 26 N1)', () => {
  it('both CSS shelves paint the grain lines, and the canvas fallback is the daytime --wood-grain', () => {
    const root = css.slice(css.indexOf('\n:root {'), css.indexOf('\n}', css.indexOf('\n:root {')));
    expect(root).toContain('--wood-grain: color-mix(in srgb, var(--wood-lip) 16%, transparent);'); // #8f6736 at 16%
    expect(SHELF_WOOD.grain).toBe('rgba(143, 103, 54, 0.16)');
    expect(root).toMatch(/--wood-grain-lines:\s+repeating-linear-gradient\(180deg, transparent 0 3px, var\(--wood-grain\) 3px 4px\),\s+repeating-linear-gradient\(180deg, transparent 0 6px, var\(--wood-grain\) 6px 7px\);/);
    const shelf = css.slice(css.indexOf('\n.jar-shelf {'), css.indexOf('}', css.indexOf('\n.jar-shelf {')));
    expect(shelf).toContain('var(--wood-grain-lines)');
    const hero = css.slice(css.indexOf('\n.hero .hero-logo::after {'), css.indexOf('}', css.indexOf('\n.hero .hero-logo::after {')));
    expect(hero).toContain('var(--wood-grain-lines)');
  });
});
