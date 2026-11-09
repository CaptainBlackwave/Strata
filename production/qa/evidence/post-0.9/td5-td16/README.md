# TD-5 and TD-16 evidence (post-0.9, 2026-11-09)

Both items are refactors with no intended behaviour change. Register: `docs/tech-debt.md`.

## TD-5: one fallback-step runner

- `runFallbackSteps` and `FallbackStep` in `src/core/generator.ts`; levels build `levelSteps`, the daily `dailySteps` (`src/core/daily.ts`).
- Unit tests: `tests/unit/core/fallback-steps.test.ts` (9). Written first and watched failing (9 of 9, functions missing) before the code was written.
- **Board comparison, before and after the change:**
  - A fingerprint script hashed the whole `GeneratedLevel` (spec, board, seed, solution length, attempts) for levels 1-500, 400 dailies from 2026-06-01, and three stress configs that force every fallback rung: few attempts (second spare, dropped mechanics), an impossible 30-pour cap (shortest deal kept, `lastResort` with 3 spares) and zero attempts (`fallbackBoard`). That is 1,380 boards, and all 1,380 lines were byte-identical (`cmp`).
  - `tools/balance/difficulty-sweep.ts`, levels 1-200, written to a scratch CSV: identical on every column except `genMs` (timing). The fallback summary was `141:secondSpare` both times, and the D36 band summary was identical.
  - The level and daily fixture tests (`placement.test.ts` plain-board hashes, the 8-week daily test in `daily.test.ts`, `pour-cap.test.ts`, `fallback.test.ts`) pass untouched.

## TD-16: injected clock and rng in the UI

- `UiState.clock` (default `systemClock`, the real clock) and `UiState.rng` (default `Math.random`) in `src/ui/state.ts`. Pure date helpers in `src/ui/clock.ts`.
- Routed: the daily date (home card, cabinet, profile streak, `startDaily`), the scene of the hour and the "in season" badge, the name re-roll (profile repair and Edit profile), the shuffle seed, and the tab-lock id fallback.
- Not routed, on purpose: `tab-lock.ts` already takes a clock. `fx.ts`, `audio.ts` and `scene-fx.ts` randomness is presentation only. `new Date(y, m - 1, d)` in `home.ts` and `strings.ts` formats a date key and does not read the clock.
- Unit tests: `tests/unit/ui/clock.test.ts` (5), using a fixed clock: the midnight-UTC daily rollover, the first day of the winter-snow window, and the southern shift. Watched failing first because the module was missing.

## Browser check (Playwright, Chromium, 390x844, `vite preview` of the build)

The save was seeded with `seenWhatsNew: '0.9.0'`, `tutorialDone: true` and `level: 5`. With `level: 1`, Play goes straight to the board because the map needs level 2 or higher (`mapAvailable`).

| Shot | What it shows |
|---|---|
| `1-home.png` | Home with the daily card for **Mon 9**, matching the UTC date of the run (2026-11-09), and "Today: easy" |
| `2-map.png` | Play opened the level map (Beach path, level 5 current) |
| `3-level.png` | `#btn-map-play` (`force: true`) started Level 5 (7 jars) |
| `4-daily.png` | The daily card started the daily: "Mon, Nov 9" (7 jars) |

Page errors: none.

Tests: 523 before, 537 after (9 for TD-5 and 5 for TD-16). `npm run typecheck` and `npm run build` are clean.
