# Sprint 18: Feel

> **Status: planned (2026-11-11), approved by the owner.** From the owner interview after 0.16.0 (D148–D152). Target release: **0.17.0**, live **before 1 December 2026**, so the winter touches arrive with Winter Tide.

## Why
No complaints are known (D148). The owner chose **feel and polish** next: make every pour, seal and win more satisfying, with no new rules. The owner also wants a **local stats sheet** players can copy into a message, because nothing is sent automatically (no server, D150).

## Goal
The same game, but it feels better in the hand. Every effect respects reduced motion, the sound and music settings and the colour-pattern setting, and costs no frame drops on a mid-range phone.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| F1 | **Pour** (D149): the sand streams in grains from the source jar and settles into a soft pile that levels out; the pour sound's length and pitch follow how many units move | No frame over 16 ms at 4× CPU throttle on a 16-jar board; reduced motion keeps today's simple move; sound recipe unit-tested |
| F2 | **Seal** (D149): the cork drops in with a small bounce and a sparkle; the seal chime rises a step with each jar sealed on the board | Chime steps tested; reduced motion shows the cork without the bounce |
| F3 | **Win** (D149): before the card, the sealed jars glow one by one, then a final chord in the scene's key | Total under 1.2 s; skippable with a tap; reduced motion skips the glow run |
| F4 | **Screens** (D149): smoother sheet and card transitions, a press feel on buttons, a gentle Home idle (logo jars sway, the sea moves) | All honour reduced motion; nothing moves under it |
| W1 | **Winter touches** (D151): light snowfall on Home and event boards during an event, and a winter variation of the music while Winter Tide runs | Only 1–31 Dec; no snow under reduced motion; music follows the music setting |
| S1 | **Stats sheet** (D150): a Settings item "Your stats" that shows, and copies as plain text: progress (level, streaks, Perfect clears, shells, badges); today (goals done, daily solved, event boards cleared); boosters used and coins earned; game version, browser and screen size | Copy works offline; nothing is sent; text builder unit-tested |
| R1 | **0.17.0**: What's new, the changelog section, the release, before 1 Dec | Upgrade play-through |

Evidence for F1–F4 and W1 is short screen recordings or frame strips in `production/qa/evidence/sprint-18/`, plus a performance trace.

## Decisions
- D148: no known complaints; next focus is feel and polish.
- D149: polish the pour, the seal, the win, and screens and menus, with no new rules.
- D150: a local stats sheet players copy and send themselves; nothing is sent automatically.
- D151: Winter Tide gets snowfall and a winter music variation during the event.
- D152: one release, 0.17.0, before 1 December.

## Out of scope
- New rules, levels or events.
- Any data sent off the device.
