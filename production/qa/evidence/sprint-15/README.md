# Evidence: the gentle climb to level 500 (sprint 15, 0.14.1)

From the production build (`npm run build`, `npx vite preview --port 5545 --strictPort`) with `check.cjs`, Pixel 7 viewport.

| File | Shows |
|---|---|
| `whats-new-0.14.1.png` | A 0.14.0 save on level 320 after the update: What's new "An easier climb", once |
| `level-45.png`, `level-149.png` | 9 and 10 colours, one hidden layer, two empty jars (0.14.0: 10 colours with two hidden layers; 13 colours with three) |
| `level-151.png` | The second hidden layer from 150 |
| `level-100.png`, `level-250.png`, `level-300.png` | Tall-jar levels, unchanged in shape |
| `result.json` | Jar and hidden-unit counts, the save after the upgrade, page errors (none) |

**The save after the upgrade** (`result.json`): best pours kept for levels 12 and 29, cleared for 30 and 120; level 320, Perfect marks, 3,100 coins, booster charges and shells kept; `boards` is 3, so it happens once.

Numbers: `production/qa/sprint-15/stuck-sweep.md`.
