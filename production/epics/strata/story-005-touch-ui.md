# Story 005: Playable touch UI with pour animation

> **Epic**: Strata
> **Status**: Complete
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md`
**Requirement**: `Brief MVP feature 5`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (Player goal & fail state, MVP feature 5) and `design/reverse-engineering/magic-sort-teardown.md`:*

- [x] Tap a jar to lift it, then tap another to pour. An illegal target shakes. The source tilts toward the target and a stream of sand runs into it.
- [x] Boards wrap into rows and fit a 390×664 phone viewport with no scrolling (R10), including 14-jar and tall-jar levels.
- [x] The HUD shows the level, pours, Undo, Restart, Jar (with count) and Hint, and the win card offers the next level.
- [x] There are no hardcoded UI strings outside `src/ui/strings.ts`. A colour-blind Patterns toggle is offered, and reduced motion skips animation.

---

## Files

- `index.html`
- `src/ui/main.ts`
- `src/ui/style.css`
- `src/ui/layout.ts`
- `src/ui/strings.ts`
- `tests/unit/core/ui-helpers.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: UI
**Required evidence**:
- UI: screenshots in `production/qa/evidence/story-005-touch-ui/` (01–10) and `production/qa/evidence/playthrough-2026-11-08.md`

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/strata/story-003-difficulty-curve.md`, `production/epics/strata/story-004-session-tools.md`
- Unlocks: `production/epics/strata/story-006-progress-save.md`
