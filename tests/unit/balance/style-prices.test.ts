// Sprint 12 S5 (D86): the jar style prices follow the balance pass's ladder (production/qa/sprint-12/balance.md).
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';

/** The fitted ladder (tools/balance/styles-model.ts): first piece 7 days, last 14 days of mid income. */
const P1 = 1700;
const G = 1.0636;
const round50 = (x: number) => Math.round(x / 50) * 50;
const slots = config.styles.slots;
/** Ladder order: rank 1 of glass, cork, sand, then rank 2, and so on. */
const ladder = [1, 2, 3, 4].flatMap((rank) => (['glass', 'cork', 'sand'] as const).map((slot) => slots[slot][rank]));

describe('jar style prices (S5, D86)', () => {
  it('each slot starts with a free default', () => {
    for (const slot of ['glass', 'cork', 'sand'] as const) expect(slots[slot][0].price).toBe(0);
  });
  it('the 12 pieces follow round50(1700 x 1.0636^(i-1)) in ladder order', () => {
    expect(ladder.map((x) => x.price)).toEqual(ladder.map((_, i) => round50(P1 * G ** i)));
  });
  it('every bought piece costs more than the last one in the ladder', () => {
    for (let i = 1; i < ladder.length; i++) expect(ladder[i].price).toBeGreaterThan(ladder[i - 1].price);
  });
});
