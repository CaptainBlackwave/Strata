# Sprint 9 evidence: M1 scene art fixes (D54)

Sprint: `production/sprints/sprint-9.md` M1. Findings: `production/qa/evidence/sprint-8/README-scenes.md` (Rainbow after rain, Winter lights, Meteor shower and Aurora night seal rows). Design: `design/gdd/scenes.md` §2.1a.

The shots come from headless Chromium on the Vite dev server (port 5205). Pixel 7 is 412 px wide and iPhone SE is 320 px. "150%" means the root font set to 150%. The save is seeded with level 3, all scenes owned, `auto: false` and `seenWhatsNew: '0.8.0'`. The driver is `m1.cjs` in the session scratchpad (`/tmp/claude-0/-home-user-Strata/52dd5b50-4e4a-5491-89dc-6ff4ab94082a/scratchpad/m1.cjs`), adapted from sprint 8's `p1.cjs`. Each `-before` shot is from the commit before the fixes (`d311db8`). Each `-after` shot is from the fix commits. No run logged a page error.

## 1. Rainbow after rain: the arc clears the title and tagline

**Change (`src/ui/style.css`, Sprint 8 P1 section):** before, the arc was a screen-sized `.home::before`. It is now a 280 × 140 px `.logo-jars::before`, so it hangs from the logo. Its feet land on the jars' base, 18 px above the title, and the jars sit in front of it. The arc moves with the logo at every width and text size. The colours, softness and swatch are unchanged.

The geometry was measured with `getComputedStyle(…, '::before')` against the title and tagline boxes:

| Shot (before / after) | Device, text | Arc box before → after (top–bottom, px) | Title top | Clear of title and tagline |
|---|---|---|---|---|
| `m1-rainbow-pixel7-*.png` | Pixel 7, 100% | 284–663 → 162–302 | 320 | No → **Yes** |
| `m1-rainbow-pixel7-150-*.png` | Pixel 7, 150% | 284–663 → 102–242 | 260 | No → **Yes** |
| `m1-rainbow-se-*.png` | iPhone SE, 100% | 154–449 → 44–184 | 202 | No → **Yes** |
| `m1-rainbow-se-150-*.png` | iPhone SE, 150% | 154–449 → 44–184 | 202 | No → **Yes** |

There is no horizontal overflow at any size. At 320 px, the top of the arc passes behind the opaque profile chip, which stays fully readable. Art review should judge whether the smaller arc still reads as "after rain".

## 2. Winter lights: the string hangs under the HUD

**Change (`src/ui/scene-fx.ts`):** before, the wire sat at a fixed 14–46 px, behind "Level N". `hangString()` now measures the HUD on the board, or the top row on Home (profile chip and Settings). It hangs the hooks 10 px below that edge, which is the glow's reach plus 2 px. The swag dips up to 16 px, or less if the jars or the logo start close below. A `ResizeObserver` on the HUD, the top row and the board re-measures the string when the HUD wraps at large text. Under reduced motion, the one still frame is redrawn in its new place and is not animated. The canvas, its z-index, the bulb count (18), 30 fps and 1x are unchanged. The `style.css` scene section needed no change.

Lit canvas pixels (alpha > 8) were counted inside the elements:

| Shot (before / after) | Where | Before | After |
|---|---|---|---|
| `m1-winterlights-board-*.png` | Pixel 7 board: "Level 3" / HUD title block | 1,317 / 3,089 | **0 / 0** (3 samples, 400 ms apart) |
| `m1-winterlights-se-150-board-*.png` | SE 150% board (HUD wraps to 10–95 px) | 4,639 / 4,639 | **0 / 0** |
| `m1-winterlights-home-*.png` | Pixel 7 Home top row | 5,041 | **0** |
| `m1-winterlights-se-150-home-*.png` | SE 150% Home top row | 4,453 | **0** |
| `m1-winterlights-reduced-motion-board-*.png` | Reduced motion, board | 1,298 | **0**. The frame is unchanged after 1 s |

