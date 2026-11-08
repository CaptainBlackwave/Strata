# Difficulty sweep, levels 1–200 (sprint 7, B2)

**How to run** (from the repo root, after `npm ci`):

```sh
npx vite-node tools/balance/difficulty-sweep.ts          # levels 1-200, 3 timing runs per level
SWEEP_TO=500 SWEEP_RUNS=1 SWEEP_CSV=/tmp/sweep500.csv npx vite-node tools/balance/difficulty-sweep.ts
```

`SWEEP_CSV` sends a long run somewhere other than the committed 1–200 CSV.

It writes `production/qa/sprint-7/difficulty-sweep.csv` (one row per level) and prints the band
summary this report is built from. It takes about 15–30 s. Every number except generation time is
deterministic. Source: `production/sprints/sprint-7.md` B2; findings GX-13 (`gdd-cross-review.md`)
and `design/gdd/level-generation.md` (`solutionLength` unused).

**Read-only.** No change to `src/` was needed. `solve()` already returns `nodes`, so the script
re-solves the board `generateLevel` returned. That re-solve explores exactly the states of the
generator's final, successful attempt, because the DFS is deterministic and the budget only cuts it
off. The fallback step is read from the spec that `generateLevel` returns.

## What the columns mean

| Column | Meaning |
|---|---|
| `poursCap` | The length cap for the level, `maxPoursFor(level)` from `generator.pourBands` (B7, D36). Added in B7. |
| `pours` | `solutionLength`: the length of the path the DFS solver found. It is **not optimal**: it is the first path found, best-first by a cheap heuristic. |
| `poursLowerBound` | A cheap floor for any player: every same-colour run on the board must move at least once, except one bottom run per colour. A real optimum lies between this and `pours`. |
| `solverStates` | States the solver expanded on the proven board. A proxy for how much search the board needs: few safe moves and many dead ends. |
| `spareSwap`, `swapJar` | The spare-swap ramp (D1) turned a spare into a narrow jar or a funnel. `swapJar` is blank when the level already had that jar. |
| `fallback` | `none`, `secondSpare`, `noMechanics`, `lastResort+1spare` or `fallbackBoard`: the step of the chain in `generateLevel`. |
| `genMs` | Median wall time of `generateLevel` over 3 runs, Node on the dev container (desktop class). A phone is probably 3–5× slower. |

## Per-band results (B2, before the length cap)

