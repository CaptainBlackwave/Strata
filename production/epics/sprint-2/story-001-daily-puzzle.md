# Story 001: Daily puzzle with streak and tide passes

> **Epic**: Sprint 2: daily puzzle and collection
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md` + `design/competitive-roadmap.md`
**Requirement**: `Roadmap C6 (S2-1, S2-2)`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] The board for a date is the same for every player and is solver-proven winnable (8 weeks tested).
- [x] Weekly rhythm from config: Monday easy through Saturday tricky, Sunday tall jars.
- [x] The first solve of a day pays `30 + 10 × (streak − 1)`, capped at 100. Replays pay nothing.
- [x] Every 7th streak day banks a tide pass (max 2). One missed day spends a pass and keeps the streak; two missed days reset it.
- [x] The home card shows today's difficulty, whether it's solved, the streak and passes, and a warning when a pass is about to be spent. The win card has Share.

---

## Files

- `src/core/daily.ts`
- `src/core/generator.ts`
- `src/config/game-config.json`
- `src/ui/main.ts`
- `tests/unit/core/daily.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `npm test` + sprint-2 evidence 01, 03–05, 08

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/competitive/EPIC.md`
- Unlocks: Roadmap C8–C11
