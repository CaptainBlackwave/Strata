# Late ladder: streak steps and top scene prices (sprint 13, E1; D99, D100)

Source: `npx vite-node tools/balance/late-ladder.ts` (raw output: `late-ladder.json`), on the sprint 7
simulated players over 365 days, with the long-streak steps on (+25 from day 30, +50 from day 60).

## The streak steps alone (D99)

A regular player's top rungs, bought in price order, would still land 14, 15, 18, 20, 24, 27 and 31 days apart
(the steps add about 15% to income from day 30). Not enough on their own, as the interview noted.

## The new prices (D100)

Rungs 1–5 keep their prices. Rungs 6–12 follow `round50(4350 × 1.031^k)`, k = 1…7: the steepest growth for which a
regular player who does not buy boosters (the ladder's reference player, D32) buys each top rung at most 14 days
after the one before.

| Rung | Scene | Before | After |
|---|---|---|---|
| 6 | Winter snow | 5,050 | 4,500 |
| 7 | Harvest moon | 5,800 | 4,600 |
| 8 | Soft rain | 6,650 | 4,750 |
| 9 | Winter lights | 7,650 | 4,900 |
| 10 | New Year fireworks | 8,800 | 5,050 |
| 11 | Meteor shower | 10,100 | 5,200 |
| 12 | Aurora night | 11,650 | 5,400 |

The ladder costs 51,250 in total (was 72,550). The price order is unchanged, so "the highest price wins" for
overlapping seasonal scenes still picks the same scene.

| Regular player | Gaps between top rungs (days) |
|---|---|
| Before, no boosters bought | 14, 15, 18, 20, 24, 27, 31 |
| After, no boosters bought | 12, 12, 13, 13, 14, 14, 14 |
| After, buying boosters | 22, 23, 24, 25, 25, 26, 28 |

Whole ladder, scenes only: regular by day 145 (was 226), heavy by day 64 (was 92), light 12 of 15 in a year.
With jar styles alternating (the sprint 12 player): a regular player owns every scene and style by day 223.

## Trade-offs for the owner

- A heavy player now owns every scene by about day 64 instead of 92; jar styles remain after that.
- The animated tier-3 scenes (Meteor shower, Aurora night) now cost about the same as the tier-2 ones. The ladder
  climbs gently instead of steeply.
- Nothing is refunded to players who bought top scenes at the old prices (D100).
