# 0.10.1: evidence

The quick-fix release before sprint 11 (D79). The plan is in `production/sprints/sprint-11.md`, under "Before the sprint".

| Task | Evidence |
|---|---|
| Q1: slider track (D72) | `sliders-<scene>-before.png` / `-after.png` in Midday, Moonlit tide, Aurora night and Winter lights (`sliders.cjs`). The track was the browser's dark grey; it is now the scene's soft ink, with the fill and thumb in its accent. `tests/unit/core/themes.test.ts` checks both at 3:1 or more on the card in all 16 scenes |
| Q2: glow per scene (D73) | `glow-<scene>-before.png` / `-after.png` (`glow.cjs`). The glow token is now set per scene (Midday 255, 236, 170; Moonlit 190, 210, 255; Spring blossom 255, 200, 222), and the motes follow it. Aurora night has no bloom by design, because its own win canvas runs (D40); its tint shows in the seal shimmer. Tests check that every scene sets both tokens and that at least 12 tints differ |
| Q3: phone checklist (D74) | https://claude.ai/artifact/P5gNC7P6YJoL15C4SZ8cKn: 16 checks, plus the phone and browser. Only the owner can write answers: a write as Contributor was refused, and an owner probe write was read back and deleted |
| Q4: cleanup | `level-generation.md` and `economy.md` updated; three merged agent checkouts removed; the live 0.10.0 check recorded in the sprint 10 evidence |
| Release | `upgrade-result.txt`: an older save sees the 0.10.1 card, then Home → map → level 12 → win, with no errors. Hint play-through and cold layout pass. `npm test`: 722/722 |
