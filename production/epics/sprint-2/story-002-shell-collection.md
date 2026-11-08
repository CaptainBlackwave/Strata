# Story 002: Shell collection and cabinet

> **Epic**: Sprint 2: daily puzzle and collection
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md` + `design/competitive-roadmap.md`
**Requirement**: `Roadmap C7 (S2-3, S2-4)`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

- [x] 20 original shells in 4 sets, drawn as SVG from `kind` + colours.
- [x] A shell is granted on the first clear of every 5th level and on each day's first daily solve, in catalog order, never duplicated.
- [x] The shell that completes a set pays 150 coins + 1 of each booster. After all 20 are collected, milestones pay 50 coins.
- [x] The cabinet shows each set's progress, owned shells by name, locked silhouettes and how many levels until the next shell. It fits 320 px.

---

## Files

- `src/core/collection.ts`
- `src/ui/shells.ts`
- `src/ui/main.ts`
- `src/ui/style.css`
- `tests/unit/core/collection.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `npm test` + sprint-2 evidence 02, 06, 07

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/competitive/EPIC.md`
- Unlocks: Roadmap C8–C11
