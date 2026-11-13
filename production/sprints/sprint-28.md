# Sprint 28: The sieve is a goal (0.24.1)

> **Status: approved by the owner (2026-11-13); building.** From player feedback after 0.24.0: a level-145 video shows the sieve (the lidded jar that only takes pink) emptied and left empty, and the level still won "Perfect!". Players read the sieve as a gate and a goal, so a win that ignores it makes it pointless. Decisions D214–D217. Target: **0.24.1**, a fix release on its own.

## Why
Rule 4 of the sieve (`jar-mechanics.md` §2.5) says a level "ends with it sealed in its band **or empty**". The generator already prefers bands whose proof ends with the sieve sealed, but nothing requires it, so players can sort the band colour in an ordinary jar and walk past the sieve. The owner chose to make sealing the sieve part of winning (D214).

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| S1 | **Win rule** (D214): a board is won only when every jar is empty or complete **and every sieve is sealed in its band**. `isWon` changes, so the solver, hints, the stuck check and the session all follow it. The generator's band choice (`proveDeal`) keeps only bands whose proof ends with the sieve sealed; if no band within `colorTries` works, the deal falls back as today. Every sieve level is solver-proven under the new rule | Unit tests: the level-145 end state (sieve empty, all else sorted) is not won; sealed in band is won; every sieve level in 141–1000 builds and its proof ends with the sieve sealed. Levels without a sieve stay byte-identical (hash fixtures); the sieve levels that change are listed in the GDD |
| S2 | **Dead end** (D215): sealing the band colour in any jar except the sieve is allowed, then the board reports it lost: a new `LostReason` `'sieve'`, shown as "Pink was sealed outside its sieve" with Undo and Restart, like the lock and funnel dead ends | Unit tests for `lostReason` (sealed outside: lost; still open: not lost); a screenshot of the message |
| S3 | **Show the goal** (D216): the intro card at 141, the Jar guide and the screen-reader label say "Fill it with <colour> to finish". The sieve gets a small goal mark that fills in when it is sealed, on Classic and Realistic | Screenshots at 412px and 320px/150%, Classic and Realistic, open and sealed; the layout guard passes |
| S4 | **Saves and dailies**: a saved in-progress board on a sieve level still loads; if its board changed it restarts that level cleanly. Dailies and weeklies with a sieve follow the same rule | Unit test for loading an old save; a daily with a sieve played to a win |
| R1 | **0.24.1**: What's new ("The sieve jar is now a goal: fill it to finish"), the changelog, a play-through of level 145 to a win with the sieve sealed, the release | tsc, tests, build, `guard:layout` and the play-through pass (D199) |

Evidence goes in `production/qa/evidence/sprint-28/`.

## Decisions
- D214: a level is won only when every sieve is sealed in its band; every sieve level is proven under that rule.
- D215: sealing the band colour outside the sieve is allowed and then reported as a dead end ("<colour> was sealed outside its sieve"), with Undo and Restart.
- D216: the goal is shown in words (intro card, Jar guide, screen reader) and by a goal mark on the sieve that fills in when sealed.
- D217: ships alone as 0.24.1, with screenshots of the goal mark sent before release.

## Out of scope
- Changing the other jar mechanics (lock, clam, tide, crab, lighthouse).
- New levels or mechanics.
