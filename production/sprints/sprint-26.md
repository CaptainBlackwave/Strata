# Sprint 26: Night polish (0.23.1)

> **Status: built (2026-11-13), approved by the owner; released as 0.23.1.** Evidence: `production/qa/evidence/sprint-26/`. From the owner interview after 0.23.0 (D204, D205). Target: **0.23.1**, now.

| ID | Task | Acceptance criteria |
|----|------|---------------------|
| N1 | **Night sea and wood**: the sea band in dark scenes gets depth (a gradient and a soft horizon, no hard slab); night wood reads as wood (warmer, a touch lighter, visible grain) | Board and Home screenshots in every night scene |
| N2 | **Toast over the shelf**: a two-line message at 320/150% no longer covers the bottom shelf (the slot fits two lines, or the toast shrinks to one line with ellipsis-free wrapping) | Screenshot at 320/150% with the longest toast |
| N3 | **Today band at night**: the coral band in dark scenes is softer, not maroon-heavy, in Home's Today header and the Weekly and Track sheets | Screenshots in every night scene; contrast tests still pass |
| C1 | **Phone checklist 0.23**: add the new look (shelves, the board's two-row top bar, one sheet header and close button, sheets open at the top, Safari's sticky headers) | Written and sent |
| R1 | **0.23.1**: the layout guard, tests, a play-through, What's new, the changelog, release (D199) | Released |

## Decisions
- D204: fix the three look items left by 0.23.0 (night sea and wood, the toast over the shelf, the Today band at night) as 0.23.1.
- D205: update the phone checklist for 0.23's look.
