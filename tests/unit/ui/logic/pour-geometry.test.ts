// Bug report 2026-11-11 ("the sand doesn't fall out of the jar right"): the stream starts at the
// tilted jar's lower lip. Clockwise CSS rotation in screen coordinates (y grows downward).
import { describe, expect, it } from 'vitest';
import { lowerLip } from '../../../../src/ui/logic/pour-geometry';

const jar = { left: 0, top: 0, width: 40, height: 100 }; // centre (20, 50)
const glass = { left: 0, top: 10, width: 40, height: 90 }; // mouth from (0,10) to (40,10)

describe('lowerLip', () => {
  it('at rest, either mouth corner (same height): the left one', () => {
    expect(lowerLip(jar, glass, 0, 0, 0)).toEqual({ x: 0, y: 10 });
  });
  it('tilted 90° clockwise, the mouth points right and its lower corner is the glass top-right one', () => {
    const p = lowerLip(jar, glass, 90, 0, 0);
    expect(p.x).toBeCloseTo(60, 6);
    expect(p.y).toBeCloseTo(70, 6);
  });
  it('tilted 90° anticlockwise, the mouth points left and its lower corner is the top-left one', () => {
    const p = lowerLip(jar, glass, -90, 0, 0);
    expect(p.x).toBeCloseTo(-20, 6);
    expect(p.y).toBeCloseTo(70, 6);
  });
  it('follows the move', () => {
    const p = lowerLip(jar, glass, 90, 100, 5);
    expect(p.x).toBeCloseTo(160, 6);
    expect(p.y).toBeCloseTo(75, 6);
  });
});
