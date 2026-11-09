# What's new as a changelog (D46, D52)

Settings > What's new now lists every posting since the first card in 0.8.0, newest first, as a changelog.
Each release sits on its own panel with a version heading, a short name and its lines as they shipped.
The newest panel is outlined and marked "Latest". The card shown once on Home after an update still
shows only the newest posting.

Captured 2026-11-09 against `npm run build` + `vite preview`, in Chromium with reduced motion. Script: `check.cjs`.
Raw results: `result.json`. No page errors in any run.

| Check | Result | Evidence |
|---|---|---|
| Settings > What's new, Pixel 7 | Pass: 7 postings (0.11.1 down to 0.8.0), 27 lines, newest marked "Latest"; the log scrolls inside the card and "Got it" stays on screen; Escape closes it and focus returns to the What's new button | `settings-changelog-pixel7.png`, `settings-changelog-pixel7-scrolled.png` |
| 320 x 568 at 150% text | Pass: the same list; only the log scrolls, "Got it" stays on screen, no sideways scroll | `settings-changelog-320-150.png` |
| Moonlit tide (night scene) | Pass: the panels and mark use the scene's tokens | `settings-changelog-moonlit.png` |
| Updating from 0.11.0 | Pass: the card on Home shows only Version 0.11.1 (3 lines) | `update-card-latest-only.png` |

Usage: `npm run build`, `npx vite preview --port 5531 --strictPort`, then
`node production/qa/evidence/whats-new-log/check.cjs http://localhost:5531/ production/qa/evidence/whats-new-log`.
