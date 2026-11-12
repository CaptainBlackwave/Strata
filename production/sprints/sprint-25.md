# Sprint 25: Beach-hut refresh (0.23.0)

> **Status: built (2026-11-12), approved by the owner; released as 0.23.0.** Before: `production/qa/evidence/sprint-25/audit/`; after: `production/qa/evidence/sprint-25/after/`. From the owner interview and the UI audit (`production/qa/evidence/sprint-25/audit/audit.md`), direction **B, Beach-hut tactile**, chosen from the mock-ups (`prototypes/ui-refresh/`, D201). One release, **0.23.0** (D203).

## Goal
Every screen looks like one finished game: warm paper cards with a pressable lip, bold headings, a tide-colour band per area, duotone icons and wooden shelves under the jars, built on one shared set of tokens. Every audit bug is fixed (D202). Rules and the Realistic sand itself don't change.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| U1 | **Tokens**: a 6-step type scale, 4-pt spacing, 4 radii, 3 shadow levels with the shadow colour per scene, 3 motion durations, the lip colour derived from each surface, area band colours; replace hard-coded values in `style.css` (the daytime brown typed 28 times, the accent retyped 10 times, the primary lip `#1f776c`) | Counts in the audit fall sharply (radii, font sizes, shadows, spacing); a test fails on new raw hex colours outside the token files |
| U2 | **Components**: one primary, one secondary, one icon-button, one chip; one card; one sheet header with one close button; tabs; toasts; all with the lip and press feel | Every screen uses them; 5 close patterns become 1 |
| U3 | **Home and tabs** in direction B: area bands (Play teal, Today coral, Collection sand, Profile blue), card styles, the tab bar's selected pill | Screenshots match the mock-up's look in light and dark |
| U4 | **Board**: the two-row HUD, toolbar buttons with lips and readable labels, the toast between board and toolbar, **wooden shelves** under each row of jars (Classic and Realistic) | Screenshots both boards, 390 and 320/150% |
| U5 | **Sheets and cards**: Settings, Stats, Profile, shells, badges, jar styles, scenes, map, weekly, track, event, What's new, Jar guide, intro cards, install card, win card (goals as a checklist, one button style), tutorial | Screenshots of each, light and dark |
| U6 | **Audit bugs** (all high and medium): moon over the gear; one-word-per-line wraps and mid-word breaks at 320/150%; sheets opening scrolled to the bottom; the Stats overlap; night-scene colours that ignore the scene; focus ring on first open; HUD rows at 320/150% | Each fixed and re-shot with the audit's `capture.cjs` |
| R1 | **0.23.0**: the layout guard, the full test suite, play-throughs on both boards, the audit capture re-run with before/after contact sheets, What's new, the changelog, release | Released (D199: no waiting for Kilo) |

## Decisions
- D201: the visual refresh follows direction B, Beach-hut tactile.
- D202: fix every high and medium issue from the audit.
- D203: one release, 0.23.0, when done.

## Out of scope
- Rule or level changes; the Realistic sand simulation; new screens.
