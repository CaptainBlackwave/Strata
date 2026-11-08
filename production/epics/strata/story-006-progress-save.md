# Story 006: Progress save

> **Epic**: Strata
> **Status**: Complete
> **Layer**: Feature
> **Type**: Integration
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md`
**Requirement**: `Brief MVP feature 6`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (Player goal & fail state, MVP feature 6) and `design/reverse-engineering/magic-sort-teardown.md`:*

- [x] Clearing a level saves `level + 1` and the best pour count to `localStorage`, and a reload resumes there.
- [x] Corrupt, missing or blocked storage falls back to level 1 without errors.

---

## Files

- `src/ui/storage.ts`
- `tests/unit/core/ui-helpers.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Integration
**Required evidence**:
- Integration: storage unit tests plus the end-to-end play-through (`production/qa/evidence/playthrough-2026-11-08.md`)

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/strata/story-005-touch-ui.md`
- Unlocks: None
