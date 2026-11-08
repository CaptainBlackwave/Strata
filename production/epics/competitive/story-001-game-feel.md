# Story 001: Game feel: tilt, splash, seal, celebration, audio, haptics

> **Epic**: Competitive sprint 1
> **Status**: Complete
> **Layer**: Presentation
> **Type**: Visual/Feel
> **Estimate**: L
> **Manifest Version**: N/A (minimal — no control manifest)
> **Last Updated**: 2026-11-08

## Context

**GDD**: `design/game-brief.md` + `design/competitive-roadmap.md`
**Requirement**: `Roadmap C1`

**ADR Governing Implementation**: N/A (minimal — no ADRs)
**ADR Decision Summary**: N/A (minimal — no ADRs)
**ADR Version**: N/A (minimal — no ADRs)

**Engine**: Web (TypeScript 5.8 + Vite 6) | **Risk**: NOT ASSESSED (no VERSION.md risk rating)
**Engine Notes**: none (no ADR engine-compatibility analysis at minimal)

**Control Manifest Rules (this layer)**: N/A (minimal — no control manifest)

---

## Acceptance Criteria

*From `design/competitive-roadmap.md` C1 and teardown v2:*

- [x] The jar tips to 100°, and its sand stays level (a world-horizontal band) throughout the tilt (V2-2, V2-3).
- [x] A pour takes ≈0.85 s, and the player can tap again while the jar flies home (V2-1).
- [x] Landing splash, cork drop with sparkles on seal, and a sand-grain burst on win (V2-4–V2-6). All are skipped under reduced motion.
- [x] Synthesised sound effects (select, pour, land, seal, win, coin, nope), ambient music and haptics, each with its own setting (V2-7).

---

## Files

- `src/ui/main.ts`
- `src/ui/fx.ts`
- `src/ui/audio.ts`
- `src/ui/style.css`

---

## QA Test Cases

*N/A — no qa-lead specs at this tier; implement against the Acceptance Criteria above*

---

## Test Evidence

**Story Type**: Visual/Feel
**Required evidence**: 01–10 in `production/qa/evidence/competitive-sprint-1/`

**Status**: [x] Created

---

## Dependencies

- Depends on: `production/epics/strata/EPIC.md` (MVP complete)
- Unlocks: Roadmap C6–C11
