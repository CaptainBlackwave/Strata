# Sprint 9 M2 (TD-1): main.ts split, before/after evidence

Base: `d311db8` (built in a temporary `git worktree`, removed afterwards). After: commit `3ed2a6e`.
Both were built with Vite and served with `vite preview`, then driven by the same Playwright scripts
(Pixel 7 profile, `reducedMotion: reduce` except the mechanics case, Chromium preinstalled).

## Result: identical

| Script | What it covers | Result |
|---|---|---|
| `m2/s8compare.cjs` (sprint 8's TD-2/TD-9 script) | static labels at boot with What's new, Home, profile, cabinet, scenes, settings, edit profile, save code, What's new and the game HUD; win card plus saved JSON for a first clear, a shell milestone, a set completion, a replay, a Perfect, a daily and its replay, a daily out of order and the tutorial; a full level played to a win with hints | `compare-base.json` and `compare-after.json` are byte-identical, `errors: []` |
| `m2/extra.cjs` | boosters (first tap arms the price confirm, second buys, Undo, Extra jar, Shuffle, Restart's confirm, the saved wallet and stats); Shift+1 and Shift+2 on a 200-level board; Settings toggles and their saved values; Tab and Shift+Tab sequences inside Settings and the cabinet; Scenes (preview, buy, use, preview of another, Match my clock, Escape); save code (copy to the clipboard, invalid, arm, restore); What's new and the Jar guide; cabinet; profile, edit, tab arrows, locked pick note, invalid name, re-roll, the discard dialog, Enter to save; the Leave-this-board dialog; mechanic intro and a pour with patterns on | `extra-base.json` and `extra-after.json` are byte-identical, `errors: []` |

Notes on the comparison:
- The Shuffle booster seeds its RNG from `Date.now()` (unchanged behaviour), so that step compares the colour multiset, not the order.
- `Math.random` is seeded in the page so name re-roll is deterministic.
- Play is clicked with `{ force: true }` and `seenWhatsNew` is seeded, as asked.
- `m2/*.png` are the screens captured from the refactored build (`shots-new`): profile, edit, cabinet, scenes, settings, save code, What's new and the win cards.

## Checks

`npm test` 472 passed (28 files), `npm run typecheck` clean, `npm run build` clean (the worker still bundles as `gen-worker-*.js`).

One change outside `src/ui/screens`: `tests/unit/ui/strings-used.test.ts` now globs `src/ui/**/*.ts`, so strings used from the new folders still count as used.
