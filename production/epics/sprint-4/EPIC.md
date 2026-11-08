# Epic: Sprint 4: time-of-day scenes

> **Goal**: Give coins a long-term use and give the game moods for different times of day, without touching puzzle readability.
> **Source**: `design/competitive-roadmap.md` C10, owner interview decisions S4-1 to S4-4 (2026-11-08).
> **Status**: Complete. Evidence in `production/qa/evidence/sprint-4/`.

## Decisions
| ID | Decision |
|---|---|
| S4-1 | Scenes: **Dawn, Sunset, Moonlit tide**, plus the free **Midday** |
| S4-2 | Bought with coins: Dawn 300, Sunset 500, Moonlit 800, with a live preview before buying |
| S4-3 | Optional **Match my clock** (off by default): Dawn 5–9, Midday 9–17, Sunset 17–20, Moonlit 20–5, through owned scenes only. Picking a scene by hand turns it off |
| S4-4 | Sky, sea, glass and UI change; **sand colours never do** (puzzles and colour-blind patterns stay valid) |

## Stories
| # | Story | Type | Status | Tests / evidence |
|---|-------|------|--------|-------|
| 001 | Scene catalog, purchase, clock schedule, contrast (WCAG) checks | Logic | Complete | `tests/unit/core/themes.test.ts` (13 tests: text ≥ 4.5:1, soft text and buttons ≥ 3:1 in every scene) |
| 002 | Scene tokens applied at runtime, sky decorations, dark-safe UI surfaces | UI | Complete | `home-*.png`, `board-*.png`, `moonlit-*.png` |
| 003 | Scene picker: live preview, buy, use, Match my clock; home + Settings entry points | UI | Complete | `01-picker-midday.png`, `02-picker-preview-moonlit.png` |
| 004 | Save: owned/selected/auto, with older saves loading cleanly | Logic | Complete | `tests/unit/core/ui-helpers.test.ts` |
