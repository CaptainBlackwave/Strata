# Sprint 9: the level map

> **Status: planned (2026-11-08).** Chosen in the owner interview after sprint 8 (D53–D59 in `design/gdd/systems-index.md`).

## Sprint Goal
Players can see their journey. Play opens a winding beach path of level stones (design signed off in `design/gdd/level-map.md`, D47–D52). Before that, the main UI file is split so the map gets its own module. The sprint also stops two tabs overwriting each other, clears the rest of the review backlog, and fixes three scene-art spots. Each release from now on gets one version number and its notes.

## Tasks (in order, D59)

| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| M1 | **Scene art fixes:** the rainbow arc clears the Home title, the Winter lights glow stays out of the HUD, and the meteor and aurora seal effects are brighter | D54 | Before/after screenshots; contrast tests pass; reduced motion unchanged |
| M2 | **Split `main.ts` by screen** (TD-1): Home, board/HUD, win card, sheets (settings, scenes, cabinet, profile, save code, What's new), boot | `docs/tech-debt.md` TD-1 | No behaviour change. Before/after browser comparison: labels, win cards and saves (as for TD-2/TD-9). Tests pass |
| M3 | **The level map** (D47–D52): a beach path with about 6 stones per screen, scenery every 20 levels, markers (Perfect, best pours on tap, special icons, the next 20 locked), replays chase Perfect (first Perfect counts once), and it replaces Play | `level-map.md` | All §5 acceptance criteria: unit tests for the pure marker and replay rules; keyboard and screen-reader names; screenshots at levels 3, 60 and 201, a tap card, a locked stone, 150% text on 320 px, and reduced motion |
| M4 | **One active tab** (D57, TD-14): the newest tab takes over (BroadcastChannel, with a storage-event fallback); older tabs show "Strata is open in another tab" with **Play here** | `save-data.md` | Two-tab browser test: no save is overwritten; Play here takes over |
| M5 | **The remaining 11 backlog findings** (player-facing) | `production/qa/sprint-8/backlog-triage.md` | Each verified; the triage marked done |
| M6 | **Versioning** (D56): `package.json` is the single version, and What's new reads it. 0.8.0 is tagged for sprint 8 and 0.9.0 for this sprint. A CHANGELOG entry per release; player-facing notes from `/patch-notes` | D56 | `CHANGELOG.md` and notes updated; tags pushed; release notes ready for a GitHub release |
| M7 | **What's new for 0.9.0:** the level map, replays to chase Perfect, one active tab | D52 | Shown once to 0.8.0 players |

## Owner tasks
- Run the device checklist (`production/qa/device-checklist.md`) on a phone and report anything off.

## Out of scope
- Achievements and a weekly challenge (not chosen); online features (anti-pillars).

## Definition of Done
- `npm test` green, with new tests seen failing first; screenshots in `production/qa/evidence/sprint-9/`
- `level-map.md` acceptance criteria ticked; PR reviewed and merged; tagged v0.9.0
