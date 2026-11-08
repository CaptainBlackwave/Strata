# Story 003: Difficulty curve from config

> **Epic**: Strata
> **Status**: Complete
> **Layer**: Core
> **Type**: Config/Data
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md`
**Requirement**: `Brief MVP feature 3`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (Player goal & fail state, MVP feature 3) and `design/reverse-engineering/magic-sort-teardown.md`:*

- [x] `levelSpec(level)` reads colours, capacity, spare jars and burial depth from `src/config/game-config.json`. Omitted fields inherit from the previous row.
- [x] Every 10th level is a tall-jar challenge (capacity 8, teardown R3).
- [x] The colour count never decreases across normal levels and is clamped to the palette size.

---

## Files

- `src/config/game-config.json`
- `src/core/levels.ts`
- `tests/unit/core/levels.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Config/Data
**Required evidence**:
- Config/Data: unit tests over the shipped config (`tests/unit/core/levels.test.ts`) — passing

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/strata/story-002-solvable-generator.md`
- Unlocks: `production/epics/strata/story-005-touch-ui.md`
