# Evidence: challenge a friend (sprint 14 H3, sharing §3.2)

From the production build (`npm run build`, `npx vite preview --port 5542 --strictPort`) with `check.cjs`, on a Pixel 7 viewport. The phone share sheet is faked (headless Chromium has none). Hints are used to win boards quickly, so the pour counts are hint paths, not good play.

| File | Shows |
|---|---|
| `1-friend-card-beat.png` | A player on level 90 opens `?challenge=80&pours=34`: "A friend cleared level 80 in 34 pours. Beat it?" |
| `2-board-beat-34.png` | Level 80 with "Beat 34" beside the pour counter |
| `3-win-verdict-send-back.png` | The win card: "43 pours: 9 more than your friend", no coins (a replay), and Send it back |
| `4-share-level-challenge.png` | The share preview for the challenge it sends back |
| `5-friend-card-ahead.png` | A player on level 12 opens the same link: "A friend is on level 80. You're on level 12." with Play level 12 |
| `6-win-challenge-a-friend.png` | A normal level win: Share reads Challenge a friend |
| `7-tutorial-win-offers-challenge.png` | A brand-new player: the tutorial first, then its win card offers See the challenge |
| `8-map-card-challenge.png`, `9-map-share-sheet.png` | A cleared stone's card on the map with Challenge a friend, and its preview |
| `result.json` | Every text, what was sent (the link carries only `challenge` and `pours`), and page errors (none) |

**Broken links** (`result.json`, `hostile`): `challenge=abc`, `0`, `99999999` and a script tag open Home with no card and no error. `pours=x` and `pours=-5` open the level as a plain replay, clamped to the player's progress, so a level-12 player gets level 12, never level 80.

**Not checked here:** two real phones sending a challenge to each other.
