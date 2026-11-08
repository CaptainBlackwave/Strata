# Story 003: First-launch tutorial

> **Epic**: Competitive sprint 1
> **Status**: Complete
> **Layer**: Feature
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md` + `design/competitive-roadmap.md`
**Requirement**: `Roadmap C4`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/competitive-roadmap.md` C4 and teardown v2:*

- [x] On first launch, Play opens a one-pour tutorial board from `tutorial` in config.
- [x] A pulsing ring and caption show which jar to tap: 'Tap a jar to lift it', then 'Now tap the other jar to pour'.
- [x] Clearing it shows 'Nice pour!' and a Start level 1 button, and the tutorial isn't shown again (it can be replayed from Settings).

---

## Files

- `src/ui/main.ts`
- `src/core/generator.ts`
- `tests/unit/core/levels.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: 02–05 in `production/qa/evidence/competitive-sprint-1/`

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/strata/EPIC.md` (MVP complete)
- Unlocks: Roadmap C6–C11
