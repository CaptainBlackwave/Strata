# strata-gbw.3 / .4 / .5: narrow screens at 150% text

`check.cjs` at 320x568 with 150% root text and the name "Breezy Cove 88". Expected (design/ux/home.md §14):
the gear stays on screen; switches stay 46x28; the Jar styles action sits clear of Close and looks
disabled when the wallet cannot cover it. `results.json`: gear 260..304, every switch 46x28, gap 12 px,
opacity 0.55. Screenshots: home-320-150.png, settings-320-150.png, styles-320-150-end.png.
Unit tests: tests/unit/ui/narrow-layout.test.ts.
