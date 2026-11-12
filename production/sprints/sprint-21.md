# Sprint 21: Feels like an app

> **Status: planned (2026-11-12), awaiting the owner's approval.** From the owner interview after 0.19.1 (D174–D180). Target release: **0.20.0**, one release, live **before 1 December 2026** so it lands before Winter Tide opens.

## Why
Realistic sand and the new Home made the board look like a studio game. The shell around it still feels like a web page: no install moment, a plain icon, no splash, silent updates, and browser habits such as pinch zoom and text selection. The owner chose **install and app polish** next (D179). Two sand-quality items and a Home hero rethink ride along, and Winter Tide gets a dress rehearsal before 1 December.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| H1 | **Hero back to the logo jars** (D175, D176): the three logo jars from before 0.19 (the middle one taller, three layers each), made larger as the hero and drawn with Realistic sand and matte glass. Still, with only a rare soft sparkle on the sand. Tap starts the player's level. The self-playing game of D173 is removed. Classic, no WebGL and reduced motion give the CSS logo jars (no sparkle under reduced motion) | Screenshots at 390px and at 320px with 150% text, Realistic and Classic; the ticker sleeps between sparkles; strata-pwe closed as no longer relevant |
| P1 | **Smooth settling pile** (strata-2en): no stair-steps while sand settles after a pour | Mid-pour frame strip before and after; sand-sim tests still pass |
| P2 | **Board redraw cost** (strata-8j3): redraw only the jars that changed on a pour, on both boards | 4x throttle, 16-jar board: p95 frame under 25 ms on Classic; a before and after trace |
| A1 | **Install prompt** (D179): after the player's 5th level clear, on Home, a calm card "Add Strata to your home screen": the browser's install on Android and desktop, step-by-step pictures on iPhone (Share, Add to Home Screen). Dismissible; asked at most twice, 7 days apart; never when already installed | Logic unit-tested (when shown, never twice in 7 days, never standalone); screenshots on Android and iPhone layouts |
| A2 | **Icon and splash** (D179): a sharper icon (jars of layered sand) at every size: 192, 512, a maskable 512 with a safe zone, the Apple touch icon, a favicon and an SVG. A splash in the scene's colours with the logo jars, shown until the first screen is ready | Icons checked in a maskable preview; splash screenshot; no flash of an unstyled page |
| A3 | **Offline and updates** (D179): Settings shows "Works offline" once the game is cached. When a new version is ready, a calm bar "New version ready · Update" on Home; Update reloads on Home only. Today's silent reload on Home stays as the fallback when the bar is ignored | Logic unit-tested; offline play-through with the network cut |
| A4 | **Native feel** (D179): no pinch or double-tap zoom on the board, no text selection or long-press menus on game controls, the status bar colour follows the scene, and a light haptic on pour, seal and win where the phone supports it (Settings toggle, on by default, off under reduced motion) | Each checked on a phone-sized browser; the haptic plan unit-tested |
| W1 | **Winter Tide rehearsal** (D178): with a faked December date, play all 24 boards on Realistic and Classic; check opening days, coins every 6th clear, the Frost glass and badge, snow, winter music, the Home card and the chooser at 390px and 320px/150% | A rehearsal log in `production/qa/evidence/sprint-21/winter/`; anything found fixed before release |
| R1 | **0.20.0**: What's new, the changelog section, an upgrade play-through, the release | Released before 1 December |

Evidence goes in `production/qa/evidence/sprint-21/`.

## Decisions
- D174: the Realistic sand phone frame-rate check is closed without a test; no complaints are known (strata-1q0).
- D175: the Home hero goes back to the pre-0.19 logo jars, drawn with Realistic sand; replaces D173.
- D176: the hero is still, with only a rare sparkle on the sand.
- D177: fix the settling pile's steps (strata-2en) and the board redraw cost (strata-8j3).
- D178: a Winter Tide dress rehearsal before 1 December.
- D179: install and app polish: install prompt, icon and splash, offline and update prompt, native feel.
- D180: everything ships as one release, 0.20.0.

## Out of scope
- App store packaging (a native wrapper).
- Push notifications.
- New levels, rules or events.
