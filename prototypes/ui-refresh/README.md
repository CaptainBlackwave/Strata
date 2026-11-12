<!-- PROTOTYPE - NOT FOR PRODUCTION -->
<!-- Question: Which visual direction (A Sea glass, B Beach-hut tactile, C Tide-line editorial) should Strata's UI refresh take? -->
<!-- Date: 2026-11-12 -->
# UI refresh mock-up

Hypothesis: three directions built on one shared token set (type, space, radius, shadow, motion) read as distinct, calm, finished products.

Run: open `index.html` (file or served). Switch A/B/C, Light/Dark, 390 / 320 + 150% text. `?dir=B&scene=dark&w=narrow` also works.
`node shoot.cjs` regenerates `shots/` and `compare-light.png`, `compare-dark.png` (`node shoot.cjs narrow` for the 320/150% shots).

Status: in-progress (awaiting owner's choice). Findings: pending.
