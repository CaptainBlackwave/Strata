# Sprint 22: Loose ends (0.20.2)

> **Status: built (2026-11-12), approved by the owner; released as 0.20.2.** L1 note: Classic p95 23–26 ms on a quiet machine (target 25), first-tap audio start-up removed. From the owner interview after 0.20.1 (D181–D187). Target release: **0.20.2**, soon, before Winter Tide opens on 1 December.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| L1 | **Faster pours** (D181): finish strata-8j3's target. Batch the HUD and screen-reader text updates after a pour into one write; don't start audio on the first tap when sound and music are off | Classic, 16-jar board (level 491), 4x throttle: p95 frame 25 ms or less on the sprint-18 script; no long task over 25 ms from the first tap; screen-reader text unchanged (tests) |
| L2 | **Splash follows the scene** (D182): the splash uses the saved scene's colours (read from the save before the app loads), daylight when there's none | Screenshots on a day and a night scene; no light flash before a dark Home |
| L3 | **Hero corks and sparkle** (D183): the Realistic hero jars wear corks like the Classic ones, and the sparkle is clearly visible | Screenshots Realistic and Classic side by side; a mid-sparkle frame |
| L4 | **Bigger install pictures** (D184): an art pass on the iPhone steps, the Share glyph readable at 320px/150% | Screenshots iPhone 390 and 320/150% |
| G1 | **Layout guard** (D185): a script that opens every Home tab and every sheet at 412px and at 320px with 150% text and fails when any visible element runs past the screen edge; run before each release and listed in the release steps | Catches the 0.20.0 weekly-card bug when that CSS is put back (shown once, then reverted); passes on 0.20.2 |
| C1 | **Phone checklist** (D186): `production/qa/phone-checklist-0.20.md` for the owner | Written and sent |
| R1 | **0.20.2**: What's new, the changelog, the guard run, the release | Released before 1 December |

## Decisions
- D181: finish the pour redraw target (strata-8j3 follow-up).
- D182: the splash follows the saved scene.
- D183: corks on the Realistic hero jars and a visible sparkle.
- D184: an art pass on the iPhone install pictures.
- D185: an automated layout guard run before every release.
- D186: a phone checklist for the owner.
- D187: 0.20.2 for these, then the next mechanic as 0.21.0 (sprint 23).
