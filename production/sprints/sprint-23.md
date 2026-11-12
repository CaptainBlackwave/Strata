# Sprint 23: Wet sand (0.21.0)

> **Status: planned (2026-11-12), awaiting the owner's approval.** From the owner interview after 0.20.1 (D188–D191). Target release: **0.21.0**, after 0.20.2. Winter Tide (1–31 Dec) is not changed.

## Why
Levels are endless and the 7 jar mechanics all debut by level 181 (narrow, frozen, locked, funnel, hourglass, sieve, clam). Players past 200 meet nothing new. The owner chose **new jar mechanics** (D188), starting with **Wet sand**, and a slower pace of one every 40 levels from 201 (D190).

## The rules (D189)
- **Wet units**: some sand units on a level start wet, shown darker with a droplet and a small number.
- **Only onto its colour**: a pour whose moving top units include a wet one may only go onto the same colour. It can't go into an empty jar. Dry units under or over it pour as usual.
- **Drying**: every successful pour on the board counts each wet unit down by one; at 0 it is dry and acts like normal sand. The number shows the pours left.
- A pour moves a run of the same colour; if any unit of that run is wet, the whole run follows the wet rule.
- Undo restores wetness and counts. Shuffle keeps each wet unit's count with its unit.
- Hints and the solver know the rule; every generated level stays solvable (the generator proves each deal, as for the other mechanics).
- Sealed jars: a full jar of one colour seals only once all its units are dry.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| W1 | **Design doc**: `design/gdd/jar-mechanics.md` §2.7 Wet sand (rules, formulas, edge cases, tuning, acceptance) | Reviewed by the owner |
| W2 | **Core rules** in `src/core/` (pour legality, drying, seal rule, undo, shuffle), DOM-free | Unit tests for every rule and edge case |
| W3 | **Generator and solver**: wet units placed by config (`wet.units`, `wet.dryAfter`), debut on level 201, then about `chance` of levels from 201; levels 1–200 unchanged | Test: levels 1–200 identical before and after; levels 201–260 all solvable; the debut is gentle |
| W4 | **Look**: darker damp sand with a droplet and count on Classic and Realistic; colour-blind patterns still readable; reduced motion respected; a short drying shimmer | Screenshots of every state, both boards, 320/150% |
| W5 | **Intro and help**: the mechanic intro card on level 201 and its help entry | Screenshot |
| W6 | **Save**: nothing new beyond the in-board state (levels regenerate) | Save tests unchanged |
| R1 | **0.21.0**: What's new, the changelog, the layout guard, an upgrade play-through, the release | Released |

## Decisions
- D188: new jar mechanics next, starting with Wet sand.
- D189: wet units pour only onto their own colour and dry after N pours.
- D190: one new mechanic every 40 levels from 201; Wet sand debuts on 201.
- D191: only Wet sand this sprint; the next mechanic (for 241) is chosen later.

## Out of scope
- Daily, weekly and event boards (Wet sand stays out of their rotation until a later decision).
- Further mechanics.
