// Sprint 10 F6 (TD-12, docs/tech-debt.md): when "Leave this board?" asks first (src/ui/logic/leave.ts).
import { describe, expect, it } from 'vitest';
import { needsLeaveConfirm } from '../../../../src/ui/logic/leave';

describe('needsLeaveConfirm', () => {
  it('asks when a board is part-way played', () => {
    expect(needsLeaveConfirm({ onHome: false, moves: 1, won: false })).toBe(true);
  });
  it('acts at once on a board with no pours made', () => {
    expect(needsLeaveConfirm({ onHome: false, moves: 0, won: false })).toBe(false);
  });
  it('acts at once on a won board, since nothing is lost', () => {
    expect(needsLeaveConfirm({ onHome: false, moves: 7, won: true })).toBe(false);
  });
  it('acts at once from Home, whatever the board behind it holds', () => {
    expect(needsLeaveConfirm({ onHome: true, moves: 7, won: false })).toBe(false);
  });
});
