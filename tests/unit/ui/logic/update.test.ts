// Story: owner request after 0.14.1 ("no stale data for players").
// A game left open on a phone picks up a new release by itself: it reloads on Home, where no board
// is in play (a board left for Home is not kept, sprint 10 F6), and waits anywhere else.
import { describe, expect, it } from 'vitest';
import { needsLeaveConfirm } from '../../../../src/ui/logic/leave';
import { reloadForUpdate } from '../../../../src/ui/logic/update';

describe('reloadForUpdate', () => {
  it('reloads on Home when a new version has taken over', () => {
    expect(reloadForUpdate({ updateReady: true, onHome: true })).toBe(true);
  });
  it('waits on a board, the win card or any other screen', () => {
    expect(reloadForUpdate({ updateReady: true, onHome: false })).toBe(false);
  });
  it('does nothing without a new version', () => {
    expect(reloadForUpdate({ updateReady: false, onHome: true })).toBe(false);
  });
  it('relies on Home never holding a board in play: leaving a part-played board for Home is confirmed and drops it', () => {
    expect(needsLeaveConfirm({ onHome: false, moves: 3, won: false })).toBe(true);
    expect(needsLeaveConfirm({ onHome: true, moves: 3, won: false })).toBe(false);
  });
});
