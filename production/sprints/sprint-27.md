# Sprint 27: Crab jar and lighthouse jar (0.24.0)

> **Status: built (2026-11-13), approved by the owner (look approved from screenshots); released as 0.24.0.** Evidence: `production/qa/evidence/sprint-27/`. From the owner interview after 0.23.0 (D206–D211). Target: **0.24.0**, after 0.23.1.

## Why
One new jar mechanic every 40 levels from 201 (D190): wet sand at 201, the tide jar at 241. The owner chose two more: the **crab jar** at **281** and the **lighthouse jar** at **321** (D206).

## The rules
### Crab jar (D207)
- A crab sits on one jar's lid. **You can't pour out of that jar while the crab is on it; you can still pour into it.**
- **Every 3 successful pours on the board the crab moves** to the next jar in the row that is not sealed and not empty (wrapping round). A count on the crab shows pours until it moves.
- A sealed jar never holds the crab. If no jar can take it, it stays. Undo restores where it was and its count; shuffle keeps its jar and count.
- The new refusal "The crab is on that jar" when you try to lift its jar.
### Lighthouse jar (D208, D209)
- One jar's sand is **dark**: you can't see its colours (it shows as dark sand with a lighthouse mark and a count).
- **Every 4th successful pour on the board the beam sweeps and lights it**: the colours show **until your next pour**, then it goes dark again. The count shows pours until the next sweep.
- You can always pour from or into it; you just can't see the colours while it's dark. It is lit for good once sealed.
- Colour-blind patterns and the screen reader treat dark sand like buried sand: no colour while dark ("dark, lit in 2 pours") (D209). Hints still work (a hint is a move, not a colour).
### Both
- About **1 level in 8** from each debut, from their own rolls (`shared: false`, like the tide jar) (D210). Debut levels show their mechanic alone with two spares. Levels 1–280 unchanged (hash fixture); not in daily, weekly or events.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| K1 | **Design docs**: `design/gdd/jar-mechanics.md` §2.9 crab jar and §2.10 lighthouse jar | Written |
| K2 | **Core rules** for both (DOM-free), with the solver, hints, undo, shuffle, and every other mechanic on the same board | Unit tests for every rule and edge case |
| K3 | **Generation**: placement, own rolls tuned to ~12.5%, debuts 281 and 321, a 1–320 hash fixture made before any change, every crab/lighthouse level 281–440 solvable, the balance gates pass | Tests |
| K4 | **Look**: the crab (art on the lid, a step animation when it moves, its count), the dark sand and the beam sweep (instant under reduced motion), on Classic and Realistic in the beach-hut style; labels and announcements | Screenshots both boards, light and dark, 320/150% |
| K5 | **Intro and help**: intro cards on 281 and 321, Jar guide entries, map badges, tap and refusal texts | Screenshots |
| R1 | **0.24.0**: screenshots to the owner first, then the layout guard, tests, play-throughs of 281 and 321 on both boards, What's new, the changelog, release (D199) | Released |

## Decisions
- D206: the next two jars are the crab jar (debut 281) and the lighthouse jar (debut 321).
- D207: the crab blocks pouring out of its jar only and moves every 3 pours to the next unsealed, non-empty jar.
- D208: the lighthouse jar is dark except for the pour after every 4th pour; always pourable.
- D209: dark sand is hidden from colour-blind patterns and the screen reader too, like buried sand.
- D210: each about 1 level in 8 from its debut, from its own roll only.
- D211: 0.23.1 polish first, then both jars as 0.24.0.
