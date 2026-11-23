# Sprint 29 N4/N5 evidence: sunrise and sunset jars

Captured 2026-11-23 with `jars.cjs` (Playwright + Chromium, 412 x 900, deviceScaleFactor 2), against a
Vite dev server: `PORT=5229 node production/qa/evidence/sprint-29/jars.cjs`.

## Kept (they don't depend on level 361's board)

| File | Shows |
|---|---|
| `intro-361.png` | The intro card on 361 (`t.mechanics.sun`): "NEW JAR!", title, rule text and the sunrise mini-jar (band + open half-sun, up arrow). The board behind it is the working tree's new deal at capture time (pair dealt empty as two extra jars), so ignore the backdrop |
| `jar-guide-sun.png` | The Jar guide scrolled to its last entry, "Sunrise and sunset jars", below the lighthouse jar |
| `map-361.png` | The beach path with 361 as the next level and the "new jar" badge under it. Its label reads "Level 361, next level, new jar: sunrise jar" (`jars-log-teach.json`) |
| `jars-log-teach.json` | The captured intro and guide text, and the map stone's label |

Re-run only these with `ONLY=teach INTRO=1`.

## Superseded: the board shots (deleted)

The owner changed the deal: the pair is now dealt **empty, as two extra jars**. So every board shot
of 361 from the first run was deleted (start, sunrise moment and filled, dusk board and win, reduced
motion, the four refusal toasts, both dead ends, 320px/150% and patterns, on Classic and Realistic,
light and dark). `map-361-card.png` was deleted too: tapping the next level's stone plays the level,
so that shot was a board.

Re-run them with `ONLY=board` once the new deal is final. The script solves 361 in the page and
searches the solver's path for each refusal (`'sun'` into each jar, `'sunrise'`, `'sunset'`) and for a
pour that leaves the board lost to `'sunset'`, so it should work on the new board without changes.
The sunrise dead end can't happen with the pair alone (it needs a funnel, a frozen jar or a lock
holding the band), so it uses a small crafted board with a funnel. Check that the new deal still
gives a `'sunset'` dead end along the path. If it doesn't, the log says `lostSunset` was not found.
