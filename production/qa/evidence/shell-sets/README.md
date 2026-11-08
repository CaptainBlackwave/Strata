# Evidence: shell sets 5–8 (expedition sets)

Design: `design/gdd/shell-collection.md` §2.1a, decisions SC-1 to SC-8 (owner interview 2026-11-08).
Captured 2026-11-08 from the production build (`npm run build`, served under `/Strata/`), Playwright Chromium.

| File | Shows |
|---|---|
| `all-40-shells.png` | All 40 shells by set, at large size (Night Shore on a dark panel to show the glow; Ancient Cliffs with the stone speckle) |
| `cabinet-veteran-collapsed.png` | A player owning all 20 originals + 2 Night Shore shells: the four completed sets collapsed, Night Shore glowing, locked shells as plain silhouettes |
| `cabinet-tidepool-expanded.png` | Tide Pool expanded by tapping its header |
| `cabinet-new-sets-owned.png`, `cabinet-ancient-owned.png` | Everything owned, the four new sets expanded |
| `cabinet-150pct-320px.png` | iPhone SE (320 px), 150% text, reduced motion: two wider columns, no word broken |
| `home-night-shell-icon.png` | Home screen shell button showing the latest (glowing) Night Shore shell |

Measured in the same run:
- Collapse state per set matches completion; header toggles by click and by Enter; `aria-expanded` follows.
- Glow animation is `none` under `prefers-reduced-motion: reduce` (the halo stays).
- Grid columns and broken words: iPhone SE 100% 4 columns, 150% 2; Pixel 7 100% 5, 150% 4; no mid-word breaks, no horizontal overflow.
- No page errors.

Finding fixed during capture: the old fixed 5-column grid let one long name ("Periwinkle") widen its column at large text; columns are now sized in `rem` and capped at five.
