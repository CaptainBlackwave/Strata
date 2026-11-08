# Accessibility Requirements: Strata

> **Status**: Approved by the owner (interview 2026-11-08)
> **Applies to**: every screen. Per-screen specs in `design/ux/` consult this file.
> **Standard it adjusts**: `.claude/rules/ui-code.md`

Strata is a phone-first web game played by touch, with full keyboard support on desktop.

## Requirements

| ID | Requirement | Status |
|---|---|---|
| A1 | **Colour is never the only cue.** Colour patterns (one texture per sand colour, including locks) can be switched on in Settings. New colours must get a new pattern | Built (14 colours, 14 patterns) |
| A2 | **Motion can be reduced.** With the system "reduce motion" setting on, pour animations and particles are skipped. Nothing the player needs is shown only by motion: the hint mark stays visible without its pulse | Built; the hint under reduced motion is decided 2026-11-08, building in sprint 6 (F1) |
| A3 | **Keyboard play.** `1`–`9`/`0` pick jars 1–10; `Tab` then `Enter`/`Space` reaches every jar, including 11 and up; `Z` `S` `J` `H` `R` for boosters and restart; `Esc` and `Enter` for sheets and dialogs (per-layer table in `design/gdd/feel-audio-ui.md`); visible focus rings | Built |
| A4 | **Screen-reader labels.** Every jar announces its contents and state (frozen, locked, narrow, funnel, sealed); toasts are announced politely | Built |
| A5 | **Text follows the player's text-size setting.** UI text scales with the browser or phone text size, and every screen still fits at 150% text on a 320 px wide phone | Built (sprint 5): `rem` sizes, iOS Dynamic Type, verified on 7 screens |
| A6 | **Readable in every scene.** Text contrast at least 4.5:1, and soft text and buttons at least 3:1, unit-tested per scene | Built |
| A7 | **Sound is optional.** Sound effects, music and vibration each have their own switch; no information is given by sound alone. A refused pour also shows a text toast; a hint is also announced as text | Built; the refused-pour toast and announced hint are decided 2026-11-08, building in sprint 6 (F1, F2) |
| A8 | **Dialogs hold keyboard focus.** Everything behind the top layer is inert; focus moves into a dialog when it opens and back to its opener when it closes | Decided 2026-11-08, building in sprint 6 (F3) |
| A9 | **Touch targets are at least 44 × 44 px**, including icon buttons, tabs, secondary buttons and set headers | Decided 2026-11-08, building in sprint 6 (F5) |

## Waivers

| Standard | Waiver | Reason | Revisit when |
|---|---|---|---|
| Gamepad support on every interactive element (`ui-code.md`) | **Waived** (decision D13, 2026-11-08) | Phone-first web game; touch and keyboard cover the supported platforms | A TV, console or desktop-app version is planned |
| Volume control | Sound stays on/off (decision D15) | Phones have hardware volume; two toggles keep Settings simple | Players ask for it |
