# ADR-0001: A GPU board with a falling-sand simulation

**Status:** accepted (owner, 2026-11-11; decisions D153–D158)
**Supersedes:** the "no runtime dependencies" note in `docs/engine-reference/web/VERSION.md` (for the board renderer only)

## Context
Strata's board is DOM and CSS: sand is coloured rectangles and the glass is CSS borders. The owner wants a
studio-quality look, and a sand pour that behaves like real sand is a must (D154). A prototype
(`prototypes/gpu-sand/`) compared today's board (A), a PixiJS board with lit glass and grain sand (B), and B
plus a falling-sand pour (C). The owner chose C (D157), to be released as soon as it is ready (D158).

## Decision
1. **The board draws on a WebGL canvas through PixiJS v8** (about 145 KB gzipped). Menus, sheets, cards
   and the HUD stay HTML.
2. **The rules stay discrete and are the only truth.** `src/core` is unchanged and DOM-free. The sand
   simulation only plays out a pour the rules have already made: it moves exactly `pourAmount` units and ends
   by snapping both jars to the board's units.
3. **The simulation is pure and tested**: `src/ui/sand/` uses typed-array grids, has no Pixi or DOM imports,
   and runs in Node under Vitest (grain conservation, exact amounts, final state equals the board,
   determinism from a seed).
4. **Input and accessibility stay in HTML.** The existing jar buttons remain as a transparent layer over the
   canvas, keeping their labels, focus, keyboard shortcuts and screen-reader text. The canvas is decorative
   (`aria-hidden`).
5. **There is always a fallback.** With no WebGL, a lost context or `?board=dom`, the current DOM board is
   used. Under reduced motion the pour is instant: no simulation, and the jars snap.
6. **It only draws when needed.** The Pixi ticker stops when the board is idle and when the tab is hidden, to
   save battery.

## Consequences
- The download grows from about 85 KB to about 235 KB gzipped. It is cached offline by the service worker.
- Every jar mechanic (narrow, frozen, locked, funnel, hourglass, sieve, clam), scene, jar style and
  colour-blind pattern needs a canvas version, and the DOM board stays as the fallback, so both must agree.
- Real-device performance is the gate: the owner's phone must hold a smooth pour on a 16-jar board before release.
- Screenshot tests must wait for the canvas to draw. Pixel checks replace DOM queries for the board's look.

## Alternatives rejected
- **Stay on DOM** (A): it can't look like sand.
- **The Pixi look with a fake pour** (B): the owner requires a real sand pour.
- **Three.js 3D**: harder to read, heavier, and a bigger art pipeline.

## ADR Dependencies
None. This is the first recorded ADR. Earlier decisions live in the decision log (`design/gdd/systems-index.md`).

## Engine Compatibility
Web stack (`docs/engine-reference/web/VERSION.md`): evergreen browsers with WebGL 1 or 2; PixiJS v8 with the WebGL renderer only, not WebGPU. Safari on iOS 15 and later and Chrome on Android 10 and later are the phone targets. Without WebGL, the DOM board is used.

## GDD Requirements Addressed
- `design/gdd/feel-audio-ui.md`: the pour, seal and win feel (sprint 18 F1–F3), now on the GPU.
- `design/gdd/pour-rules.md`: unchanged. The simulation plays out the rules' result and never decides it.
- `design/accessibility-requirements.md`: keyboard, screen reader, reduced motion and colour patterns are kept through the HTML overlay and the fallback.
