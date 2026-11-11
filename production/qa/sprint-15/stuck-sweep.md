# Stuck-rate sweep: the gentle climb to level 500 (sprint 15, 0.14.1)

**Why:** players still got stuck from level 40 and leaned on boosters (D125). The solver-pour measure of 0.13.1 missed it, because the solver sees buried sand and never gives up. This sweep uses a **simulated player** instead (D132).

**The simulated player** (`tools/balance/sim-player.ts`): orders pours by what a person can see, never looks at buried sand, backs out with free Undo, and gives up after 150 pours and Undos. Giving up stands for "stuck, would need a booster". When it is stuck, the sweep counts Hints: the fewest first moves of the solver's path that let it win from there (capped at 30). It is a stand-in, not a person; use it to compare curves.

**How to run** (from the repo root):

```sh
npx vite-node tools/balance/stuck-sweep.ts                          # the shipped config
SWEEP_CONFIG=/path/to/old/game-config.json npx vite-node tools/balance/stuck-sweep.ts
```

Every other level from 1 to 500. Deterministic: the same config always gives the same numbers. Raw output: `stuck-sweep-0.14.0.txt`, `stuck-sweep-0.14.1.txt`.

## Before and after

| Levels | 1–40 | 41–80 | 81–150 | 151–200 | 201–300 | 301–400 | 401–500 |
|---|---|---|---|---|---|---|---|
| Stuck, 0.14.0 | 0% | 40% | 49% | 68% | 76% | 76% | 80% |
| Stuck, 0.14.1 | 0% | 0% | 0% | 12% | 14% | 42% | 56% |
| Hints per 100 levels, 0.14.0 | 0 | 515 | 646 | 1,084 | 1,388 | 1,460 | 1,560 |
| Hints per 100 levels, 0.14.1 | 0 | 0 | 0 | 100 | 162 | 496 | 772 |

The test `tests/unit/balance/gentle-climb.test.ts` holds the targets on a sample: at most 5% stuck to 150, 15% at 151–200, 30% at 201–300, and under 60% at 301–400.

## What the stuck boards had in common (0.14.0)
Every stuck board up to 200 had two or more buried layers; none had one. 60% had one ordinary empty jar (the spare-jar swap). With those fixed, the next cause was board size: 11 colours with two empty jars stalled it even with one buried layer and no special jar. So the curve moves all three, and colours most of all.

## The curve (0.14.1)

| | Colours | Buried | Spare swap | Special jars |
|---|---|---|---|---|
| 1–29 | unchanged | unchanged | none | debuts from 21 |
| 30–69 | 9 | 1 | none | 1 in 3 |
| 70–149 | 10 | 1 | none | 1 in 3 |
| 150–249 | 10 | 2 | none | 1 in 3 |
| 250–339 | 11 | 2 | from 300: 10%, rising | 1 in 3 rising; two on a board from 250 |
| 340–419 | 12 | 2 | rising | rising |
| 420–489 | 13 | 2 (3 from 450) | rising | rising |
| 490+ | 14 | 3 | 75% from 500 | 1 in 2 from 500 |

Tuning, kept for the record: a first try put 11 colours at 220 and 12 at 300; levels 201–250 were 22% stuck and 301–400 68%. Moving 11 to 250, 12 to 340, 13 to 420 and 14 to 490, and the swap to 300, gave the smooth climb above.

Breathers (every level ending in 3 or 8), tall-jar levels, pour caps, the daily and the weekly are unchanged; their fixture tests pass untouched.

## What this does not show
- **People.** The testers who reported it should replay 40–150 on a phone.
- **Past 500.** The last curve row holds: today's hardest boards stay as they are.
