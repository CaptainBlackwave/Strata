# Follow-ups after 0.26.0 (2026-11-24)

## Header date (Beads `strata-o9x`)
The board header's level label is now also capped by its own box (`font-size: min(var(--fs-5), 8vw, 14cqi)`,
`.hud-title { container-type: inline-size }`), so a daily date fits beside the "Daily · tricky" tag.
`header-check.cjs` (Playwright, dev server on port 5231) measures the label at 320/412 px and 100/150% text.

| Size | Daily "Sat, Jan 16" | Daily "Wed, Jan 20" | "Level 361" / "Level 1000" |
|---|---|---|---|
| 320 px, 150% | was cut, now full (25.6 → 18.5 px) | was cut, now full | unchanged / 25.6 → 21.5 px |
| 320 px, 100% | unchanged | was cut, now full (25.6 → 21.6 px) | unchanged |
| 412 px, 100% | unchanged (28 px) | unchanged | unchanged |
| 412 px, 150% | 33 → 28 px | was cut, now full | unchanged |

Screenshots (320 px, 150% text, the header only): `header-before-*` and `header-after-*` for the Saturday and a Wednesday daily.

## The lighthouse gives way on one-spare levels (D235, Beads `strata-3ic`)
Measured in `design/gdd/jar-mechanics.md` §2.10 and the decision log. No new screenshots: no art changed.
