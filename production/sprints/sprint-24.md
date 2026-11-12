# Sprint 24: Tide jar (0.22.0)

> **Status: built (2026-11-12), approved by the owner (look approved from screenshots); released as 0.22.0.** Evidence: `production/qa/evidence/sprint-24/tide/`. From the owner interview after 0.21.0 (D193–D197). Target release: **0.22.0, whenever it's ready** (D197).

## Why
One new mechanic every 40 levels from 201 (D190). Wet sand debuted on 201; the next debuts on **241**. The owner chose the **Tide jar** (D193).

## The rules (D194, D195)
- **A tide jar** is one filled jar on a level, marked with a small wave and a count.
- **The tide turns every 4 successful pours on the board** (the count shows pours left, like the hourglass). When it turns, the jar's stack **rises by one**: its bottom unit moves to the top and every other unit moves down one place. Different from the hourglass, which flips the whole stack.
- **Sealing stops the tide**: a tide jar full of one colour seals as usual and never turns again. An empty jar doesn't turn; a jar holding one colour only looks the same after a turn.
- A tide jar has no buried units (everything in it is visible).
- Undo restores the stack and the count; shuffle keeps the tide jar's count; hints and the solver know the rule, and every deal is solver-proven like the other mechanics.
- With wet sand on the same board, a turn moves each unit's wet count with its unit.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| T1 | **Design doc**: `design/gdd/jar-mechanics.md` §2.8 Tide jar (rules, formulas, edge cases, tuning, acceptance) | Written; matches this plan |
| T2 | **Core rules** in `src/core/` (the turn, the count, sealing stops it, undo, shuffle, with wet sand), DOM-free | Unit tests for every rule and edge case |
| T3 | **Generator and solver**: placed by config (`every` 4), debut on level 241 alone with two spares, then its own roll of about 1 level in 8 from 241 (D196); levels 1–240 unchanged; not in daily, weekly or event rotations | Test: levels 1–240 identical to before (hash fixture); every tide level 241–400 generates and solves; frequency 10–15% of 241–1000 |
| T4 | **Look**: a wave mark and count on Classic and Realistic; a short rise animation when the tide turns (instant under reduced motion); colour-blind patterns move with their units; screen-reader label "tide jar, turns in N pours" and an announcement when it turns | Screenshots of every state, both boards, 320/150% |
| T5 | **Intro and help**: the intro card on level 241, Jar guide entry, map badge, tap text | Screenshot |
| R1 | **0.22.0**: What's new, the changelog, the layout guard, a play-through of 241 on both boards, the release | Released |

## Decisions
- D193: the next jar mechanic is the Tide jar, debuting on level 241.
- D194: the tide turns every 4 successful pours on the board; the stack rises by one (bottom unit to the top).
- D195: a sealed tide jar never turns again.
- D196: about 1 level in 8 from 241 (its own roll, like wet sand).
- D198: the tide jar comes only from its own roll (about 1 in 8), keeping wet sand at 1 in 8; every 4 pours; the 301–400 balance gate samples every 3rd level.
- D197: release 0.22.0 whenever it's ready; wet sand and the tide jar stay on levels only (not daily, weekly or events).

## Out of scope
- Daily, weekly and event boards.
- Further mechanics (the one for 281 is chosen later).
