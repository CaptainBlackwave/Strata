# Accessibility Audit: all screens (sprint 6, Q5)

Date: 2026-11-08 · Auditor: accessibility-specialist · Build: dev server (`npx vite`), working tree at audit time
Target: `design/accessibility-requirements.md` A1–A7. Gamepad support and volume control are waived there, so this audit does not raise them.

## Method

- **Runtime**: headless Chromium through Playwright 1.63. `deviceScaleFactor` 1. Saves were seeded through `strata.save.v2` before load. The seeded save had `tutorialDone: true`, level 120 (a board with locked and funnel jars), colour patterns on and sound off. All four scenes were owned and the scene was pinned with `auto: false`.
- **Devices**: Pixel 7 (412×839) for contrast, names and touch targets. iPhone SE (320×568) for touch targets and the A5 check at 150% text (`html{font-size:150%}`). Desktop Chrome (1280×720) for keyboard walks.
- **Scenes**: midday, dawn, sunset and moonlit. The contrast scan ran on all 16 screen states in every scene (64 scans).
- **Motion**: `reducedMotion: 'reduce'` for every run. The Hint and refused-pour checks were also run with `no-preference` for comparison.
- **Contrast**: for each visible text node, the scan takes the topmost element at that point (`elementFromPoint`) and the computed colour multiplied by the opacity of its ancestors. It composites the background layers. Where the background is a gradient, it uses the worst stop. For text on the page gradient it uses the worst of bg-top and bg-bottom, plus sea or sky depending on the text's position. A6 thresholds: 4.5:1 for text, 3:1 for soft text (`--ink-soft`) and button labels. Name plates use their fixed colours. Plate text was measured and passes on every unlocked plate.
- **Keyboard**: 24 Tab presses per screen. Each press records the focused element, whether it has a focus ring, and whether it sits in the topmost open layer. The run also checks where focus lands when a dialog opens and after it closes (Escape or Enter).
- **Names**: each interactive element's name is computed from `aria-label`, `aria-labelledby`, `<label>`, text, then `title`, and cross-checked against Playwright `ariaSnapshot()`. Dialog roles and names were checked too.
- **Touch targets**: `getBoundingClientRect` on Pixel 7 and iPhone SE. A checkbox counts its whole `<label>` row as the target.
- The scripts and raw JSON are outside the repo, in `/tmp/claude-0/-home-user-Strata/52dd5b50-4e4a-5491-89dc-6ff4ab94082a/scratchpad/a11y/`. Evidence is in `production/qa/evidence/sprint-6/a11y-*.png` (15 files).

**Not assessed here**: real screen readers (VoiceOver, TalkBack), real iOS Dynamic Type, and real audio output. These are listed at the end and are not passes.

## Matrix

Legend: **P** pass, **F** fail (a minor or worse finding applies), **n/a** the requirement does not apply to the screen. Nits do not fail a cell.
Three findings apply to every screen and are not repeated in each cell: AX-10 (focus-ring contrast in moonlit and sunset), AX-17 (pinch zoom disabled) and AX-21 (A6 thresholds compared with WCAG).

| Screen | A1 colour | A2 motion | A3 keys/rings | A4 SR labels | A5 150% @320 | A6 contrast | A7 sound | Keyboard/focus | Names | Touch ≥44 |
|---|---|---|---|---|---|---|---|---|---|---|
| Home (with profile chip) | n/a | P | P | P | P | F (AX-8, AX-9) | n/a | F (AX-2) | P | P |
| Board + HUD + boosters | F (AX-13) | F (AX-1, AX-5) | P | F (AX-4) | P | F (AX-8) | F (AX-5) | P | P | F (AX-12) |
| Win card | n/a | P | P | P | P | P | P | F (AX-2, AX-3) | P | P |
| Profile | n/a | P | P | P | P | F (AX-8) | n/a | F (AX-2, AX-3) | P | F (AX-12) |
| Edit profile (Avatar, Frame, Name) | P | P | P | P | P | F (AX-7, AX-16) | n/a | F (AX-2) | P | F (AX-12) |
| Discard prompt | n/a | P | P | P | P | P | n/a | F (AX-2) | P | P |
| Shell cabinet | P | P | P | F (AX-15) | P | F (AX-6, AX-8) | n/a | F (AX-2, AX-3) | P | F (AX-12) |
| Scenes sheet | P | P | P | P | P | F (AX-8, AX-11) | n/a | F (AX-2, AX-3) | P | P |
| Settings sheet | P | P | P | P | P | F (AX-11) | P | F (AX-2, AX-3) | P | P |
| Save-code sheet | n/a | P | P | P | P | P | n/a | F (AX-2, AX-3) | P | P |
| Mechanic intro / Jar guide | P | P | P | P | P | F (AX-8) | n/a | F (AX-2, AX-3) | F (AX-14) | P |
| Tutorial | P | P | P | P | P | P | P | P | P | F (AX-12) |

