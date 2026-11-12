# Winter Tide dress rehearsal (sprint 21 W1, 2026-11-12)

Rerun: `PORT=5182 node production/qa/evidence/sprint-21/winter/rehearsal.cjs` (dev server running). Raw data: `results.json`. Dates faked with Playwright's clock.

| Check | Result | What was seen |
|---|---|---|
| No event on 30 Nov or 1 Jan | Pass | No card, no snow, normal music |
| 1 Dec | Pass | Card "Winter Tide", chooser "Board 1 open · 0 of 24 cleared · Ends in 30 days", 23 locked, "Board 2, opens Dec 2" |
| 12 Dec | Pass | 12 open, "Board 13, opens Dec 13", "Ends in 19 days" |
| 24 Dec and 31 Dec | Pass | All 24 open; "Ends in 7 days", "Last day" |
| All 24 boards played to a win | Pass | Boards 1–12 on Realistic, 13–24 on Classic; 0 missed taps, 0 page errors |
| Coins | Pass | +50 after boards 6, 12, 18 and 24 only (200 in total); replays of 3 and 24 pay nothing ("Already cleared this year") |
| Prize | Pass | Board 24 card "Winter Tide complete!" with "Frost jar glass is yours" and the Winter Tide badge; granted once (replay adds nothing) |
| Frost not sold | Pass | Before: locked "Winter Tide prize · December", button disabled, `buyStyle` refused, coins unchanged. After: "Wear Frost" |
| Snow | Pass | On Home and event boards in December; not on level boards; none under reduced motion; none on 30 Nov or 1 Jan |
| Winter music | Pass | `event:wintertide` variation (its own root and scale) chosen through December, on Home and boards |
| Layout at 390 and 320/150% (1, 12, 31 Dec) | Pass | Home, Today, chooser, event win and prize win cards: no sideways overflow, Next/Continue visible |
| Rainbow scene hero | Pass | Logo jars sit cleanly over the scene on Realistic and Classic |
| Splash on a night scene | Note | The splash is always the daylight colours (by design for now); it is up for a split second |

No bugs found. Note: the win card scrapes read "New badge: First SealShare" because the Share button's text follows the row text; on screen they are separate (see `shot-320-150-12-31-prize-win.png`).
