# strata-gbw.1 / .2: Undo after a Shuffle

`check.cjs` plays level 7 into a dead end (pours 0>5, 0>6, 2>5), taps Shuffle, then Undo.
Expected (session-boosters.md §2.1 Undo row): the counter stays at 3 pours and the stuck banner
shows again. `results.json` and `undo-shuffle.png` show 3 pours and the banner.
Unit tests: tests/unit/core/undo-shuffle.test.ts.