**Cell totals (120 cells): 78 pass, 29 fail, 13 n/a.** Fails by column: A1 1, A2 1, A3 0, A4 2, A5 0, A6 8, A7 1, keyboard/focus 10, names 1, touch 5.

Key passes worth noting:
- **A1**: all 14 patterns render on sand and on padlocks (a11y-06, a11y-07).
- **A3**: the shortcuts `1`–`0`, `Z S J H R`, `Esc` and `Enter` work. Every focused control shows a 3 px ring.
- **A4**: jar labels read like "Jar 2: lagoon, terracotta, … (locked until coral is sealed)". `aria-pressed` reports the lifted jar, and the toast is `role=status`.
- **A5**: no horizontal scroll and no unreachable control on any screen at 150% text on 320 px (a11y-12 to a11y-15).
- **A6**: toasts, primary-button labels, unlocked plates and body text pass in all four scenes.

## Findings

| ID | Severity | Screen | Requirement | Finding (measured) | Suggested fix | Size |
|---|---|---|---|---|---|---|
| AX-1 | blocker | Board | A2 | **With reduced motion on, Hint shows nothing but still spends the charge.** The `.hint-from` and `.hint-to` ring exists only inside the `hint` keyframes. The reduced-motion rule cuts animations to 1 ms and 1 iteration, so the ring disappears at once. Measured: `box-shadow` on both jars 300 ms and 1 s after Hint is the default jar shadow, with no ring. The hint counter went 300 → 299. With full motion the ring is present (7 px, then 4 px). See a11y-01 and a11y-02. | Give `.hint-from .glass` and `.hint-to .glass` a static ring (`box-shadow: 0 0 0 4px var(--hint)`) for the whole hint duration. Keep the pulse only under `prefers-reduced-motion: no-preference`. | S |
| AX-2 | major | Home, every dialog and sheet | Keyboard/focus | **Focus is not contained.** Tab leaves every open layer for the controls behind it, which are covered and invisible to the player. Home: the first 8 Tab stops are the hidden HUD, jars and boosters, then the chip. Settings: after Close, Tab goes to body, then restart, settings, 3 jars and 3 boosters, and only then the toggles. The same happens in Profile, Edit, Discard, Cabinet, Scenes, Save code, Jar guide and Win (Win: Tab leaves Continue for the jars behind). Enter on a jar behind a sheet still fires its click. `aria-modal` is set, but nothing is `inert`. | When a layer opens, set `inert` on `#app`'s board, HUD and toolbar and on any lower layer, and remove it on close. Do the same for the game while Home is shown. One `openLayer`/`closeLayer` helper covers every screen. | M |
| AX-3 | major | Scenes, Save code, Settings, Profile, Cabinet, Jar guide, Win | Keyboard/focus | **Focus is not moved on open, or not returned on close.** On open: Scenes leaves focus on `#btn-scenes` behind the sheet, and Save code leaves it on body. On close: Profile (Esc) → `#btn-play` (expected `#btn-profile`). Cabinet (Esc) → a jar behind Home. Settings (Esc) → body. Settings (Close) → focus stays on the hidden Close button. Save code → `#btn-restart`. Jar guide → a jar. Scenes → `#btn-shells` (expected `#btn-scenes`). Win Continue → body. Edit → `#btn-edit-profile` and Discard → its tab both pass. | In the same helper as AX-2, store the opener and focus it on close. On open, focus the first control (Scenes: the in-use scene card; Save code: the code box or Copy). | S |
| AX-4 | major | Board | A4 | **Hint is not announced.** `showHint()` only adds CSS classes. Jar `aria-label`s do not change and there is no toast, so a screen-reader player spends a hint and hears nothing. | Announce through the existing toast, e.g. "Hint: pour jar 2 into jar 5". Optionally append "hint: pour from here" / "pour here" to the two jar labels while the hint shows. | S |
| AX-5 | major | Board | A7 (and A2) | **A refused pour is signalled by motion and sound only.** A plain refusal (jar 1 → jar 2, top colours differ) gets the `nope` shake and the `nope` sound. There is no toast (measured: toast empty and not shown). Only mechanic jars get an explanation toast. With reduced motion the shake lasts 1 ms (measured `translate: none`), so the only cue is sound, and with sound off there is no feedback at all. | Add a non-moving cue that also shows under reduced motion: a short red-tinted outline on the target jar, plus a polite toast or label update such as "Can't pour there". | S |
| AX-6 | major | Shell cabinet (moonlit) | A6 | **Completed-set headers are unreadable in moonlit.** The header background is a fixed `#cfe9e1`, but the text uses scene ink. Set name `#f1ead9` is 1.07:1 and the count `#b6c2d1` is 1.41:1. Four headers are affected (Tide Pool, Dune Coast, Coral Reef, Deep Blue). See a11y-03. | Pair the fixed tint with fixed dark ink (`#4a3b2c` gives about 10:1), or make the tint a scene token. | S |
| AX-7 | major | Edit profile, Name tab (moonlit) | A6 | **The name error is too faint in moonlit.** "Use 2–16 letters…" is `#b3412b` on card `#1b2a44`, 2.54:1 against the 4.5 required. Save is disabled at the same time, so this message is the only explanation. See a11y-04. | Add a per-scene error colour, e.g. a light coral around 5:1 on `#1b2a44` (verify in `themes.test.ts`). | S |
| AX-8 | minor | Home, Board, Profile, Cabinet, Scenes, Intro/Guide | A6 | **Accent colour used as text, or behind small white text, in midday and dawn.** Accent text on card: `#cabinet-next`, `#scenes-auto-note` and `#intro-kicker` are 3.20:1 (midday) and 3.78:1 (dawn). White on accent, not button labels: challenge tag (10 px), level badge "Level 120", daily calendar weekday (11 px), all 3.32:1 (midday) and 4.03:1 (dawn). Required 4.5. Sunset and moonlit pass. The unit test only checks `accentInk`/`accent` at 3:1. See a11y-05 and a11y-11. | Add an `accentText` token that is darker in the light scenes (≥4.5 on card) and use it for these labels and for the small badges. Extend `themes.test.ts` to cover it. | S |
| AX-9 | minor | Home | A6 | Daily streak line uses a fixed `#c8553d`: 3.30:1 on the moonlit card, 4.01–4.19:1 in the light scenes, required 4.5. | Make it a scene token, or use `--ink` with a small icon. | S |
| AX-10 | minor | All screens (moonlit, sunset) | A3 / A6 | The focus ring uses a fixed `#2a6fdb`. Against moonlit it is 3.01:1 on card, 2.51:1 on surface-2 and 2.73:1 on bg-bottom. Against the sunset bg-bottom it is 2.30:1. Focus indicators need 3:1 (WCAG SC 1.4.11 Non-text Contrast). | Make `--focus` a scene token (a light blue on moonlit), or draw a two-tone ring (white inner, blue outer). | S |
| AX-11 | minor | Settings, Scenes | A6 | The off-state track of the switches is a fixed `#d9cbb4`: 1.54:1 on the midday card (1.50 dawn, 1.47 sunset) against the 3:1 required for controls. On/off is also shown by knob position, so the state itself is not colour-only. See a11y-08. | Use a darker off track, or give it a 2 px `--ink-soft` border. | S |
| AX-12 | minor | Board, Profile, Edit, Cabinet, Tutorial | Touch | Targets under 44 px. Icon buttons are 38×38: Restart, Settings, the Close buttons on Profile, Edit and Cabinet, and Edit profile. Edit tabs are 38 px tall (110.7 px wide on Pixel 7, 80 px on SE). Shell-set headers are 25–27 px tall (328 px wide). | Give a 44×44 minimum hit area (padding, or a transparent `::before` that extends the target). Set headers: `min-height: 44px`. | S |
| AX-13 | minor | Board | A1 | Hint direction (from or to) is shown by ring colour only: teal `#2a9d8f` for "from" and orange `#f2a541` for "to". Pattern mode does not change this. See a11y-02. | Distinguish them by shape as well: a solid ring plus an up-arrow on "from", a dashed ring plus a down-arrow on "to". | S |
| AX-14 | minor | Intro card / Jar guide | Names | The dialog has `aria-labelledby="intro-title"`, but no element has that id, so the dialog's accessible name is empty (measured on both entry points). See a11y-09. | Point it at `intro-kicker`, or add `id="intro-title"` to the kicker. | S |
| AX-15 | minor | Shell cabinet | A4 | Locked shells are captioned "?" (19 of them in the test save), which a screen reader reads as "question mark" 19 times and which tells the player nothing. | Keep the "?" visually and give the cell an `aria-label` of "Not found yet" (a new string in `strings.ts`). | S |
| AX-16 | minor | Edit profile, Name tab | A6 | Locked plate picks are drawn at opacity 0.45. On the locked Wave Ribbon pick, the name preview text (`#ffffff` on `#1f7a70`) drops to 2.28:1. Locked picks can still be focused and tapped (the tap explains the unlock), so their text should stay readable. Unlocked plates pass. | Dim only the plate artwork, or raise the opacity to about 0.75 and rely on the lock icon. | S |
| AX-17 | minor | All (Android) | A5 | `index.html` sets `user-scalable=no`. Android Chrome then blocks pinch zoom (iOS ignores it). The text-size path that A5 requires works, but zoom is the fallback for low-vision players (WCAG SC 1.4.4 Resize Text). | Remove `user-scalable=no`. `touch-action: manipulation` already prevents double-tap zoom. | S |
| AX-18 | nit | Discard, Settings, Save code, Scenes | Touch | Secondary buttons are 42 px tall: Keep editing, Discard, Home, Replay tutorial, Jar guide, Scenes, Save code, Copy, Restore, and the Scenes Close button (67×42). | Increase the padding to reach 44 px. | S |
| AX-19 | nit | Board (iPhone SE) | Touch | Jars are 43 px wide (164.7 px tall) on 320 px at level 120. | Give `computeLayout` a 44 px minimum jar width. | S |
| AX-20 | nit | Board at 150% on 320 px | A5 | The HUD row and the "pours" label end at x = 322 on a 320 px viewport. The body hides overflow, so 2 px are clipped. Nothing is unreachable. See a11y-13. | Tighten the HUD gap or let the subhud wrap at large text. | S |
| AX-21 | nit | All (document) | A6 | A6 accepts 3:1 for soft text and button labels. That is below WCAG 2.1 AA for normal-size text (4.5:1). Measured soft text is 3.58–4.18:1 in the light scenes (tagline, HUD "pours", stat labels, scene status), and the midday button labels are 3.32:1. This is within the owner's target, so it is not a failure; it is listed for the owner to decide. The unit test also checks soft text only against the card, not against bg-bottom or surface-2 (both measured ≥3:1 today). | Owner decision. If kept, add bg-bottom and surface-2 pairs to `themes.test.ts`. | S |

