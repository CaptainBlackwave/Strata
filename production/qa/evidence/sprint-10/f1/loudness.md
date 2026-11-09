# Sprint 10 F1: sound-effect loudness, before and after

> Sprint: `production/sprints/sprint-10.md` F1. Decisions: D64 (richer sounds, new events), D68 (calm, a little richer), D67 (loudness measured before the sign-off page).
> Measured 2026-11-09 in headless Chromium 153.0.8010.12 (Playwright), `OfflineAudioContext`, mono, 48 kHz, 2.6 s per render.

## Method

- **Before** is the engine at `fbb2874` (the sprint-10 plan commit, the code before this work), from `git show fbb2874:src/ui/audio.ts`. That engine has no injection point, so the harness replaces `window.AudioContext` with a function that returns the offline context.
- **After** is the new engine (`src/ui/audio.ts` with `src/ui/sfx.ts`), given the offline context through `new GameAudio(options, { createContext })`.
- Noise is seeded (a fixed LCG; seed 7) in both, so a re-run gives the same numbers.
- Each event renders alone, with sound on, music off and haptics off. **After at 100%** is the worst case (sound volume 1.0). The default sound volume is 0.8 (D66), which is 1.9 dB lower. The master gain is 0.7 in both engines.
- **Peak** is the highest absolute sample. **RMS** is taken over the active span, from the first to the last sample above −60 dBFS. **ms** is the length of that span.
- **Cap** is the event's own peak cap (`SOUNDS[event].capDb` in `src/ui/sfx.ts`). `tests/unit/ui/sfx.test.ts` also checks a worst-case envelope bound against each cap in Node.
- The tools are kept beside this file: `harness.ts` (bundled with Vite's esbuild), `measure.cjs` (uses `require('/opt/node22/lib/node_modules/playwright')`), and the raw `loud.json`.

## Results (dBFS)

| Event | Detail | Cap (dBFS) | Before: peak / RMS / ms | After at 100%: peak / RMS / ms | After at 80% (default): peak / RMS | Under cap and −1 |
|---|---|---|---|---|---|---|
| select | — | -16 | -18.6 / -32.5 / 44 | -20.2 / -33.8 / 43 | -22.1 / -35.6 | yes |
| deselect | — | -18 | -22.0 / -35.6 / 37 | -22.8 / -36.1 / 35 | -24.7 / -37.9 | yes |
| nope | — | -12 | -14.2 / -26.6 / 77 | -16.6 / -29.1 / 85 | -18.5 / -30.8 | yes |
| pour | units:1 | -12 | -19.7 / -37.2 / 235 | -22.3 / -41.6 / 293 | -24.2 / -43.6 | yes |
| pour | units:4 | -12 | -19.9 / -37.4 / 445 | -22.5 / -41.3 / 428 | -24.5 / -43.2 | yes |
| land | pitch:0 | -14 | -20.4 / -32.7 / 56 | -22.3 / -34.5 / 75 | -24.3 / -36.2 | yes |
| land | pitch:7 | -14 | -20.4 / -32.8 / 56 | -22.3 / -34.6 / 75 | -24.3 / -36.3 | yes |
| seal | — | -8 | -12.1 / -30.1 / 363 | -17.6 / -32.2 / 745 | -19.5 / -34.0 | yes |
| win | — | -6 | -15.3 / -28.9 / 1082 | -17.7 / -31.4 / 1309 | -19.6 / -33.2 | yes |
| coin | — | -18 | -29.2 / -39.8 / 118 | -26.2 / -40.1 / 138 | -28.2 / -41.8 | yes |
| booster | — | -14 | -19.9 / -34.6 / 159 | -21.8 / -36.1 / 170 | -23.7 / -37.8 | yes |
| shuffle | — | -16 | -19.1 / -37.4 / 295 | -23.7 / -41.7 / 297 | -25.6 / -43.6 | yes |
| mapStone | — | -18 | (new) | -23.4 / -39.0 / 79 | -25.4 / -40.6 | yes |
| locked | — | -18 | (new) | -22.9 / -35.2 / 56 | -24.8 / -37.0 | yes |
| unlock | — | -12 | (new) | -20.9 / -34.8 / 479 | -22.8 / -36.6 | yes |
| shell | — | -12 | (new) | -23.6 / -37.6 / 450 | -25.6 / -39.4 | yes |
| sceneBought | — | -12 | (new) | -21.8 / -35.7 / 629 | -23.8 / -37.5 | yes |
| playHere | — | -14 | (new) | -23.0 / -35.3 / 362 | -24.9 / -37.0 | yes |

**Loudest peak after:** win, −17.7 dBFS at full volume (−19.6 at the default). That leaves 16.7 dB of headroom under −1 dBFS, with no clipping anywhere. **Loudest before:** seal, −12.1 dBFS (the cork pop).

## Reading the numbers

- After this work, every event peaks between −26 and −16 dBFS at full volume, so the spread is narrower than before (−29 to −12). The old seal's cork click was the outlier; the new cork is softer, and the warm chime carries the seal (D68).
- Seal and win are longer (0.75 s and 1.3 s) but no louder: the win's bloom is a chord that swells in under the bell arpeggio. Both stay calm.
- The pour still grows with the units poured: 293 ms for 1 unit, 428 ms for 4, with more grains and more low body. Its peak is about 2.6 dB lower than before. The first pass was 7 dB lower and too faint for the most frequent sound, so the hiss and grains were raised once before this measurement.
- The coin is about 3 dB louder at its peak, but its RMS is unchanged. The old version used square waves, so it read as harsher, not louder; the new one is sine and triangle.
- One worry was that a sound played while another rings (a land just after a pour, or the coin count-up during the win) could clip. Two simultaneous events add at most about 6 dB, so the loudest pair (win and seal) would still peak near −11 dBFS.
- The renders of the before engine logged 12 `InvalidStateError: cannot resume an offline context that has not started` page errors. The old `unlock()` calls `resume()` on any suspended context. The new engine skips `resume()` for an `OfflineAudioContext`, and its renders logged no errors.

## Not measured here

- Perceived loudness (LUFS) and how each sound feels: the owner judges those on the sign-off page (F7, D67).
- Music: F2 measures it after the move to `src/ui/music.ts`.
