# Sprint 8: finish the scene ladder, and polish

> **Status: built (2026-11-08).** P1–P8 done; P9 (playtest follow-ups) waits for the owner's notes. Evidence: `production/qa/evidence/sprint-8/README.md`. 472 tests pass. Chosen in the owner interview after sprint 7 (D43–D51 in `design/gdd/systems-index.md`). Playtest notes from sprint 7 (`production/qa/sprint-7/playtest-list.md`) will be folded in when they arrive.

## Sprint Goal
Finish the 12-scene ladder and make the game feel finished: accessible zoom and tap areas, instant level starts, a "What's new" card, a code review, and the most valuable fixes from the review backlog. The level map is designed now and built in sprint 9.

## Tasks

### Must Have
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| P1 | **The 8 remaining ladder scenes**: High Summer, Spring Blossom, Autumn Shore and Rainbow After Rain (tier 1); Soft Rain and Winter Lights (tier 2); Meteor Shower and Aurora Night (tier 3) | `scenes.md` §2.1a | Each has the ladder price, its window, and its tier's animation within the layer rules. Contrast tests pass. Screenshots of home, board and win for each |
| P2 | **Southern-hemisphere switch** (D42): a Settings toggle that shifts *season* windows by 6 months; holidays keep their dates | `scenes.md` | Unit tests for the shift. The badge follows the switch |
| P3 | **Zoom and tap areas**: allow pinch zoom, keep double-tap zoom off on the board and buttons (D44); jar hit areas at least 44 px (D45); the intro dialog gets a name (AX-14) | `accessibility-audit.md` | Measured on iPhone SE at 100% and 150% text; screenshots |
| P4 | **Instant level starts**: generate the next level in the background (a Web Worker or idle time) while the current one is played, so slow levels (141, 185) start at once | D46, sweep timings | Next-level start under 50 ms on a cached level. Works offline (service worker). The board is identical to direct generation (test) |
| P5 | **"What's new" card**: shown once after an update (per version), with 3–5 short plain lines (D52); can be reopened from Settings | D46, D52 | Shown once per version and never on a first install. Screenshot |
| P6 | **Code review and tech-debt register**: run `/code-review` on `src/`, write `docs/tech-debt.md`, and fix the clear wins | D46 | The register lists each item with its size. Fixes come with tests |
| P7 | **Top backlog findings**: triage the ~117 minor review findings from sprint 6 and fix the 15–20 with the most player value | `production/qa/sprint-6/*` | A triage table in `production/qa/sprint-8/backlog-triage.md`; every fix verified |
| P8 | ~~Level map design sign-off~~ **Done 2026-11-08 (D52)** | `level-map.md` | Signed off; ready to build in sprint 9 |

### Should Have
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| P9 | **Playtest follow-ups**: tune whatever the owner's sprint 7 playtest finds | owner notes | Each change recorded with its reason |

## Out of scope
- Building the level map (sprint 9).
- Achievements and a weekly challenge (not chosen).
- Online features (anti-pillars).

## Definition of Done
- `npm test` green, with new tests seen failing first; screenshots in `production/qa/evidence/sprint-8/`
- GDDs updated; PR opened, reviewed and merged
