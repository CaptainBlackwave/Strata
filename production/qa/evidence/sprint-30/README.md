# Sprint 30 E4: Saturday daily era (from 2026-12-19) and weekly era (from 2026-W52)

Captured with `capture.cjs` (dev server on 5230: `PORT=5230 node production/qa/evidence/sprint-30/capture.cjs`).
The browser clock is fixed per shot with Playwright `context.clock.setFixedTime`, at noon UTC. Shots are 412x900 at deviceScaleFactor 2 unless they say 320-150 (320px wide, 150% text).
dom means the Classic board in the midday (light) scene. gpu means the Realistic board in the moonlit (dark) scene. The facts for each shot (jar labels, tag, scroll width, errors) are in `capture-log.json`.

## Saturday daily: each new mechanic (level-400 save, all jars seen)
- daily-2026-12-19-wet-dom-light.png: Sat Dec 19, wet sand (2 wet jars, "dries in 5"), Classic light
- daily-2026-12-19-wet-gpu-dark.png: the same daily, Realistic dark
- daily-2026-12-26-tide-dom-light.png: Sat Dec 26, tide jar (turns in 4), Classic light
- daily-2026-12-26-tide-gpu-dark.png: the same daily, Realistic dark
- daily-2027-01-02-crab-dom-light.png: Sat Jan 2, crab on jar 5 (moves in 3), Classic light
- daily-2027-01-02-crab-gpu-dark.png: the same daily, Realistic dark
- daily-2027-01-09-lighthouse-dom-light.png: Sat Jan 9, lighthouse jar (dark, lit in 4), Classic light
- daily-2027-01-09-lighthouse-gpu-dark.png: the same daily, Realistic dark
- daily-2027-01-16-sun-dom-light.png: Sat Jan 16, sunrise and sunset pair (14 jars), Classic light
- daily-2027-01-16-sun-gpu-dark.png: the same daily, Realistic dark

## Pair Saturday at 320px, 150% text
- daily-2027-01-16-sun-320-150-dom.png: Sat Jan 16 pair (14 jars), Classic, 320px at 150%, no horizontal overflow
- daily-2027-01-16-sun-320-150-gpu.png: the same, Realistic. The header date shortens to "Sat, Jan..." (the existing ellipsis on `.level-label`)

## Intro path (D2)
- intro-2027-01-02-crab-level50.png: a level-50 player (seen: narrow, frozen) opens the crab Saturday. The "New jar!" crab card shows over the daily

## Weekly: the theme name on the chooser sheet and the Today card (Wednesday of each week)
- weekly-sheet-2026-W52-rain-on-the-dunes.png: chooser, "Week 52 · Rain on the Dunes · 0 of 5 cleared"
- weekly-sheet-2026-W53-high-water.png: chooser, "Week 53 · High Water"
- weekly-sheet-2027-W01-crab-walk.png: chooser, "Week 1 · Crab Walk"
- weekly-sheet-2027-W02-night-watch.png: chooser, "Week 2 · Night Watch"
- weekly-sheet-2027-W03-dawn-to-dusk.png: chooser, "Week 3 · Dawn to Dusk"
- weekly-sheet-*-320-150.png (5): the same five choosers at 320px and 150% text
- weekly-card-2026-W52-rain-on-the-dunes.png: Today tab weekly card, "Rain on the Dunes"
- weekly-card-2026-W53-high-water.png: Today card, "High Water"
- weekly-card-2027-W01-crab-walk.png: Today card, "Crab Walk"
- weekly-card-2027-W02-night-watch.png: Today card, "Night Watch"
- weekly-card-2027-W03-dawn-to-dusk.png: Today card, "Dawn to Dusk"
- weekly-card-*-320-150.png (5): the same five cards at 320px and 150% text

## Dawn to Dusk board (2027-W03, board 1)
- weekly-board-2027-W03-dawn-to-dusk-dom-light.png: Week 3 · Board 1, tag "Dawn to Dusk", sunrise and sunset pair (9 jars), Classic light
- weekly-board-2027-W03-dawn-to-dusk-gpu-dark.png: the same board, Realistic dark

## Build and layout guard
`npm run build` passed (tsc and vite). `npm run guard:layout`: 48 screens checked, 0 with overflow, 0 could not be opened.
