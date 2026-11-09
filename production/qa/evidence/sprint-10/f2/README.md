# Sprint 10 F2: music per scene (D65), evidence

Story: `production/sprints/sprint-10.md` F2. Decision: D65 (a variation per scene: the same calm
style, with each scene's own key, tempo and timbre). Code: `src/ui/music.ts` (`SceneMusic`, the scene
table and the phrase walker). `src/ui/audio.ts` `startMusic`/`stopMusic` delegate to it, and
`GameAudio.setScene` is called from `applyTheme` (`src/ui/theme.ts`). Tests: `tests/unit/ui/music.test.ts`.

## What changed, by ear

- **0.9.1:** one fixed 16-step sine pattern on a 620 ms timer (it loops every 9.9 s) over a sea swell.
- **Now:** every scene has its own key and scale, tempo (520 to 860 ms per step), lead timbre and sea level,
  plus an optional layer. The tune is a seeded random walk over the scale in eight-step
  question-and-answer phrases with rests and cadences, over a soft low note per phrase, so there is no
  loop. A scene change crossfades over 2 s (equal power). The table, with each scene's key, tempo, lead and
  layer, is the doc comment on `MUSIC` in `src/ui/music.ts`. All values are presentation values, so they
  stay in code (exempt from the data-driven rule, D31).
- The music **stops while the page is hidden** and comes back when it is shown (0.9.1 kept playing).

Layers: Soft rain has a rain hiss, Aurora night has a high sparkle (Winter snow and Rainbow after rain have
a fainter one), New Year fireworks has an occasional low thump, and Meteor shower has an occasional falling
streak. Winter lights has a bell-like lead (a sine plus a quieter partial at 2.76×). Moonlit tide is slower
(860 ms) and darker (a 700 Hz low-pass on the lead).

## How the clips were made

Two methods, both in Chromium's own WebAudio engine (Playwright, `--autoplay-policy=no-user-gesture-required`).

1. **Offline renders** (`clips/<scene>.ogg`, `scripts/render-offline.cjs`). esbuild bundles
   `src/ui/music.ts` into a blank page. Each clip is an `OfflineAudioContext` (stereo, 48 kHz, 20 s) with
   the game's 2 s noise buffer (seeded, so it can be reproduced) and an output gain of 0.35, which is the
   game's `musicBus` (0.5) × `master` (0.7). `SceneMusic.start()` then `pump(20)` schedules the whole
   clip up front (the time-stepped scheduler). The crossfade clip suspends the render at 10 s to call
   `setScene('softrain')`. `before-midday.ogg` is the 0.9.1 `startMusic` graph (`git show
   fbb2874:src/ui/audio.ts`) with its steps at exact times. Clips are 16-bit WAV, then Ogg Vorbis q5.
   Loudness was measured on the WAV.
