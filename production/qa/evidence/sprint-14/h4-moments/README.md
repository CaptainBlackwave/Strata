# Evidence: Share at milestones (sprint 14 H4, sharing §3.4)

From the production build (`npm run build`, `npx vite preview --port 5543 --strictPort`) with `check.cjs`, on a Pixel 7 viewport. The phone share sheet is faked (headless Chromium has none).

| File | Shows |
|---|---|
| `1-daily-win-streak-and-set.png` | The busiest card possible: a daily that reaches a 30-day streak and finds the last Tide Pool shell, and earns badges. Each high point has its own quiet Share; the daily's own Share stays below |
| `2-moment-share-sheet.png` | The preview for the Tide Pool set |
| `card-moment-first.png`, `card-moment-second.png` | The pictures for the set and the 30-day streak |
| `3-level-win-badge-share.png` | A numbered level win that earned two badges: Share on the badge row only, and Challenge a friend |
| `result.json` | Each row's text and button label, what was sent (the plain site address, no key), page errors (none) |

The Share buttons pay nothing and open nothing by themselves (D120). A badge row with several new badges shares the first.

**Not checked here:** a real phone.
