# Sprint 12 S4: the Jar styles sheet

Script: `check.cjs` (against `npm run build` + `vite preview`, Pixel 7 and 320 x 568, reduced motion).
Raw results: `result.json`. No page errors.

| Check | Result |
|---|---|
| Level 59: no Styles button | pass |
| Level 61: button shows, read as "Jar styles, New" | pass (`home-styles-button.png`) |
| Opening focuses the worn glass (Clear glass); Escape closes and focus returns to the button; the New mark is gone, also after a reload | pass |
| Tapping Sea glass previews it on the sample jars only (the board keeps Clear glass); the button reads "Buy Sea glass · 1700"; the live line reads "Previewing Sea glass" | pass (`sheet-preview-seaglass.png`) |
| Buying spends 1,700 (2,000 to 300), owns and wears it; the board and Home wear it at once | pass |
| A piece out of reach: the button is disabled and reads "Needs 1800 coins (you have 300)" | pass (`sheet-need-coins.png`) |
| Wearing a default back is free | pass |
| 150% text on 320 px: no sideways scroll | pass (`sheet-320-150*.png`) |

## Regressions on the combined sprint 12 build (S2 + S3 + S4)

- Upgrade play-through (`sprint-9/close/upgrade.cjs`): a 0.8.0 save shows the 0.12.0 What's new card once, opens the map and wins level 12; no errors.
- Two tabs (`sprint-9/m4/two-tab.cjs`): no save lost.
- Level 141 at a 4x CPU throttle: the board appears in 0.4–0.5 s on Pixel 7 and iPhone SE at 150% text, 17 jars above the toolbar.
- Hints on level 26: 36 hint pours to a win, no stale marks, no sealed jar with buried sand.
