# Sprint 11: badges, the weekly set, and a smoother start

> **Status: built (2026-11-09).** 0.10.1 (PR #9), badges (PR #10), onboarding (PR #11) merged; the weekly set and the 0.11.0 release in the last PR; 864 tests pass. Evidence: `production/qa/evidence/sprint-11/README.md`. Open for the owner: the first-run recommendations R1–R5 (`production/qa/sprint-11/first-run-review.md`) and the weekly set's no-coins choice. Chosen in the owner interview after 0.10.0 (D72–D80 in `design/gdd/systems-index.md`). First comes the 0.10.1 quick-fix release, then this sprint as one PR per feature (D80). Target release: **0.11.0**.

## Before the sprint: 0.10.1 (D79): done
Evidence: `production/qa/evidence/0.10.1/README.md`.
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| Q1 | **Slider track** styled from the scene's tokens | D72 | Contrast of 3:1 or more for the track and thumb in all 16 scenes (added to the scene contrast test); screenshots in light, dark and two animated scenes |
| Q2 | **Seal shimmer and win glow tinted per scene** | D73 | A tint per scene in one table; the motes stay readable on each scene; screenshots of 4 contrasting scenes; reduced motion unchanged |
| Q3 | **Phone checklist page** for the real-phone checks; it stores the answers | D74 | A published page with each check as tick or note; Claude reads the answers back and files fixes |
| Q4 | **Cleanup:** fix the stale "targets deferred" lines in `economy.md` and `level-generation.md` (D36 set the difficulty bands); remove three merged agent checkouts; record the live 0.10.0 check in the sprint 10 evidence | owner | Docs match the decisions; the checkouts are gone; the evidence row is added |

## Tasks
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| A1 | **Badge shelf design** (D76): about 20–30 badges across play, mastery, collection and exploration (e.g. "Seal 100 jars", "Perfect a tall-jar level", "Play in every scene"). Recognition only, with no coins | D76 | A GDD section with every badge, its rule, and how progress is counted from existing stats (new counters only where needed) |
| A2 | **Badges built:** pure rules in `src/core/`, a save field with repair, a shelf on the profile, a quiet toast when one is earned, and screen-reader text | A1 | Unit tests for every rule, written failing first; old saves award the badges already earned once, quietly; screenshots |
| W1 | **Weekly set design** (D77): every Monday (UTC), five themed seeded boards, the same for everyone, playable all week; clearing all five earns that week's badge; Share shows the pours | D77, `daily-puzzle.md` | A GDD section: seeding, difficulty of the five boards, the week boundary, out-of-order play, and how it differs from the daily |
| W2 | **Weekly set built:** a card on Home, the five boards with progress, the weekly badge, and Share | W1 | Seeds deterministic (a fixture of 8 weeks); week-boundary tests; screenshots; generation within budget |
| O1 | **Add to Home Screen card** (D78): once, after a few levels, never on the first visit. iPhone gets its Share-then-Add steps; Android gets the browser's install prompt | D78 | Shown once and dismissible; not shown when already installed; screenshots for both |
| O2 | **First-run review:** pacing of the tutorial and the first ten levels; explaining the map, boosters and scenes at the right moment | D78 | A written review with findings, then the agreed fixes, with before and after screenshots |
| O3 | **Share link** that opens today's daily or this week's set directly | D78 | The link opens the right board; a link from an old day falls back gracefully; the URL holds no save data |
| O4 | **Offline-ready notice**, once, after everything is cached | D78 | Shown once; not shown when storage is blocked; screenshot |
| R1 | **0.11.0:** What's new, changelog, version (tagged by the release workflow) | D56, D60 | The upgrade play-through passes; tag and release after merge; live site checked |

## Out of scope
- The late-game economy (D23) and new puzzle variety: still open for a later sprint.
- Online features, accounts, leaderboards (anti-pillars, C11).

## Definition of Done
- `npm test` is green, and new tests were seen failing first.
- Evidence is in `production/qa/evidence/sprint-11/`.
- One PR per feature (D80), each merged under D61.
- The live site is checked, and the 0.11.0 tag and release exist.
