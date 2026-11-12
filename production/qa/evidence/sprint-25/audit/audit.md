# Sprint 25 UI audit: every screen, before the polish pass

Audit only. No `src/` file was changed. Captured 2026-11-12 from `npm run build` (v0.22.0).

| | |
|---|---|
| Capture script | `capture.cjs` (built on `tools/qa/layout-guard.cjs`: same rich save, fixed date 2026-11-20, Winter Tide date 2026-12-12) |
| Shots | `shots/<screen>[-classic\|-real]__<light\|dark>-<390\|320t150>.png`, 132 files, all captured (`capture-report.json`) |
| Viewports | 390×844 at 100% text; 320×700 at 150% root text; deviceScaleFactor 1 |
| Scenes | light = `midday`, dark = `moonlit` (selected, clock matching off) |
| Board modes | Classic `?board=dom`, Realistic (Settings on, WebGL through SwiftShader) |
| Contact sheets | `contact-home.png`, `contact-sheets1.png` (Settings, Stats, Profile, Edit profile, What's new), `contact-sheets2.png` (Shells, Badges, Jar styles, Scenes, map), `contact-sheets3.png` (weekly, track, event Home and chooser, install), `contact-board-classic.png`, `contact-board-real.png`. Columns: light-390, dark-390, light-320t150, dark-320t150 |

Capture notes
- `board-toast`: a full jar tapped onto a full jar, so the toast reads "That jar is full". `booster-armed`: all charges 0, Jar tapped once (the price toast shows too).
- `tutorial`: no save in the light scene. The dark scene needs a near-empty save to pick moonlit, and that save also raises What's new, so the script closes it. A real fresh player does not see What's new.
- `install`: iPhone user agent. The card's 700 ms timer sometimes misses on the first paint, so the script reloads and tries again. The dark-390 shot can catch the card while it is still fading in.
- The 320 shots show the viewport only: content below the fold is not in them.

---

## 1. The design system as it is (`src/ui/style.css`, 6,015 lines)

### Tokens
| Source | What it has |
|---|---|
| `:root` in style.css | 21 colour tokens (midday defaults): `--bg-top/-bottom --sea --ink --ink-soft --glass --glass-edge --accent --accent-ink --card --surface --surface-2 --toast-bg/-fg --sky --glow --glow-core --buried --focus --accent-text --coral-text` |
| `theme.ts` | Applies the 16 core `ThemeTokens` and the 5 `UiThemeTokens` (`theme-tokens.ts`) per scene |
| Not tokens at all | type scale, spacing, radii, shadows, motion, z-index. **Every one of these is a literal.** 47 custom properties are defined in total, and most are jar geometry (`--jar-w`, `--lj-w`, …) |
| Per-scene CSS overrides | 46 `[data-theme=…]` selectors: moonlit 15, harvestmoon 15, lighthousenight 13, newyear 12, auroranight 9, meteorshower 9, winterlights 9, … Night styling is long `:is()` lists of scene ids, not a token like `color-scheme: dark` |

### Counts (grep of style.css)
| Property | Distinct values / uses | Most used | Notes |
|---|---|---|---|
| font-size | **24** / 135 | 0.8125rem ×26, 0.875 ×22, 0.75 ×15, 0.9375 ×14, 0.6875 ×11, 1rem ×7, 1.25 ×7, 1.375 ×6, 1.0625 ×5, 1.125 ×4, 0.625 ×4 | Also 1.1875, 1.3125, 1.5, 2.25, 3.375rem, `10px`, `0.9em`, 3 `min(…vw)` clamps. 11 sizes sit between 10 and 18px, 1px apart |
| font-weight | 4 / 94 | 800 ×41, 700 ×36, 900 ×10, 600 ×7 | No 400/500 on purpose; body copy is inherited. Headings mix 700, 800 and 900 |
| letter-spacing | 10 | 0.08em, 0.06em … 0.24em | Five different eyebrow/kicker trackings (STRATA, DAILY PUZZLE, NEW JAR!, JAR GUIDE, VERSION) |
| line-height | 12 | 1.4, 1.3, 1.15, 1.35, 1.1 | |
| border-radius | **43** / 147 | 50% ×28, 999px ×24, 14px ×16, 12px ×10, 18 ×6, 16 ×6, 3 ×6, 2 ×5, 10 ×5, 8 ×3, 6 ×3, 9, 5 | About 15 are jar/cork shapes (`calc(var(--jar-w)…)`). The UI itself uses **2, 3, 5, 6, 8, 9, 10, 12, 14, 16, 18, 22, 24, 999px and 50%**. Sheet 24, cabinet 22, primary 14, toast 14, secondary 12, icon button 12, home tab pill 10 |
| box-shadow | **51** / 64 | `none` ×6; almost every other value is used once | 9 shadow colour families: rgba(90,70,50), rgba(74,59,44), rgba(0,0,0), rgba(40,30,20), rgba(140,90,20), white insets, accent rings. The primary button's 3D lip is the hard-coded `0 4px 0 #1f776c` (line 657 and line 3470) |
| spacing px (padding/margin/gap) | **24** distinct px values | 10px ×48, 6 ×41, 8 ×41, 12 ×40, 4 ×37, 2 ×30, 16 ×26, 14 ×16 | Off-grid values in use: 1, 2.5, 3, 5, 7, 9, 11, 13, 15, 22, 26, 30. 81 distinct `padding` shorthands and 51 distinct `margin` shorthands. Spacing is margin-driven (`margin: 10px 0 4px` …), not gap-driven |
| hex colours | **121** distinct | #fff ×30, #ffffff ×11, #000 ×11, #2a9d8f ×10 (the accent, re-typed), #f2a541 ×9, #c8553d ×8 | Many are art (shells, badges, logo jars, scene previews), which is fine. UI chrome that bypasses tokens: `#1f776c` (primary lip), `#2a9d8f` re-typed in 10 places (`--hint`, the focus ring at line 3126, the win/logo jars), the moon gradient `#fbf8ee/#e9e3d2/#d8d0bb` |
| rgba literals | **162** distinct | white ×80, black ×39, rgba(90,70,50) ×28, rgba(74,59,44) ×9 | `rgba(90,70,50)` is the midday ink-brown typed by hand, so it stays brown in the night scenes |
| color-mix() | 44 | | Good: the newer code derives tints from tokens |
| motion | 12+ durations | 200, 160, 180, 220, 300, 560, 600, 760, 800, 900 ms | No motion tokens. Reduced motion has 5 `reduce` blocks and 6 `no-preference` blocks |
| breakpoints | 2×360px, 380px, 640h, 620h, 1 container query | | No 150%-text rule: text size is handled only by wrapping |

### Components
| Kind | Variants found | Notes |
|---|---|---|
| Buttons | `.primary` (accent, 3D lip, r14, 1.0625rem/800), `.secondary` (surface-2, r12, 800, no lip), `.icon-btn` (44×44, r12, surface), `.tool` (booster, r~14, 0.75rem label), `.chip` (999px), `.pill` (999px accent), `.ghost`, `.link-btn`, `.tab` / `.home-tab`, plus `.hcard`/`.daily-card` buttons and Close rows | **8+ button looks.** The win card shows three on one card: primary, secondary, and a cream "Challenge a friend" |
| Close affordance | An X `.icon-btn` (Profile, Edit profile, Shell cabinet, Weekly), a full-width primary Close (Settings), a secondary `.sheet-close` (Scenes, Styles, Event, Track, Stats), "Got it" (What's new, Jar guide, intro), a back chevron (map) | Five patterns for "close this sheet" |
| Containers | `.sheet` / `.sheet-card` (bottom sheet, r24 top), `.cabinet` / `.cabinet-card` (inset card, r22), full-height sheets (Jar styles, Scenes), `.win-card`, `.toast` | Jar styles and Scenes fill the screen with no inset; the cabinets float with a 16px inset. Same family, different chrome |
| Cards | 30+ `*-card / *-tile / *-row` classes: `hcard daily-card streak-card goals-card weekly-card row-card scene-card badge-tile profile-card stone-card intro-card install-card whatsnew-card edit-card share-card discard-card …` | Card fills alternate between `--card` (white), `--surface-2` (tan) and `--surface`. Depth is almost flat: few shadows, and those are one-offs |
| Icons | `.home .ico` 24px, stroke 2; `.ico-sm` 1.05em; `.tool svg` 24px; `.icon-btn svg` 21px; `.home-tab .ico` 50×30 pill; plus 0.72em, 1rem, 1.1em, 1.25rem, 15, 20, 30px | Stroke widths: 17 in CSS (0.9 to 3, plus 5/8/16/22 for art) and 13 in inline SVG attributes. Booster glyphs on Today (`9 ⤭`) are a different set from the toolbar's |

---

## 2. Issues by screen

Severity: **H** looks broken or hides something, **M** looks unpolished or inconsistent, **L** a nicety.

### Cross-cutting
| # | Sev | Issue | Shot | Fix |
|---|---|---|---|---|
| X1 | **H** | Moonlit's moon (`body[data-theme='moonlit'] .home::before`, 40px, top-right) sits **on top of the settings gear** on Today and Collection, and on the coin chip on Play and the welcome screen. The gear cannot be seen | `tab-today__dark-390`, `tab-collection__dark-390`, `tutorial-real__dark-390` | Move the moon behind the header (z-index -1 / into the hero sky) or offset it left of the header controls |
| X2 | **H** | At 320/150%, sheets open **scrolled to the bottom** (focus lands on the last button), so the title and the top of the list are off screen | `stats__*-320t150`, `track__*-320t150`, `jar-guide-*__*-320t150` | Focus the heading or sheet (`tabindex=-1`) on open and scroll to the top; keep the buttons in a sticky footer |
| X3 | M | The programmatic-focus ring (`--focus` #2a6fdb, 3px) shows on first open: welcome Play, install "Got it", intro "Got it". A blue ring on a teal button looks like a bug | `tutorial-*__light-390`, `install__light-390`, `mechanic-intro-*` | Use `:focus-visible` only for keyboard input (do not show it after `.focus()` from a tap), and tint the ring from the accent |
| X4 | M | Five different close patterns (X, primary Close, secondary Close, Got it, back chevron) | all sheets | One rule: X in the header for browse sheets, one primary action at the bottom for task sheets |
| X5 | M | The primary button's lip is hard-coded `#1f776c`. In moonlit, the bright mint accent sits on a dark-teal lip, which reads heavy and muddy | any `__dark` shot with a primary button | Derive it: `color-mix(in srgb, var(--accent) 70%, #000)` |
| X6 | M | Stacked buttons touch: the primary's 4px lip runs into the Close button below it | `stats__*-390`, `win-card-*` | 8px gap token between stacked buttons |
| X7 | L | The profile name (generated, random per load in this capture) is a large white pill even in the night scenes, and it is the brightest object on the dark Home | `tab-play__dark-390` | Pill on `--surface` with a 1px edge in night scenes |

### Home tabs
| # | Sev | Issue | Shot | Fix |
|---|---|---|---|---|
| H1 | **H** | The "Collection" title breaks mid-word ("Collec / tion") | `tab-collection__*-320t150` | `overflow-wrap: normal; hyphens: auto`, or let the title shrink with `min()` so it fits beside the coin chip |
| H2 | **H** | The Today daily card wraps word by word into a ~70px column ("Not / solved / yet · 27- / day / streak") because the Play pill stays beside it | `tab-today__*-320t150` | Below ~22em of width, stack the card: date, then text, then a full-width Play |
| H3 | **H** | The Profile tab name plate collapses to "Pl / u." in a circle, and "On level 250" stacks one word per line | `tab-profile__*-320t150` | Put the plate on its own row under the avatar, full width, with an ellipsis |
| H4 | M | The Play tab profile chip truncates to "Sa…" at 320/150% | `tab-play__*-320t150` | Avatar-only chip at narrow widths (name on Profile) |
| H5 | M | In Winter Tide, the Daily and event cards sit side by side and both wrap to 4–5 lines at 390 | `event-play__light-390` | Stack them below ~420px, or make the event a full-width strip |
| H6 | M | Today's Streak rewards rows break into overlapping label and value at 320/150% ("Booster pair" heading floating over the row) | `tab-today__*-320t150` | Give the row a grid with the icon in a fixed column and the text in `minmax(0,1fr)` |
| H7 | M | The reward icon tiles on Streak rewards are five different kinds of art (glyph pair, round frame, jar, name-plate mini, scene thumb) at different sizes | `tab-today__light-390`, `track__*-390` | One 40px rounded tile per row, with the art centred inside it |
| H8 | L | The Collection tab has large empty space under Beach path at 390 | `tab-collection__light-390` | Fine as is; or give the map tile more height or a "next reward" strip |
| H9 | L | The Collection tiles at 320/150% stay as tall as they are at 390, so only 1.5 tiles show | `tab-collection__*-320t150` | Horizontal tile (art left, text right) when the column is narrow |
| H10 | L | Footnotes ("2 tide passes", "Rewards are yours to keep…") are unstyled ink-soft text that looks left over | `tab-today__light-390` | A small caption style with a top divider, or fold them into the header |

### Sheets
| # | Sev | Issue | Shot | Fix |
|---|---|---|---|---|
| S1 | **H** | Stats: "Browser" and "Chrome 153 (Linux)" overlap at 320/150%, and every label wraps to 2–3 lines | `stats__*-320t150` | `dl` rows wrap (label above value) when the label and value cannot both fit; `min-width: 0` |
| S2 | **H** | Badges: "Beachcombe / r" breaks mid-word **at 390** | `badges__*-390` | `overflow-wrap: normal` on badge names, or `hyphens: auto` |
| S3 | M | Badges opens #profile scrolled to the badge shelf, so the header X has scrolled off and the sheet has no close | `badges__*-390` | Its own sheet with a sticky header, or a sticky `.cabinet-head` |
| S4 | M | Shell cabinet: in moonlit, the completed sets are pale mint pills on a navy card. They ignore the scene, are the brightest thing on screen, and the text on them is dark | `shells__dark-390` | Tint them from tokens (`color-mix(var(--accent) 18%, var(--surface-2))`) |
| S5 | M | Shell cabinet: the dark "New" tags sit on top of the shell art | `shells__*-390` | A dot or corner tag outside the art box |
| S6 | M | Edit profile: the Avatar/Frame/Name segmented control is cramped at 320/150%, with no inner padding and labels touching | `edit-profile__*-320t150` | Allow a scroll row or shorter labels; min 8px padding |
| S7 | M | Weekly: the uncleared boards show a thin open "U" jar outline that looks unfinished, the rows have no chevron or "Play", and the cleared rows use an accent border that looks like a selected state | `weekly__*-390` | The same empty-jar mini art as the map; a chevron; a check plus accent tint for cleared, not a border |
| S8 | M | Settings opened from Today: the sheet has no header X, and Close is a full-width primary, unlike every other sheet | `settings__*-390` | Header X plus a secondary Close (see X4) |
| S9 | M | Stats intro text is bold accent-coloured, so it reads as a link | `stats__light-390` | ink-soft regular |
| S10 | M | Jar styles and Scenes are full-screen sheets with no inset or corner, while the other sheets are inset cards. The jump in chrome between related sheets (Collection → Shells vs Collection → Styles) is noticeable | `jar-styles__*-390`, `scenes__*-390` | Pick one: bottom sheets for all Collection browsers |
| S11 | L | Jar styles tiles: a 24px jar in a ~110px-tall tile leaves the tiles mostly empty | `jar-styles__light-390` | Bigger jar art (48–56px), or a 3-column grid |
| S12 | L | Profile sheet: the name plate wraps to 2 lines at 320/150% inside a big pill | `profile__*-320t150` | See H3 |
| S13 | L | The map's top stone ("253") is clipped under the header | `map__*-390` | A scroll-padding/top fade under the header |
| S14 | L | The Track sheet repeats Today's streak card in a second, different layout | `track__light-390` | Share one row component |
| S15 | L | What's new: the "Latest" chip wraps onto its own line at 320/150% | `whatsnew__*-320t150` | Fine; or put the chip after the title |

### Board, HUD, cards over the board
| # | Sev | Issue | Shot | Fix |
|---|---|---|---|---|
| B1 | M | At 320/150% the HUD breaks into two ragged rows: the title row, then the restart/coins/gear row right-aligned, with "0 pours" on a third row. STRATA and the brand disappear | `board-250-*__*-320t150` | A fixed 2-row HUD: row 1 the level and challenge tag, row 2 the controls left and pours right |
| B2 | M | The toolbar at 320/150% swaps icons for count pills, and the labels touch the button edges ("Shuffle") | `board-250-*__*-320t150` | Keep the icon, put the count in the corner badge, and shrink the label with `min()` |
| B3 | M | Classic board: the empty jars in midday are opaque cream, so they read as full of white sand rather than empty glass | `board-250-classic__light-390` | A more transparent `--glass` in light scenes, or a faint inner shadow |
| B4 | M | The teal sea-dome arc behind the toolbar is a cropped circle that looks like a stray shape, especially in moonlit | `board-250-*__*-390` | A full-width horizon band or a gradient instead of an arc |
| B5 | M | Jar guide: Got it floats over the list with no fade, so the next entry shows under and around it; behind the card, the Settings sheet's Close peeks out as a green bar at the bottom | `jar-guide-*__light-390` | Sticky footer with a top fade; hide or dim the Settings sheet underneath |
| B6 | M | The toast at 320/150% covers the lower jars (it is anchored above the toolbar, over the board) | `board-toast-*__*-320t150` | Anchor it below the HUD or over the toolbar, max 2 lines |
| B7 | L | Armed booster: coral in midday and a pale salmon in moonlit. The price pill (yellow, coin) differs from the count badge (teal) | `booster-armed-*` | Fine as a state; unify pill shape and size with the count badge |
| B8 | L | Mechanic intro: the jar art sits left with the text indented beside it, and at 320/150% the text runs in a narrow column next to a small jar | `mechanic-intro-*__*-320t150` | Art above the text when narrow |
| B9 | L | Realistic and Classic look the same everywhere except the jars. The HUD/toolbar chrome does not change, which is right; noted for the refresh | | Keep |

### Win card, install, first screen
| # | Sev | Issue | Shot | Fix |
|---|---|---|---|---|
| W1 | M | Win card: the goal lines are filled rounded rows that look like buttons, and "Challenge a friend" is a third button style (cream) between them and Home | `win-card-*__light-390` | Goals as a checklist (a tick and text, no fill); Challenge as a secondary or link with a share icon |
| W2 | M | Win card: the coin reward is not visible as a moment (coins jump 98765 → 98865 in the HUD, behind the scrim) | `win-card-*__light-390` | A coin row with a count-up near the title |
| W3 | M | Win card: plain and flat, with a small avatar floating in the corner. It is the most-seen reward screen and has the least art direction | `win-card-*` | See refresh R2 |
| W4 | M | First screen (fresh save): the bottom half is empty under Play at 390 | `tutorial-*__light-390` | Centre the hero and Play vertically, or add a one-line "How to play" under Play |
| W5 | L | Install card: the step illustrations use a different line weight and style from every other icon | `install__light-390` | Redraw them in the 24px, 2px-stroke icon set |
| W6 | L | Every sheet at 320/150% (Stats, Event, Badges) shows a ghost of the tab bar labels peeking under the card's bottom edge | `event-chooser__*-320t150` | Make the scrim opaque behind the bottom bar, or let the card cover it |

---

## 3. Top 10 (fix first)
1. **X1** The moon covers the settings gear in moonlit (H)
2. **H2** The Today daily card wraps word by word at 320/150% (H)
3. **H3** The Profile tab name plate collapses at 320/150% (H)
4. **H1** "Collec / tion" title break (H)
5. **S1** Stats label and value overlap at 320/150% (H)
6. **S2** "Beachcombe / r" breaks at 390 (H)
7. **X2** Sheets open scrolled to the bottom at 320/150% (H)
8. **S4** The Shell cabinet's mint set pills in night scenes (M)
9. **B1** The board HUD breaks into ragged rows at 320/150% (M)
10. **X4 / X6 / W1** Five close patterns, stacked buttons touching, and win-card goals that look like buttons (M)

---

## 4. Refresh opportunities

### Where a refresh adds the most
| Area | Today | Gain |
|---|---|---|
| Foundations | No type, space, radius, shadow or motion tokens; 24 font sizes, 43 radii, 51 shadows | Everything below gets cheaper and stays consistent across 17 scenes |
| Card depth and surfaces | Flat; fills alternate white, tan and surface; one-off shadows | One elevation scale makes Home, sheets and the win card feel like one product |
| Headers | Every sheet styles its title differently; close varies | A shared sheet header (title, optional subline, X) fixes X4, S3, S8 at once |
| HUD and toolbar | Functional; breaks at 320/150% | The screen seen most; a fixed 2-row layout and a quieter toolbar give the sand board more room |
| Win card | Plain, button-like goal rows | The reward moment: the biggest felt-quality gain per line of CSS |
| Icons | ~12 sizes, ~17 stroke widths, 3 booster glyph styles | One 24px / 2px set plus 16px / 1.75px |
| Night scenes | Hand-listed `:is()` of 7 scene ids, brown rgba literals | Token-driven shadows and edges fix S4 and X5 for every night scene |

### Suggested foundation (all three directions build on it)
- Type: 6 steps, 12 / 14 / 16 / 20 / 28 / 40 (rem), weights 600 / 800, one eyebrow style (12px, 800, 0.12em).
- Space: 4-pt scale, 4 / 8 / 12 / 16 / 24 / 32, with `gap` instead of margins.
- Radius: 8 (chips inside cards) / 14 (buttons, tiles) / 22 (cards, sheets) / 999 (pills).
- Elevation: 3 levels, each `0 1px 0 var(--edge), 0 Ypx Bpx var(--shadow)`, with `--shadow` set per scene (warm brown by day, near-black navy by night).
- Motion: 160 / 240 / 400 ms with one ease-out; reduced motion keeps opacity only.

### Directions (pick one)

**A. Sea glass (soft, light, closest to today)**
- Cards: frosted panels, `--card` at 86% over the scene with `backdrop-filter: blur(12px)`, a 1px light top edge, radius 22.
- Depth: low and wide (elevation 1–2), no hard lips; the primary loses its 3D lip for a soft glow ring in the accent.
- Type: today's family, the 6-step scale, titles at 800, kickers in tracked small caps.
- Colour: the accent only on primary actions and progress; everything else in ink and ink-soft. Night scenes get glassier, not darker.
- Icons: 2px rounded line icons, set in a 40px tinted circle on cards.
- Fits: the calm brief. Lets the Realistic sand be the only saturated thing. Cost: `backdrop-filter` on low-end Android (fall back to an opaque card).

**B. Beach-hut tactile (warmer, more "game")**
- Cards: solid paper cards with a 2px bottom "lip" in a darker shade of the card (like today's primary, applied everywhere), radius 18, subtle grain.
- Depth: chunky and readable: everything pressable has a lip that compresses on press, and static cards are flat.
- Type: rounder, heavier display weight (900) for titles and numbers, 600 for body.
- Colour: each Home area gets a tide colour band (Play teal, Today coral, Collection sand, Profile sea-blue) in headers and tab pills.
- Icons: filled duotone icons (ink plus accent tint), 24px.
- Fits: the most "mobile puzzle" look; makes the win card and HUD feel rewarding. Risk: busier, and it needs care to stay calm in night scenes.

**C. Tide-line editorial (quiet, typographic)**
- Cards: hardly any. Content sits on the scene with hairline dividers and generous space; only the sheets and the win card are cards, with radius 28 and a large soft shadow.
- Depth: two levels only (page, sheet), with a scrim.
- Type: a larger contrast: 40px numbers and titles, 14px body, tabular numbers in stats and pours.
- Colour: monochrome ink with a single accent line (progress, the current stone, the selected tab); scene colour does the mood.
- Icons: thin 1.75px line icons, 20px, no tiles behind them.
- Fits: the most calm and the most premium; it suits 150% text best, since there are fewer boxes to overflow. Risk: it can feel sparse on Collection and the win card unless the art (shells, jars) is scaled up.

For any direction, keep the Realistic sand board untouched and let the chrome get quieter around it: the board is the hero.
