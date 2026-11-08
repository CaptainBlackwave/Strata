# Play-through evidence: 2026-11-08

Run against the production build (`npm run build` + `vite preview`) in headless Chromium
(Playwright), emulating an iPhone 13 unless noted. The script played each level by pressing **Hint**
and tapping the two highlighted jars until the win card appeared, the way a player would.

## Results

| Check | Result |
|---|---|
| Level 3, full animation | **Won** in 11 pours (14.1 s, animated) |
| Level 10, tall-jar challenge, reduced motion | **Won** in 42 pours |
| Level 14, buried sand, reduced motion | **Won** in 20 pours |
| Reload with no `?level=` after winning level 14 | Resumes at **Level 15** (progress save) |
| Pour, then Undo | Pours 1 → 0 |
| Extra jar | 7 → 8 jars, button disabled afterwards |
| Patterns toggle and hint highlight | Visible: `story-004-session-tools/01-extra-jar-patterns-hint.png` |
| iPhone SE (320 px) at levels 1, 10, 45 | No horizontal overflow, and every button is on screen |
| Page errors | None |

## Defects found and fixed during this run

1. **Hints could loop forever** (levels 10 and 14 ran 200 pours without a win). Each hint
   re-ran the DFS solver from scratch, and successive first moves could undo each other.
   *Fix:* `GameSession` now keeps the solver's plan and serves its next step while the
   player stays on it, re-solving only after the player leaves the plan.
   *Regression test:* `tests/unit/core/session.test.ts`, "following hints from any state
   always reaches a win". It was run against the unfixed code and failed (`level 10:
   expected 'playing' to be 'won'`), then passed after the fix.
2. **Two hint highlights at once** when Hint was pressed again within 1.8 s. *Fix:* old
   highlights are cleared before a new hint is shown.
3. **Header overflow on narrow phones** with the "Tall jars" tag. *Fix:* the tag is now a
   separate pill, and the wordmark hides below 360 px.

## Screenshots

`story-005-touch-ui/`: 01 level 1 · 02 level 12 buried · 03 level 10 tall jars · 04 level 45,
twelve colours · 05 jar lifted · 06 pour mid-animation · 07 win card · 08–09 iPhone SE ·
10 desktop 1280×720.
