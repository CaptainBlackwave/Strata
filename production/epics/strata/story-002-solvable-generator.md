# Story 002: Solvable level generator

> **Epic**: Strata
> **Status**: Complete
> **Layer**: Core
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md`
**Requirement**: `Brief MVP feature 2`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/game-brief.md` (Player goal & fail state, MVP feature 2) and `design/reverse-engineering/magic-sort-teardown.md`:*

- [x] The same level number always deals the same board (seeded mulberry32).
- [x] Every dealt level has exactly `capacity` units of each colour, plus `spare` empty jars, and no jar sealed at the start.
- [x] No board reaches the player unless the solver has proved it solvable, and replaying the solver's path wins (tested for levels 1–40; 2,000 levels swept by hand).

---

## Files

- `src/core/rng.ts`
- `src/core/solver.ts`
- `src/core/generator.ts`
- `tests/unit/core/levels.test.ts`

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

- Depends on: `production/epics/strata/story-001-pour-rules.md`
- Unlocks: `production/epics/strata/story-003-difficulty-curve.md`
