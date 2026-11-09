# TD-13: Hint and Shuffle off the main thread (evidence)

`docs/tech-debt.md` TD-13. Hint and Shuffle now run their solver search in a worker. The worker uses the
same module as the level generator (`src/ui/gen-worker.ts`), as a second instance, so a hint never
waits behind a level being made. The protocol and the stale-reply logic are in `src/core/assist.ts`,
with unit tests in `tests/unit/core/assist.test.ts`.

## How it was run

`td13-longtask.cjs <baseUrl> <label> <outDir>` runs Playwright Chromium with the Pixel 7 profile, reduced motion and a CDP
`Emulation.setCPUThrottlingRate` of 4. A `PerformanceObserver` records `longtask` entries.
The save starts at level 141 or 152 with 999 hints and 99 shuffles. The script goes from Home
Play to `#btn-map-play`. `Date.now()` is frozen, so Shuffle's clock seed, and so its board and
cost, is the same in both builds.

- **Before:** the build of `e8d9244`, served with `vite preview --outDir <dist-before> --port 5351`.
- **After:** this branch, `npm run build`, then `npx vite preview --port 5350 --strictPort`.

## Longest main-thread block (ms, 4x throttle)

| Action | Before | After | Same result? |
|---|---|---|---|
| Level 141, Hint on the dealt board | 52 | **0** | yes (jar 1 to 15) |
| Level 141, Shuffle on the dealt board | 0 (under 50) | **0** | yes (same board hash) |
| Level 152, Hint on the dealt board | 527 | **0** | yes |
| Level 152, Hint after an off-plan pour (fresh search) | **1032** | **0** | yes |
| Level 152, Shuffle after two pours | 60 | **0** | yes (same board hash) |
| Level 141 won with Hint only (longest of 62 hints) | 53 | **0** | 62 hints, 62 pours, won in both |

"After" has no long task at all, so no task blocked the main thread for 50 ms or more. The time
from tap to answer is now spent in the worker while the board stays live. In the raw JSON,
`wallMs` includes the script's own waits.

## Other checks (after)

- **Stale reply dropped:** tap Shuffle, then Undo at once. The shuffle never lands and its
  charge is not spent (98 before, 98 after), and the moves go 2 to 1 (`staleShuffle` in `after.json`).
  The old build applied the shuffle synchronously, charged it, and then Undo took it back.
- **Thinking state:** `after-cue-hint*.png` and `after-cue-shuffle*.png` show it. The button is
  `disabled` and `aria-busy="true"`, its label is "Hint, thinking…", it reads "Thinking…" and has a teal ring.
  The other assist button is disabled while it shows (`cue` in `after.json`). Unthrottled, the worker answers in
  about 150-400 ms, which is too quick to photograph reliably. For these frames only, the script holds the worker's
  reply back by 1.5 s with an opt-in test hook (`__delayAssist`). It is inert in every measurement.
- `after-win-with-hints.png` and `before-win-with-hints.png` show the win card after a hint-only clear.
- `*-thinking-*.png` and `*-after-shuffle.png` are frames taken during the measurement. They show the answered state.
- There were no page errors in either run.

## Caveat

CDP CPU throttling slows the page's main thread. It does not obviously slow a dedicated worker,
so the "after" tap-to-answer times are not a 4x-phone figure. The main-thread numbers are the
point: they are zero regardless of how long the worker takes.
