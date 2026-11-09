# Sprint 13: puzzle variety, and the late economy

> **Status: in progress (2026-11-09).** E1 merged (PR #16). M1 (hourglass) approved by the owner (D102), in review. Chosen in the owner interview after 0.12.0 (D95–D101 in `design/gdd/systems-index.md`). Target release: **0.13.0**. One PR per item (D80).

## Sprint Goal
Keep the late game teaching something new: three original jar mechanics, the hourglass at level 101, the sieve at 141 and the clam at 181 (D96, D97), also in the daily and weekly (D98). Bring the top scene prices back to about two weeks each for a regular player (D99, D100).

## Tasks
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| E1 | **Late economy** (PR 1): streak steps (+25 from day 30, +50 from day 60) and lower prices for ladder rungs 6–12, fitted with the economy model | D99, D100 | The model shows about 14 days per top rung for a regular player; owned scenes kept; `economy.md`, `scenes.md`, `daily-puzzle.md` updated; tests seen failing first |
| M1 | **Hourglass jar** (PR 2, level 101): every third pour on the board flips its stack. Rules, placement, solver support, dead-end cases, intro card, art, sound | D96, D97 | Rules unit-tested; every generated board with it solver-checked; intro card and art screenshots; owner art approval |
| M2 | **Sieve jar** (PR 3, level 141): banded in one colour; only that colour may be poured in | D96, D97 | Same as M1 |
| M3 | **Clam jar** (PR 4, level 181): closed and untouchable until a set number of pours, then shows its sand | D96, D97 | Same as M1 |
| W1 | **Daily and weekly** (with each mechanic): add it to the weekly themes and a daily weekday from a set start date | D98 | No live daily or weekly board changes before its start date (fixture test); the current week's boards are byte-identical |
| P1 | **Phone checklist** findings (when the owner has run it) | D74, D101 | Each failed item fixed or filed |
| R1 | **0.13.0** (last PR): What's new, changelog, version | D56, D60 | Upgrade play-through; tag and release after the merge |

## Design notes to settle in the GDD (M1–M3)
- The hourglass's flip counts every successful pour on the board (Undo reverses it); the solver must model the flip so every board stays winnable and hints stay correct.
- The sieve's colour must be a colour on the board; a sieve jar can be the target that seals that colour.
- The clam's count is shown on the shell; Shuffle and Hint must respect a closed clam.
- Each needs dead-end cases (D21) where certain, and an intro card.

## Out of scope
- New scenes or jar styles.

## Definition of Done
- `npm test` is green, and new tests were seen failing first.
- Evidence in `production/qa/evidence/sprint-13/`.
- The owner approved each mechanic's art.
- Each PR merged under D61; the live site checked; the v0.13.0 tag and release exist.
