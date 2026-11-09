# Sprint 8 backlog triage (P7)

> Task P7 of `production/sprints/sprint-8.md` (D46). Read-only triage by `lead-programmer`, 2026-11-08. No code or other docs were changed.
> Input: the 117 minor and nit findings in `production/qa/sprint-6/` (gdd-reviews-a 29, gdd-reviews-b 33, gdd-cross-review 11, ux-review 30, accessibility-audit 14). Bundles F1-F10 and the owner picks are in `production/qa/sprint-6-findings.md`.

## How status was decided (read this first)

- **Fixed** means the finding's ID is cited in a GDD version history, a code comment or a decision (D19-D52) as handled, or a grep of the current code/docs shows the problem is gone (for example `.pat`/44 px rules for F5, the static hint ring for F1, `isFreeBooster` for D25, `knownShells` at boot for D26). Doc findings marked fixed were located by their ID in `design/gdd/*.md` and `design/ux/` history tables; I did **not** re-read every GDD passage, so treat "Fixed (doc)" as high-confidence, not proof.
- **Still open (player-facing)** was checked against current code: `src/ui/style.css` has 0 `:hover` rules; `strings.ts` keys `coins`, `scenePreviewing`, `patternsTitle` have no use; `index.html` keeps `maxlength="32"` on the name field, `user-scalable=no`, and `aria-labelledby="intro-title"` with no element of that id; `lockedShell` is still `'?'`; level win card has no Home button (only the daily card sets `btnNext` to Home); number keys still stop at jar 10; `useBooster` still spends coins with no price confirmation. A few UX items (board-9, board-10, cab-2 heading structure) were not individually re-measured; they are marked open on the basis that no fix is cited.
- **Won't fix** carries a reason: advisory sections (Player Fantasy, Tuning Knobs) at `workflow: standard`, owner decisions (D23, D31), and tastes the owner can reverse.
- AX-14, AX-17 and AX-19 are already in sprint 8 task **P3** (D44, D45), so they are not counted in the 15-20.

## Counts

> **Sprint 9 M5 (2026-11-09):** the 9 remaining **OP** rows are now **F** (6 fixed, 3 verified already fixed by sprint 8 P3). No player-facing row is open. The plan said 11; the table had 9. Evidence: `production/qa/evidence/sprint-9/README-m5.md`.

| Status | Count |
|---|---|
| Fixed in sprints 6-7 | 64 |
| Still open (player-facing) | 31 (3 of them already in P3) |
| Still open (doc only) | 8 |
| Won't fix | 14 |
| **Total** | **117** |

By source: gdd-reviews-a 23 fixed / 0 open / 6 won't; gdd-reviews-b 24 fixed / 4 doc / 5 won't; gdd-cross-review 8 fixed / 2 doc / 1 won't; ux-review 2 fixed / 25 player / 1 doc / 2 won't; accessibility-audit 7 fixed / 6 player / 1 doc.

## Recommended fixes (ranked by player value; all S unless noted)

> **P7 wave 2 result (2026-11-08, `ui-programmer`):** all 20 closed. 19 fixed in 13 commits on the P7 branch, and #18 (AX-11) was already fixed in sprint 6. TD-10 closed with them (`c7cfaaa`, `432f28e`). Evidence: `production/qa/evidence/sprint-8/README-p7.md`.

