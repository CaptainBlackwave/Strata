# Sprint 5: evidence (2026-11-08)

New tests were written first and seen failing on the old code: 9 for the ramp and tall jars, 3 for the swap and fallback, 11 for T3–T6. The suite is now 163/163.
Browser checks: production build at `/Strata/`, headless Chromium (Pixel 7; iPhone SE for 150% text).

| Decision | Check | Result |
|---|---|---|
| D1 ramp | Sweep of levels 1–500 | 0 failures; 1 of 277 swap levels fell back to 2 spares; median 4 ms, 95th percentile 217 ms, worst 577 ms |
| D1 ramp | Level 131 with patterns on (`d1-level-131-14-colours-patterns.png`) | 14 colours, 14 distinct patterns, a funnel in place of a spare, 3 buried layers |
| D1 revision | 30 random deals per case | 1 empty spare: 0/30 winnable at 12 colours. 1 spare + narrow: 29/30. 1 spare + funnel: 30/30 |
| D3 | `?level=100` with progress at level 5 | Opens level 5 |
| D5 | Two extra jars on one level (`d5-two-extra-jars.png`) | Jars 7 → 9; Jar charges 3 → 1 |
| D8 | Tall-jar levels 100–500 | 19 of 41 have a mechanic; levels 460 and 470 (which failed before the fallback) generate |
| D10 | Daily solved with the device date (8 Nov) earlier than the last solve (10 Nov) (`d10-clock-back-win.png`) | Note shown; streak unchanged (6); no reward |
| D14 | 150% text on a 320 px phone: home, board, settings, scenes, cabinet, win, save code (`d14-150pct-text-*.png`) | No horizontal overflow, no clipped or unreachable content |
| D16 | Copy the code on one device, restore on a fresh one (`d16-save-code-sheet.png`) | Bad code rejected; first tap asks to confirm; second tap restores level 5 and 500 coins |

**Defects found and fixed in this sprint**
1. Locks were silently skipped on tall-jar levels where every jar holds every colour; such deals are now rejected and re-dealt.
2. Two tall-jar levels (460, 470) could not generate at all; a fallback chain now guarantees every level loads.
3. Level generation took up to 1.8 s on large boards; capped fallback steps bring the worst case to 0.58 s.
4. At 150% text, Settings buttons ran off-screen and the home screen cut off its last buttons; overlays now scroll and button rows wrap.
