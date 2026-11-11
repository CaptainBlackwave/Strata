# Evidence: the gentler difficulty curve (D104–D109, 2026-11-11)

Captured from the production build (`npm run build`, `npx vite preview --port 5530 --strictPort`) with `shots.cjs`, on a 390 × 844 phone viewport. The save loaded is a returning player from before the change: level 60, best pours on old boards, no `boards` field.

| File | Shows |
|---|---|
| `level-21.png` | Level 21: 8 colours (was 9), one hidden layer (was two), the narrow jar's debut. 11 jars |
| `level-23.png` | Level 23, a breather: 6 colours and both spare jars. 8 jars |
| `level-30.png` | Level 30, tall jars: 4 × 8 (was 5 × 8). 6 jars |
| `level-33.png` | Level 33, a breather: 7 colours. 9 jars |
| `level-40.png` | Level 40, tall jars: 4 × 8 (was 5 × 8). 6 jars |
| `level-45.png` | Level 45: 10 colours (was 12). 12 jars |
| `result.json` | Jar counts, page errors (none), and the save after the first load |

**The best-pours reset (D109)**, from `result.json`: the old save had best pours for levels 5, 11, 12, 23, 30, 40 and 50. After one load it keeps 5 and 11 (unchanged boards) and 50 (a tall-jar level that did not change), drops 12, 23, 30 and 40, and keeps level 60, the Perfect marks on 5, 23 and 30, and all 900 coins. `boards` is now 2, so it does not run again.

The "ready to play offline" toast in the screenshots is the service worker's first-install message; it clears after a few seconds.

Numbers: `production/qa/gentle-curve/difficulty-sweep.md`. Tests: `tests/unit/core/gentle-curve.test.ts`, `tests/unit/map/save-boards.test.ts`.

**Not done:** nobody has played the new levels 20–60 on a phone. The sweep and these screenshots show the boards are smaller and shorter, not that the climb feels right.
