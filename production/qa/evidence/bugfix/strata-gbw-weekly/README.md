# strata-gbw.6: weekly Share past midnight

`check.cjs` opens the chooser on Sunday 2026-11-15 23:59 UTC (week 46, board 1 cleared in 20 pours),
moves the clock past midnight and taps Share. Expected (weekly-set.md §3.9): it shares week 46 with 20.
`results.json` shows `Strata Weekly 2026-W46 ... 20 · – · – · – · –`. Unit tests:
tests/unit/weekly/share-shown-week.test.ts.
