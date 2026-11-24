# The lighthouse jar and a dark-aware simulated player (sprint 30 S1, D232)

Beads `strata-m4f`. **Report only: nothing in the game changed.** The recommendation at the end is for the owner to decide.

## What changed in the simulator

`tools/balance/sim-player.ts` (the simulated player of D132) can now be **dark-aware**, and is by default:

- While a lighthouse jar is dark (`isLit(jar, capacity)` false, `design/gdd/jar-mechanics.md` §2.10), the player sees its units like buried sand: it knows how many there are but no colour (`unseen()`, `visible()`). Lit, sealed and empty lighthouse jars, and every other jar, look as before.
- It can still pour into and out of a dark jar (every pour the rules allow; a refused try is free in the game). But its liking for such a pour (`score()`) uses no dark colour. A pour out of a dark jar is a blind pour (score 0, or -1 into an empty jar). A pour into one gets no credit for a match or a one-colour fill it can't see.
- It has no memory: once the beam goes out, it forgets what it saw, and it ignores the colour of sand as it falls out of a dark jar (D212). That makes it a **pessimistic** bound. The old player, which sees every colour, is the **optimistic** bound, and a real player is somewhere between the two. It never waits on purpose for the beam either.
- It's switchable: `simPlay(board, patience, { darkAware: false })` gives the sprint 15–29 player. On a board with no lighthouse jar the two play exactly alike (tested), so nothing below level 321 moves.
- `tools/balance/stuck-sweep.ts`: dark-aware by default, and `DARK=0` gives the old player.
- New: `tools/balance/lighthouse-dark.ts`, the measurement behind the tables below (about 90 s): `npx vite-node tools/balance/lighthouse-dark.ts`.
- `tests/unit/balance/gentle-climb.test.ts`: the stuck-rate gates now pass `{ darkAware: false }` explicitly, so they measure exactly what they did before. Their thresholds are unchanged. The gates were set with that player, and switching them is the owner's call (see below).
- New test: `tests/unit/balance/sim-player-dark.test.ts` checks what the player sees of a dark, a lit, a sealed and an empty lighthouse jar, that its choices use no dark colour, that it can still win through a dark jar, and that non-lighthouse boards play the same as before.

## The numbers

These use the same levels (seeded by level number) and the same patience (150) as the gates. "Stuck" means the player gave up without a booster. The beam-every-3 and every-2 columns are what-ifs on the generated board only (the beam re-dealt as `{ every, left: every, lit: false }`). Non-lighthouse boards are untouched by them.

| Sample | Boards | Old player | Dark-aware | Dark-aware, beam every 3 | Dark-aware, beam every 2 |
|---|---|---|---|---|---|
| 301–400, every 3rd (the gate, < 60%) | 34 | 32% (11) | 35% (12) | 35% (12) | 32% (11) |
| 401–500, every 2nd (the sprint 15 sweep sample; no unit gate) | 50 | 50% (25) | 54% (27) | 52% (26) | 54% (27) |
| **321–600, lighthouse levels** | 44 | **64% (28)** | **70% (31)** | 70% (31) | 68% (30) |
| 321–600, non-lighthouse levels | 236 | 52% (123) | 52% (123) | – | – |
| lighthouse, 1 spare | 22 | 73% (16) | 82% (18) | 82% (18) | 82% (18) |
| non-lighthouse, 1 spare | 95 | 76% (72) | 76% (72) | – | – |
| lighthouse, 2 spares | 22 | 55% (12) | 59% (13) | 59% (13) | 55% (12) |
| non-lighthouse, 2 spares | 141 | 36% (51) | 36% (51) | – | – |
| lighthouse, 321–400 | 15 | 60% (9) | 67% (10) | – | – |
| non-lighthouse, 321–400 | 65 | 38% (25) | 38% (25) | – | – |
| lighthouse, 401–500 | 17 | 53% (9) | 65% (11) | – | – |
| non-lighthouse, 401–500 | 83 | 45% (37) | 45% (37) | – | – |
| lighthouse, 501–600 | 12 | 83% (10) | 83% (10) | – | – |
| non-lighthouse, 501–600 | 88 | 69% (61) | 69% (61) | – | – |

Notes:
- **Lighthouse levels** means boards that really have a lighthouse jar. Levels 515 and 529 roll one, but the generator's fallback chain builds them without it (already recorded in `jar-mechanics.md` §2.9 and §2.11), so they count as non-lighthouse here. The old player's 28 of 44 agrees with §2.10's 20 of 32 for 322–500 as closely as the different range allows.
- **The dark changes 3 of the 44 lighthouse levels.** 346, 419 and 497 become stuck. No level gets easier. In the what-ifs, 452 is stuck only with the beam every 3, and 497 is stuck with the beam every 4 and every 2 but not every 3. Those flips aren't monotonic, so a change of one board is within this heuristic player's noise.
- **The same board without the dark is the exact control.** The old player ignores the beam, and the beam changes no rule, so the old column is the lighthouse board played as an ordinary board.

## Do the lighthouse levels now look harder than the gates allow?

- **The band gates: no.** 301–400 goes from 32% to 35%, still well below the 60% cap. 401–500 goes from 50% to 54%. It has no unit gate, but it stays below the sprint 15 sweep's 56% for that band and the "today's late rate (about 70%)" the gate's name refers to. Switching the gate test to the dark-aware player would still pass.
- **The lighthouse levels on their own: about at the cap in 321–400.** The gates are for whole bands, not one mechanic. But if you hold the 15 lighthouse levels of 321–400 to the < 60% cap, they are at 60% even with the old player and 67% dark-aware.
- **Most of that excess isn't the dark.** With the old player, which sees the colours, lighthouse levels are already stuck 64% of the time against 52% for the other late levels, and 55% against 36% on two-spare boards. The dark adds about 7 points (3 of 44 boards) on top of that. The likely cause is the board's makeup. The lighthouse comes from its own roll (`shared: false`, D210), so it lands on top of the usual special-jar roll, and lighthouse boards carry more special jars. Matched on spares and special-jar count, the one-special two-spare boards are alike (40% old and 47% dark, against 41%). The two-special two-spare boards are not (86% against 42%, but only 7 boards).

## Recommendation (for the owner to decide; nothing changed)

1. **Leave the beam at every 4.** In this model a more frequent beam barely changes anything: every 3 gives 70% and every 2 gives 68%, against 70% at every 4, a difference of one board or less. The beam isn't where the lighthouse's difficulty comes from.
2. **Leave the lighthouse schedule as is for 0.26.0.** The dark costs about 3 to 4 points on each band and keeps both bands inside their targets. This player has no memory, so that cost is an upper bound.
3. **If the lighthouse levels should feel gentler, change what the jar is stacked with, not the jar itself.** For example, no lighthouse on boards that already have two special jars, or no lighthouse on one-spare boards, where it is stuck 82% of the time dark-aware. That would be a design change (`jar-mechanics.md` §2.10, `levels.ts`) for a future sprint. Fewer lighthouse levels would only move the band rates by a point or so, because lighthouse levels are about 16% of 321–600.
4. **The gates:** keep them on the old player (as now), or switch the 301–400 gate to the dark-aware player. Both pass. Switching would make the gate count the dark.

## Test results

- `npx vitest run tests/unit/balance`: 3 files, 23 tests pass (gentle-climb 10, style-prices 3, sim-player-dark 10).
- `npx tsc --noEmit`: no errors in these files. At the time of the run, the only errors were in another lane's `tests/unit/daily/newer-jars-era.test.ts`.
