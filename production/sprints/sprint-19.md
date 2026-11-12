# Sprint 19: Real sand

> **Status: planned (2026-11-11), approved by the owner (D157, D158).** Architecture: `docs/architecture/adr-0001-gpu-sand-board.md`. Prototype: `prototypes/gpu-sand/` (variant C). Target release: **0.18.0, as soon as ready**, December included. About 3–4 weeks.

## Change of direction (2026-11-12, D159–D163)
A player suggested, and the owner agreed, that the real-sand board should be a **cosmetic** rather than a replacement. Today's board stays the free default ("Classic"); "Real sand" is a one-time 2,500-coin purchase in a new **Board** row of the Jar styles sheet, switched freely once owned. The glass becomes **soft and matte**. It goes on sale only once every level works on it. The DOM board is therefore a first-class look, not only a fallback.

**Update 2026-11-12 (D164):** not for sale after all. Realistic sand is a free Settings toggle, Classic by default.

## Goal
The board looks like a studio game: lit glass jars and sand that is really sand. A pour tips the jar, the top colour slides to the lip and spills as grains, and it piles and settles in the target. The rules don't change.

## Phases and tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| S1 | **Sand simulation core**: `src/ui/sand/`, pure TypeScript with no Pixi and no DOM. Per-jar grids, a tilting world grid, the spill, falling grains, settling | Vitest: grains are conserved; exactly `pourAmount × grainsPerUnit` grains move; the final grids equal the board's units in order; the same seed gives the same frames; the prototype's "jar empties then snaps back" bug cannot happen (test) |
| S2 | **Pixi board renderer**: layout from today's `layout.ts`, glass (rim light, inner shadow, highlight, base, shadow), sand drawn from the grids with grain and sparkle, hidden units as neutral sand | Screenshot parity with today's board positions; idle frames draw nothing (ticker stopped) |
| S3 | **Mechanics, styles and scenes on canvas**: narrow, frozen, locked, funnel, hourglass, sieve, clam; jar styles (glass, cork, sand); scene colours; colour-blind patterns anchored to the grains | One screenshot per mechanic and style; patterns don't shimmer while sand moves |
| S4 | **Input and accessibility overlay**: the existing jar buttons stay over the canvas (transparent) for taps, focus, keys and labels | Keyboard and screen-reader behaviour unchanged (existing tests pass); focus ring visible over the canvas |
| S5 | **Pour, seal and win on the GPU**: the simulated pour driven by `session.pour`, cork and sparkle, the win glow, hints, the stuck banner, Undo and Shuffle redraws | Every board event looks right; Undo and Shuffle snap at once |
| S6 | **Fallback and settings**: no WebGL, a lost context or `?board=dom` gives today's board; reduced motion gives an instant pour | Tested with WebGL disabled; a context loss mid-pour recovers |
| S7 | **Performance**: grids sized per jar count, a simulation step budget, textures cached, the ticker stops when idle | 4× throttle: median frame 16.7 ms or less on a 16-jar board in hardware WebGL; the owner's phone test passes |
| C1 | **Board toggle** (D164, replaces the 2,500-coin purchase): Settings > "Realistic sand" switches Classic and Realistic at once, free, saved in `settings.realistic`; `?board=` stays for testing | Built: switch and save tests; `production/qa/evidence/sprint-19/toggle/` |
| M1 | **Matte glass** (D162) and the three pour follow-ups (strata-r8z spill only over the target, strata-085 a narrow stream, strata-bcr clear empty glass) | Screenshots and a mid-pour strip |
| R1 | **0.18.0**: What's new, the changelog, an upgrade play-through, the owner's phone sign-off, then release | Released as soon as S1–S7 pass |

## Decisions
- D157: go straight to the full sand-simulation board (prototype C), not the Pixi look first.
- D158: release as soon as it is ready, December included.

## Out of scope
- Rule changes, new levels or new jar mechanics.
- 3D rendering.
