# Sprint 4: evidence (2026-11-08)

Production build served at `/Strata/`, headless Chromium emulating a Pixel 7 (iPhone SE for `*-iphone-se`), clock fixed with Playwright.

| Check | Result |
|---|---|
| Preview Moonlit without buying, then close | Scene reverts to Midday |
| Buy Sunset with 1000 coins | Coins 500; saved `{"owned":["midday","sunset"],"selected":"sunset","auto":false}` |
| Moonlit with 500 coins | Button: "Needs 800 coins (you have 500)", disabled |
| Match my clock at 22:00 owning Moonlit | Moonlit |
| Match my clock at 06:00 without Dawn | Falls back to the selected scene (Midday) |
| Match my clock at 18:00 owning Sunset | Sunset |
| Page errors | None |
| 320 px (iPhone SE), Moonlit | No horizontal scroll; moon clear of the logo |

Shots: `home-{midday,dawn,sunset,moonlit}.png` and `board-*.png` (the same level in each scene).
Moonlit also has settings, jar guide, toast and both phone sizes.

**Defects found and fixed during the walkthrough**
1. *Startup crash:* the scene was applied before its colour table was defined ("Cannot access … before initialization"). The table now sits at the top of the module.
2. *Sky drawn over the game:* the moon and sun decorations painted above the HUD. `#app` now stacks above the sky layer.
3. *Moonlit glare:* a near-white sky glow and the moon washed out the coins and pours counter. The glow is now a soft blue, and the moon appears only on the home screen.
4. *Scene icon glyph* (◐) didn't render in the UI font; it's now drawn with CSS.