This table is the B2 baseline the owner decided D36 on. For the shipped numbers after the B7
length cap, see [After the cap](#after-the-cap-b7-d36). The CSV is the after-cap sweep.

| Band | Pours median | p90 | max (level) | Floor median | States median | p90 | max (level) | Gen ms median / max | Mechanics (combos) | Spare swap | Fallbacks |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1–20 | 24 | 35 | 44 (20) | 17.5 | 28.5 | 42 | 49 (9) | 0.3 / 0.9 | 0 (0) | 0 | 0 |
| 21–40 | 43 | 49 | 57 (29) | 30 | 52.5 | 97 | 466 (37) | 0.8 / 7.8 | 4 (0) | 0 | 0 |
| 41–60 | 47.5 | 55 | 59 (55) | 36 | 76.5 | 133 | 210 (56) | 1.0 / 2.7 | 8 (0) | 0 | 0 |
| 61–80 | 48.5 | 55 | 59 (76) | 37.5 | 120.5 | 591 | 5,328 (69) | 2.3 / 198 | 10 (2) | 6 | 0 |
| 81–100 | 50.5 | 60 | 72 (93) | 39 | 125.5 | 783 | 4,222 (92) | 2.6 / 122 | 14 (1) | 7 | 0 |
| 101–120 | 52 | 59 | 64 (114) | 40.5 | 241 | 1,511 | 3,348 (104) | 6.7 / 344 | 14 (4) | 8 | 0 |
| 121–150 | 55 | 64 | 69 (135) | 43 | 190.5 | 2,506 | 8,683 (131) | 6.7 / 805 | 25 (10) | 20 | 1 (141, `secondSpare`) |
| 151–200 | 56 | 66 | 73 (153, 161) | 44 | 260.5 | 1,157 | 11,634 (185) | 7.2 / 360 | 44 (11) | 34 | 0 |

Mechanic counts per band: 21–40 narrow 4 · 41–60 frozen 5, narrow 3 · 61–80 narrow 7, locked 4,
frozen 1 · 81–100 narrow 6, funnel 5, frozen 3, locked 1 · 101–120 narrow 6, funnel 6, locked 5,
frozen 1 · 121–150 narrow 13, funnel 11, locked 7, frozen 6 · 151–200 narrow 23, funnel 19,
frozen 7, locked 7.

Pours by board shape (normal levels; the tall-jar levels are their own row):

| Shape | Levels | Pours median | Floor median | States median |
|---|---|---|---|---|
| 3–5 colours | 7 | 11–19 | 7–15 | 11–19 |
| 6–8 colours | 11 | 23–31 | 16–25 | 30–40 |
| 9 colours | 7 | 38 | 28 | 40 |
| 10–11 colours | 15 | 43–46 | 30–35 | 62–92 |
| 12 colours, 2 spares | 31 | 48–50 | 37–39 | 74–95 |
| 12 colours, spare swap | 10 | 51–52 | 37–38 | 176–1,438 |
| 13 colours (2 spares / swap) | 36 | 52 / 54 | 40 | 152 / 249 |
| 14 colours (2 spares / swap) | 63 | 56 / 57 | 44 | 146 / 370 |
| Tall jar (5 × 8) | 20 | 47.5 (max 58) | 31 | 48.5 |

## Spikes

1. **The biggest step in length is at 21, not 75–101.** The median goes from 24 to 43 pours between
   1–20 and 21–40, as colours go 8 → 9 (21) → 10 (28) and narrow debuts. After 40 the length grows
   slowly: about +1 pour per band. The tall-jar levels are long from the start: level 10 needs
   42 pours, and level 40 needs 56.
2. **Around 75–101 (GX-13) the levers barely move the length.** 3 buried layers at 75 add no
   pours (12 colours: 48 at depth 2, 49.5 at depth 3). 13 colours at 90 add about 3. Level 100's
   tall jar rolled no mechanic, so the first tall-jar level with mechanics is 110 (frozen+locked,
   45 pours, but it took 19 deals to find). The first planned combo is at 103. **What does move is
   search effort.** The p90 solver states go from 133 (41–60) to 591 (61–80) and 783 (81–100), with
   maxima of 5,328 at 69 and 4,222 at 92. Every one of these is a spare-swap level. With 12 colours,
   swap boards need a median of 1,438 states against 95 without the swap. The difficulty jump past 60
   is "fewer safe moves", not "more moves".
3. **The spare swap makes combos before `comboFrom`, and triples later.** It adds a narrow or funnel
   to a level that already rolled a mechanic. That gives 77 and 88 locked+narrow (combos before 101),
   and 136, 141 and 167 with **three mechanics**, which no document describes. `jar-mechanics.md`
   caps combos at two.
4. **Single-level outliers in length:** 93 (72 pours, 13 colours + narrow), 153 and 161 (73), 177
   (71), 156 (70). All are narrow-jar boards. The narrow jar lengthens the solver's path most.
5. **Generation time.** The median stays under 8 ms, but the swap levels have a long tail: 141
   takes 805 ms (the only fallback in 1–200, to `secondSpare`), 135 takes 465 ms, and 176, 185 and
   109 take 340–360 ms. On a phone, 141 could take 2–4 s before the board appears. Worth a look in
   B7 (a lower `ramp.spareOne.maxAttempts`, or a precomputed seed).

## Proposed pours-per-band target (for owner approval)

**Assumption:** a player takes **4–6 s per pour** (5 s is the midpoint), counting the look-ahead
between pours. The brief's "1–3 minute bites" is then **12–36 pours at 5 s**, and 45 pours at the
fast end (4 s).

The target is stated in **solver pours** (`solutionLength`), because that is deterministic and
testable. A human's pour count differs. A good player beats the solver's path, but stays above the
floor. An average player also makes exploratory pours and undoes. So solver pours are a fair
middle estimate.

| Band | Measured median / max | **Target median** | **Target max** | At 5 s per pour |
|---|---|---|---|---|
| 1–20 | 24 / 44 | **≤ 25** | **≤ 40** | median about 2 min |
| 21–40 | 43 / 57 | **≤ 30** | **≤ 42** | 2.5 min |
| 41–60 | 47.5 / 59 | **≤ 34** | **≤ 45** | 2.8 min |
| 61–200 (each band) | 48.5–56 / 59–73 | **≤ 36** | **≤ 48** | 3 min, worst about 4 min |
| Tall-jar levels (every 10th) | 47.5 / 58 | **≤ 40** | **≤ 50** | an "event" level, about 3.3 min |

**Rationale.** The median should end at the top of the brief's bite (3 min at 5 s = 36 pours) and
then **stay flat**. Past 60, difficulty should come from the spare swap, the mechanics and burial
(search effort, which the states column shows is already rising), not from length. The max allows
one long level in about ten, at about 4 minutes.

**What the target implies (input for B7, not a change made here).** Today every band from 21 is over
target, and even the **floor** passes 36 pours at 12 colours (37–39). Holding the target needs fewer
units per board, not a smarter solver. From the shape table, about **8–9 colours at capacity 4**
(median 31–38), with burial, mechanics and the swap carrying difficulty past 40. Tall jars need about
4 colours × 8, or 5 × 7.

**The other option for the owner:** keep the current curve and change the brief's bite past
level 40 to "3–5 minutes" (target median ≤ 56, max ≤ 70, which today's curve meets except 153 and
161). Either way, the approved numbers become the B7 band test.

## After the cap (B7, D36)

The owner chose to keep the boards and change the brief (D36): 1–3 minute bites early, 3–5 minutes
from level 40. The targets are now config (`generator.pourBands`), and the `max` is enforced at
generation. A solver-proven deal over its band's max is rejected like an unwinnable one and the
next attempt is dealt. `tests/unit/core/difficulty-bands.test.ts` generates levels 1–200 and checks
every band.

**Boards that changed in 1–200.** Four levels, not the two D36 names: 93 and 177 were over 70 as
well (spike 4 above). All four were re-dealt from their own recipe, with the same spec, the same
mechanics and no fallback step. Levels 1–59 are byte-identical (every one, not only the plain
levels the fixture guards).

| Level | Before (pours) | After (pours) | Deal used | Mechanics | Gen ms after |
|---|---|---|---|---|---|
| 93 | 72 | 61 | 4th | narrow | 9 |
| 153 | 73 | 55 | 2nd | narrow (spare swap) | 46 |
| 161 | 73 | 57 | 2nd | narrow (spare swap) | 66 |
| 177 | 71 | 66 | 3rd | narrow | 13 |

The daily uses the same cap at the last band's max (70). In a full year of dailies (2026) one date
changed: 2026-09-26 (Saturday, 71 → 41 pours, 2nd deal). The longest daily is now 68 pours.

**D36 bands after the cap** (levels 1–200):

| Band | Median (target) | p90 | Max (target) | Over max |
|---|---|---|---|---|
| 1–20 | 24 (≤ 25) | 35 | 44 (≤ 45) | none |
| 21–40 | 43 (≤ 45) | 49 | 57 (≤ 58) | none |
| 41–200 | 53 (≤ 56) | 62 | 70 (≤ 70, level 156) | none |

Only two sweep bands moved: 81–100 now has a max of 62 (94), was 72 (93), and 151–200 has a p90
of 64 and a max of 70 (156), was 66 and 73. Its median stays 56, and its states median goes from
260.5 to 252.5. Every other number in the B2 table is unchanged, apart from generation time.

**Headroom.** The 1–20 and 21–40 bands are within a pour of their max (44/45, 57/58), and level
156 sits exactly on 70. A small change to the curve or the solver could push these over. The band
test will catch that, and the cap will re-deal levels from 41 on. Levels 1–40 would be re-dealt
too, which would break the byte-identical guarantee for 1–59.

## Caveats

- `pours` depends on the solver's move order. A change to `orderedMoves` changes every number, and
  which boards the length cap re-deals, so the band test
  (`tests/unit/core/difficulty-bands.test.ts`) must be re-baselined whenever the solver changes.
- `genMs` was measured on one desktop-class container. Treat it as relative.
- Levels past 200 are not measured. The economy model's regular player reaches level 720 by day 90
  (see `economy-model.md`), so a sweep to 500 would be worth running once (`SWEEP_TO=500`).
