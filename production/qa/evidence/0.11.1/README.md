# 0.11.1 evidence: first-run fixes (D81, D82) and the weekly bonus (D83)

Captured 2026-11-09 against `npm run build` + `vite preview`, Chromium device emulation (Pixel 7,
iPhone SE, and 320 x 568 with an iPhone user agent), reduced motion, the clock fixed at
2026-11-12 12:00 UTC (Thursday of 2026-W46). Script: `check.cjs`; raw results: `result.json`.
No page errors in any run.

| Item | Result | Evidence |
|---|---|---|
| R1 (D81): Home line on the level 3 first clear, once | Pass: note reads "No hint, shuffle or extra jar used · Today's daily puzzle is on Home."; it is in the card's `aria-describedby`; level 4's card does not repeat it | `r1-level3-win-home-hint.png` |
| R2 (D82): a daily link before the tutorial | Pass: Home opens (tutorial first), the link is kept; the tutorial's card says "Your friend's daily puzzle is ready." with "Play the daily", which opens today's daily; the kept link is cleared | `r2-daily-tutorial-win-offer.png`, `r2-daily-opened.png` |
| R2: a weekly link before the tutorial | Pass: the same, and "See the weekly set" opens the chooser over Home | `r2-weekly-*.png` |
| R2: a returning player's `?weekly=` link; weekly Share | Pass: the chooser opens at once; Share's text ends `?weekly=2026-W46` | `result.json` |
| R3 (D82): level 10 | Pass: 6 jars (4 colours x 8), was 7 jars (5 x 8) | `r3-level10-board.png` |
| R4 (D82): Scenes "New" mark | Pass: hidden at 299 coins, shown at 320 (cheapest scene 300), read as "Scenes, New"; gone after opening Scenes and after a reload; no sideways scroll at 150% on 320 px | `r4-home-scenes-new.png`, `r4-home-scenes-new-320-150.png` |
| R5 (D82): install card at 150% text | Pass: 454 px tall with no inner scroll on 320 x 568 and on iPhone SE (was 595 px in 520); the offline toast no longer covers it | `r5-install-320-150.png`, `r5-install-se-150.png` |
| D83: weekly set bonus | Pass: the fifth board's card shows "+100" and the wallet goes 100 -> 200 | `d83-weekly-set-complete-bonus.png` |

Usage: `npm run build`, `npx vite preview --port 5521 --strictPort`, then
`node production/qa/evidence/0.11.1/check.cjs http://localhost:5521/ production/qa/evidence/0.11.1`.

Note: `production/qa/evidence/sprint-11/onboarding/scripts/solutions.json` holds level 10's old
moves; level 10 changed in 0.11.1 (R3), so that sprint 11 script no longer replays level 10.

## Regressions on the same build

- Upgrade play-through (`sprint-9/close/upgrade.cjs`): a 0.8.0 save shows the 0.11.1 What's new card once, opens the map and wins level 12; no errors.
- Two tabs (`sprint-9/m4/two-tab.cjs`): the newest tab takes over, the older one never overwrites it, Play here hands back; no save lost.
- Level 141 at a 4x CPU throttle: the board appears 0.5 s after Play on Pixel 7 and on iPhone SE at 150% text, 17 jars above the toolbar; level 5 the same.
- Hints on level 26: 36 hint pours to a win, no stale hint marks, no sealed jar showing buried sand.
