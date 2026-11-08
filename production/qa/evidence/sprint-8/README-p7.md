# Sprint 8 P7: backlog fixes, evidence

Task P7 of `production/sprints/sprint-8.md`, wave 2, plus TD-10. Ranked list and IDs: `production/qa/sprint-8/backlog-triage.md`. Finding detail: `production/qa/sprint-6/ux-review.md` and `accessibility-audit.md`.

Captured 2026-11-08 with Playwright (Chromium) against `npx vite --port 5202`. Phone shots use Pixel 7 emulation; p7-13 to p7-15 use a 1280x800 desktop viewport. No page errors were logged in any run.

| # | Finding | Commit | Evidence | Result |
|---|---|---|---|---|
| 1 | UX-board-7: price confirm before coins are spent | `097bc7c` | p7-01-booster-confirm.png | First Hint tap with 0 charges: coins stay 500, the button turns coral, the toast says "Tap again to buy for 60 coins", and the label becomes "Hint: tap again to buy for 60 coins". Second tap: 440 coins and the hint shows. After 3 s with no second tap the arm clears and nothing is spent. |
| 2 | UX-settings-6: your code vs restore box | `9d2a886` | p7-03-savecode-sheet.png, p7-04-savecode-invalid.png | "Your code" box is read-only (824 chars) with Copy, and focus starts on Copy. The paste box starts empty. Restore with an empty box says "Paste a save code in the box first."; with junk it says "That isn't a Strata save code...". |
| 3 | UX-win-2: Home on the level win card | `6d98e13` | p7-07-win-home.png | Home (secondary) sits beside Continue on a level card and goes to Home ("Play · Level 4"). It is hidden on daily cards, where Continue is already Home. |
| 4 | UX-settings-4: return to Settings | `6e930ff` | p7-06-back-in-settings.png (and p7-03, where the sheet opens over Settings) | After closing Save code, Scenes (Esc) and the Jar guide, Settings is still open and focus is on the opening button (`btn-savecode`, `btn-scenes-2`, `btn-guide`). |
| 5 | UX-board-5: live pour/seal announcement | `285d2d5` | no visual change | `#announce` (polite, outside `#app`) read "Poured 1 saffron into jar 6." and "Poured 1 saffron into jar 11." after pours. A seal adds "Jar N sealed." |
| 6 | UX-win-3: describe the win dialog | `6d98e13` | p7-07 (no visual change) | Resolved `aria-describedby` on a first clear: "11 pours · new best \| +20 coins". Only the parts shown that time are listed (note, shell row, unlocks when present). |
| 7 | UX-home-2 + UX-scenes-3: coin counts | `c7cfaaa` | no visual change | Accessible text: Home "500 coins", HUD "500 coins", Scenes chip "440 coins", unowned Dawn status "300 coins". |
| 8 | UX-cab-1 + AX-15: locked shells | `c7cfaaa` | p7-08-cabinet.png | The "?" is still drawn (`aria-hidden`); screen readers get "Not found yet"; the shell SVG is `aria-hidden`. |
| 9 | UX-edit-1: name error hidden on other tabs | `09c54b0` | p7-11-edit-name-error-by-save.png | Name "a", then the Avatar tab: "Name tab: use 2–16 letters or numbers to save" shows above the disabled Save. |
| 10 | UX-edit-2: name field length | `09c54b0` | p7-10-edit-locked-plates.png | `maxLength` is 16, set from `config.profile.name.max`. |
| 11 | UX-scenes-2: Use/Buy turns Match my clock off | `78abcd0` | p7-05-scenes-previewing.png | Helper text under the switch: "Choosing a scene with Use or Buy turns this off." |
| 12 | UX-settings-5: Colour patterns explanation | `c7cfaaa` | p7-02-settings-patterns-help.png | "Show a texture on each colour (colour-blind aid)" under the switch, as its `aria-describedby`. |
| 13 | UX-scenes-4: preview marked only by a border | `c7cfaaa` | p7-05-scenes-previewing.png | "Previewing Dawn" above the Buy button while previewing. |
| 14 | UX-win-4: Share outcome | `6d98e13` | p7-12-daily-share-status.png | Headless Chromium has no `navigator.share` and no clipboard permission, so the failure path shows in the card: "Couldn't share. Try again." The "Result copied" and "Shared" paths use the same element (not captured). |
| 15 | UX-board-8: jars 11+ by keyboard | `03bba2a` | p7-14-shift1-jar11.png, p7-15-jar-guide-keys.png | Level 120 plus 3 extra jars (11 jars): "1" lifts jar 1, Shift+1 pours into jar 11 ("Jar 11: saffron"). The Jar guide lists the keys on a fine pointer only (none on the phone run). |
| 16 | UX-all-6: hover state | `352a776` | p7-13-hover-play.png | Hovering Play computes `filter: brightness(1.06) saturate(1.05)`. The rule sits inside `@media (hover: hover)`, so touch is unchanged. |
| 17 | UX-cab-3: next-shell line and complete line | `0c3092d` | p7-08-cabinet.png | "Next shell: clear 2 more levels, or solve today's daily". All-shells text is now "Collection complete: each milestone now pays N coins" (or "Collection complete ✓" at 0, the D38 value). |
| 18 | AX-11: switch off-track contrast | none (already fixed) | p7-02-settings-patterns-help.png | Already fixed in sprint 6 (`43c1420`): the off track has a 2 px `--ink-soft` inset ring (computed `rgb(125, 106, 85) 0px 0px 0px 2px inset`), and `themes.test.ts` checks `inkSoft` on `card` at 3:1 or more in all 16 scenes. |
| 19 | AX-16: locked plate picks fade to 2.28:1 | `b6373d2` | p7-10-edit-locked-plates.png | Locked plates now render at opacity 1 with no greyscale, so the name keeps its unlocked contrast. A dashed `--ink-soft` edge and the lock icon mark them. Avatar and frame picks still dim. |
| 20 | UX-profile-1: "Level 12" vs "Levels cleared 11" | `b6373d2` | p7-09-profile-on-level.png | The badge reads "On level 4". |
| TD-10 | Unused strings, stale `noJars` | `c7cfaaa`, `432f28e` | `tests/unit/ui/strings-used.test.ts` | `coins`, `scenePreviewing` and `patternsTitle` are now shown. `noJars` and its `useBooster` branch are deleted: `extraJarsPerLevel` is `null`, which `GameSession` turns into `Infinity`, so `extraJarsLeft` never reaches 0. The new test also found the unused top-level `shells`, which is deleted. |