2. **Real-time captures from the built game** (`clips/after-app-<scene>.ogg`, `clips/before-app-midday.ogg`,
   `scripts/capture-app.cjs`). `npm run build`, then `npx vite preview --port 5420 --strictPort`. The 0.9.1
   build (fbb2874, from `git archive`) was served on 5421. An init script subclasses `AudioContext` so its
   `destination` is a GainNode feeding the real destination and a `MediaStreamAudioDestinationNode`, which
   `MediaRecorder` records as Opus in WebM at 256 kb/s. The save `strata.save.v2` is seeded (level 5,
   tutorial done, `seenWhatsNew` = package.json's version, all 16 scenes owned). The script taps Play
   (which unlocks audio), then picks each scene in the Scenes sheet, waits 3 s for the crossfade and records
   20 s. Loudness was measured on the WebM (`scripts/measure.py`), which was then re-encoded to Opus
   96 kb/s in Ogg to keep the repo small.

Measured with `/usr/bin/ffmpeg -af ebur128=peak=true`: integrated loudness (I), loudness range (LRA) and
true peak. `scripts/level.py` set each scene's gains from a first render, so they would all sit at
-38.5 LUFS. That target is the 0.9.1 music's level, so players hear the same overall loudness.

## Loudness table

| Clip | Scene | Offline I (LUFS) | Offline LRA (LU) | Offline true peak (dBTP) | Seed 7 I (LUFS) | App capture I (LUFS) | App true peak (dBTP) | Render speed (× real time) |
|---|---|---|---|---|---|---|---|---|
| `before-midday.ogg` | 0.9.1 music | -38.8 | 1.5 | -28.5 | -38.8 | -38.7 | -28.5 | 225 |
| `midday.ogg` | Midday | -38.5 | 1.6 | -28.0 | -38.8 | -38.7 | -27.8 | 152 |
| `dawn.ogg` | Dawn | -38.5 | 1.9 | -27.1 | -38.6 | -39.0 | -27.5 | 110 |
| `sunset.ogg` | Sunset | -38.5 | 2.1 | -26.5 | -38.6 | -38.7 | -27.4 | 114 |
| `moonlit.ogg` | Moonlit tide | -38.4 | 1.5 | -27.0 | -38.6 | -38.6 | -27.7 | 124 |
| `seafog.ogg` | Sea fog | -38.5 | 1.8 | -27.2 | -38.4 | -38.4 | -27.0 | 120 |
| `wintersnow.ogg` | Winter snow | -38.5 | 1.9 | -27.6 | -38.3 | -38.3 | -27.9 | 175 |
| `harvestmoon.ogg` | Harvest moon | -38.4 | 1.6 | -27.1 | -38.6 | -38.4 | -27.6 | 116 |
| `newyear.ogg` | New Year fireworks | -38.6 | 2.9 | -20.3 | -39.1 | -38.9 | -20.5 | 102 |
| `highsummer.ogg` | High summer | -38.6 | 2.5 | -26.3 | -38.7 | -38.9 | -25.2 | 96 |
| `springblossom.ogg` | Spring blossom | -38.5 | 1.5 | -27.1 | -38.8 | -38.6 | -28.1 | 137 |
| `autumnshore.ogg` | Autumn shore | -38.5 | 1.9 | -25.7 | -38.5 | -38.7 | -27.5 | 115 |
| `rainbowafterrain.ogg` | Rainbow after rain | -38.5 | 1.8 | -27.3 | -38.2 | -38.6 | -28.4 | 151 |
| `softrain.ogg` | Soft rain | -38.5 | 1.3 | -27.5 | -38.5 | -38.2 | -27.3 | 97 |
| `winterlights.ogg` | Winter lights | -38.6 | 1.8 | -27.6 | -38.7 | -38.8 | -27.4 | 127 |
| `meteorshower.ogg` | Meteor shower | -38.4 | 2.0 | -27.7 | -38.5 | -38.5 | -28.5 | 168 |
| `auroranight.ogg` | Aurora night | -38.5 | 2.1 | -27.4 | -38.2 | -38.1 | -27.3 | 175 |
| `crossfade-midday-to-softrain.ogg` | Midday to Soft rain at 10 s | -38.6 | 1.4 | -28.1 | -38.5 | — | — | 128 |
| `midday-2min.ogg` | Midday, 130 s | -38.6 | 1.8 | -26.8 | — | — | — | 61 |

- **Level across scenes:** offline -38.6 to -38.4 LUFS (0.2 LU), an unseen seed -39.1 to -38.2 (0.9 LU),
  and the real app -39.0 to -38.1 (0.9 LU). All are well inside ±2 LU, and the 0.9.1 music measures -38.7.
- **True peak:** at most -20.3 dBTP (New Year's thump), so there is plenty of headroom below -1 dBTP even
  with sound effects on top.
- Raw numbers: `clips/loudness-offline.json`, `clips/loudness-offline-seed7.json`, `clips/loudness-app.json`.

## Smoke run and other checks (built game, Chromium)

- Every one of the 16 scenes was chosen in the Scenes sheet with music on. In each case `body[data-theme]`
  followed, the music crossfaded, and there were **no page errors** in either build. Screenshots:
  `after-first-scene.png` (midday, playing), `after-end.png` (the Scenes sheet after the last pick, Aurora
  night), `before-first-scene.png` and `before-end.png` (0.9.1).
- **Hidden page:** an AnalyserNode on the same tap gives the loudest 100 ms RMS. Now: -34.2 dBFS playing,
  **silent (-∞) while hidden**, -35.4 when shown again. 0.9.1: -33.7, then -34.1 while hidden (it kept
  playing). MediaRecorder writes no frames for a silent graph, so silence is checked this way, not from a
  clip.
- **CPU:** main-thread script time while the music plays (CDP `ScriptDuration`) is 0.4 to 0.6 ms per
  second on scenes without an animated layer. 0.9.1 was 0.3 ms/s. Scenes with an animated canvas
  (tier 2 and 3) show about 40 ms/s of task time, which is scene-fx, not the music. Each note uses at most
  3 nodes (unit-tested) and is disconnected when it ends. A steady scene keeps 7 long-lived nodes (its bus, two
  noise sources, a low-pass, the swell gain, the LFO and its depth), or 10 with rain. Offline, Chromium renders the music at 96 to 175× real time.
- **Switch:** `configure()` still starts and stops the music through `startMusic`/`stopMusic`, and the other
  tab still forces it off. The volume slider (F3, D66, `musicLevel` after `musicBus`) belongs to another
  task and is not in this branch.

## Unit tests

`tests/unit/ui/music.test.ts`, 18 tests. They were seen failing first (module missing), and then failing
against deliberate defects: a linear crossfade fails the equal-power test, a `stop()` that keeps its timer
fails three tests, and a walker that repeats its last phrase fails two. They check that:

- every scene in the config has an entry (or is listed as using the fallback), and an unknown scene gets midday;
- tempos are within 480 to 900 ms;
- the named scenes have their layer or tone;
- the walker is deterministic for a seed, never repeats a phrase back to back, has rests and cadences, and
  varies over two minutes;
- `setScene` while playing schedules two equal-power curves of 2 s;
- the old scene's sources stop and every node is disconnected;
- flicking through previews keeps at most two scenes sounding;
- `stop()` leaves no timer (injected and real) and nothing more is scheduled;
- every scene uses at most 3 nodes per note;
- a restart uses the last scene asked for.

## For the owner (F7 sign-off)

- Listen to `midday-2min.ogg` for a loop seam. The tune never repeats. The 2 s noise buffer under the sea
  is played twice, at 1× and 0.71×, so the swell does not repeat on a 2 s cycle.
- Winter lights' bell partial is inharmonic (2.76×) on purpose. If it sounds sour, a 3× or 4× partial is
  a one-line change in the table.
- The music's overall level is unchanged from 0.9.1 (about -38.5 LUFS at full volume). If it should sit
  louder or quieter against the sound effects, that is one number (`musicBus` 0.5) or the F3 slider.
