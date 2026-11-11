# Evidence: strata-dwd (milestone Share cut off on the win card)

`check.cjs` on the production build: a daily win that completes the Tide Pool set, reaches a 30-day streak and earns badges, at 320x568 with 150% text and on a Pixel 7. It measures whether each Share sits inside its row and the card.

| Run | 320 px / 150% | Pixel 7 |
|---|---|---|
| Before (`before.json`, `before-small150.png`) | set-complete Share **outside** the card (right edge 309 against the card's 304) | all inside |
| After (`after.json`, `after-small150.png`) | all three inside; long rows put the Share under the text, short rows keep it beside | all inside |

No page errors.
