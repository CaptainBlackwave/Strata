# Sprint 11 W2: the weekly set, browser evidence

Design: `design/gdd/weekly-set.md` (W1, D77). Run on 2026-11-09 against `npm run build` served by
`npx vite preview --port 5530 --strictPort`, with headless Chromium from the preinstalled Playwright
(`node shots.cjs http://localhost:5530/ .`). The page clock is fixed at **Thursday 2026-11-12 12:00
UTC** (`2026-W46`, theme **Lock and Key**, "4 days left") with Playwright's `clock.setFixedTime`, so the
shots don't depend on the day they were taken. Seed save `strata.save.v2`: `seenWhatsNew` = the
package.json version, `tutorialDone: true`, `level: 8`, sound off, 99 hints. Boards are won with
hints (`h`, then `#board .hint-from` and `#board .hint-to`). `navigator.share` is stubbed so the
shared text can be captured. Raw results: `results.json`. No page errors in any run.

| File | What it shows | Result |
|---|---|---|
| `01-home-card-412.png` | Home card under the daily, Pixel 7 (412 px). Save: boards 1 and 4 cleared | "Weekly set / Lock and Key · 4 days left / 2 of 5 cleared"; jars 1 and 4 filled. Accessible name: "Weekly set Lock and Key · 4 days left 2 of 5 cleared" |
| `02-chooser-412.png` | The chooser | "Week 46 · Lock and Key · 2 of 5 cleared"; five buttons named e.g. "Board 1, Cleared · best 22 pours" and "Board 2, Not cleared yet"; focus on Board 2 (first uncleared); Escape returns focus to the Home card |
| `03a-intro-card-412.png` | Board 2 opened: the locked jar's intro card first (level 8 has not met it; D2's rule) | shown |
| `03-weekly-board-412.png` | A weekly board in the `weekly` mode | label "Week 46 · Board 2", tag "Lock and Key", a locked jar on the board |
| `04-win-mid-week-412.png` | The win card mid-week | "Board 2 cleared", "24 pours · 3 of 5 cleared", no reward row; coins unchanged (weekly boards pay nothing); save `cleared [0, 1, 3]`, `pours {0: 22, 1: 24, 3: 38}`. Its badge row is the catalogue's "Narrow Escape" (first special jar met) |
| `06-share-status-412.png` | Share pressed on that card | "Shared" in the card; text below |
| `04b-chooser-after-win-412.png` | Continue goes back to the chooser | Board 2 now "Cleared · best 24 pours" |
| `05-win-set-complete-badge-412.png` | Clearing all five: board 5 won with boards 1–4 already cleared | "Weekly set complete!", "34 pours · 5 of 5 cleared", badge row "New badges: Week 46, 2026, Narrow Escape" with the weekly medallion; save `badges` gains `weekly-2026-W46` |
| `05b-chooser-complete-412.png` | The chooser after the set is complete | "Set complete ✓", all five cleared with best pours |
| `05c-shelf-weekly-badge-412.png` | The badge shelf in the Profile | the last tile is "Week 46, 2026 · Cleared the weekly set" |
| `07-home-card-320-150.png`, `07-chooser-320-150.png`, `07-weekly-board-320-150.png`, `07-win-320-150.png` | 150% text on a 320 × 568 screen | Text wraps, nothing overflows horizontally (checked on the card, the chooser, the board and the win card); the chooser scrolls |
| `share-text.txt` | The Share text, mid-week and complete | below |

Share text, mid-week (boards 1, 2 and 4 cleared):

```
Strata Weekly 2026-W46 (Lock and Key)
3 of 5 boards: 22 · 24 · – · 38 · –
http://localhost:5530/
```

Set complete:

```
Strata Weekly 2026-W46 (Lock and Key)
All 5 boards: 22 · 27 · 31 · 38 · 34 (152 pours)
http://localhost:5530/
```

**Generation budget.** Weekly boards are generated on the main thread, as the daily is (the daily
does not use the worker; only numbered levels are prefetched). In Node, the slowest of the 520
boards of 104 weeks (2026-W46 onward) took 15 ms, and none needed the fallback chain in the 8-week
fixture (`tests/unit/weekly/weekly.test.ts`).

Not covered here: a real phone, and the week rolling over while the app is open (unit-tested in
`tests/unit/weekly/weekly.test.ts`: Sunday 23:59:59.999 / Monday 00:00 UTC, the year edge and week 53).
