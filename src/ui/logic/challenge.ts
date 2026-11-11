/**
 * A friend's challenge on a numbered level (sprint 14 H3, design/gdd/sharing.md §3.2, §4), DOM-free.
 * A challenge never unlocks a level (D3) and pays nothing (D120).
 */

/** What the receiver of `?challenge=N&pours=P` is offered (D121). */
export type ChallengeOffer =
  | { readonly kind: 'beat'; readonly level: number; readonly pours: number }
  | { readonly kind: 'ahead'; readonly level: number; readonly mine: number };

/**
 * `beat` when the receiver has reached level `level` (their next level is `nextLevel`), else
 * `ahead`: an invitation to play on, and the challenge is dropped (D121).
 * Example: `challengeOffer(80, 34, 12) // { kind: 'ahead', level: 80, mine: 12 }`.
 */
export function challengeOffer(level: number, pours: number, nextLevel: number): ChallengeOffer {
  return level <= nextLevel ? { kind: 'beat', level, pours } : { kind: 'ahead', level, mine: nextLevel };
}

/** How a result compares with the friend's pours. */
export interface ChallengeVerdict {
  readonly kind: 'beat' | 'matched' | 'behind';
  /** How many pours apart (0 when matched). */
  readonly by: number;
}

/** `diff = mine − theirs`: beat if negative, matched if 0, else behind (§4). Example: `challengeVerdict(31, 34) // beat by 3`. */
export function challengeVerdict(mine: number, theirs: number): ChallengeVerdict {
  const diff = mine - theirs;
  return { kind: diff < 0 ? 'beat' : diff === 0 ? 'matched' : 'behind', by: Math.abs(diff) };
}
