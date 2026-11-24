# Sprint 30: The new jars come to the daily and weekly (0.26.0)

> **Status: planned (2026-11-24).** From the owner's interview on the open Beads items on 2026-11-24 (Beads `strata-qym`, `strata-m4f`; decisions D228–D233). Design: `design/gdd/daily-puzzle.md` §3.3, `design/gdd/weekly-set.md` §3.3, `design/gdd/jar-mechanics.md` §2.7–§2.11. Evidence: `production/qa/evidence/sprint-30/`. Target: **0.26.0**.

## Why
Five mechanics only appear on numbered levels so far: wet sand (201), the tide jar (241), the crab (281), the lighthouse jar (321) and the sunrise and sunset jars (361). The Saturday daily and the weekly themes still use only the four classic jars, the hourglass, the sieve and the clam. The owner chose to bring all five newer mechanics into both (D228). The sprint also fixes a known gap in the balance numbers: the simulated player can see a dark lighthouse jar's colours (D232).

## The rules
### Saturday daily (D228, D229)
- A new era of `daily.saturdayFrom` adds the five newer mechanics. They come first, in debut order, and the existing rotation follows:
  - wet sand, tide jar, crab, lighthouse jar, sunrise and sunset jars;
  - then hourglass, sieve, clam, narrow, frozen, locked, funnel.

  That is 12 Saturdays per cycle.
- The Saturday board keeps its recipe: 10 colours, capacity 4, 2 spares, buried depth 2, plus the featured mechanic on its own.
  - The sunrise and sunset jars add their two empty jars, so that board has 14 jars.
  - Every featured mechanic uses the same placement as on the levels (§2.7–§2.11).
  - The tide, crab and narrow give-way rule (D226) doesn't apply, because a Saturday board has only one mechanic.
- If a Saturday board can't be built with its mechanic, the daily fallback chain (TD-5) is used, as now. N2 measures how often that happens.
- A player who hasn't reached a mechanic's level yet sees its intro card first (D2, as for every mechanic today).
### Weekly themes (D228, D229, D230)
- A new era of `weekly.themesFrom` follows the same order: the five new themes, then the existing eight. That is 13 weeks per cycle.
- Theme names:
  - wet sand: **Rain on the Dunes**
  - tide jar: **High Water**
  - crab: **Crab Walk**
  - lighthouse jar: **Night Watch**
  - sunrise and sunset jars: **Dawn to Dusk**
- The weekly's five boards (5 to 9 colours) each carry the week's mechanic, as the existing themes do.
### Start dates (D229; please confirm)
- **Proposed:** Saturday **2026-12-19** and ISO week **2026-W52** (Monday 2026-12-21).
  - **Why those dates:** the current era starts this Saturday, 2026-11-28, and opens with the hourglass (11-28), the sieve (12-05) and the clam (12-12). The weekly opens the same way, in W49, W50 and W51. These dates let each of those three have its first turn before the new era begins.
  - **Condition:** 0.26.0 must ship before 2026-12-19. If it slips, both dates move to the first Saturday and ISO week after the release. A date already played is never moved.
- No daily or weekly before those dates changes. The fixtures (`daily-saturdays.json`, `daily-weekly-pins.json`, `weekly-boards.json`) change only from them on.
### Events (D231)
- Seasonal event boards stay plain, with no special jars (D144, kept).
### Balance simulator (D232)
- `tools/balance/sim-player.ts` treats a dark lighthouse jar's sand like buried sand, so it is unknown until the beam lights it or the jar is sealed.
- Then the stuck rates for 301–400 and 401–500, and for the lighthouse levels on their own, are measured with and without the change.
- **Report only:** no level changes unless the owner decides one after seeing the numbers.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| E1 | **Design docs**: the new Saturday era in `daily-puzzle.md` §3.3; the new weekly era and theme names in `weekly-set.md` §3.3; the "Daily, weekly, events" paragraphs in `jar-mechanics.md` §2.7–§2.11 updated; D228–D233 in `systems-index.md` | Written |
| E2 | **Daily era** (`daily.saturdayFrom`, `src/core/daily.ts`). Before any change, hash two years of dailies from today (fixtures). Add the era. Prove each new mechanic on the Saturday recipe | Every daily before the era date is byte-identical. From the era: two years of Saturdays build, each with its mechanic (or a counted fallback, reported), within the cap, and each proof replays to a win. A 1-in-12 cycle test. The sunrise and sunset Saturday has 14 jars |
| E3 | **Weekly era** (`weekly.themesFrom`, `src/core/weekly.ts`, `strings.ts` theme names). Before any change, hash the weekly boards (fixture). Add the era and the five themes | Weeks before the era are byte-identical. From the era: two years of weeks build, every board carries its theme's mechanic (fallbacks counted and reported), and the theme names show. A 13-week cycle test |
| E4 | **Look and words**: the five theme names on the weekly card and sheet. Check the Saturday daily card and the intro-card path for a player meeting a mechanic early | Screenshots: a Saturday daily with each new mechanic (Classic and Realistic, light and dark) and the weekly card for each new theme, at 412px and at 320px with 150% text. The layout guard passes |
| S1 | **Dark-aware simulator** (`tools/balance/sim-player.ts`): dark lighthouse units are unknown until lit or sealed. Measure the stuck rates with and without the change | A unit test of the player's view of a dark jar. A short report in `production/qa/sprint-30/lighthouse-dark-sim.md` with the numbers and a recommendation. Nothing in the game changes |
| R1 | **0.26.0**: screenshots to the owner first. Confirm the era dates are still in the future on release day. Then tests, the build, the layout guard, What's new ("The newer jars come to the Saturday daily and the weekly"), the changelog with its tag-table row, and the release | tsc, tests, build and the layout guard pass. The owner approves the look |

**Order:** E2 and E3 hash their fixtures before anything changes. E2, E3 and S1 are independent and can run in parallel. E4 follows E2 and E3, and R1 comes last.

## Risks
- **Building the pair on a 10-colour Saturday.** The pair struggled on late, crowded levels (D225, D226). E2 measures its Saturday build rate. If it falls back often, the options go to the owner (an easier pair Saturday recipe, or accepting the fallbacks).
- **The release must beat the era date.** If 0.26.0 isn't out before 2026-12-19, the dates are moved forward at R1, never backward.
- **Players meeting mechanics early.** A level-50 player may meet the crab on a Saturday. The intro card covers it (D2). E4 checks that path.

## Decisions
- D228: wet sand, the tide jar, the crab, the lighthouse jar and the sunrise and sunset jars join both the Saturday daily and the weekly themes.
- D229: they join from a new era after 0.26.0 ships, new ones first in debut order, then the existing rotation (proposed: Saturday 2026-12-19, week 2026-W52).
- D230: weekly theme names Rain on the Dunes, High Water, Crab Walk, Night Watch, Dawn to Dusk.
- D231: seasonal event boards stay plain (D144 kept).
- D232: the balance simulator becomes dark-aware for the lighthouse; report only.
- D233: one sprint, released as 0.26.0 with screenshots sent before release.

## Out of scope
- Combining two featured mechanics on one Saturday or one weekly board.
- Special jars on event boards.
- Retuning the lighthouse; that waits for S1's report.
- The next 40-level mechanic (level 401).
