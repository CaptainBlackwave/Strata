# Sprint 8 P4: instant level starts (evidence)

Task: `production/sprints/sprint-8.md` P4, decision D46. Date: 2026-11-08.

## What changed

- `src/ui/gen-worker.ts`: a module Web Worker that runs `prepareLevel` (which wraps `generateLevel`).
- `src/core/prefetch.ts`: a DOM-free cache keyed by level and config fingerprint (FNV-1a over the
  config JSON), plus a one-at-a-time request queue. A missing worker, a worker error and a stuck
  worker (8 s timeout, after which the worker is replaced) all fall back to synchronous generation.
- `src/ui/main.ts` (`startLevel` and boot only):
  - A cache hit starts the level instantly.
  - If the worker is already making the level, `startLevel` waits for it. A toast
    (`t.preparingLevel`) appears only after 150 ms.
  - Otherwise it generates synchronously, as before.
  - After every start it prefetches `n + 1` (which also covers the level after a replay) and
    `save.level`.
  - Boot prefetches the current level and the next one. The home screen covers the board, so the
    board behind it is built when the worker delivers.
  - A QA `?level=` launch stays synchronous.
- `public/sw.js`:
  - On install and on each online navigation it also pre-caches the chunks that the cached
    scripts load by URL (`new URL("x.js", import.meta.url)`), which includes the worker chunk.
  - Fix: asset lookups use `ignoreVary: true`. `vite preview` sends `Vary: Origin`, and module
    scripts are requested in CORS mode with an `Origin` header, so the cached JS and CSS never
    matched and the built site did not load offline. This bug existed before P4, in the sprint-3
    handler.

## Timings: next-level start, headless Chromium, CPU throttled 4x (CDP `Emulation.setCPUThrottlingRate`)

**Method.** The probe script is `measure.cjs`, kept outside the repo.

- Viewport is 390x844. The save is seeded with `seenMechanics`, so no intro card opens, which
  matches a returning player.
- The probe waits 12 s on the previous screen. It then times one synchronous `click()` with
  `performance.now()`. Every path that was measured is synchronous.
- **Next**: launch `?level=N-1`, then click Next, which starts level N.
- **Play**: the save is at level N. Open home, then click Play.
- **Before** is a build of `71f71f4`, the commit just before P4. **After** is this branch's build.
  Both were run with `vite preview`.

| Level | Path | Before (ms) | After (ms) | Target |
|---|---|---|---|---|
| 141 | Next | 2848 / 2781 | **13 / 15 / 8** | < 50 met |
| 185 | Next | 953 | **10 / 14** | < 50 met |
| 141 | Play from home | 2510 / 2296 | 75 / 96 / 47 | see note |
| 185 | Play from home | 960 | 33 / 47 | |
| 5 (control) | Play from home | 81 | 57 | |
| 141 | Boot (page load to `load`) | 3966 / 2830 (the board was generated at boot) | 290–360 | |

Dev server (`vite`, unminified) before → after, same probe: 141 Next 2896 → 63 ms; 185 Next 924 → 29 ms.
These dev runs did not seed `seenMechanics`, so the mechanic intro card was built during the start.

**Note on Play.**

- Play on level 5 costs 57–81 ms both before and after P4, even though generating level 5 takes
  under 1 ms. That cost is Play itself: closing the full-screen home layer (style and layout of
  the whole page) and unlocking audio. It is not the level start.
- The level-start part of Play is now a cache hit, the same as Next. Play's own overhead is
  outside P4's scope and is a candidate for P6/P7.
- Boot no longer generates the level on the main thread. On level 141 the page used to block for
  about 3–4 s at load under throttling.

## Offline check (built site, `vite preview --port 5199`)

**Method.** The probe script is `offline.cjs`.

1. The first visit is online. The script waits for `navigator.serviceWorker.ready`.
2. It then sets `context.setOffline(true)`, reloads `?level=140`, waits 6 s and clicks Next.

| Check | Result |
|---|---|
| Cache contents after first visit | `/`, manifest, 3 icons, `assets/index-*.js`, `assets/index-*.css`, **`assets/gen-worker-*.js`** |
| Page controlled by the SW after the offline reload | yes |
| Worker started offline | `assets/gen-worker-DRoCXgP2.js` (served from cache) |
| Failed requests / page errors offline | none / none |
| Next to 141 offline (unthrottled) | 15 ms, "Level 141", 17 jars rendered |

Screenshot: `p4-offline-level-141.png`. It shows level 141 started offline. The probe's fresh save
had not seen these mechanics, so the "New jar!" card for frozen, locked and narrow is open on top
of the board.

Before the `ignoreVary` fix, the same probe reloaded offline into a page whose JS and CSS failed.
It showed "Level 1" and 0 jars.

## Determinism

`tests/unit/core/prefetch.test.ts` has 16 tests.

- **Determinism.** A fake worker structured-clones both directions, as `postMessage` does, and
  runs the same `prepareLevel`. For levels 1, 21, 141 and 185 it returns a board, spec, seed and
  solution length deep-equal to `generateLevel`. `generateNow`, the synchronous fallback, gives
  the same board.
- **Queue.** Order is kept and duplicates are skipped. A response made with a different config is
  ignored.
- **Fallbacks.** Covered cases: no worker, a constructor that throws, a worker error, and a stuck
  worker (it times out, is terminated and replaced, and the queue continues). `wait` moves a
  queued level to the front.
- **Cache.** A different config key is a miss. Eviction is least recently used. The config key
  is stable.

## Gates

- `npm run typecheck`: clean.
- `npm test`: 21 files, 367 tests passed (16 of them new).
- `npm run build`: emits `dist/assets/gen-worker-*.js` (9.3 kB) next to the main chunk.
