# Evidence: the gentler difficulty curve (0.12.1, D104–D111, 2026-11-11)

Captured from the production build (`npm run build`, `npx vite preview --port 5530 --strictPort`) with `shots.cjs`, on a 390 × 844 phone viewport. The save loaded is a returning player from before the change: level 110, last seen 0.12.0, best pours on old boards, no `boards` field.

| File | Shows |
|---|---|
| `level-21.png` | Level 21: 8 colours (was 9), one hidden layer (was two), the narrow jar's debut. 11 jars |
| `level-23.png` | Level 23, a breather: 6 colours and both spare jars. 8 jars |
| `level-30.png` | Level 30, tall jars: 4 × 8 (was 5 × 8). 6 jars |
| `level-33.png` | Level 33, a breather: 7 colours. 9 jars |
| `level-40.png` | Level 40, tall jars: 4 × 8 (was 5 × 8). 6 jars |
| `level-45.png` | Level 45: 10 colours (was 12). 12 jars |
| `level-60.png` | Level 60, tall jars 5 × 8, re-dealt under the 50-pour cap (D111). 7 jars |
| `level-103.png` | Level 103, a late breather: 9 colours (12 − 3) and one special jar at most (D110). 12 jars |
| `whats-new-card.png` | Home for that returning player: the 0.12.1 What's new card, shown once |
| `result.json` | Jar counts, page errors (none), and the save after the first load |

**The best-pours reset (D109)**, from `result.json`: the old save had best pours for levels 5, 11, 12, 23, 30, 40 and 50. After one load it keeps 5 and 11 (unchanged boards), drops the rest, and keeps level 110, the Perfect marks on 5, 23 and 30, and all 900 coins. `boards` is now 2, so it does not run again.

The "ready to play offline" toast in the screenshots is the service worker's first-install message; it clears after a few seconds.

Numbers: `production/qa/gentle-curve/difficulty-sweep.md`. Tests: `tests/unit/core/gentle-curve.test.ts`, `tests/unit/map/save-boards.test.ts`.

**Not done:** nobody has played the new levels 20–60 on a phone. The sweep and these screenshots show the boards are smaller and shorter, not that the climb feels right.
