# Story 002: Economy and boosters (undo, shuffle, jar, hint)

> **Epic**: Competitive sprint 1
> **Status**: Complete
> **Layer**: Feature
> **Type**: Logic
> **Estimate**: M
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md` + `design/competitive-roadmap.md`
**Requirement**: `Roadmap C2, C3`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/competitive-roadmap.md` C2, C3 and teardown v2:*

- [x] Wallet starts at `economy.startCoins` with each booster's `start` charges, all from config.
- [x] Using a booster spends a charge, or its coin price at 0 charges. It refuses, changing nothing, when neither is possible.
- [x] Clearing a level pays `coinsPerLevel`, plus `perfectBonus` with no boosters used, plus `challengeBonus` on tall-jar levels.
- [x] Shuffle re-deals only unsealed jars, keeps every jar's fill level, proves the result winnable and is undoable.
- [x] The wallet, tutorial flag and settings persist in a v2 save that migrates v1 progress.

---

## Files

- `src/core/economy.ts`
- `src/core/session.ts`
- `src/ui/storage.ts`
- `src/config/game-config.json`
- `tests/unit/core/economy.test.ts`
- `tests/unit/core/session.test.ts`
- `tests/unit/core/ui-helpers.test.ts`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Logic
**Required evidence**: `npm test` (69 tests)

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/strata/EPIC.md` (MVP complete)
- Unlocks: Roadmap C6–C11
