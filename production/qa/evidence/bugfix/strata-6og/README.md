# strata-6og: hand-edited saves are inferred, not reset

`check.cjs` seeds a v2 save with no `tutorialDone`, `level: -5`, best pours for levels 1-44 and
`coins: 1e300`, then loads the game (served build on port 4320).

Expected (design/gdd/save-data.md, repair rules): resumes at level 45, no tutorial, coins clamped
to 999,999,999 and shown as digits. Result in `results.json`; `home.png` shows Home.
Unit tests: tests/unit/profile/save-infer.test.ts.
