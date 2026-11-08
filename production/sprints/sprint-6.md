# Sprint 6: quality pass

> **Status: in progress (2026-11-08).** Chosen in the owner interview of 2026-11-08: a quality pass before more content. The art and name review runs alongside it on the owner's review page.

## Sprint Goal
Find every gap between the design documents, the screens and the accessibility requirements, and give the owner one findings report to choose fixes from. No player-facing change unless the owner picks a fix.

## Goal Prerequisites
| Needed to show the goal | Status |
|-------------------------|--------|
| All 11 systems have a GDD | Done (systems-index.md, player profile added 2026-11-08) |
| Player profile merged | Done (PR #1, 2026-11-08) |
| Accessibility requirements written | Done (`design/accessibility-requirements.md`) |

## Capacity
One working session for the reviews and the report, then one more for the fixes the owner picks. Rigor `standard`, review mode `lean`.

## Tasks

### Must Have
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| Q1 | **`/design-review` on each GDD** (11): pour-rules, level-generation, jar-mechanics, session-boosters, economy, daily-puzzle, shell-collection, scenes, feel-audio-ui, save-data, player-profile | `design/gdd/` | One verdict per GDD, each finding with a section reference and a severity |
| Q2 | **`/review-all-gdds`** across the set: contradictions, dominant strategies, pillar drift | `design/gdd/` | A cross-document findings list; every contradiction names both documents |
| Q3 | **UX specs for 8 screens** with `/ux-design`: home, board and HUD, win card, profile, edit profile, shell cabinet, scenes, settings (with save code) | `design/ux/`, the GDDs, the current build | One spec per screen in `design/ux/`, written from the screen as built, each listing its states, inputs and accessibility notes |
| Q4 | **`/ux-review` of each spec** | `design/ux/` | One verdict per spec |
| Q5 | **Accessibility audit** of every screen against `design/accessibility-requirements.md`: contrast in all 4 scenes, focus order and visible focus, screen-reader names, reduced motion, 150% text at 320 px, touch-target size | the running build (Playwright, headless Chromium) | A pass, fail or n/a for each requirement on each screen, with screenshot evidence in `production/qa/evidence/sprint-6/` |
| Q6 | **Findings report** that merges Q1–Q5, sorted by severity, with a suggested fix and size for each | all of the above | `production/qa/sprint-6-findings.md`; the owner picks which findings to fix |

### Should Have
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| Q7 | **Fix the picked findings** | Q6, owner's picks | Each fix has a test or a screenshot; docs updated |
| Q8 | **Apply the art and name review** from the owner's review page: renames into `game-config.json` (ids unchanged), redraw flagged art | owner review page | Names updated, flagged items redrawn and re-screenshotted, both "owner review" follow-ups closed |

## Out of scope
- Code review and tech debt (`/code-review`, `/tech-debt`): not chosen for this sprint.
- New content or features, including seasonal shells and more cosmetics.
- Online features: the brief stays offline (leaderboards C11 stay deferred).

## Risks
| Risk | Mitigation |
|---|---|
| The reviews produce more findings than one sprint can fix | The report is sorted by severity; the owner picks, and the rest go to the backlog |
| UX specs written after the build just describe the code | Specs are checked against the GDDs and the accessibility requirements, not only against the code |
| Accessibility checks headless miss real screen-reader behaviour | Record what was checked automatically (names, roles, focus) and list real-device checks as owner follow-ups |

## Definition of Done
- Q1–Q6 complete; the findings report has been handed to the owner
- Evidence in `production/qa/evidence/sprint-6/`
- Picked fixes (Q7) and the art review (Q8) applied, with `npm test` green and screenshots of anything visible
