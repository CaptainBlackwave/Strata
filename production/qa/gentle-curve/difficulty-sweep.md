# Difficulty sweep after the gentler curve (D104–D111, 0.12.1, 2026-11-11)

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
| Breather levels | none | from 21, levels ending in 3 or 8: two fewer colours (three from 101), both ordinary spares, one special jar at most | D106, D110 |
| Hidden sand | 2 layers from 12, 3 from 75 | 1 layer until 30, 2 from 30, 3 from 110 | D107 |
| Tall jars | 4 × 8 at 10, 5 × 8 from 20 | 4 × 8 through 40, 5 × 8 from 50; never over 50 pours | D108, D111 |
| Pour caps | 45 (1–20), 58 (21–40), 70 (41+) | 45 (1–20), 48 (21–40), 58 (41–100), 70 (101+) | D108 |

Unchanged: levels 1–11, mechanic unlock levels and chances, the spare-jar swap ramp, the daily and the weekly (the weekly's `bandLevel` values moved to the rows that carry their old caps, and its fixture test still passes).

## Before and after

"Before" is the shipped generator at commit `f87f7f1` (hourglass and sieve included), measured the same way.

| Levels | Median pours before | after | Longest before | after | Breather median | Median solver states before | after |
|---|---|---|---|---|---|---|---|
| 1–10 | 18.5 | 18.5 | 32 | 32 | – | 18.5 | 18.5 |
| 11–20 | 29.5 | 28.5 | 44 | 37 | – | 36.5 | 30 |
| 21–30 | 38 | 31 | 57 | 41 | 21.5 | 47.5 | 35 |
| 31–40 | 44 | 34 | 56 | 42 | 24 | 69 | 35 |
| 41–60 | 47.5 | 36 | 59 | 51 | 30.5 | 76.5 | 54 |
| 61–80 | 48.5 | 39 | 59 | 54 | 31.5 | 120.5 | 93.5 |
| 81–100 | 50.5 | 44 | 62 | 53 | 37 | 125.5 | 57.5 |
| 101–130 | 54 | 45 | 65 | 61 | 37 | 169.5 | 116 |
| 131–170 | 54.5 | 50 | 69 | 70 | 38.5 | 323 | 102.5 |
| 171–200 | 57.5 | 55 | 69 | 69 | 44 | 242.5 | 211 |

Reading it:
- The climb is now roughly even: about +3 to +5 median pours per range all the way to 200, instead of +20 by level 35 and almost nothing after.
- Levels 171–200 are as long as before, so the late game is not easier.
- Breathers are about 6–12 pours shorter than the range median at every stage. Before D110, late breathers were not: 45.5 pours against 46 in 101–130, because a two-fewer breather still had 10 colours and could roll two special jars.

## Tall-jar levels

| Level | 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 | 120 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Shape | 4 × 8 | 4 × 8 | 4 × 8 | 4 × 8 | 5 × 8 | 5 × 8 | 5 × 8 | 5 × 8 | 5 × 8 | 5 × 8 | 5 × 8 |
| Pours before | 32 | 44 | 48 | 56 | 45 | 55 | 58 | 43 | 40 | 44 | 61 |
| Pours after | 32 | 37 | 28 | 34 | 45 | 46 | 38 | 43 | 40 | 44 | 49 |

The 50-pour cap (D111) changed 15 of the 46 tall-jar levels from 50 to 500; the rest kept their boards. None lost a special jar to the cap. Three (300, 360, 460) fall back to no special jars with or without it, as before.

## Pour bands (enforced by `tests/unit/core/difficulty-bands.test.ts`)

| Band | Median | Target | Longest | Cap |
|---|---|---|---|---|
| 1–20 | 23.5 | 25 | 37 | 45 |
| 21–40 | 34 | 36 | 42 | 48 |
| 41–100 | 39.5 | 44 | 54 | 58 |
| 101–200 | 49 | 56 | 70 | 70 |

## Generation health

- Every level 1–200 generated and was solver-proven. Two used the easier-spare fallback (147 and 172; 172 did before as well).
- Worst generation time: about 1.3 s at level 172 on the dev container, the same level and about the same time as before. Median 0.3–6 ms.

## What this does not show

- **Feel.** Nobody has played the new levels 20–60 on a phone yet. The sweep counts solver pours; a person's experience also depends on hidden sand and dead ends. The testers who raised the complaint are asked to retry (D114).
- **Levels past 200.** The recipe past 170 is the same as before apart from breathers and the tall-jar cap, so nothing new is expected, but this run stops at 200.
