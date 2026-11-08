# Sprint 8 evidence: scenes (P1) and southern hemisphere seasons (P2)

Sprint: `production/sprints/sprint-8.md` P1, P2. Design: `design/gdd/scenes.md` §2.1a (D32, D33, D37, D40, D42).

All shots are Pixel 7 in headless Chromium, with motion allowed unless noted. The driver is `p1.cjs` in the session scratchpad (`/tmp/claude-0/-home-user-Strata/52dd5b50-4e4a-5491-89dc-6ff4ab94082a/scratchpad/p1.cjs`), adapted from sprint 7's `b5.cjs`. It seeds the save, solves level 3 with hints, and serves on port 5196.

## P1: the other 8 ladder scenes

| Rung | Id | Shown as | Kind | Tier | Price | Window |
|---|---|---|---|---|---|---|
| 2 | `highsummer` | High summer | season | 1 | 2,900 | 06-01..08-31 |
| 3 | `springblossom` | Spring blossom | season | 1 | 3,300 | 03-01..05-31 |
| 4 | `autumnshore` | Autumn shore | season | 1 | 3,800 | 09-01..11-30 |
| 5 | `rainbowafterrain` | Rainbow after rain | weather | 1 | 4,350 | any time |
| 8 | `softrain` | Soft rain | weather | 2 | 6,650 | any time |
| 9 | `winterlights` | Winter lights | holiday | 2 | 7,650 | 12-01..01-06 |
| 11 | `meteorshower` | Meteor shower | sky | 3 | 10,100 | 08-10..08-14 |
| 12 | `auroranight` | Aurora night | sky | 3 | 11,650 | any time |

The prices are `round50(2500 × 1.15^(n−1))`, and a test checks them. All 12 rungs total 72,550. The scenes are appended to `themes.list`: `git diff` on `game-config.json` shows 244 lines added and 0 removed, so the original 8 are byte-identical (D27).

| Screenshot | Check | Result |
|---|---|---|
| `p1-highsummer-home.png`, `-board.png`, `-win.png` | Bright sky palette, a sun top right on Home, a warm haze on the board's horizon. No canvas | Pass |
| `p1-springblossom-*.png` | Pink palette, still petals near the edges, clear of the centred text. No canvas | Pass |
| `p1-autumnshore-*.png` | Warm sand palette, still leaves near the edges. No canvas | Pass |
| `p1-rainbowafterrain-*.png` | Soft blue palette, a static CSS rainbow arc behind the Home content | Pass. The arc passes behind the title and tagline, which stay readable; art review should judge it |
| `p1-softrain-*.png` | Grey-blue palette, thin slanted rain streaks (tier 2) | Pass |
| `p1-winterlights-*.png` | Evening palette, a string of softly twinkling bulbs in three swags along the top (tier 2) | Pass. The bulbs sit behind the top HUD row; art review should check the glow behind "Level 3" |
| `p1-meteorshower-home.png`, `-board.png` | Night palette, twinkling stars, at most 2 slow ambient meteors | Pass |
| `p1-meteorshower-seal.png` | A meteor in the sealed jar's colour streaking over the jar | Pass. It is small; check it at full size |
| `p1-meteorshower-win.png` | About 1.4 s after the card opens: meteors in the board's colours above and below the card | Pass |
| `p1-auroranight-home.png`, `-board.png` | Deep teal night with three slow aurora bands across the top | Pass |
| `p1-auroranight-seal.png` | A ripple of brightness spreading along the bands from the sealed jar | Pass. Subtle in a still; it reads better in motion |
| `p1-auroranight-win.png` | Bands above and below the card, with a brighter wave sweeping across them | Pass |
| `p1-softrain-reduced-motion-home.png`, `-board.png` | `reducedMotion: 'reduce'`: one still frame of streaks | Pass |
| `p1-auroranight-reduced-motion-home.png`, `-board.png` | Still bands | Pass |
| `p1-meteorshower-reduced-motion-home.png`, `-board.png` | Still stars and one frozen meteor | Pass |

**Behaviour checks (same run):**
- Layer placement for every tier 2 and 3 scene:
  - On Home the canvas is a child of `#home`; on the board it is a child of `body`.
  - It has `z-index: -1`, `pointer-events: none` and a 412 px backing store (1x on the 412 px Pixel 7 viewport).
  - `elementFromPoint` on a jar returns the jar's sand.
- Tier 1 scenes create no canvas.
- Win display: while it plays, `#win canvas.scene-fx-win` exists at z 0 under the card (z 1) with `pointer-events: none`. It is gone 5.5 s later, for both Meteor shower and Aurora night.
- Under reduced motion, no win canvas is created.
- Reduced motion: the canvas data URL is unchanged after 1 s, for Soft rain, Aurora night and Meteor shower.
- Hidden page: for Soft rain, Winter lights, Meteor shower and Aurora night, the frames change while visible, freeze while `document.hidden` is true, and resume after.
- Match my clock, with every scene owned:
  - On 2026-12-10 12:00 it shows `winterlights`.
  - On 2026-12-30 12:00 it shows `newyear`. That date is inside both windows, and the higher rung wins.
  - On 2026-08-12 12:00 it shows `midday`. Meteor shower is in season, but it is a sky scene and does not take over.
- There were no page errors and every level was solved.

