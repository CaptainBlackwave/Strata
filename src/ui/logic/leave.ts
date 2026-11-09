/** When leaving a board from Settings asks "Leave this board?" first (sprint 10 F6, TD-12). DOM-free. */

/** What the decision reads about the board being left. */
export interface LeaveContext {
  /** Settings was opened from Home, so no board is being left. */
  readonly onHome: boolean;
  /** Pours made on the board. */
  readonly moves: number;
  /** The board is won, so nothing would be lost. */
  readonly won: boolean;
}

/**
 * True when the board is part-way played: it isn't kept, so the player is asked first.
 * Otherwise (from Home, no pours made, a won board) the action runs at once.
 */
export function needsLeaveConfirm(c: LeaveContext): boolean {
  return !c.onHome && c.moves > 0 && !c.won;
}
