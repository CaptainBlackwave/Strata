# Sprint 10 evidence: F1 sound effects, F3 volume sliders, F4 haptics

> Sprint: `production/sprints/sprint-10.md` F1, F3, F4. Decisions: D64, D66, D68 (D67 for the loudness table). Recorded 2026-11-09 on 0.9.1 plus this branch.

## F1: sound effects
- The recipes are data in `src/ui/sfx.ts` (`SOUNDS`), and `src/ui/audio.ts` synthesises them. Everything is WebAudio oscillators and filtered noise: no files, nothing sampled, nothing from another game.
- Richer events:
  - pour follows the units poured;
  - land has a soft thud under its note;
  - seal is a softer cork with a warm three-note chime;
  - win is a swelling chord under a bell arpeggio;
  - coin is a soft rising third, with no square edge.
- New events and where they are called:

| Event | Called from |
|---|---|
| `mapStone` | `onStone`, cleared stone (`src/ui/screens/map.ts`) |
| `locked` | `onStone`, locked stone (`src/ui/screens/map.ts`) |
| `shell` | `renderShell`, delayed 0.8 s (`src/ui/screens/win.ts`) |
| `unlock` | `showUnlocks`, delayed 1.2 s (`src/ui/screens/win.ts`) |
| `sceneBought` | `confirmScene`, replacing `coin` (`src/ui/screens/sheets/scenes.ts`) |
| `playHere` | `playHere` (`src/ui/screens/other-tab.ts`) |

- Loudness: `f1/loudness.md` has peak and RMS dBFS before and after for every event, measured offline in Chromium. Every event is under its own cap and under −1 dBFS; the loudest is win at −17.7 dBFS at full volume.
- Tests:
  - `tests/unit/ui/sfx.test.ts`: every event has a recipe; the voices are well formed and short; a worst-case envelope bound stays under each cap; the pour follows the units.
  - `tests/unit/ui/audio.test.ts`: a fake AudioContext checks the buses, clamping, `configure`, routing into `sfxBus`, delays, and mute.

## F3: volume sliders
- The save gains `settings.soundVolume` and `settings.musicVolume`, from 0 to 1 with a default of 0.8. A missing or invalid value gets the default; an out-of-range number is clamped. Old saves, v1 migrations and save codes all round-trip (`tests/unit/ui/settings-volume.test.ts`, written first and seen failing).
- The engine's signal paths:
  - sound: effects → `sfxBus` (sound volume) → `master`;
  - music: `musicBus` (the music's own fades) → `musicLevel` (music volume) → `master`.
- The switches still mute, and a muted slider is disabled.
- Moving the sound slider plays a short preview at the new level. The music slider applies live.
- Each slider is labelled by its own visible text, `aria-valuetext` reads as a percentage, and the arrow keys move it in steps of 5.
- Screenshots in `f3/`, from `f3/shots.cjs`:

| File | Device | Text | Music |
|---|---|---|---|
| `settings-se-100-music-muted.png` | iPhone SE, 320 px | 100% | muted, slider disabled |
| `settings-se-150.png` | iPhone SE, 320 px | 150% | on |
| `settings-pixel7-100-music-muted.png` | Pixel 7 | 100% | muted |
| `settings-pixel7-150.png` | Pixel 7 | 150% | on |

- Measured in each screenshot (`f3/result.json`): no horizontal overflow, each slider is 44 px tall, and its accessible name is "Sound volume" or "Music volume".

## F4: haptics
- There is one table, `HAPTICS` in `src/ui/sfx.ts`. Every event has a pattern, or `null` for an explicit none. Pulses are at most 40 ms, and a pattern lasts at most 200 ms in all.
- Seal is a double tap, `[12, 40, 24]`. Win is a triple, `[16, 50, 16, 50, 36]`.
- The new events have patterns: mapStone 6, locked `[6, 30, 6]`, unlock `[10, 50, 10]`, shell `[8, 40, 16]`, sceneBought `[10, 40, 20]` and playHere 10.
- Coin, pour and deselect do not vibrate.
- Tested in `tests/unit/ui/sfx.test.ts` ("haptics table").
- **iPhone browsers ignore `navigator.vibrate`.** Safari and every iOS browser, which all use WebKit, do not support the Vibration API, so haptics only work on Android browsers. On iPhone the Vibration switch does nothing. The engine guards the call, so there is no error.

## Smoke run (Playwright, Pixel 7, reduced motion)
- Steps:
  - `npm run build`, then `npx vite preview --port 5410 --strictPort`.
  - Seeded the save with `seenWhatsNew: "0.9.1"`, `tutorialDone: true` and `level: 5`, plus `hint: 99` in the wallet. The starting 3 hints and 100 coins don't last a whole level.
  - Home's Play opened the map, then `#btn-map-play` was clicked with `force: true`.
  - Pressed `h`, then clicked `#board .hint-from` and `#board .hint-to`, until the level was won.
- Result: level 5 was won in 18 hinted pours, "Level cleared" (`f3/smoke-win-pixel7.png`).
- Settings after a reload: three ArrowLeft presses on Sound volume and two ArrowRight presses on Music volume saved `soundVolume: 0.65` and `musicVolume: 0.9`, with `aria-valuetext` reading "65%" and "90%" (`f3/smoke-settings-after-keys-pixel7.png`).
- Page errors: **none** (`f3/result.json`).
- Also clean: `npm test` (610 tests in 43 files), `npm run typecheck` and `npm run build`.

## Not covered here
- Hearing the sounds is for the owner, on the sign-off page (F7, D67).
- Haptics on a real Android phone.
- Music per scene is F2.
