# Sprint 3: new jar mechanics and offline install

> **Status: complete (2026-11-08).** Evidence: `production/qa/evidence/sprint-3/`. All Must Have and Should Have tasks are done, plus T11. T12 is covered by the Jar guide, which shows "Unlocks at level N". Deviation: T8 has no "tap to refresh" toast; the page is network-first instead, so every launch with signal loads the latest deploy and the toast isn't needed.

## Sprint Goal
Give long-term players something new every 20 levels (four jar mechanics, each introduced with a
short card) and make the home-screen app work with no signal.

## Goal Prerequisites
| Needed to show the goal | Status |
|-------------------------|--------|
| Owner decisions on mechanics, pacing, mixing, daily and the frozen rule | Done: S3-1 to S3-6 below (interview 2026-11-08) |
| Sprint 2 live (daily, collection) | Done |

## Milestone Context
Roadmap items **C8** (new mechanics) and **C9** (offline install) in `design/competitive-roadmap.md`.
C10 (time-of-day theme scenes) is next sprint. C11 (backend social) is deferred.

## Capacity
Working sessions with Claude Code, about 2 sessions. Game Studios rigor `minimal`: the brief and roadmap
are the design record. Each mechanic ships with unit tests (the solver must prove every level
winnable) and retained phone screenshots.

## Decisions (owner interview)
| ID | Decision |
|---|---|
| S3-1 | Build **all four** mechanics: Narrow jar, Frozen jar, Locked lid, One-way funnel |
| S3-2 | Unlock **every 20 levels, easiest first**: Narrow 21, Frozen 41, Locked 61, Funnel 81 |
| S3-3 | After unlock, each mechanic appears in **about 1 in 3 levels**. Two can combine **after level 100** |
| S3-4 | **Saturday's daily** features one mechanic (rotating), Sunday stays tall jars, Mon–Fri stay plain |
| S3-5 | Frozen jars **thaw when any jar seals** (all frozen jars at once) |
| S3-6 | Next sprint: **time-of-day scenes** (Dawn, Midday, Sunset, Moonlit tide), ~300–800 coins each. Backend social is **deferred** |

## Mechanic rules (as built)
| Mechanic | Rule | Reads as |
|---|---|---|
| **Narrow jar** | An extra jar holding 2 units. It never seals, so it must end empty: working space with a catch | A short, slim tube |
| **Frozen jar** | Starts iced: it can't be poured into or out of. It thaws the moment any jar seals | Frosted glass with a crack animation on thaw |
| **Locked lid** | A padlock in colour X: closed to pours in and out until a jar of colour X is sealed | A coloured padlock on the rim |
| **One-way funnel** | An extra empty jar you can pour into but never out of. It seals as normal when full of one colour, so a mixed funnel is a dead end (undo exists) | A funnel on the rim, striped glass |

## Tasks

### Must Have (Critical Path)
| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|-------------------|
| T1 | **Board model v2**: per-jar capacity plus jar state (`frozen`, `lock` colour, `funnel`). Rules, win/stuck checks, solver state key, shuffle and hint respect it | gameplay-programmer | 0.5 | — | All 94 existing tests still pass. New rule tests for each state. Boards without mechanics are unchanged |
| T2 | **Mechanic placement in the generator**: a separate RNG stream adds mechanics after the base deal, so plain levels stay the same. Data-driven in `game-config.json` (`mechanics.unlockAt`, `chance`, `comboFrom`) | gameplay-programmer | 0.5 | T1 | Levels 1–20 unchanged. Every level 21–200 is solver-proven winnable. About 1/3 of levels use a mechanic after it unlocks. Combos only after level 100 |
| T3 | **Narrow jar** (rules + art) | gameplay + ui | 0.25 | T1, T2 | Level 21 shows a narrow jar. Screenshot evidence |
| T4 | **Frozen jar** (rules, frost art, thaw animation + sound) | gameplay + ui | 0.4 | T1, T2 | Pours into or out of a frozen jar are refused with a nope. Sealing any jar thaws all frozen jars. Tests + screenshots |
| T5 | **Locked lid** (rules, padlock art in the lock colour, unlock pop) | gameplay + ui | 0.4 | T1, T2 | Locked until that colour seals. Patterns mode shows the lock's pattern too (colour-blind). Tests + screenshots |
| T6 | **One-way funnel** (rules, funnel art) | gameplay + ui | 0.3 | T1, T2 | It can't be lifted. Pours into it work. Stuck detection still correct. Tests + screenshots |
| T7 | **Intro cards**: the first level with each mechanic shows a one-line card with a mini illustration | ui-programmer | 0.3 | T3–T6 | Shown once per mechanic (saved), replayable from Settings |
| T8 | **Offline install**: a service worker caches the built app. A new version installs in the background, with a "New version: tap to refresh" toast | devops / ui | 0.4 | — | With the network off after the first visit, the game loads and plays. A new deploy is picked up on the next launch |

### Should Have
| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|-------------------|
| T9 | **Saturday daily mechanic**: rotates through the four, seeded by date | gameplay-programmer | 0.2 | T2 | 8 weeks of Saturdays all solvable. Mon–Fri boards unchanged |
| T10 | **Hint and shuffle with mechanics**: shuffle never moves frozen or locked jars' contents; hint plans around locks | gameplay-programmer | 0.2 | T1 | Following hints still always wins (regression test extended to mechanic levels) |

### Nice to Have
| ID | Task | Agent/Owner | Est. Days | Dependencies | Acceptance Criteria |
|----|------|-------------|-----------|-------------|-------------------|
| T11 | Update the GitHub Actions versions (Node 20 deprecation warning) | devops | 0.1 | — | The deploy run shows no deprecation warning |
| T12 | "Level map" peek on the home screen showing when the next mechanic arrives | ui-programmer | 0.3 | T2 | e.g. "New jar at level 41" |

## Carryover from Previous Sprint
| Task | Reason | New Estimate |
|------|--------|-------------|
| — | Nothing carried over; sprint 2 is complete | — |

## Risks
| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Locks and funnels blow up the solver's search (slow generation or unsolvable deals) | Medium | High | Lock and funnel state goes into the solver key. Re-deal on budget overrun. Sweep levels 21–500 for timing (target: under 0.5 s worst case) |
| Players mid-campaign see their current level change shape at 21+ | High | Low | Placement uses a separate RNG stream, so only levels that gain a mechanic change. Note it in the patch notes |
| A mixed one-way funnel feels unfair | Medium | Medium | The intro card warns about it, the stuck toast suggests Undo, and the hint never routes into a dead funnel |
| Service worker serves stale builds after a deploy | Medium | Medium | Versioned cache name per build, "tap to refresh" toast, and network-first for `index.html` |

## Dependencies on External Factors
None. No backend, no new hosts, no paid services.

## Definition of Done for this Sprint
- All Must Have tasks complete, and `npm test` green (existing + new tests), including a solvability sweep for levels 1–200
- Retained phone screenshots for each mechanic, each intro card and the offline load, in `production/qa/evidence/sprint-3/`
- Deployed to GitHub Pages through the normal push to `main`
- `design/competitive-roadmap.md` updated (C8, C9 marked done)
