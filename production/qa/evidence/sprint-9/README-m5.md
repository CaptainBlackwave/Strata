# Sprint 9 M5: the remaining player-facing backlog findings

This is task M5 in `production/sprints/sprint-9.md`. The source is `production/qa/sprint-8/backlog-triage.md`, and the details of each finding are in `production/qa/sprint-6/ux-review.md` and `accessibility-audit.md`.

**Count: 9, not 11.** The plan says "the remaining 11". The full table has exactly 9 rows with status **OP** and no other open player-facing status. The other open rows are 8 **OD** rows, which are doc-only and outside this task. All 9 OP rows are now **F**:
- 6 were fixed here;
- 3 were verified as already fixed by sprint 8 P3.

The code fix is commit `287820b`. The UX-board-10 clamp was corrected in `49456db`. The browser checks are in `m5/m5.cjs`, with the raw log in `m5/m5-result.json`. They ran on Pixel 7 and on iPhone SE at 150% text, with reduced motion and no page errors. I looked at every screenshot.

| Finding | Status before | What was checked | Result | Screenshot |
|---|---|---|---|---|
| **UX-home-3**: the daily card's name lacks the day | open | Accessible name of `#btn-daily` (aria snapshot) | **Fixed.** The name is now "Daily puzzle, Monday 9 Today: easy Start a streak today", from a hidden `#daily-date-sr` with string `dailyDate`. The card looks the same as before. | `m5/m5-ux-home-3-home.png` |
| **UX-board-9**: tutorial tools are disabled with no reason | open | Tutorial board: caption shown, `aria-describedby` on the 4 tools and Restart | **Fixed.** "Boosters and Restart unlock after the tutorial" sits above the toolbar, and all 5 disabled controls point at it. | `m5/m5-ux-board-9-10-tutorial-pixel7.png`, `-se-150.png` |
| **UX-board-10**: the coach caption is `nowrap` at 150% on 320 px | open | Caption box on iPhone SE at 150% for both tutorial steps | **Fixed.** The caption wraps (`max-width: 100vw - 32px`), and `coach()` shifts it to stay 8 px inside the screen. Step 2 measured x 24-312 of 320, over 2 lines. The first attempt measured the drawn box and still overflowed (x=371); `49456db` computes from the jar centre instead. | `m5/m5-ux-board-10-tutorial-step2-se-150.png`, `-pixel7.png` |
| **UX-profile-2**: the footnote doesn't say which totals | open | Stat labels as a screen reader gets them; footnote text | **Fixed.** Perfect clears, Dailies solved, Total pours, Coins earned and Boosters used show a visual `*`, which is `aria-hidden`; a screen reader hears ", counted from this update". The footnote reads "* These totals count from this update onwards." | `m5/m5-ux-profile-2-stats.png` |
| **UX-cab-2**: an h3 inside a button | open | DOM structure and aria snapshot of the cabinet | **Fixed.** Each set is `H3 > BUTTON.shell-set-head`, the snapshot lists `heading "Tide Pool 1/5" [level=3]`, and headers are still 44 px tall. | `m5/m5-ux-cab-2-cabinet.png` |
| **UX-cab-4**: nothing marks the newest shell | open | Won level 5 (earns Limpet), then Home and the cabinet; then reopened it | **Fixed.** Limpet shows a "New" badge and its set opens. On the next open there are 0 badges. Shells owned at page load are not marked. | `m5/m5-ux-cab-4-new-shell.png` |
| **AX-14**: the intro dialog has no name | open (P3) | Jar guide dialog's `aria-labelledby` target; `getByRole('dialog', {name})` | **Already fixed** in sprint 8 P3 (`05d5be5`, `id="intro-title"` on the kicker). The name is "Jar guide" and the role query finds 1 dialog. | `m5/m5-ax-14-jar-guide.png` |
| **AX-17**: `user-scalable=no` | open (P3) | Viewport meta | **Already fixed** in sprint 8 P3, D44 (`05d5be5`). The meta is `width=device-width, initial-scale=1, viewport-fit=cover`. Pinch evidence is `../sprint-8/p3-pinch-zoom-320.png`. | (sprint 8) |
| **AX-19**: 43 px jars at level 120 on 320 px | open (P3) | Drawn width vs hit width (`::before`) of every jar at level 120, iPhone SE, 150% | **Already fixed** in sprint 8 P3, D45 (`05d5be5`). All 8 jars are drawn 34 px wide with 45 px hit areas. | `m5/m5-ax-19-level120-se-150.png` |

## Notes for the owner

- **UX-board-9/10 overlap.** On iPhone SE at 150% text, the wrapped step-2 caption ("Now tap the other jar to pour") sits over the new tools caption, which hides it during that step. Both are visible on Pixel 7 and in step 1. Moving the coach up is a layout call for `ux-designer`.
- **UX-cab-4 lasts one session only.** "New" covers shells earned since the cabinet was last opened in this page load. It is not saved, so a reload clears it.
- **New copy for `ux-designer` to confirm:**
  - `toolsLocked`: "Boosters and Restart unlock after the tutorial";
  - `statNewSr`: ", counted from this update";
  - `shellNew`: "New";
  - the reworded `statsFootnote`.
