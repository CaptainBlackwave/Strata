# Difficulty sweep after the gentler curve (D104–D109, 2026-11-11)

**Why:** players said levels from 20 were too hard. The sprint-7 sweep had already named the cause: the biggest step in level length was at 21, where a ninth colour, the first mechanic, a higher pour cap and two hidden layers all arrived within a few levels of each other. Levels doubled in length between 15 and 30, then barely changed.

**How to run** (from the repo root, after `npm ci`):

```sh
SWEEP_CSV=production/qa/gentle-curve/difficulty-sweep.csv npx vite-node tools/balance/difficulty-sweep.ts
```

The CSV beside this file is that run (levels 1–200, one row per level). Every number except generation time is deterministic. Columns are explained in `production/qa/sprint-7/difficulty-sweep.md`. "Pours" is the length of the first path the solver finds, not the optimum, and not a measure of how a board feels.

## What changed

| Lever | Before | After | Decision |
|---|---|---|---|
| Colours | 8 at 16, 9 at 21, 10 at 28, 11 at 36, 12 at 45, 13 at 90, 14 at 130 | 8 at 18, 9 at 30, 10 at 45, 11 at 65, 12 at 95, 13 at 130, 14 at 170 | D105 |
| Breather levels | none | from 21, levels ending in 3 or 8: two fewer colours, both ordinary spares | D106 |
| Hidden sand | 2 layers from 12, 3 from 75 | 1 layer until 30, 2 from 30, 3 from 110 | D107 |
| Tall jars | 4 × 8 at 10, 5 × 8 from 20 | 4 × 8 through 40, 5 × 8 from 50 | D108 |
| Pour caps | 45 (1–20), 58 (21–40), 70 (41+) | 45 (1–20), 48 (21–40), 58 (41–100), 70 (101+) | D108 |

Unchanged: levels 1–11, tall-jar levels from 50, mechanic unlock levels and chances, the spare-jar swap ramp, the daily and the weekly (the weekly's `bandLevel` values moved to the rows that carry their old caps, and its fixture test still passes).

## Before and after

"Before" is the shipped generator at commit `f87f7f1` (hourglass and sieve included), measured the same way.

| Levels | Median pours before | after | Longest before | after | Breather median | Median solver states before | after |
|---|---|---|---|---|---|---|---|
| 1–10 | 18.5 | 18.5 | 32 | 32 | – | 18.5 | 18.5 |
| 11–20 | 29.5 | 28.5 | 44 | 37 | – | 36.5 | 30 |
| 21–30 | 38 | 31 | 57 | 41 | 21.5 | 47.5 | 35 |
| 31–40 | 44 | 34 | 56 | 42 | 24 | 69 | 35 |
| 41–60 | 47.5 | 36 | 59 | 55 | 30.5 | 76.5 | 54.5 |
| 61–80 | 48.5 | 39.5 | 59 | 58 | 31.5 | 120.5 | 93.5 |
| 81–100 | 50.5 | 44 | 62 | 53 | 37 | 125.5 | 57.5 |
| 101–130 | 54 | 46 | 65 | 61 | 45.5 | 169.5 | 125 |
| 131–170 | 54.5 | 50.5 | 69 | 70 | 42 | 323 | 123 |
| 171–200 | 57.5 | 55 | 69 | 69 | 48.5 | 242.5 | 244.5 |

Reading it:
- The climb is now roughly even: about +3 to +5 median pours per range all the way to 200, instead of +20 by level 35 and almost nothing after.
- Levels 171–200 are as long as before, so the late game is not easier.
- Breathers are about 6–10 pours shorter than the range median up to level 100. From 101 the gap narrows (45.5 against 46 in 101–130), because a breather there still has 10 colours and can roll two mechanics. If late breathers should stay clearly easier, raise `breather.fewerColors` or stop them rolling a second mechanic.

## Tall-jar levels

| Level | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 |
|---|---|---|---|---|---|---|---|---|
| Shape | 4 × 8 | 4 × 8 | 4 × 8 | 4 × 8 | 5 × 8 | 5 × 8 | 5 × 8 | 5 × 8 |
| Pours before | 32 | 44 | 48 | 56 | 45 | 55 | 58 | 43 |
| Pours after | 32 | 37 | 28 | 34 | 45 | 55 | 58 | 43 |

Levels 60 and 70 (55 and 58 pours) are still about 15 pours above the levels around them. That is inside the 58 cap and they are meant as event levels, but they are the next thing to look at if complaints move to 60+.

## Pour bands (enforced by `tests/unit/core/difficulty-bands.test.ts`)

| Band | Median | Target | Longest | Cap |
|---|---|---|---|---|
| 1–20 | 23.5 | 25 | 37 | 45 |
| 21–40 | 34 | 36 | 42 | 48 |
| 41–100 | 40 | 44 | 58 | 58 |
| 101–200 | 51 | 56 | 70 | 70 |

## Generation health

- Every level 1–200 generated and was solver-proven. Two used the easier-spare fallback (147 and 172; 172 did before as well).
- Worst generation time: 1,123 ms at level 172 on the dev container (1,290 ms before). Median 0.3–6 ms.

## What this does not show

- **Feel.** Nobody has played the new levels 20–60 on a phone yet. The sweep counts solver pours; a person's experience also depends on hidden sand and dead ends.
- **Levels past 200.** The recipe past 170 is the same as before, so nothing new is expected, but this run stops at 200.
