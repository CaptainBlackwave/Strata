# strata-gbw.7: no freeze on a late map replay

`check.cjs` replays levels 615 and 545 from the map (save at level+3) and records long tasks.
Before the fix: one 930 ms main-thread task on 615 (leftover sweep D). After: `results.json` shows no
long tasks; the worker makes the board (615 reaches the board in about 430 ms). Screenshots:
M-replay-615.png, M-replay-545.png. Unit tests: tests/unit/core/prefetch-ensure.test.ts.
