# Sprint 11: evidence index

Sprint plan: `production/sprints/sprint-11.md`. Each feature has its own pull request (D80).

| Part | Notes | What it covers |
|---|---|---|
| 0.10.1 (Q1–Q4) | `../0.10.1/README.md` | Scene-coloured sliders, per-scene glow, the phone checklist page, cleanup (PR #9) |
| A1–A2: badges | `badges/README.md` | The shelf (empty, part-earned, 150% text on 320 px), a win-card badge row, and back-fill of an old save (PR #10) |
| O1–O4: onboarding | `onboarding/README.md`, `../../sprint-11/first-run-review.md` | The install card (Android prompt, iPhone steps), the daily share link and a past day's link, the offline notice, and the first-run review with two fixes (PR #11) |
| W1–W2: weekly set | `weekly/README.md` | The Home card, the chooser, a weekly board, the win card mid-week and complete (badge awarded), Share, and 150% text on 320 px; an 8-week board fixture |

**Final regression on the merged build (2026-11-09):**
- `npm test`: 864/864. `npm run typecheck` and `npm run build`: pass.
- The weekly script passes with no page errors, and nothing overflows at 150% text.
- Also passing, all with no page errors:
  - the onboarding scripts (install, share, offline);
  - the hint play-through to a win;
  - the level 141 start;
  - two tabs, with no save lost;
  - the upgrade play-through.
- Merging the parallel feature branches caught one issue: a CSS brace the conflict split, which broke the build. It was fixed before anything shipped, and the same split was handled correctly in the weekly merge.
