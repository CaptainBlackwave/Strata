/**
 * Picks the jar size and row count so the board fits the available space
 * (teardown rule R10: large boards wrap into rows).
 * Pure function so it can be unit-tested.
 */

/** Layout inputs. */
export interface LayoutInput {
  readonly width: number;
  readonly height: number;
  readonly jars: number;
  readonly capacity: number;
}

/** The chosen layout, in CSS pixels. */
export interface Layout {
  readonly rows: number;
  readonly cols: number;
  readonly jarWidth: number;
  readonly unitHeight: number;
  readonly jarHeight: number;
  readonly gapX: number;
  readonly gapY: number;
}

const MAX_JAR_WIDTH = 68;
const MIN_JAR_WIDTH = 26;
const MAX_ROWS = 4;

/**
 * Example: `computeLayout({ width: 390, height: 600, jars: 14, capacity: 4 })`
 * gives two rows of seven jars.
 */
export function computeLayout(input: LayoutInput): Layout {
  const { width, height, jars, capacity } = input;
  let best: Layout | null = null;
  for (let rows = 1; rows <= MAX_ROWS; rows++) {
    const cols = Math.ceil(jars / rows);
    if (rows > 1 && Math.ceil(jars / (rows - 1)) === cols) continue;
    const gapX = Math.max(6, Math.min(18, width * 0.025));
    const jarWidthByW = (width - gapX * (cols + 1)) / cols;
    // Unit height shrinks for tall jars so a capacity-8 jar still fits.
    const unitRatio = capacity > 4 ? 0.42 : 0.62;
    const neck = 0.55; // neck + lift room, as a multiple of jar width
    const gapY = 26;
    const jarWidthByH = (height - gapY * (rows + 1)) / rows / (capacity * unitRatio + neck);
    const jarWidth = Math.floor(Math.min(MAX_JAR_WIDTH, jarWidthByW, jarWidthByH));
    if (jarWidth < MIN_JAR_WIDTH && best) continue;
    const unitHeight = Math.floor(jarWidth * unitRatio);
    const candidate: Layout = {
      rows,
      cols,
      jarWidth,
      unitHeight,
      jarHeight: unitHeight * capacity + Math.round(jarWidth * 0.3),
      gapX,
      gapY,
    };
    // Another row costs vertical room, so it has to buy a clearly bigger jar.
    if (!best || candidate.jarWidth > best.jarWidth * 1.1) best = candidate;
  }
  return best!;
}
