# Sprint 12: the late-game economy (jar styles)

> **Status: in progress (2026-11-09).** Chosen in the owner interview after 0.11.1 (D84–D92 in `design/gdd/systems-index.md`). Target release: **0.12.0**.

## Sprint Goal
Give coins a lasting purpose (D85): jar and sand styles bought from level 60 (D91) in three mix-and-match slots (D90), cosmetic only and never changing a sand colour (D89), priced so a regular player affords something new about every 1–2 weeks (D86). A balance pass checks income against every price (D88).

## Tasks
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| S1 | **Design**: `design/gdd/jar-styles.md` (catalogue, unlock, buy and wear, what a style may change, save, edge cases) | D85–D91 | GDD written; systems-index row |
| S2 | **Rules and save**: `src/core/styles.ts` (unlock, buy, wear, repair), `styles` in config and the save, the save code | jar-styles §3, §3.5 | Unit tests seen failing first; old saves get defaults |
| S3 | **Art**: CSS for 4 glass, 4 cork and 4 sand pieces on top of the defaults, keyed by `data-glass`, `data-cork`, `data-sand` | D89, jar-styles §3.4 | Every piece in all 16 scenes; patterns on top; reduced motion still; sand overlay cap tested |
| S4 | **Styles sheet**: a Home button from level 60 with a one-time New mark; three slots; preview, buy and wear | jar-styles §3.2–§3.3 | Keyboard and screen reader; 150% text at 320 px; screenshots |
| S5 | **Balance pass** (D88): extend `tools/balance/economy-model.ts` with styles from level 60 over 180 days; fit the 12 prices | D86, D87 | A new scene or style every 7–14 days for a regular player from level 60; prices in jar-styles §4 and `economy.md` |
| S6 | **Art sign-off page** (D92): every piece in a few scenes, before the merge | D92 | Published page; **the owner approves before the PR merges** |
| S7 | **0.12.0**: What's new, changelog, version bump | D56, D60 | Upgrade play-through; the tag and release appear after the merge |

## Out of scope
- New puzzle variety (still open).
- Badges for styles (D76 keeps badges reward-free; none added).
- Changes to the post-collection shell bonus (kept, D87).

## Definition of Done
- `npm test` is green, and new tests were seen failing first.
- Evidence is in `production/qa/evidence/sprint-12/`.
- The owner has approved the style art.
- The PR is merged under D61, the live site is checked, and the tag and release exist.
