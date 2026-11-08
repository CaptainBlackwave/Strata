# Sprint 3: evidence (2026-11-08)

Production build served at `/Strata/` (same path as GitHub Pages) in headless Chromium emulating a Pixel 7.
Each debut level was played to a win by tapping the solver's path.

| Shot | Shows | Checked |
|---|---|---|
| 21-a/b | Narrow jar intro card + board (short jar, bottom right) | Intro shown once; won "Perfect!" |
| 41-a/b/c | Frozen jar intro, frosted jar, and the moment after the first seal | Tap → "Frozen: seal any jar to thaw it". After the seal: 0 `.frozen`, "Thawed!" toast |
| 61-a/b/c | Locked lid in its key colour; after its colour seals | Tap → lock explanation. After the seal: 0 `.locked` on screen |
| 81-a/b | One-way funnel (funnel rim, striped glass) | Tap → "Funnel: pour in only…"; won |
| combo-level-103 | Locked + narrow on one board | Combos appear from level 101 |
| jar-guide | Settings → Jar guide lists all four | Rules for met mechanics, "Unlocks at level N" for the rest |
| saturday-daily | 2026-11-14 (Saturday) daily, clock fixed | Mechanic = funnel, tag "Daily · tricky" |
| offline-play | Reload with the network off after one visit | Home screen + playable level (service worker) |

**Defect found and fixed:** frozen and locked jars changed state in the rules but not on screen,
because only the two jars in a pour were redrawn. After the fix, every jar is redrawn after a pour;
the check above went from `.frozen = 1` to `0` after the first seal.

**Timing (levels 1–500):** 0 generation failures, worst 196 ms (level 211, locked), 1.10 deal
attempts on average for mechanic levels. A year of Saturday and Sunday dailies: worst 26 ms.
