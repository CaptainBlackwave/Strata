<!-- PROTOTYPE - NOT FOR PRODUCTION -->
<!-- Question: is a calm hero-and-tabs Home clearly better than today's stacked Home? (sprint 20 H1) -->
<!-- Date: 2026-11-12 -->
# home-redesign prototype (throwaway)

**Status:** in progress. Waiting for the owner to approve it or ask for changes before H2 (`production/sprints/sprint-20.md`, D166–D170).

**Hypothesis:** if Home is a live Realistic-sand hero with one Play button, a small Today strip, and a
bottom tab bar (Play, Today, Collection, Profile) for everything else, it will look clearly calmer and
more "studio" than today's stacked Home, and the game will look better to a newcomer. Every feature
stays one tap away.

## What it shows
- **Play:** three jars on a beach. The middle one is filled from a glass funnel that trickles sand. The
  sand is painted by the real `paintGrid` with its corner mask, and the glass is the real `drawJarArt`. When
  the funnel is empty, the scene cross-fades back to the start and the next cycle uses a new colour.
  Above the jars: "Strata · Level 52". Below: Play, then the Today strip: the daily and Winter Tide cards, and a
  streak reward card. That card shows the next reward's picture and name, and a track of the six reward days
  (3, 7, 14, 30, 60, 100) with the collected days ticked, "Day 4" marked and day 7 lit. Tapping it opens Today's
  streak rewards. Today's goals now sit only on the Today tab (owner's change, 2026-11-12). The chip and coins sit small at the top.
- **Today:** daily, streak rewards (the track plus a list of all six, each with its picture), goals, weekly set, Winter Tide.
- **Collection:** shells, badges, jar styles, scenes ("New") and the beach path map. The tab carries the "new" dot.
- **Profile:** portrait and plate, stats and Settings. The gear on Today and Collection jumps here.
- **Motion:** the trickle, a light sweep every 11 s, two wave lines drifting, the shore's foam and the
  moon's glint. All of it is still under `prefers-reduced-motion` or `?still=1`, which shows a settled frame.
- **Scenes:** Midday and Moonlit. The dashed round button in the corner is a mock-up control only.

URL options: `?tab=play|today|collection|profile`, `?theme=moonlit`, `?still=1`.
Buttons that would leave Home show a "Mock-up: would open…" toast. The data is sample data and the text is hard-coded English.

## Run it
From this folder, with the repo's root `npm i` done (Vite comes from the root `node_modules`):
```
timeout 3600 npx vite --port 4560 --strictPort --host     # http://localhost:4560/
node shoot.cjs                                           # screenshots into shots/
```
It reads the painter, glass art, shell/medal/portrait SVG and `game-config.json` from `../../src`, and only reads them.
Nothing in `src/` imports this folder.

## Shots
`shots/`: each tab at 412×915, Play at 320×568 with 150% text (top and scrolled), Play and Today on
Moonlit, Play under reduced motion, and today's Home for comparison (`today-home-before-390.png`, copied
from `production/qa/evidence/sprint-17/`).

## Findings
To come after the owner's review.