1. **UX-board-7: price confirmation before coins are spent.** With 0 charges a booster tap spends up to 120 coins at once. First tap shows "Hint for 60 coins? Tap again", second tap buys. Change `useBooster` in `src/ui/main.ts` (reuse the restart arm-window pattern, `RESTART_CONFIRM_MS`) plus a string. Size S-M. **Done in P7: `097bc7c` (p7-01).**
2. **UX-settings-6: separate "your code" from the restore box.** The pre-filled box makes Restore warn about overwriting your own progress. Read-only code + Copy, and an empty paste field for Restore, in `index.html` and `openTransfer`/`restoreSaveCode` (`main.ts` ~174-225). Size S-M. **Done in P7: `9d2a886` (p7-03, p7-04).**
3. **UX-win-2: Home button on level win cards.** Today the only way out is Continue, then Settings, then Home. Add a secondary button in `index.html` `#win` and show it when `mode !== 'daily'` in `showWin`. **Done in P7: `6d98e13` (p7-07).**
4. **UX-settings-4: return to Settings when a sub-screen was opened from it.** Scenes, Jar guide and Save code drop the player on the board. Pass the opener to `closeLayer` (the `LayerStack` already restores focus), `main.ts` open/close pairs. **Done in P7: `6e930ff` (p7-06).**
5. **UX-board-5: polite live announcement for pours and seals.** "Poured 2 coral into jar 4. Jar 4 sealed." Add a visually hidden `aria-live` node in `index.html`, set it in `finishPour`/`onSessionEvent`, strings in `strings.ts`. **Done in P7: `285d2d5` (announce text checked).**
6. **UX-win-3: describe the win dialog.** `aria-describedby` pointing at `#win-text`, `#win-note`, `#win-reward` in `index.html`, so Continue's focus does not skip the result. **Done in P7: `6d98e13` (aria-describedby checked).**
7. **UX-home-2 + UX-scenes-3: coin counts read "120", "300".** Add hidden " coins" text (use the unused `t.coins`) to the home, HUD and Scenes chips and the unowned scene status, `index.html` and `renderScenes`. **Done in P7: `c7cfaaa` (text checked).**
8. **UX-cab-1 + AX-15: locked shells read "question mark" 19 times.** Keep the "?" visually, give the cell an `aria-label`/hidden "Locked shell" and the SVG `aria-hidden`, in `openCabinet` (`main.ts` ~475) and `strings.ts` `lockedShell`. **Done in P7: `c7cfaaa` (p7-08).**
9. **UX-edit-1: invalid-name reason hidden on other tabs.** Show the error beside Save (or mark the Name tab) in `renderEdit`/`#name-error`. **Done in P7: `09c54b0` (p7-11).**
10. **UX-edit-2: name field allows 32 characters, rule is 16.** Set `maxlength` to 16 in `index.html` line 161 (normalisation already trims). **Done in P7: `09c54b0` (p7-10).**
11. **UX-scenes-2: nothing says Use/Buy turns "Match my clock" off.** One line under the switch or a toast, in `confirmScene` (`main.ts` ~308). **Done in P7: `78abcd0` (p7-05).**
12. **UX-settings-5: Colour patterns switch has no explanation.** Show the existing `t.patternsTitle` as helper text under the switch in `index.html`. **Done in P7: `c7cfaaa` (p7-02).**
13. **UX-scenes-4: preview is marked only by a border.** Show the existing `t.scenePreviewing(name)` above the Buy/Use button in `renderScenes`. **Done in P7: `c7cfaaa` (p7-05).**
14. **UX-win-4: a failed Share is silent, and success shows under the overlay.** Show "Copied" / "Couldn't share" inside the card in `shareDaily` (`main.ts` ~744) with a string each. **Done in P7: `6d98e13` (p7-12).**
15. **UX-board-8: number keys reach jars 1-10 only; boards reach 14.** Document "Tab for jars 11+" in the jar guide, or add Shift+1.. mappings in `wireInput` (`main.ts` ~1630). **Done in P7: `03bba2a` (p7-14, p7-15).**
16. **UX-all-6: no hover state on desktop.** Subtle tint on `.primary`, `.secondary`, `.tool`, `.icon-btn`, cards inside `@media (hover: hover)` in `style.css` (0 hover rules today). **Done in P7: `352a776` (p7-13).**
17. **UX-cab-3: "Next shell: clear N more levels" ignores the daily shell; "Collection complete: +50" reads as a payout just made.** Reword in `strings.ts` (`allShellsBonus`, next-shell line) and `openCabinet`. **Done in P7: `0c3092d` (p7-08).**
18. **AX-11: switch off-track `#d9cbb4` is 1.5:1 on the card (needs 3:1 for controls).** Make it a scene token or a darker fixed colour in `style.css`; add the pair to the per-scene contrast test in `tests/unit/core/themes.test.ts`. **Already fixed, no change in P7:** sprint 6 (`43c1420`) gave the off track a 2 px `--ink-soft` inset ring, which is the control boundary; `tests/unit/core/themes.test.ts` checks `inkSoft` on `card` at 3:1 or more in every scene, so the 8 new P1 scenes are covered (computed style and p7-02 checked).
19. **AX-16: locked plate picks fade to 2.28:1.** Raise the locked-pick opacity or keep text at full contrast in `style.css`; add the pair to the contrast test. **Done in P7: `b6373d2` (p7-10).**
20. **UX-profile-1: header "Level 12" next to tile "Levels cleared 11" reads as a contradiction.** Label the badge "On level 12" via `t.levelBadge` in `strings.ts`. **Done in P7: `b6373d2` (p7-09).**

