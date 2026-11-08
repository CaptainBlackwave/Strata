# Story 004: Home screen and settings

> **Epic**: Competitive sprint 1
> **Status**: Complete
> **Layer**: Presentation
> **Type**: UI
> **Estimate**: S
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md` + `design/competitive-roadmap.md`
**Requirement**: `Roadmap C5`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/competitive-roadmap.md` C5 and teardown v2:*

- [x] Launch shows a home screen with the coin balance and 'Play · Level N'.
- [x] The Settings sheet toggles sound, music, vibration and colour patterns, and offers Home and Replay tutorial.
- [x] Fits a 320 px phone with no horizontal overflow.

---

## Files

- `index.html`
- `src/ui/main.ts`
- `src/ui/strings.ts`
- `src/ui/style.css`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: UI
**Required evidence**: 01, 09, 10 in `production/qa/evidence/competitive-sprint-1/`

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/strata/EPIC.md` (MVP complete)
- Unlocks: Roadmap C6–C11
