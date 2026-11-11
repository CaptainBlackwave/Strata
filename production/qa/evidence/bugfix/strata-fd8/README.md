# Evidence: strata-fd8 (challenge target came back on a later replay)

`check.cjs` on the production build, Pixel 7: a level-20 save opens `?challenge=5&pours=999`, plays and wins level 5, goes Home, then replays level 5 from the map.

| Step | Result (`result.json`) |
|---|---|
| The challenge | "Beat 999" beside the pours; the win card says "you beat it by 981" and offers Send it back |
| The later map replay | No target; "Replay: no coins"; Share reads Challenge a friend (`replay-no-target.png`, `replay-win-card.png`) |

No page errors.