## Totals

| Severity | Count | IDs |
|---|---|---|
| blocker | 1 | AX-1 |
| major | 6 | AX-2, AX-3, AX-4, AX-5, AX-6, AX-7 |
| minor | 10 | AX-8 to AX-17 |
| nit | 4 | AX-18 to AX-21 |
| **total** | **21** | |

Gate: AX-1 fails the target (A2) and leaves a paid action with no visible result. AX-5 leaves gameplay feedback in one channel. Both are **BLOCKING** for Q6 until the owner resolves or accepts them. Every other finding is **ADVISORY**.

## Still needs a real device or screen reader (not assessed)

1. **VoiceOver (iOS Safari) and TalkBack (Android Chrome)**:
   - jar labels and `aria-pressed` read naturally
   - the toast and coins chip are polite and not chatty (the coins chip announces every change)
   - whether `aria-modal` keeps the virtual cursor inside dialogs, given AX-2
   - the Discard `alertdialog` and the Edit tabs and radio groups
2. **iOS Dynamic Type** at the largest accessibility sizes (`-apple-system-body`). Only a CSS 150% was simulated here.
3. **The system reduce-motion setting** on iOS and Android, and confirmation that particles (`fx.ts`) are skipped on hardware.
4. **Pinch zoom** on Android Chrome with `user-scalable=no` (AX-17), and the safe-area insets on notched phones.
5. **Real finger accuracy** on a 320 px phone for the 38 px icon buttons and 25 px set headers (AX-12).
6. **Desktop Safari keyboard**: by default Safari does not Tab to buttons ("Press Tab to highlight each item" is off), so keyboard play there depends on that setting. Firefox Tab order was not tested.
7. **Colour patterns** with players who have colour-vision deficiencies, or with a CVD simulation. This audit only confirmed that patterns render.
8. **A7 on hardware**: the sound, music and vibration switches each act on their own. Vibration does not exist on iOS Safari.
