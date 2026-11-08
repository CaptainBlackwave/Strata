# Sprint 7: evidence

## Bug fix: a sealed jar kept showing "?" (owner report, 2026-11-08)

**Report:** on level 26, a jar sealed (cork on) while its bottom layer still showed "?". A sealed jar is one colour by definition, so its buried sand must be that colour and should show.

**Fix:** `settle()` in `src/core/board.ts` reveals every buried unit of a sealed jar (the same place that thaws frozen jars and opens locks on a seal); `makeBoard()` does the same for a jar dealt already full. Tests in `tests/unit/core/board.test.ts` ("sealing reveals buried sand") were written first and seen failing (2 of 3; the third, "a jar that doesn't seal stays buried", guards against over-revealing).

**Also fixed:** a hint's From/To marks stayed on screen after the player made the suggested pour, so "To" could point at the jar that had just sealed. Marks now clear whenever the board changes.

| Screenshot | Check | Result |
|---|---|---|
| `bug-sealed-jar-reveals-buried.png` | Level 26 (the owner's level), played with hints, Pixel 7, colour patterns on. Taken right after the teal jar sealed. (Its marks are from before the hint-clearing fix.) | The sealed teal jar shows all four layers, no "?" | Pass |

Whole-level check after both fixes (`hintclear.cjs`): 36 pours to a win; sealed jars showing "?": 0; hint marks left after a pour: 0; no page errors. `npm test`: 289/289.
