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
