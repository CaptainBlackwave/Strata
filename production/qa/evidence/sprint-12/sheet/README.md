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
