# Story 001: Pour rules

> **Epic**: Strata
> **Status**: Complete
> **Layer**: Foundation
> **Type**: Logic
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md`
**Requirement**: `Brief MVP feature 1`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (Player goal & fail state, MVP feature 1) and `design/reverse-engineering/magic-sort-teardown.md`:*

- [x] A pour is legal only from a non-empty jar onto an empty jar, or onto a matching top colour with free space (teardown R5).
- [x] A pour moves `min(top run, free space)` units, and the remainder stays in the source (R6).
- [x] An illegal pour throws and never mutates the board, and burial is re-clamped so a new top is always revealed.

---

## Files

- `src/core/board.ts`
- `tests/unit/core/board.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/core/` — passing (`npm test`)

**Status**: [x] Created

---

## Dependencies

- Depends on: None
- Unlocks: `production/epics/strata/story-002-solvable-generator.md`, `production/epics/strata/story-004-session-tools.md`
