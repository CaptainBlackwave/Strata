## P3, P5

Sprint 8 tasks P3 (zoom and tap areas: D44, D45, AX-14) and P5 (the "What's new" card: D46, D52), from `production/sprints/sprint-8.md`.
Captured on 2026-11-08 with Playwright Chromium, `devices['iPhone SE']` (320 × 568 CSS px), reduced motion, served by `npx vite --port 5197`.
150% text means `html { font-size: 150% }`.

### P3: pinch zoom (D44, AX-17)

- The viewport meta is now `width=device-width, initial-scale=1, viewport-fit=cover`, with no `user-scalable=no` and no maximum-scale.
- `touch-action: manipulation` is set on `.board`, `.jar`, `.toolbar` and every `button` (and already on `body`). This keeps double-tap zoom off and leaves pinch zoom on.

| File | What it shows |
|---|---|
| `p3-pinch-zoom-320.png` | The board after a two-finger pinch sent with CDP touch events. `visualViewport.scale` = 5 (the browser maximum). |

Limits:
- Headless Chromium also zoomed when `user-scalable=no` was added back at runtime. This run therefore shows that the build zooms, not that the old meta blocked zoom.
- Android Chrome and iOS Safari still need a check on a real device.
- Double-tap zoom was not tested in headless mode.

### P3: jar tap targets (D45, AX-19)

- **Layout (`computeLayout`):** when a jar is drawn narrower than 44 px, the gap grows into the spare row width until jar + gap reaches 45 px. That is `MIN_HIT` (44) plus `HIT_SNAP_MARGIN` (1). The drawn jar never shrinks.
- **Hit area (CSS):** an invisible `.jar::before` extends each side by `clamp(0px, (45px - jar width) / 2, gap / 2)`, so it never reaches a neighbour.
- **Why the extra 1 px:** a scan across each row at 0.1 px steps showed that pixel snapping at fractional x positions cost up to about 1 px.
- **Tests:** three new tests in `tests/unit/core/ui-helpers.test.ts`; the existing layout tests still pass.

The narrow jars only appear once the layout is rebuilt from the real board size (see the cold-start problem below), so they were measured after one extra jar was added.
- **CSS hit box** is the jar box plus the `::before` padding.
- **Measured tap width** comes from `elementFromPoint` scanned every 0.1 px. The scan reads about 0.9 px high: a 48 px jar with no padding reads 48.9–49.0. The adjusted column below subtracts that.

| Board (320 px, board 288 px wide) | Text | Jars | Drawn jar | Gap | CSS hit box | Measured tap width (raw) | Adjusted | ≥ 44 |
|---|---|---|---|---|---|---|---|---|
| Level 120 + 1 jar | 100% | 9 | 37 px | 8 px | 45 × 137.7 px | 45.0–45.9 px | ≈ 44.0–45.0 px | yes |
| Level 120 + 1 jar | 150% | 9 | 34 px | 11 px | 45 × 128.1 px | 45.0–45.9 px | ≈ 44.0–45.0 px | yes |
| Level 150 + 1 jar | 100% | 8 | 37 px | 8 px | 45 × 137.7 px | 45.0–45.9 px | ≈ 44.0–45.0 px | yes |
| Level 150 + 1 jar | 150% | 8 | 34 px | 11 px | 45 × 128.1 px | 45.0–45.9 px | ≈ 44.0–45.0 px | yes |
| Level 120 / 150, cold start | both | 8 / 7 | 48 px | 7.6 px | 48 × 182.6 px (no padding needed) | 48.9–49.0 px | ≈ 48 px | yes |

- No two CSS hit boxes overlap.
- At the shared gap midpoint, the right-hand jar answers for about the last half pixel. Every jar still measures at least 44 px.

| File | What it shows |
|---|---|
| `p3-hit-areas-L120-plusjar-320-100.png`, `…-150.png` | Level 120 with 9 jars. Each hit box is outlined in red. |
| `p3-hit-areas-L150-plusjar-320-100.png`, `…-150.png` | Level 150 with 8 jars, the same overlay. |
| `p3-coldstart-L120-320-100.png`, `…-150.png`, `p3-coldstart-L150-320-*.png` | The cold-start layout problem below. |

**Problem found (not fixed here; handed to the coordinator):**
- On a cold start at levels 120 and 150 on 320 px, the first board is built for a taller board than there is: 48 px jars, 174 px tall. The bottom row then runs under the toolbar (see the `p3-coldstart-*` shots).
- Resizing the window did not rebuild it. Only a redraw such as adding the extra jar gives the correct 37 / 34 px layout.
- This is in the `startLevel` / `buildJars` timing.
- It may explain why the audit measured 43 px.

**Limit:** if a board is ever limited by width (very many columns on a narrow screen), the hit area fills the whole gap but can stay under 44 px, because 44 would need a smaller drawn jar. No measured board did this.

### P3: AX-14

The intro and Jar guide dialog had `aria-labelledby="intro-title"` with no element of that id. The kicker now has `id="intro-title"`, so the dialog is named "New jar!" or "Jar guide". This was checked in the markup, not with a screen reader.

### P5: the "What's new" card (D46, D52)

**Content:**
- **Version:** `WHATS_NEW_VERSION = '0.8.0'`, a constant in `src/ui/strings.ts`. `package.json` says 0.1.0 and is not kept up to date.
- **Lines** (`t.whatsNew.lines`):
  1. Undo is free now.
  2. Four new scenes to buy, with more on the way.
  3. A banner tells you when you're stuck, and hints are clearer.
  4. Jars are easier to tap, and you can pinch to zoom.
  5. Sealed jars now show their sand.

**Save field (`seenWhatsNew`):**
- A fresh save stores the current version.
- A save without the field, a migrated v1 save or an old save code gives `''`.
- A non-string value is repaired to `''`.
- The card is due when the stored value differs from the current version.
- Seven tests are in `tests/unit/ui/whats-new.test.ts`.

**What was observed on 320 px:**

| Step | Result |
|---|---|
| A save from before the update (no `seenWhatsNew`) opens Home | The card shows, named "What's new", with 5 lines. Focus is on Got it. The save now reads `0.8.0`. No horizontal overflow. |
| Esc | The card closes and focus returns to Play. |
| Reload | The card does not show again. |
| Settings → What's new | The card reopens with focus on Got it. Got it returns focus to the Settings button on Home. |
| First install (empty storage) | No card. The save stores `0.8.0`. |
| Page errors | 0 |

The Settings button is 280 × 44 px.

| File | What it shows |
|---|---|
| `p5-whats-new-home-320.png` | The card on Home after an update. |
| `p5-settings-whats-new-button-320.png` | Settings with the What's new button. |

### Checks

`npm test`: 21 files, 361 tests pass. `npm run typecheck`: clean.
