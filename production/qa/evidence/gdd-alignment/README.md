# GDD alignment fixes M1, M2, M4: evidence (2026-11-08)

Each fix had its tests written first and seen failing on the old code (9 failures), then passing (140/140).
Browser checks: production build at `/Strata/`, headless Chromium emulating a Pixel 7; levels played from the solver's path.

| Fix | Check | Result |
|---|---|---|
| M1 first clear only | Replay level 3 with progress at level 5 | "Already cleared: no coins this time", reward hidden, coins 100 → 100 (`m1-replay-no-coins.png`) |
| M2 Undo free for Perfect | First clear of level 5 with one Undo mid-level | "Perfect!", +30, coins 100 → 130, Undo charges 5 → 4 (`m2-perfect-with-undo.png`) |
| M4 UTC daily | Phone in `Pacific/Kiritimati` (UTC+14), clock 2026-11-08T12:00Z, local date Mon 9 Nov | Home card shows Sun 8; the 2026-11-08 board is served and solving it saves `daily.last = 2026-11-08` (`m4-utc-daily-card-kiritimati.png`) |

No page errors.