Next best, if capacity remains: UX-board-10 (coach caption `nowrap` at 150% text on 320 px), UX-cab-2 (heading structure in the cabinet), UX-home-3 (daily card name includes the day), UX-board-9 (explain why boosters are disabled in the tutorial), UX-cab-4 (mark the newest shell "New"), UX-board-6 is already fixed.

## Full table

Status key: **F** fixed, **OP** still open (player-facing), **OD** still open (doc only), **W** won't fix. Source key: A = gdd-reviews-a, B = gdd-reviews-b, X = gdd-cross-review, U = ux-review, AX = accessibility-audit. Value is for the player: high, med, low (doc-only items are low by definition). "Fix now" is Y for the ranked list above, P3 for items already in task P3.

| ID | Source | Status | Player value | Size | Recommend fix now? | Note |
|---|---|---|---|---|---|---|
| GA-PR-2 | A | F | low | S | n/a | stuck-definition in pour-rules |
| GA-PR-3 | A | F | low | S | n/a | D21 |
| GA-PR-4 | A | F | low | S | n/a | |
| GA-PR-5 | A | F | low | S | n/a | |
| GA-PR-6 | A | W | low | S | N | advisory section at `standard` |
| GA-LG-4 | A | F | low | S | n/a | |
| GA-LG-5 | A | F | low | S | n/a | |
| GA-LG-6 | A | F | low | S | n/a | owner default |
| GA-LG-7 | A | F | low | S | n/a | tested |
| GA-LG-8 | A | W | low | S | N | advisory Tuning Knobs |
| GA-JAR-4 | A | F | low | S | n/a | |
| GA-JAR-5 | A | F | low | S | n/a | |
| GA-JAR-6 | A | F | low | S | n/a | "teal" gone from jar-mechanics.md |
| GA-JAR-7 | A | W | low | S | N | advisory Tuning Knobs |
| GA-SB-5 | A | F | low | S | N | doc fixed; stale `noJars` string is TD-10 |
| GA-SB-6 | A | F | low | S | n/a | roadmap IDs now R1-R5 |
| GA-SB-7 | A | W | low | S | N | advisory |
| GA-ECON-3 | A | F | low | S | n/a | |
| GA-ECON-4 | A | F | low | S | n/a | |
| GA-ECON-5 | A | F | low | S | n/a | |
| GA-ECON-6 | A | F | low | S | n/a | |
| GA-ECON-7 | A | W | low | S | N | advisory; economy targets are D23 balance sprint |
| GA-DP-2 | A | F | low | S | n/a | |
| GA-DP-3 | A | F | low | S | n/a | |
| GA-DP-4 | A | F | low | S | n/a | |
| GA-DP-5 | A | F | med | S | n/a | built (owner default) |
| GA-DP-6 | A | F | med | S | n/a | `dailyShare` in save |
| GA-DP-7 | A | F | low | S | n/a | |
| GA-DP-8 | A | W | low | S | N | advisory |
| GB-SC-2 | B | F | low | S | n/a | `knownShells` at boot (D26) |
| GB-SC-3 | B | F | low | S | n/a | |
| GB-SC-4 | B | F | low | S | n/a | |
| GB-SC-5 | B | W | low | S | N | advisory Tuning Knobs |
| GB-SC-6 | B | F | low | S | n/a | D26 |
| GB-SC-7 | B | F | low | S | n/a | |
| GB-SC-8 | B | W | low | S | N | advisory Player Fantasy |
| GB-SN-1 | B | F | low | S | n/a | |
| GB-SN-2 | B | OD | low | S | N | add "clock toggle saves at once" to scenes.md |
| GB-SN-3 | B | F | low | S | n/a | economy owns the figure |
| GB-SN-4 | B | W | low | S | N | prices and targets are D23 (balance sprint) |
| GB-SN-5 | B | F | low | S | n/a | |
| GB-SN-6 | B | OD | low | M | N | ACs for preview-restore, clock poll, button states (Playwright) |
| GB-SN-7 | B | OD | low | S | N | list the checked contrast pairs |
| GB-FA-5 | B | F | low | S | n/a | |
| GB-FA-6 | B | F | low | S | n/a | |
| GB-FA-7 | B | OD | low | S | N | write `computeLayout` rules as formulas |
| GB-FA-8 | B | W | low | S | N | D31: presentation timings exempt (verified in tech-debt review) |
| GB-FA-9 | B | W | low | S | N | advisory |
| GB-SD-4 | B | F | low | S | N | shells fixed by D26; `best`/`level` hygiene is TD-6; save-data.md line 147 is stale |
| GB-SD-5 | B | F | low | S | n/a | |
| GB-SD-6 | B | F | low | S | n/a | |
| GB-SD-7 | B | F | low | S | n/a | |
| GB-SD-8 | B | F | low | S | n/a | |
| GB-PP-2 | B | F | low | S | n/a | |
| GB-PP-3 | B | F | low | S | n/a | hyphen rule in player-profile.md |
| GB-PP-4 | B | F | low | S | n/a | |
| GB-PP-5 | B | F | med | S | n/a | D25: free Undo not counted (`isFreeBooster`) |
| GB-PP-6 | B | F | low | S | n/a | |
| GB-PP-7 | B | F | low | S | n/a | |
| GB-PP-8 | B | F | low | S | n/a | |
| GB-PP-9 | B | F | low | S | n/a | |
| GB-PP-10 | B | F | low | S | n/a | |
| GX-5 | X | F | low | S | n/a | |
| GX-7 | X | F | low | S | n/a | brief has Pillars (D29) |
| GX-10 | X | F | low | S | n/a | |
| GX-12 | X | F | low | S | n/a | |
| GX-15 | X | F | low | S | n/a | D26 |
| GX-16 | X | F | low | S | n/a | |
| GX-17 | X | F | med | S | n/a | D25 |
| GX-18 | X | F | low | S | n/a | |
| GX-19 | X | W | low | S | N | advisory Player Fantasy sections |
| GX-20 | X | OD | low | S | N | unify "tall-jar" and `challenge` naming in a glossary |
| GX-21 | X | OD | low | M | N | Cross-References tables; add when each GDD is next edited |
| UX-all-6 | U | F | med | S | Y (#16) | no `:hover` rules; fixed in P7 `352a776` |
| UX-home-2 | U | F | med | S | Y (#7) | fixed in P7 `c7cfaaa` |
| UX-home-3 | U | F | low | S | N | next-best; fixed in sprint 9 M5 (287820b): name reads "Daily puzzle, Monday 9" |
| UX-board-5 | U | F | med | S | Y (#5) | fixed in P7 `285d2d5` |
| UX-board-6 | U | F | med | S | n/a | static refused outline (AX-5) |
| UX-board-7 | U | F | high | S-M | Y (#1) | fixed in P7 `097bc7c` |
| UX-board-8 | U | F | low | S | Y (#15) | fixed in P7 `03bba2a` |
| UX-board-9 | U | F | low | S | N | next-best; fixed in sprint 9 M5 (287820b): caption above the toolbar in the tutorial |
| UX-board-10 | U | F | low | S | N | next-best, not re-measured; fixed in sprint 9 M5 (287820b, clamp corrected in 49456db) |
| UX-win-2 | U | F | high | S | Y (#3) | fixed in P7 `6d98e13` |
| UX-win-3 | U | F | med | S | Y (#6) | fixed in P7 `6d98e13` |
| UX-win-4 | U | F | med | S | Y (#14) | fixed in P7 `6d98e13` |
| UX-win-5 | U | OD | low | S | N | document that Esc does nothing on the win card |
| UX-profile-1 | U | F | low | S | Y (#20) | fixed in P7 `b6373d2` |
| UX-profile-2 | U | F | low | S | N | asterisk on the 5 new counters; fixed in sprint 9 M5 (287820b): asterisk on the 5 counters |
| UX-edit-1 | U | F | med | S | Y (#9) | fixed in P7 `09c54b0` |
| UX-edit-2 | U | F | low | S | Y (#10) | one attribute; fixed in P7 `09c54b0` |
| UX-edit-3 | U | W | low | S | N | accepted as is: Re-roll is a deliberate overwrite |
| UX-cab-1 | U | F | med | S | Y (#8) | fixed in P7 `c7cfaaa` |
| UX-cab-2 | U | F | low | S | N | 44 px part fixed (F5); h3-in-button structure remains; fixed in sprint 9 M5 (287820b): button inside the h3 |
| UX-cab-3 | U | F | low | S | Y (#17) | fixed in P7 `0c3092d` |
| UX-cab-4 | U | F | low | S | N | delight; next-best; fixed in sprint 9 M5 (287820b): "New" until the cabinet is next opened |
| UX-scenes-2 | U | F | med | S | Y (#11) | fixed in P7 `78abcd0` |
| UX-scenes-3 | U | F | med | S | Y (#7) | fixed in P7 `c7cfaaa` |
| UX-scenes-4 | U | F | low | S | Y (#13) | string exists; fixed in P7 `c7cfaaa` |
| UX-scenes-5 | U | W | low | S | N | close-pattern choice waits for the interaction-pattern library |
| UX-settings-4 | U | F | med | S | Y (#4) | fixed in P7 `6e930ff` |
| UX-settings-5 | U | F | med | S | Y (#12) | string exists; fixed in P7 `c7cfaaa` |
| UX-settings-6 | U | F | high | S-M | Y (#2) | progress-loss risk; fixed in P7 `9d2a886` |
| UX-settings-7 | U | F | low | S | n/a | F3 first focus |
| AX-8 | AX | F | med | S | n/a | F4 |
| AX-9 | AX | F | med | S | n/a | F4 |
| AX-10 | AX | F | med | S | n/a | F4 |
| AX-11 | AX | F | med | S | Y (#18) | already fixed in sprint 6 (`43c1420`, 2 px ink-soft ring, contrast-tested) |
| AX-12 | AX | F | high | S | n/a | F5, 44 px |
| AX-13 | AX | F | med | S | n/a | F1 |
| AX-14 | AX | F | med | S | P3 | `intro-title` id missing; verified fixed in sprint 9 M5: `id="intro-title"` added in sprint 8 P3 (05d5be5) |
| AX-15 | AX | F | med | S | Y (#8) | same fix as UX-cab-1; fixed in P7 `c7cfaaa` |
| AX-16 | AX | F | low | S | Y (#19) | fixed in P7 `b6373d2` |
| AX-17 | AX | F | high | S | P3 | D44, still `user-scalable=no`; verified fixed in sprint 9 M5: no `user-scalable=no`, sprint 8 P3 D44 (05d5be5) |
| AX-18 | AX | F | med | S | n/a | F5 |
| AX-19 | AX | F | med | S | P3 | D45; verified fixed in sprint 9 M5: 34 px jars get 45 px hit areas, sprint 8 P3 D45 (05d5be5) |
| AX-20 | AX | F | low | S | n/a | HUD wrap fix |
| AX-21 | AX | OD | low | S | N | A6 accepts 3:1 for soft text; revisit the criterion in `accessibility-requirements` |

## Notes for the second wave

- Fixes 7, 8, 12, 13 use strings that already exist but are unused (`coins`, `lockedShell`, `patternsTitle`, `scenePreviewing`); they close TD-10 at the same time.
- Fixes 4, 9, 10, 11, 16, 20 are one-file or one-attribute changes, safe to batch. Fixes 1 and 2 change interaction and need new Playwright screenshots (booster price prompt, transfer sheet) per the UI evidence rule.
- Fix 18/19 should extend the existing per-scene contrast test so the new P1 scenes (8 more) are covered by the same pairs.
- Changes to `index.html` and `main.ts` will collide with P3, P5 and the TD-2/TD-9 refactors; sequence them or assign one owner for `main.ts`.
