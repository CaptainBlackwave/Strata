# Sprint 15: a gentle climb to level 500

> **Status: proposed (2026-11-11), waiting for the owner's approval of this plan.** Nothing is built. From the owner interview after 0.14.0 (D125–D133 in `design/gdd/systems-index.md`). Target release: **0.14.1**, one PR (D133).

## Why
Players still get stuck from level 40 and only get through by using boosters too often (D125). The 0.13.1 curve fixed the climb between 20 and 45, but its solver-pour measure missed the problem: the solver sees every hidden unit and never gives up.

A **simulated player** prototype confirms the reports. It sees only what a person sees, uses free Undo to back out of dead ends, and gives up after 150 moves and undos ("would need a booster"). On today's levels (0.14.0):

| Levels | 1–40 | 41–60 | 61–80 | 81–100 | 101–150 | 151–200 | 201–300 | 401–500 |
|---|---|---|---|---|---|---|---|---|
| Stuck today | 0% | 15% | 40% | 30% | 54% | 62% | 71% | 73% |

Every stuck board up to 200 had two or more hidden layers (none had one), and 60% had only one ordinary empty jar. Once those are fixed, the next cause is board size: 11 colours with two empty jars.

## Goal
Players enjoy levels up to about 150 without boosters, and meet today's hardest boards only around level 400–500 (D126). Boosters stay as they are (D127).

## The plan (all in `src/config/game-config.json`)

| Lever | Today (0.13.1) | Planned | Decision |
|---|---|---|---|
| Colours | 9 at 30, 10 at 45, 11 at 65, 12 at 95, 13 at 130, 14 at 170 | 9 at 30, 10 at 70, 11 at ~220, 12 at ~300, 13 at ~380, 14 at ~470 | D128 |
| Hidden sand | 1 layer to 30, 2 from 30, 3 from 110 | 1 layer to 150, 2 from 150, 3 from ~420 | D129 |
| Empty jar swap (a spare becomes a narrow jar or funnel) | from 60: 20% rising to 75% at 150 | from ~250: 10% rising to 75% at 500 | D130 |
| Special jars | debuts 21–181; 1 in 3 levels rising to 1 in 2 at 120; two on a board from 101 | debuts unchanged; 1 in 3 until 250, rising to 1 in 2 at 500; two on a board from 250 | D131 |
| Breathers, tall jars, pour caps, daily, weekly | as 0.13.1 | unchanged (pour caps re-checked) | — |

Exact level numbers marked "~" are tuned during the build against the targets below.

**Measured with the prototype (planned curve):**

| Levels | 1–100 | 101–150 | 151–200 | 201–300 | 301–400 | 401–500 |
|---|---|---|---|---|---|---|
| Stuck, planned | 0% | 0% | 12% | 32% | 62% | 68% |

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| G1 | **Simulated player** in `tools/balance/` and a test: the prototype made repeatable, with its patience and move ordering written down | Same result every run; the report lists stuck rates per band, today and planned |
| G2 | **Curve changes** above, test first | Targets met (below); levels 1–29 keep their boards; daily and weekly byte-identical |
| G3 | **Booster counts**: a run that uses Hint when the simulated player is stuck, counting boosters per band (D132) | Reported per band, today against planned |
| G4 | **Saves**: best pours reset once for changed levels (D110 rule, a new `boardChanges` row) | Level, coins, shells, Perfect marks kept (test) |
| G5 | **Docs and evidence**: `level-generation.md`, the decision log, a sweep report, screenshots | As 0.13.1 |
| R1 | **0.14.1**: What's new line about the gentler climb and the reset | Upgrade play-through |

## Targets (simulated player, patience 150)
- Levels 1–150: stuck on at most 1 board in 20 (5%).
- 151–200: at most 15%. 201–300: at most 30%.
- Reaches today's late rate (about 70%) no earlier than level 400.
- No band is harder than the one after it by more than 5 points (a smooth climb).

## What this does not show
- The simulated player is a stand-in, not a person. It plays worse than a careful player and better than a hurried one; the targets compare curves, not exact player experience. The testers' phone run stays the real check.
- Levels past 500 keep the curve's last row: the hardest boards then stay as they are.

## Out of scope
- Booster prices or charges (D127). New mechanics, scenes or styles.