**Particle budgets (by construction, `scene-fx.ts`):**
- Soft rain: 48 streaks.
- Winter lights: 18 bulbs.
- Meteor shower: 26 stars, up to 2 ambient meteors, and seal meteors up to the 60 cap.
- Aurora night: 3 bands × 16 slices = 48, plus at most 4 ripples.
- Win displays: 12 meteors, or 3 × 16 slices.
- Every layer runs at 30 fps or less, at 1x.

**Contrast:** all 18 token pairs in `themes.test.ts` pass for each new scene. The two tightest pairs per scene:

| Scene | Tightest pair | Next |
|---|---|---|
| High summer | coral on surface-2, 5.23 | accent text on surface-2, 5.25 |
| Spring blossom | coral on surface-2, 5.29 | accent text on surface-2, 5.47 |
| Autumn shore | accent text on surface-2, 5.20 | coral on surface-2, 5.32 |
| Rainbow after rain | coral on surface-2, 5.07 | accent text on surface-2, 5.46 |
| Soft rain | coral on surface-2, 5.50 | accent text on surface-2, 5.84 |
| Winter lights | coral on surface-2, 6.12 | accent text on surface-2, 6.49 |
| Meteor shower | coral on surface-2, 7.12 | accent text on surface-2, 7.94 |
| Aurora night | coral on surface-2, 6.66 | accent text on surface-2, 7.61 |

All of these pairs need 4.5.

## Main-thread cost (tier 2 and 3)

The method is the same as sprint 7 B5:
- Pixel 7 emulation in headless Chromium, which uses software raster, so absolute numbers overstate a phone with a GPU.
- Each row is a 5 s `requestAnimationFrame` sample in a fresh context.
- Task and script time come from CDP `Performance.getMetrics` (`TaskDuration`, `ScriptDuration`), in ms of main-thread time per second.

| Scene | Board task / script ms/s | Home task / script ms/s | Mean / p95 frame (board) |
|---|---|---|---|
| Midday (no layer, baseline) | 14.2 / 2.8 | 31.8 / 3.0 | 16.7 / 16.8 ms |
| Soft rain | 45.9 / 5.2 | 58.1 / 5.9 | 16.7 / 16.7 ms |
| Soft rain, reduced motion | 14.2 / 3.1 | 15.3 / 2.9 | 16.7 / 16.8 ms |
| Winter lights | 68.1 / 6.7 | 62.0 / 7.4 | 16.7 / 16.8 ms |
| Winter lights, reduced motion | 13.4 / 2.7 | 14.6 / 2.5 | 16.7 / 16.7 ms |
| Meteor shower | 43.3 / 6.6 | 57.7 / 7.8 | 16.7 / 16.7 ms |
| Meteor shower, reduced motion | 14.1 / 2.7 | 13.8 / 2.7 | 16.7 / 16.7 ms |
| Aurora night | 69.2 / 7.7 | 84.3 / 8.5 | 16.7 / 16.7 ms |
| Aurora night, reduced motion | 13.1 / 2.8 | 14.8 / 2.8 | 16.7 / 16.7 ms |

What the numbers show:
- No frame was dropped. Mean and p95 frame times stayed within 0.1 ms of baseline in every row.
- Soft rain and Meteor shower cost about the same as sprint 7's layers: +26 to +32 ms/s over baseline, about 3% of one core in software raster.
- Winter lights (+30 board, +54 home) and Aurora night (+55 board, +53 home) cost more. Script time is still under 9 ms/s, so the rest is raster:
  - Winter lights spends it on the glow sprite per bulb.
  - Aurora night spends it on 48 large, overlapping, alpha-blended slices.
- If a real-phone measurement shows Aurora night too heavy, two particle-specific cuts are available:
  - Draw the bands into a half-height offscreen canvas and blit it once, which cuts the fill area.
  - Use 10 slices per band instead of 16.

  Either would fit the existing budget. Neither is needed for the 30 fps / 60-particle rule, which holds.
- Under reduced motion the cost falls back to baseline.

Not yet done: a measurement on a real phone with a GPU.

## P2: Southern hemisphere seasons (D42)

| Screenshot | Check | Result |
|---|---|---|
| `p2-picker-june-north.png` | Clock fixed to 2026-06-15 12:00, switch off. "In season" on High summer only | Pass |
| `p2-settings-southern-on.png` | Settings sheet with "Southern hemisphere seasons" turned on through the UI. The save holds `settings.southern: true` | Pass |
| `p2-picker-june-south.png` | Same date, switch on. "In season" moves to Winter snow (Jun 1 – Aug 31 in the south), and High summer loses it | Pass |

**Checks:**
- With the switch on and Match my clock on, the scene stays `midday`, because season scenes never take over the clock.
- Holiday and sky windows keep their dates. The unit tests cover Winter lights, New Year, Harvest moon and Meteor shower.
- Season windows keep whole months. In the south, High summer ends Feb 28 in common years and Feb 29 in leap years.
- `tests/unit/core/themes.test.ts` (core) and `tests/unit/ui/settings-southern.test.ts` (the save field: default false, repaired on load, round-trips through a write and a save code) were written first and watched failing: 8 and 4 failures, before the code existed.
- `npm test` passed 404/404, and `npm run typecheck` was clean.
