# Story 004: Session tools: undo, restart, extra jar, hint

> **Epic**: Strata
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md`
**Requirement**: `Brief MVP feature 4`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (Player goal & fail state, MVP feature 4) and `design/reverse-engineering/magic-sort-teardown.md`:*

- [x] Undo is unlimited and restores the exact previous board. Restart returns to the dealt board.
- [x] The extra jar can be used `extraJarsPerLevel` times. It survives undo and restart, and it is the rescue for a stuck board (R9).
- [x] Hint returns a legal move from a solver search, or null when the board can no longer be won. Following hints from any state always reaches a win, with no hint cycles.
- [x] The session reports `won` / `stuck` status and emits events. It has no DOM dependency.

---

## Files

- `src/core/session.ts`
- `tests/unit/core/session.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**:
- Logic: `tests/unit/core/` — passing (`npm test`). Screenshot: `production/qa/evidence/story-004-session-tools/01-extra-jar-patterns-hint.png`

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/strata/story-001-pour-rules.md`
- Unlocks: `production/epics/strata/story-005-touch-ui.md`
