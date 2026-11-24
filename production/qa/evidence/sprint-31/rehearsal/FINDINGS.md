# FINDINGS: Sprint 31 C6 final dress rehearsal (build c84f1e5)

Vite on port 5243, Playwright Chromium, `?board=dom`, deviceScaleFactor 2. Script: `rehearsal.cjs` (`ONLY=holly` re-runs the board 25 sealed-jar check). Logs: `rehearsal-log.json`, `holly-log.json`, `run.out`. There were no page or console errors on any date.

The rehearsal agent returned these findings as text (subagents may not write report files). The orchestrator recorded them here and marked what happened to each.

## Blockers
None.

## Bugs
None.

## Polish
1. **2026-12-25, board 25 win card title:** "Winter Tide · Christmas Day" wraps to three lines at 412px, leaving "Day" alone (`win-2026-12-25-board25.png`).
   - Status: fixed in integration (see the sprint 31 commit log).
2. **2026-12-25, "All cleared ✓" while the Christmas Day tile is still open:** the chooser and the Home card read "All cleared ✓" with board 25 not yet played (`chooser-2026-12-25.png`). The count is correct (prize boards only), but it reads as a contradiction.
   - Status: fixed; the line now says the 24 prize boards are cleared.
3. **2026-12-25 and 2027-12-25, the gift card's only button says "Open":** the gift is already granted when the card shows, so the button only closes it.
   - Status: fixed; the button now says "Thank you".
4. **2026-12-25, the Holly cap swatch on the gift card at 412px** reads as a plain cork; the sprig shows at 320px with 150% text (`gift-card-2026-12-25.png`).
   - Status: passed to the art check.

## Unverified
**U1. Holly caps on board 25's sealed jars.**
- The run confirmed that board 25 starts with `#board.festive-board` and that `--cork-sprig` is set on its jars.
- The quick-win harness restores the board with `beginSession(state, false)`, which drops the festive flag, so the sealed-jar shots show plain corks. That is a harness artifact: in the game, only `startEvent` passes the flag.
- The GPU board was not exercised: headless Chromium fell back to the DOM board.
- Covered by the art check.

## What passed
- **2026-11-30:** nothing festive (no cards, garland, snow, sparkles, lights or Festive tag).
- **2026-12-01:**
  - The Winter Tide start card shows once and is gone after a reload; Play opens the chooser.
  - The chooser has 25 tiles, the 25th "Christmas Day" (locked, spoken as a bonus), and reads "Clear all 24…".
  - Garland, snow and winter music are on; 34 map light bulbs; the Festive scenes are first.
  - Board 1 shows "Board 1" with the "Winter Tide" tag, and its win card reads "1 of 24".
- **2026-12-12:** board 12 pays +50; the chooser reads "12 of 24".
- **2026-12-24:** board 24 completes Winter Tide: +50, the Frost glass and the badge are saved.
- **2026-12-25:**
  - The gift is given as its card shows: +100 coins, +1 hint, the Holly cap owned, and the year recorded.
  - The start card is suppressed and marked seen; there is no second gift after a reload.
  - Board 25 shows "Christmas Day" with the "Winter Tide" tag and "24 of 24", with no coins and no prize.
  - The Holly cap reads "Owned" and can be worn.
- **2026-12-26:**
  - The New Tide start card shows, then its Home card ("0 of 12", ends in 11 days).
  - Sparkles show; no garland or snow; the music key is `newtide`. The map lights and the Festive order are still on.
  - Board 1 shows "1 of 12" with no coins.
- **2027-01-01:** board 7 is open; no map lights and no Festive tag.
- **2027-01-06:** board 12 completes New Tide: +50, Sparkle glass and the badge.
- **2027-01-07:** nothing festive.
- **2027-12-25 (second year):** the gift card names only coins and a hint, and they are added; the start card is marked seen; no repeat after a reload. The chooser says "You already have the prize from an earlier year".
- **2027-12-24, second-year completion:** +50, with no Frost prize row and no repeated badge.
- **320px with 150% text** (12-01, 12-25, 12-26): the cards fit and there is no sideways scroll.