Hidden page: the frames change while the page is visible, freeze while `document.hidden` is true, and resume after.

## 3. Meteor shower and Aurora night: brighter seal reactions

**Change (`src/ui/scene-fx.ts`):** the values are named constants, `SEAL_METEOR` and `SEAL_RIPPLE`.

| | Before | After |
|---|---|---|
| Meteor shower seal meteor | 1.8 px wide, 70 px tail, 260 px/s, 0.6 s | 3 px wide, 125 px tail, 300 px/s, **0.9 s**, plus a soft halo along the tail and head and a white core. It starts higher and further right, so the head crosses over the jars toward the sealed one |
| Aurora night seal ripple | gain 1.1, about 70 px ring, 300 px/s, 1.4 s, slice alpha capped at 0.5 | gain 2.2, about 90 px ring, 260 px/s, **1.6 s**. Where the ring passes, the cap rises to 0.85 and the slice grows by up to 20%. Ambient slices are unchanged (cap 0.5) |

| Shot (before / after) | Moment | Result |
|---|---|---|
| `m1-meteorshower-seal-*.png` | 480 ms after `.just-sealed` (same timing as sprint 8) | Before: a faint thin streak. After: a clear streak in the sealed jar's green, with a glow |
| `m1-auroranight-seal-*.png` | 600 ms after the seal | Before: a barely visible change. After: the band slices near the ring are clearly brighter and taller |

**Layer rules, re-checked:**
- Each seal is still **one** particle against `MAX_PARTICLES` (60): one meteor, or one ripple with at most 4 live.
- 30 fps and the 1x backing store are unchanged. The canvas stays behind the UI at `z-index: -1`.
- The win displays (`skyWinDisplay`, D40) are untouched.
- Reduced motion: the canvas is unchanged at a seal in both scenes, and no win canvas is created.
- Hidden page: both scenes freeze and resume.
- Cost: the bold meteor adds two strokes and one arc per frame for 0.9 s. The ripple's extra cost is only the taller slice draws while it runs. Neither raises the particle count.

## Tests

- `npm run typecheck`: clean.
- `npm test`: 28 files, 472 tests passed, including the per-scene contrast test (`themes.test.ts`). No theme tokens changed.

## Observations for art review (not changed in M1)

- Aurora night: the top band (at 10% of the screen height, 110 px thick) starts behind the board HUD. Its upper edge is faint, but a ripple passing near the left can brighten it slightly behind "Level N". If art review wants it clear, the fix is to start the bands under the HUD the way Winter lights now does.
- The commit hook flagged "hardcoded gameplay values" in `scene-fx.ts`. They are visual tuning for the layer, not gameplay. They follow the file's existing convention and are named constants. Moving them to `game-config.json` would be a separate decision.

## Follow-up: Aurora night bands clear the HUD (D54)

The M1 review noted that the top aurora band started behind the board HUD, the same problem D54 fixed for Winter lights. `scene-fx.ts` now shares the Winter lights HUD measurement. Every band moves down until the top band's highest possible lit pixel, at full ripple stretch and top of sway, sits at least 10 px under the HUD. The measurement is repeated on resize, and the reduced-motion still frame is redrawn.

Canvas alpha behind the HUD was measured by `aurora.cjs`, with `getImageData` over rows 0 to HUD bottom:

| Case | HUD bottom | Max alpha behind HUD, before → after | First lit row, before → after |
|---|---|---|---|
| Pixel 7, 100% text | 66 | 35 → 0 | 29 → 104 |
| iPhone SE, 150% text | 95 | 63 → 0 | 3 → 134 |
| Pixel 7, reduced motion | 66 | 30 → 0 | 30 → 105 |

Screenshots: `m1-auroranight-board-*-before.png` / `-after.png`. The seal ripple (`m1-auroranight-seal-*`) is unchanged; it only brightens the bands.
