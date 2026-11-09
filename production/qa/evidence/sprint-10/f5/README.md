# Sprint 10 F5: celebrations and animation (D68: calm, a little richer)

Evidence for `production/sprints/sprint-10.md` F5. Before is base commit `fbb2874`, built in a
temporary git worktree; after is this branch. Both were served with
`npx vite preview --port 5430 --strictPort` and captured by `capture.cjs` (Playwright Chromium,
390 x 844, scale 1). The save is seeded with `seenWhatsNew` = package.json's version,
`tutorialDone: true`, `level: 5`, plus 300 coins and 50 hints. Level 5 is won with hints (`h`, then
`#board .hint-from` and `#board .hint-to`). Run logs: `log-before.txt` and `log-after.txt`.

Each sequence file name ends in its time in ms from its anchor: the click for transitions, the
jar's `just-sealed` class for the seal, and the win overlay showing for the win and the coins.
Screenshots are rapid captures in real time (about 60 to 130 ms apart), so times are approximate.

## What changed (after)

| Effect | Before | After | Files |
|---|---|---|---|
| Seal | Box-shadow ring pulse and a 22-spark ring | A soft band of light sweeps up the glass, and 6 sand motes rise off the cork (600 ms). The cork drop is unchanged | `seal-*` |
| Level-clear grains | 3 bursts of 34 (102 particles) | 2 bursts of 12, softer, inside the 60 budget | `win-*-01/02` |
| Win | Card pops in | A soft warm glow opens behind the card and motes in the board colours drift up around its edges (1 s), then the glow stays still. When the scene draws its own win canvas (New Year, Meteor shower, Aurora night; D40), the bloom does not run, so the two never stack | `win-*`, `win-settled-*` |
| Coins | Count-up ran while the card was still hidden (it starts at the win, and the card opens 650 ms later). The counter bumped before the card was visible | The count-up runs on the open card. Then 3 to 5 coins fly from the reward pill to the coin counter (500 ms), which updates and bumps as they land | `coins-*` (300 becomes 320 on landing) |
| Map, next stone | 1.8 s ring, scale 0.95 to 1.45 | A softer 2.6 s ripple, scale 1 to 1.32, 2 px, with a rest between breaths | all map frames |
| Map, Perfect | The mark is just there | After a replay earns Perfect, the mark pops in (360 ms, after the map's fade) | `map-perfect-pop-*` |
| Map, first clear | The path is just solid | When the map next opens, dots fade in one by one along the newly unlocked stretch (5 to 6), then the solid path fades in under them (about 700 ms) | `map-after-first-clear-*` |
| Transitions | Cuts. The map had a 180 ms CSS fade in, but nothing out | 200 ms cross-fades: Home to map (the map also rises 10 px), map to board, board to Home, map to Home, and board to map (Continue after a replay). The real screen switches at once, and a still copy fades over it, so input and focus never wait | `trans-*`, `map-perfect-pop-*-01` |

Rules met: the Web Animations API and CSS only, transform and opacity only. A tap or key
(capture-phase `pointerdown` or `keydown`) finishes every running effect at once. A hidden tab pauses
them, and none starts while the tab is hidden. At most 60 particles (worst case: splash 10 + seal 6
+ grains 24 + win motes 18 = 58, unit-tested).

## Reduced motion (`reduced-*-after.png`)

Nothing moves. There is no sweep, motes, bloom, coin flight, pop, dots or fade. The map draws its final
path at once, and the pending touches are used up so they never play late. Frames of the map 150 ms apart,
and of the map after a first clear 300 ms apart, are byte-identical before and after. The log reports
the seal and win frame pairs as not identical, in **both** before and after. I inspected the
difference regions. For the seal, the board was still being re-laid out after the last instant pour.
For the win, the shell row's icon was not yet drawn in the first frame. Neither is an effect: the log
shows 0 fx nodes and no `.win-bloom`.

## Frame time at a 4x CPU throttle (CDP `Emulation.setCPUThrottlingRate`)

Longest frame (rAF to rAF), no screenshots taken during the run:

| Window | Before | After (run 1) | After (run 2, in `log-after.txt`) |
|---|---|---|---|
| Seal (seal to +980 ms) | 23.2 ms | 25.8 ms | 23.7 ms |
| Win (last seal to card +2 s) | 28.1 ms | 35.9 ms | 41.2 ms |

The win window now also holds the bloom and the coin flight. Its worst frame is about 2 to 3
frames at 60 Hz on a 4x throttled CPU. No frame over 50 ms was seen.

## Unit tests

`tests/unit/ui/fx-plan.test.ts` has 24 tests: the timing table, the particle budget, the
reduced-motion switch, the coin flight plan, the win bloom's scene rule, and the map stretch and its dots.
They were written first and seen failing, because the module did not exist yet.
