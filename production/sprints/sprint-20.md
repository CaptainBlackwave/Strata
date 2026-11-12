# Sprint 20: A new Home

> **Status: built and released as 0.19.0 (2026-11-12).** Mock-up approved with D171–D172. Evidence: `production/qa/evidence/sprint-20/`. Mock-up first, then the build. Target release: **0.19.0**.

## Why
Home grew one card at a time: logo jars, Play, daily, streak line, weekly, event, goals, then shells, scenes and styles below. It is busy, it doesn't match the new Realistic sand look, players miss features, and it doesn't sell the game to a newcomer (D166).

## Goal
A calm, studio-quality Home where the eye lands on a live sand scene and one big Play button, today's reasons to play sit in one strip, and everything else is one tap away in a bottom tab bar.

## The design
- **Hero (D167):** a large glass jar (or a small set) of layered Realistic sand that slowly trickles and settles, lit softly; the level number above, one big **Play** button below. On Classic or without WebGL, a matching still image.
- **Today strip (D168, D171, D172):** under Play, compact cards for the daily and the event when one runs, then a **streak reward card** with the next reward's picture and name, "Day N · … in K days" and a track of the six reward days. **Goals live on the Today tab**, not on Play. Booster rewards are titled "Booster pair" (day 3) and "Booster bundle" (day 7).
- **Bottom tab bar (D168):** **Play** (Home), **Today** (daily, weekly, goals, event, streak rewards), **Collection** (shells, badges, jar styles, scenes, map), **Profile** (profile, stats, Settings). A tab appears only once it holds something; a dot marks something new.
- **Header:** the profile chip and coins stay small at the top; Settings moves into Profile (the gear stays reachable).
- **First visit (D169):** straight into the tutorial, as today.
- **Motion (D169):** a slow trickle, a soft light sweep and a moving sea; nothing flashes; all still under reduced motion.
- **Accessibility:** the tab bar is a real tablist (arrow keys, aria-selected); every feature stays keyboard and screen-reader reachable; 320 px at 150% text fits.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| H0 | **UX spec**: update `design/ux/home.md` for the new layout, states and unlocks | Reviewed against `design/accessibility-requirements.md` |
| H1 | **Clickable mock-up** in `prototypes/home-redesign/`, with the real game's palette and a real sand render as the hero | The owner approves it (or asks for changes) before H2 |
| H2 | **Hero**: the live sand scene on the GPU board's renderer; the still fallback | Draws only while visible; nothing under reduced motion |
| H3 | **Today strip and tab bar**: Play, Today, Collection, Profile; unlock rules; "new" dots | Every existing Home entry point still reachable; tests for the unlock rules |
| H4 | **Checks**: keyboard, screen reader, 320 px at 150% text, dark scenes | Screenshots of every tab |
| R1 | **0.19.0**: What's new, the changelog, upgrade check, release | Upgrade play-through |

## Decisions
D166–D170 in `design/gdd/systems-index.md`.
