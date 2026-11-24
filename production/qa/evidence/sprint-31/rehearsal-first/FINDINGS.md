# Winter Tide dress rehearsal (sprint 31 C2), first pass

- **Story type**: Integration (events + win + save + styles + Home UI). **Gate**: BLOCKING (documented playtest)
- **Code under test**: clean worktree of `e70ed708` (the game code of the live 0.26.1), Vite dev server, Chromium (Playwright), DOM board
- **Clock**: `context.clock.setFixedTime` at 09:00 UTC per date; the after-midnight case used 23:58 then 00:01
- **Script**: `rehearsal.cjs` (run as `WT=<worktree> PORT=5240 OUT=<log> node rehearsal.cjs`). Raw results: `rehearsal-log.json`
- **Dates**: 2026-11-30, 12-01, 12-06, 12-12, 12-24, 12-25, 12-31, 2027-01-01, 2027-12-01, plus 2027-12-24 (completing a second year)

## Findings (blockers first)

**No blockers.** Nothing found would stop Winter Tide from running on 1 December.

1. **bug: second-year completion says the prize was granted again** (2027-12-24). Frost was owned from 2026. Clearing all 24 again in 2027 shows "Winter Tide complete!" and a prize row "Frost jar glass is yours", but nothing new is granted. The save is correct: `owned` still holds `glass:frost` once and the badge appears only once. The badge row correctly leaves out "Winter Tide". GDD §5 says: "Prize already owned: this year's completion grants nothing new. The win card still says the set is complete." The title is right; the prize row is wrong. Likely cause: `src/core/win.ts` `winEvent` sets `prizeStyle` whenever `completedNow`, without checking whether the piece was already owned, and `src/ui/screens/win.ts` `winEvent` draws the row from it. Evidence: `win-2027-12-24-second-year-complete.png`.
2. **polish: the board label is cut off in the HUD** (every date, 412px, 100% text). On an event board the HUD reads "Winter Tide · Boar…" next to "29 pours", so the player can't see which board they are on. Likely files: `src/ui/style.css` (the `#level-label` ellipsis) or the label text `t.event.label` in `src/ui/strings.ts`. Evidence: `win-2026-12-24-board24.png` (top of the screen).
3. **polish: the GDD's Home-card text doesn't match the Play tab card** (every event date). The Play-tab mini card shows "9 of 24 cleared" and the days left, without "Board 12 open". The full line "Board 12 open · 11 of 24 cleared" appears only on the Today tab card and in the chooser. This has been the case since sprint 20 (comment in `src/ui/screens/sheets/event.ts` `renderEventCard`). GDD §3.6 still describes the full line on "the Home card". Fix: update `design/gdd/events.md` §3.6, or the card, whichever the owner wants.
4. **polish: locked tiles say "Dec 14", not "Opens Dec 14"** (12-01 to 12-23). GDD §3.6 shows locked boards as "Opens Dec 14". The visible status is "Dec 14", and only the spoken label says "Board 14, opens Dec 14". The tile is also visibly disabled. Location: `src/ui/strings.ts` `event.boardLocked`, or the GDD wording.
5. **polish: a new year's chooser says "Prize collected" at 0 of 24** (2027-12-01). This is true, because the badge was kept from 2026, but at the top of a fresh year's chooser it can read as if this year's set is done. Consider "Prize collected in 2026" or "Prize already yours". Location: `src/ui/logic/event-card.ts` (`prizeCollected` is read from the badge alone).

## Passed

- **Dates and Home card**: no card, no chooser, no snow and no event music on 2026-11-30 and 2027-01-01. On the other dates the card shows with the correct text:
  - "Ends in 30 days" on 12-01, 25 on 12-06, 19 on 12-12, 7 on 12-24, 6 on 12-25, "Last day" on 12-31.
  - Today tab: "Board N open · n of 24 cleared", "All 24 boards open" from 12-24, and the progress bar width.
- **Chooser**:
  - Board n opens on day n: on 12-01 board 1 is open and boards 2 to 24 are locked and disabled, with "Dec 2" to "Dec 24". From 12-24 all are open.
  - Cleared tiles show "✓ best pours". Focus goes to the first open board that isn't cleared (board 7 on 12-12 with 7 missed, board 3 on 12-25).
  - The prize line reads "Clear all 24 for the Frost jar glass and the Winter Tide badge".
- **Play and win, every event date**: tapping a tile starts "Winter Tide · Board n" with the right year and board.
  - The boards were solvable, with no special jars. Recipes cycle 5, 6 and 7 colours, and the 7-colour boards have one buried layer.
  - Full taps of the solver's path were played on 12-01 (16 pours), 12-24 (29) and 2027-12-01 (21).
  - Win card: "Winter Tide · Board n", "N pours · n of 24 cleared", no Share. Continue returns to Home and reopens the chooser with the new progress.
- **Coins**: +50 exactly on the 6th, 12th and 24th first clear (100 to 150 coins in the save); nothing on the 1st, 10th, 21st or 2027's 1st.
- **Progress per year**: the save holds `{year, cleared, pours}`, survives a reload, and takes the best pours. A 2027 clear replaces the 2026 progress with a fresh year (`cleared: [1]`).
- **All 24 in one run** (save with 23 cleared, then board 24 on 12-24):
  - The title reads "Winter Tide complete!", with +50 coins.
  - The rows read "Frost jar glass is yours" and "New badges: Winter Tide, …".
  - The save gets `glass:frost` and `event-wintertide`, and the Jar styles sheet shows Frost as "Owned".
  - A level-8 player, below the Jar styles level, also gets the prize, and the Jar styles button appears.
- **Catch-up**: on 12-25 a missed board 3 and on 12-31 a missed board 23 were playable and recorded.
- **Won after midnight** (started 12-31 23:58, won 2027-01-01 00:01): the clear recorded for 2026 (21 of 24). Continue then lands on Home with no card and no chooser, and the snow and music stop.
- **Second year** (2027-12-01): fresh progress (0 of 24, only board 1 open). Frost is kept and still worn. In 2027-12-24's completion the badge and the glass were not added twice.
- **Snow**:
  - On Home and on event boards (`winterSnowing()` true, `canvas.winter-fx` present).
  - Not on a normal level board during the event.
  - None under `prefers-reduced-motion: reduce`, on Home or on an event board.
- **Music**: `audio.event` is `wintertide` and the variation root is 329.63 Hz (E4) while the event runs. Off dates use the scene's (261.63 Hz). Checked by state only, not by ear.
- **320px with 150% text** (12-01, 12-12, 12-24, 12-31):
  - Document scroll width is 320 everywhere, and no element runs off-screen in the Play card, the Today card or the chooser.
  - The chooser's two-column grid fits and scrolls vertically (`overflow-y: auto`).
  - On the win card, including the prize rows, the only wider boxes are the decorative `.win-bloom` glow, which is clipped, and the `sr-only` text.
- **Errors**: no page errors and no console errors or warnings on any date or variant.

## Test notes and limits

- Most dates won by starting a session one pour from the end (`beginSession`), so their win cards say "1 pour". Full plays were 12-01, 12-24 and 2027-12-01.
- "New badge: First Seal" on the win cards is caused by the seeded saves, which have no jars sealed. It is not an event defect.
- The 320px shots are at deviceScaleFactor 2. Screenshots end in `-<date>.png`: `home-*`, `home-today-tab-*`, `chooser-*`, `win-*`, `after-next-*`, `styles-frost-*`, `w320-*`, `after-midnight-win-next.png`.
- Not covered: the GPU (Realistic) board, the audible music, daily-goal counting from event wins, and corrupt `events` saves (covered by unit tests).
