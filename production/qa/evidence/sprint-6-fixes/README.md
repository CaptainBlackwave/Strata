# Sprint 6 fixes: screenshot evidence

Source: `production/qa/sprint-6-findings.md`, bundles F1–F6 and F8 plus decision D-a (free Undo).
Captured 2026-11-08 with Playwright and Chromium against `npx vite --port 5190`, with a seeded save
(`strata.save.v2`) and reduced motion on. The device is Pixel 7 (412 px wide, deviceScaleFactor 2.625)
unless the file name says 320 (iPhone SE, 320 px wide, with the root font set to 150%). Every run logged
no page or console errors.

| Screenshot | Finding | What it shows | Result |
|---|---|---|---|
| `f1-hint-reduced-motion.png` | F1: AX-1, UX-board-1, AX-4, UX-board-2, AX-13 | Hint pressed with reduced motion on, captured 600 ms later (the reduced-motion rule cuts animations to 1 ms). "From" is lifted with a solid teal ring and a **From** badge. "To" has a dashed orange ring and a **To** badge. The toast reads "Hint: pour jar 1 into jar 8" | Pass. Measured: `.hint-from .glass` outline solid 4 px, `.hint-to .glass` outline dashed 4 px |
| `f2-refused-pour-toast.png` | F2: AX-5, UX-board-6 | A plain refused pour (the top colours differ) shows the toast "Top colours don't match" and a static red outline on the target jar | Pass |
| `f2-stuck-banner.png` | F2: GX-1, UX-board-4 | After random pours, the board is stuck. The banner reads "No pours left. Undo, shuffle, add a jar or restart." with a Restart button, above the Undo / Shuffle / Jar toolbar. It stays until the board changes | Pass. The banner disappeared after Restart |
| `f6-restart-second-tap.png` | F6: UX-board-3 | The first tap on HUD Restart with 4 pours on the board. The button fills coral, its label becomes "Restart: tap again to confirm", and the toast says "Tap Restart again to start this board over". Restart also sits left of the coins chip, away from Settings (F5) | Pass. The second tap reset the pours to 0 |
| `f3-focus-trapped-settings.png` | F3: AX-2, AX-3, UX-all-1, UX-all-2, UX-settings-7 | Settings open, with the focus ring on a switch after Tab presses. Measured Tab order: set-sound > music > haptics > patterns > Home > Replay tutorial > Jar guide > Scenes > Save code > Close > (body) > set-sound. It never reaches the board, which is `inert` | Pass. Esc returned focus to `#btn-settings` |
| `f4-moonlit-cabinet.png` | F4: AX-6 | Moonlit cabinet. The completed set headers (Tide Pool, Dune Coast, Coral Reef) keep the mint tint with dark ink (#4a3b2c on #cfe9e1, 8.4:1). "Next shell" uses accent text | Pass |
| `f4-moonlit-name-error.png` | F4: AX-7 | Moonlit, Edit profile, Name tab, name "Hi!". The error "Use 2–16 letters or numbers" is #ff9a85 on card #1b2a44 (7.0:1, was 2.54:1) | Pass |
| `f8-home-settings-button.png` | F8: UX-home-1; F3: Home first focus | Home with a Settings button on the top row, opposite the profile chip. Focus starts on Play | Pass. Opened from Home, Settings hides its Home button, and closing it returns focus to the Home Settings button |
| `f6-leave-level-confirm.png` | F6: UX-settings-2 | After 1 pour, Settings > Home asks "Leave this board?" (Keep playing / Leave) over Settings. The toast draws above all layers (UX-all-3) | Pass. Keep playing kept the board (1 pour) and returned focus to Settings > Home |
| `undo-free-button.png` | Decision D-a | The config the core work ships (`undo: { start: 0, price: 0, free: true }`), served to the page in place of `game-config.json`. Undo has no badge, and its label is "Undo, free" | Pass. Confirmed again on the merged build below |
| `a5-150pct-320-home.png` | A5 at 150% on 320 px | Home at 150% text on iPhone SE | Pass: no horizontal overflow |
| `a5-150pct-320-board.png` | A5, AX-20; F5 | The board at level 120, 150% text, 320 px (retaken on the merged build). Restart, coins and Settings move to a row under the title, so "Level 120" and the Tall jars tag show in full | Pass |

## Checked but not shown

- **F5 hit areas** (`measure.cjs` pass, Pixel 7 and SE at 150%, on Home, Cabinet, Profile, Edit (both tabs), Board, Settings, Save code and Scenes). Every visible button, tab and set header is at least 44 × 44. The only items under 44 are the switch inputs (46 × 28), and the whole label row around each one is the tap target (≥ 44 px tall).
- **F3 focus return** (`smoke3.cjs`). Profile Esc returns to `#btn-profile`. Scenes opened from Settings returns to `#btn-settings`. Save code opens on the code box and returns to `#btn-settings`.

## Merged build (core + UI + docs), 2026-11-08

Re-checked after the three branches merged and the last wiring was added. The wiring: `sessionOptions(config)` passes the Shuffle total budget; Hint uses `hintResult()`, which shows "Couldn't find a hint this time" when the search budget runs out, and the "This board can't be won now: Undo or Restart" banner when the board is proven lost; the same banner shows when a stuck or changed board has a certain `lostReason`; free Undo isn't counted in "Boosters used"; set-reward text names Shuffle, Jar and Hint. 282/282 tests pass and the production build passes. No page errors.

| Screenshot | Check | Result |
|---|---|---|
| `merged-hint-reduced-motion.png` | F1 on the merged build, reduced motion | "From"/"To" badges and rings show; toast "Hint: pour jar 1 into jar 6" | Pass |
| `merged-free-undo-used.png` | D-a + the owner's "don't count Undo" decision | After a pour and an Undo: Undo charges 5 → 5, coins 500 → 500, Boosters used 1 → 1 (the 1 is the hint) | Pass |
| `a5-150pct-320-board.png` | HUD wrap fix (the open note below) | Title in full; controls on their own row | Pass |
| `merged-hud-412-one-row.png` | HUD at 412 px, 100% text | Title, tag and controls stay on one row when they fit | Pass |

Keyboard on the merged build: in Profile, Tab never reaches a control behind the layer (it cycles through Profile's controls, and between cycles goes to the browser itself, as `inert` intends). Escape returns focus to the profile chip.

## Open note (resolved)

- At 150% text on 320 px, a level with the **Tall jars** tag has no room for both the tag and "Level 120". The heading ellipsises to "Level 1…" and the tag is clipped at its right edge (see `a5-150pct-320-board.png`). Everything is still reachable, and nothing overflows the screen. Fixed on the merged build: Restart, coins and Settings are grouped (`.hud-actions`) and wrap under the title only when the title would not fit.
