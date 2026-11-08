# Sprint 5: build the 2026-11-08 design decisions

> **Status: complete (2026-11-08).** Evidence: `production/qa/evidence/sprint-5/`. Deviation, approved by the owner: the spare-jar lever replaces one spare with a narrow jar or funnel instead of removing it, because 1-empty-spare boards are almost never winnable.

## Sprint Goal
Implement every interview decision that needs code (D1, D3, D5, D8, D10, D14, D16 in
`design/gdd/systems-index.md`), so the GDDs and the game agree again.

## Goal Prerequisites
| Needed to show the goal | Status |
|-------------------------|--------|
| Owner decisions D1–D18 | Done (interview 2026-11-08) |
| GDDs updated with the decisions | Done |

## Capacity
One working session. Rigor `standard`: every Logic task has unit tests written first and seen failing; every UI task has retained screenshots.

## Tasks

### Must Have
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| T1 | **Difficulty ramp past level 45** (D1). Spare jars: from level 60 one of the two spare jars is swapped for a narrow jar (or a funnel from level 81), with a chance rising linearly from 20% (level 60) to 75% (level 150) — revised from "1 spare jar" after testing. Buried depth 3 from level 75. Mechanic chance 34% up to level 45, rising linearly to 50% at level 120. Colours: 13 from level 90, 14 from level 130 (two new palette colours, each with a new colour-blind pattern). If a 1-spare deal can't be proven winnable, that level falls back to 2 spares | level-generation.md | Levels 1–59 keep their exact boards (fixture). Difficulty parameters keep changing past 45 (test). Levels 1–500 all generate. Worst generation time recorded |
| T2 | **Tall-jar mechanics from level 100** (D8), at the same chance as normal levels | level-generation.md, jar-mechanics.md | Tall-jar levels before 100 stay plain; some from 100 have a mechanic; all solvable |
| T3 | **Extra Jar: no per-level cap** (D5) | session-boosters.md | Two extra jars can be added on one level; still survive undo and restart |
| T4 | **`?level=N` replay only** (D3): a launch level beyond the player's progress opens their current level instead | economy.md, shell-collection.md | Unit test on the clamp; walkthrough: `?level=100` with progress 5 opens level 5 |
| T5 | **Backwards clock ignored** (D10): a daily solve dated before the last solve gives no reward and no reset | daily-puzzle.md | Test fails first on the old code; win card explains |
| T6 | **Save code export/import** (D16): Settings → "Save code" sheet with Copy and Restore; the code is `STRATA1:` + base64 of the save; restore validates and repairs like a normal load | save-data.md | Round-trip test; invalid code rejected with a message; walkthrough screenshot |
| T7 | **Text follows the player's text size** (D14): UI font sizes in `rem`; iOS Dynamic Type respected | feel-audio-ui.md, accessibility-requirements.md A5 | Screenshots of home, board, win and settings at 150% text on a 320 px phone with no horizontal overflow |

## Out of scope
- The fifth shell set (D12) is future content.
- All "keep as built" decisions (D2, D4, D6, D7, D9, D11, D15, D17, D18) need no code.

## Risks
| Risk | Mitigation |
|---|---|
| 1-spare 12–14 colour boards are hard for the solver (slow or no proof) | Fall back to 2 spares on failure; sweep levels 1–500 for failures and timing |
| Two more colours are harder to tell apart | Distinct hues plus new patterns; check a 14-colour board screenshot |
| Larger text breaks tight layouts (HUD, badges) | Badge and chip sizes in `em`; check every main screen at 150% on 320 px |

## Definition of Done
- `npm test` green, with new tests seen failing first
- Sweep: levels 1–500 generate, worst time recorded
- Screenshots in `production/qa/evidence/sprint-5/`
- GDDs updated from "not yet built" to built; pushed to `main` and deployed
