# Sprint 7: balance and the scene ladder

> **Status: built (2026-11-08); owner playtest (B8) pending after merge.** B1–B7 done; 351 tests pass. Chosen in the owner interview of 2026-11-08 (decisions D26–D35 in `design/gdd/systems-index.md`). This picks up D23, the economy and difficulty targets deferred in sprint 6.

## Sprint Goal
Give difficulty a measurable target and give coins a lasting purpose. Measure levels 1–200, set a pours-per-band target and enforce it in tests. Design a ladder of about 12 scenes priced to the coin model, and build the first 4. Also build the small decisions from the interview.

## Goal Prerequisites
| Needed to show the goal | Status |
|-------------------------|--------|
| Sprint 6 merged (free Undo, never-failing generation, contrast tests) | Done (PR #2) |
| Owner decisions D26–D35 | Done (interview 2026-11-08) |

## Capacity
Two working sessions. Rigor `standard`: Logic tasks get tests first, seen failing; every visible change gets retained screenshots. There are two owner approval points: the targets (B2) and the ladder (B4).

## Tasks

### Must Have
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| B1 | **Small decisions in code.**<br>D26: unknown shell ids are dropped on load.<br>D28: a debut level gets no spare-jar swap.<br>D30: names are stored NFC-normalised | `save-data.md`, `shell-collection.md`, `jar-mechanics.md`, `player-profile.md` | A failing test first for each. Levels 1–59 stay byte-identical. Only debut levels change (list them) |
| B2 | **Difficulty measurement.** A repeatable sweep of levels 1–200: solution length (pours), solver states, mechanics count, spare swap, fallback step and generation time | `level-generation.md` (GX-13, `solutionLength` unused) | A script in `tools/balance/` and a report in `production/qa/sprint-7/difficulty-sweep.md` with per-band medians and maxima. **The owner approves the pours-per-band targets**, which then become a test |
| B3 | **Economy model.** A simulated player (regular: a few levels plus the daily each day; light; heavy) projects coins over 90 days, with and without booster spending | `economy.md` (GA-ECON-1, GX-11, GX-12) | A script in `tools/balance/` and a report in `production/qa/sprint-7/economy-model.md`: coins by day and by level, and the Extra Jar vs spare-swap check (GX-12) |
| B4 | **Scene ladder design.** About 12 scenes across seasons, weather, holidays and special skies. Each has a price set by B3's model, an animation tier (1 colour-only, 2 one ambient layer, 3 layered and reactive) and, where seasonal, a date window | `scenes.md` (D32, D33) | `scenes.md` updated with the ladder table, the pricing rationale, the season windows and the reduced-motion rule. **The owner approves the ladder and picks the first 4** |
| B5 | **Build the first 4 scenes**, with their animation tiers, the "in season" badge and Match-my-clock switching to holiday scenes on their dates | B4 | Contrast tests pass for every new scene. Animation stops under reduced motion. Screenshots of each scene (home, board, win) in `production/qa/evidence/sprint-7/` |
| B6 | **Docs for the decisions:** pillars and anti-pillars in the brief (D29), the append-only catalog rule (D27), timings recorded as exempt (D31), D26–D35 rows | `game-brief.md`, `shell-collection.md`, `feel-audio-ui.md`, `systems-index.md` | Each doc updated with a Version History row |

### Should Have
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| B7 | **Tune to the targets:** adjust the ramp and economy values in `game-config.json` where B2/B3 fall outside them | B2, B3 | The band test passes. Every change is recorded with its rationale (design-docs rule: balance values link to their formula) |
| B8 | **Owner playtest list:** 8–12 specific levels that sit at band edges or outliers, with what to look for | B2 | `production/qa/sprint-7/playtest-list.md` |

## Out of scope
- Scenes 5–12 of the ladder: designed now, built in later sprints.
- Online features, leaderboards and anything sold for money (anti-pillars, D29).

## Risks
| Risk | Mitigation |
|---|---|
| Animated scenes cost battery or frame rate on older phones | CSS and canvas only, paused when the tab is hidden, stopped under reduced motion; check frame time on a throttled CPU |
| Holiday dates differ by region and culture | Seaside, secular framings (harvest moon, winter lights, New Year fireworks) with wide windows; every scene can be bought any time (D33) |
| Changing debut levels (D28) changes boards some players are on | Only the debut levels change; record them, and they stay solver-proven |
| Retuning prices strands coins players already banked | Prices only apply to scenes not yet owned; owned scenes are kept |

## Definition of Done
- `npm test` green, with new tests seen failing first
- Sweep and economy reports retained; the targets and the ladder approved by the owner
- 4 new scenes built and screenshotted; GDDs updated; pushed and PR opened
