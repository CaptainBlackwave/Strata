# Post-0.9.0 fixes: evidence

Follow-ups to the items in the sprint 9 report that could be fixed without an owner decision. `fixes.cjs` runs against a build (`node fixes.cjs <baseUrl> <outDir>`). `result-before-0.9.0.json` is the same script run against the 0.9.0 release (`4a35afb`), and `result.json` is the run against the fixed build.

| Fix | Check | 0.9.0 | Fixed |
|---|---|---|---|
| Late write between tabs (D57). Tab B reloads the save when another tab writes to it within 3 s of B's claim | B opens, then A writes a level-3 win | B stays on level 3 with 500 coins and would overwrite the win | B shows Level 4 and plays it, with best and coins kept |
| "New" shell mark (UX-cab-4) survives a reload, using a new `seenShells` save field | Load a save that has seen 1 of 2 shells, then open the cabinet | No mark | 1 "New"; none after reopening and reloading |
| Booster price badge at 150% text: the coin dot and number wrapped, and the number fell onto the tool name | Text lines and lowest text pixel of each badge (iPhone SE, 150%) | "120" drawn over "Jar" | One line each, clear of the names |
| Map title at 150% text on 320 px | Line count | 2 lines, 30 px | 1 line, 20.5 px |
| Map scenery label at 150% text: the path was drawn over it, and the first stone of its band sat on it | Hit-test along each label | Covered | Clear; `labels.cjs` sweep: 30 labels in view across 4 device/text combinations, 9 levels and 3 scroll positions, none covered |

Unit tests: `tests/unit/ui/seen-shells.test.ts` (5 tests) was seen failing first. Screenshots: `price-badges-se-150.png`, `map-title-se-150.png`, `cabinet-new-after-reload.png`.
