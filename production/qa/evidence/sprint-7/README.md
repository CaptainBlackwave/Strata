# Sprint 7: evidence

## Bug fix: a sealed jar kept showing "?" (owner report, 2026-11-08)

**Report:** on level 26, a jar sealed (cork on) while its bottom layer still showed "?". A sealed jar is one colour by definition, so its buried sand must be that colour and should show.

**Fix:** `settle()` in `src/core/board.ts` reveals every buried unit of a sealed jar (the same place that thaws frozen jars and opens locks on a seal); `makeBoard()` does the same for a jar dealt already full. Tests in `tests/unit/core/board.test.ts` ("sealing reveals buried sand") were written first and seen failing (2 of 3; the third, "a jar that doesn't seal stays buried", guards against over-revealing).

**Also fixed:** a hint's From/To marks stayed on screen after the player made the suggested pour, so "To" could point at the jar that had just sealed. Marks now clear whenever the board changes.

| Screenshot | Check | Result |
|---|---|---|
| `bug-sealed-jar-reveals-buried.png` | Level 26 (the owner's level), played with hints, Pixel 7, colour patterns on. Taken right after the teal jar sealed. (Its marks are from before the hint-clearing fix.) | The sealed teal jar shows all four layers, no "?" | Pass |

Whole-level check after both fixes (`hintclear.cjs`): 36 pours to a win; sealed jars showing "?": 0; hint marks left after a pour: 0; no page errors. `npm test`: 289/289.

## B5: the first 4 ladder scenes (design/gdd/scenes.md 2.1a)

Built: Sea fog (2,500, weather, tier 1), Winter snow (5,050, season, tier 2, 12-01..02-29), Harvest moon (5,800, holiday, tier 2, 09-15..10-15), New Year fireworks (8,800, holiday, tier 3, 12-28..01-07). Layers are in `src/ui/scene-fx.ts` (one canvas, 30 fps cap, 60-particle cap). Sea fog's mist, Winter snow's snow edge and Harvest moon's moon are static CSS.

All shots: Pixel 7 in headless Chromium, motion allowed unless noted. Driver: `b5.cjs` (session scratchpad); it seeds the save and solves level 3 with hints.

| Screenshot | Check | Result |
|---|---|---|
| `b5-seafog-home.png`, `-board.png`, `-win.png` | Pale grey-green palette, static mist low over the sea, no canvas | Pass |
| `b5-wintersnow-home.png`, `-board.png`, `-win.png` | Cool palette, falling flakes, white snow edge on the home sea curve | Pass |
| `b5-harvestmoon-home.png`, `-board.png`, `-win.png` | Dusk palette, large warm moon top right (clear of the logo), lanterns rising up the sides | Pass |
| `b5-newyear-home.png`, `-board.png` | Night palette, faint twinkling sparkle | Pass |
| `b5-newyear-seal-burst.png` | Small burst above the jar that just sealed, in its sand colour | Pass |
| `b5-newyear-win.png` | Win display: bursts around the card in the board's sand colours, ~450 ms after the card opens | Pass. Faint behind the card's 35% backdrop, so art review should judge the size |
| `b5-picker-in-season-dec30.png`, `-scrolled.png` | Clock fixed to 2026-12-30 12:00. Scenes listed by price; "In season" on Winter snow and New Year; "Animated" on tiers 2-3 | Pass |
| `b5-wintersnow-reduced-motion-home.png`, `-board.png` | `reducedMotion: 'reduce'`: one still frame of flakes | Pass |

**Behaviour checks (same run):**
- With Match my clock on and every scene owned:
  - 2026-12-30 12:00 shows `newyear`.
  - 2026-09-20 21:00 shows `harvestmoon`.
  - 2027-02-01 12:00 shows `midday`, because Winter snow is a season scene and never takes over the clock.
- Layer placement:
  - On home the canvas is a child of `#home`; on the board it is a child of `body` (behind `#app`).
  - It has `z-index: -1` and `pointer-events: none`.
  - `elementFromPoint` on a jar returns the jar's sand, not the canvas.
- Reduced motion: the canvas is drawn once and unchanged after 1 s.
- Hidden page: the frames change while visible, freeze while `document.hidden` is true, and resume after.
- There were no page errors.
- `npm test` passed 334/334 and `npm run typecheck` was clean.

**Contrast:** all 18 token pairs in `themes.test.ts` pass for each new scene. These are the tightest pairs:

| Scene | Pair | Ratio |
|---|---|---|
| Sea fog | coral on surface-2 | 5.00 |
| Sea fog | soft ink on bottom | 4.20 (needs 3) |
| Winter snow | coral on surface-2 | 5.17 |
| Harvest moon | accent text on surface-2 | 6.00 |
| New Year | coral on surface-2 | 6.73 |

**Main-thread cost:** measured on Pixel 7 emulation in headless Chromium, which uses software raster, so absolute numbers overstate a phone with a GPU. Each row is a 5 s `requestAnimationFrame` sample. Task and script time come from CDP `Performance.getMetrics` (`TaskDuration`, `ScriptDuration`), in ms of main-thread time per second.

Canvas at 2x pixel ratio (first build):

| Scene | Board task ms/s | Home task ms/s |
|---|---|---|
| Midday (no layer) | 14.1 | 30.7 |
| Winter snow | 108.2 | 121.4 |
| Harvest moon | 96.0 | 110.7 |
| New Year | 86.1 | 100.3 |

Script time was only 2.9 to 7.1 ms/s, so the cost was raster. The canvas was then switched to a 1x backing store, which is what ships:

| Scene | Board task / script ms/s | Home task / script ms/s | Mean / p95 frame |
|---|---|---|---|
| Midday (no layer) | 15.8 / 3.0 | 31.3 / 3.0 | 16.7 / 16.8 ms |
| Sea fog (CSS only) | 15.3 / 3.2 | 34.0 / 3.2 | 16.7 / 16.7 ms |
| Winter snow | 47.9 / 6.0 | 64.4 / 5.9 | 16.7 / 16.7 ms |
| Winter snow, reduced motion (still) | 17.0 / 4.1 | 16.2 / 3.1 | 16.7 / 16.7 ms |
| Harvest moon | 43.8 / 6.9 | 57.6 / 6.7 | 16.7 / 16.7 ms |
| Harvest moon, reduced motion | 15.4 / 3.2 | 15.7 / 3.1 | 16.7 / 16.7 ms |
| New Year | 42.7 / 6.1 | 57.7 / 6.1 | 16.7 / 16.7 ms |
| New Year, reduced motion | 14.8 / 3.0 | 16.3 / 3.1 | 16.7 / 16.7 ms |

What the numbers show:
- An animated layer adds about 28 to 33 ms of main-thread time per second, about 3% of one core, in software raster. Script is about 3 ms/s of that.
- No frame was dropped. p95 stayed within 0.1 ms of baseline.
- Under reduced motion the cost falls back to baseline.

Not yet done: a measurement on a real phone with a GPU.
