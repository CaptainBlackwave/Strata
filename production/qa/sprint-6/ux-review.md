# Sprint 6 Q4: UX Review of the 8 Screen Specs

> **Date**: 2026-11-08
> **Reviewer**: ux-designer, running the `/ux-review` procedure (`.claude/skills/ux-review/SKILL.md`, checklist 3A)
> **Specs reviewed**: `design/ux/home.md`, `board-hud.md`, `win-card.md`, `profile.md`, `edit-profile.md`, `shell-cabinet.md`, `scenes.md`, `settings.md` (all written in Q3 from the build)
> **Feeds**: Q6 findings report (`production/qa/sprint-6-findings.md`)

## Intro

Each spec was written from the screen as built (`index.html`, `src/ui/main.ts`, `src/ui/style.css`, `src/ui/strings.ts`), then checked against the GDDs that own the behaviour and against `design/accessibility-requirements.md` (A1–A7, gamepad waived by D13). This review grades the screens' UX as the specs capture it. Findings are about the screens, not about the specs' wording.

**Inputs and what could not be assessed**
- **Input methods**: `project.yaml` has no `platform` block. The input set comes from `design/accessibility-requirements.md` (touch first, full keyboard) plus mouse (it is a web page). Gamepad is waived and not raised as a finding.
- **Accessibility tier**: the requirements file is approved but names no tier (Basic / Standard / Comprehensive / Exemplary). The review uses A1–A7 as the criterion. Recommendation: the owner names a tier so later gates have a label to check.
- **Pattern Library: NOT ASSESSED** for every spec. `design/ux/interaction-patterns.md` does not exist, and at `rigor: standard` the library is recommended, so this is missing, not out of scope. Each spec lists its unrecorded patterns in Open Questions.
- **Player journey**: `design/player-journey.md` does not exist, so the "context on arrival" checks were made against the GDDs and the brief only.
- **GDD UI Requirements**: no GDD has a `UI Requirements` section. Alignment was checked against each GDD's rules, edge cases and acceptance criteria.
- **Contrast values** marked "computed" come from the theme tokens in `game-config.json` and the fixed colours in `style.css`, using the WCAG formula. They were not measured on screen. Q5 should confirm them.
- **Not checked**: screenshots in `production/qa/evidence/` were not opened for this pass. Layout claims come from markup and CSS.

**Verdict scale** (from the skill): APPROVED / NOT ASSESSED / NEEDS REVISION / MAJOR REVISION NEEDED. A revision verdict outranks NOT ASSESSED, so the missing pattern library does not hide the findings below.

**Severity**: blocker = breaks a committed requirement for a group of players with no workaround; major = a real usability or accessibility failure with a workaround, or a risk to progress; minor = friction or polish with a clear cost; nit = small consistency issue.

## Summary

| Spec | Verdict | Primary issue |
|---|---|---|
| `home.md` | NEEDS REVISION | No route to Settings, so colour patterns, sound and Save code are unreachable from Home |
| `board-hud.md` | NEEDS REVISION | With reduced motion, Hint shows nothing but still costs a charge (blocker) |
| `win-card.md` | NEEDS REVISION | Share can't be activated from the keyboard: Enter/Space always fire Continue |
| `profile.md` | NEEDS REVISION | Cross-cutting modal issues only (no focus trap or focus return, 38 px buttons) |
| `edit-profile.md` | NEEDS REVISION | Cross-cutting modal issues; Save is disabled with no visible reason on other tabs |
| `shell-cabinet.md` | NEEDS REVISION | Cross-cutting modal issues; locked shells read as "question mark" |
| `scenes.md` | NEEDS REVISION | The Match my clock switch shows "on" after Use/Buy has turned it off |
| `settings.md` | NEEDS REVISION | Restore stays armed after the code is edited; Home and Replay tutorial throw away the board with no confirm |

No spec needs MAJOR REVISION: each screen's purpose, structure and flow are sound. All 8 specs carry open questions, so none can reach APPROVED until those are resolved or deferred.

---

## Cross-cutting findings (affect several screens)

These come from shared code (the overlay pattern, `.icon-btn`, `.toast`, theme tokens). Each is listed once here and referenced from the specs it affects, so the totals count each issue once. IDs use `UX-all-<n>`.

| ID | Severity | Area | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| UX-all-1 | major | Keyboard / focus | None of the 9 `aria-modal` dialogs traps focus (win card, Settings, Save code, Scenes, intro card, cabinet, Profile, Edit, Discard). Tab walks into the board, HUD or Home behind, and keyboard players can act on hidden controls | One shared open/close helper that sets `inert` on everything outside the top dialog | M |
| UX-all-2 | major | Keyboard / focus | Focus is not set when Scenes or Save code open (it stays on a button behind or on `body`), and is not returned to the opener when Settings, Save code, Scenes, the cabinet, Profile or the intro card close. Home sets no focus when it appears | The same helper records the opener and restores focus to it; set a first focus for every dialog | S |
| UX-all-3 | major | Feedback | The toast (`z-index: 10`) draws under every overlay (win 20, Home 22, sheets 25, cabinet 26). Feedback raised from an overlay is hidden or dimmed: "Result copied" (win card), "{scene} unlocked!" (Scenes), "Progress restored" (lands on Home) | Raise the toast above all overlays (e.g. `z-index: 30`), or show the message inside the open sheet | S |
| UX-all-4 | major | Touch targets | `.icon-btn` is 38 × 38 px: HUD Restart and Settings, × on the cabinet, Profile and Edit, and Profile's ✎. Edit tabs are about 37 px tall, secondary buttons about 41 px, and cabinet set headers about 26 px. The template and the profile GDD ask for 44 px. Restart (destructive) sits 8 px from Settings | Minimum 44 × 44 px hit area (padding or `::before` hit box) on every control | S |
| UX-all-5 | major | Contrast (A6) | The per-scene contrast test covers ink, ink-soft and toast on card/bg, and accent-ink on accent. Text set in `--accent`, in fixed colours or on `--surface-2` is not tested, and some of it fails 4.5:1. Accent text on card is about 3.2:1 in Midday and 3.8:1 in Dawn (win note, cabinet "Next shell", pick note, intro kicker, Scenes note). The streak line `#c8553d` is about 4.2:1 in Midday and 3.3:1 in Moonlit. The name error `#b3412b` is about 2.5:1 in Moonlit. All values computed | Add text-accent tokens per scene, move the fixed colours into tokens, and extend `themes.test.ts` to every text/background pair actually used, including `--surface-2` | M |
| UX-all-6 | minor | Mouse | No `:hover` state anywhere; on desktop the only pointer feedback is the cursor | Add a subtle hover tint to `.primary`, `.secondary`, `.tool`, `.icon-btn` and cards | S |

---

## UX Review: `design/ux/home.md`

**Checklist**: 3A (Template line) · **Platform**: web, touch + keyboard + mouse · **Tier**: A1–A7 (unnamed)

- **Completeness**: 15/15 sections present. Unticked checklist items (initial focus, hover) are listed in Open Questions.
- **GDD alignment**: GAPS FOUND. Player-profile §3.1, daily-puzzle §2.1 (Home card), shell-collection and scenes entry points are covered. `feel-audio-ui.md` §2.1 still lists Home without the chip (doc gap). Settings and Save code (save-data D16) have no Home entry.
- **Accessibility**: GAPS (streak contrast, UX-all-5; unlabelled coins).
- **Pattern Library**: NOT ASSESSED (no library).
- Also affected by UX-all-2, UX-all-4, UX-all-5, UX-all-6.

**Verdict: NEEDS REVISION**

| ID | Severity | Area | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| UX-home-1 | major | Navigation | Home has no route to Settings: the only Settings button is in the board HUD, which Home covers. A player who needs colour patterns (A1) or silence (A7) must start a level first. A player on a new phone who wants "Restore from code" must play into the tutorial before they can find it | Add a Settings icon button to Home's top row, opposite the profile chip | S |
| UX-home-2 | minor | Screen reader | The coin count reads as a bare number ("120"): the coin icon is `aria-hidden` and the `t.coins` string is unused. The same applies to the HUD and Scenes coin chips | Add visually hidden " coins" text or an `aria-label` on the chips | S |
| UX-home-3 | nit | Screen reader | The daily card's accessible name drops the weekday and date, because the calendar is `aria-hidden` | Include the day in the name (e.g. "Daily puzzle, Sunday 8") | S |

## UX Review: `design/ux/board-hud.md`

**Checklist**: 3A (Template line; the spec notes it covers the HUD as one fixed screen) · **Platform**: web, touch + keyboard + mouse · **Tier**: A1–A7

- **Completeness**: 15/15. Loading and error states are recorded as n/a, with the reason.
- **GDD alignment**: GAPS FOUND. Brief: the stuck state "offers Undo, Restart or the extra jar", but the build shows a toast that leaves out Restart. The `noJars` string and the brief's "one extra jar per level" contradict D5. `feel-audio-ui.md` says 12 patterns where the build has 14. Session-boosters, jar-mechanics and feel-audio-ui input rules are otherwise covered.
- **Accessibility**: NON-COMPLIANT against A1 and A2 for Hint (findings 1–2).
- **Pattern Library**: NOT ASSESSED.
- Also affected by UX-all-1 (intro card), UX-all-4, UX-all-5, UX-all-6.

**Verdict: NEEDS REVISION**

| ID | Severity | Area | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| UX-board-1 | blocker | Reduced motion (A2) / screen reader | The hint highlight exists only inside the `hint` keyframes. The global reduced-motion rule cuts every animation to 1 ms, so with reduced motion on, a hint shows nothing. The charge or coins are still spent, and the hint still counts against Perfect. Screen readers get no announcement either. Players with reduced motion or a screen reader pay for a hint they never see | Give `.hint-from` / `.hint-to` a static outline outside the animation, and announce politely: "Hint: pour jar 3 into jar 5" | S |
| UX-board-2 | major | Colour (A1) | The hint's "from" and "to" jars differ only by colour (teal vs saffron) with the same pulse, which breaks "colour is never the only cue" | Lift the "from" jar or add an arrow/badge ("from", "to") | S |
| UX-board-3 | major | Error prevention | Restart (tap or `R`) acts at once with no confirm and clears the undo history, so a mistaken tap loses the whole board. The 38 px button sits 8 px from Settings | Make Restart undoable (push the board onto history) or ask for a second tap; enlarge and space it (UX-all-4) | S |
| UX-board-4 | major | Feedback (stuck) | The stuck state is only a 2.6 s toast. Once it fades, nothing on the board says the player is stuck, and the text leaves out Restart | Show a persistent stuck banner with Undo / Shuffle / Jar / Restart until the board changes | M |
| UX-board-5 | minor | Screen reader | Pours, seals and the win's lead-up aren't announced. Only the jar labels change, and those are re-read only on focus | Add a polite live summary: "Poured 2 coral into jar 4. Jar 4 sealed." | S |
| UX-board-6 | minor | Reduced motion / sound (A7) | With reduced motion, the "nope" shake lasts 1 ms. On a plain illegal target the only cue left is a sound (which may be off), and the selection silently moves or drops | Use a static invalid state (brief outline or icon), or a short toast for plain illegal pours | S |
| UX-board-7 | minor | Economy safety | With 0 charges, a booster tap spends coins at once (up to 120). The only feedback, "Used N coins", comes after the spend | First tap shows the price ("Hint for 60 coins? Tap again"); second tap buys | S |
| UX-board-8 | minor | Keyboard (A3) | Number keys reach jars 1–10 only, but boards reach 14 jars, and more with extra jars. Jars 11+ need Tab, and nothing tells the player | Document it in the jar guide, or add keys for 11+ (e.g. Shift+1…) | S |
| UX-board-9 | nit | Onboarding | In the tutorial, the boosters and Restart are disabled with no explanation | Add a caption or hide the toolbar in the tutorial | S |
| UX-board-10 | nit | Layout / localisation | The coach caption is `white-space: nowrap`, so a longer string (translation, 150% text) can run past a 320 px screen | Allow wrapping with a max width | S |

## UX Review: `design/ux/win-card.md`

**Checklist**: 3A · **Platform**: web, touch + keyboard + mouse · **Tier**: A1–A7

- **Completeness**: 15/15.
- **GDD alignment**: ALIGNED with daily-puzzle §2.1, player-profile §3.7, shell-collection §2.1 and session-boosters (Perfect). Gap: `feel-audio-ui.md` says Esc "closes a sheet", but Esc does nothing on the card.
- **Accessibility**: GAPS (keyboard Share, A3; dialog description; accent note contrast, UX-all-5).
- **Pattern Library**: NOT ASSESSED.
- Also affected by UX-all-1, UX-all-3, UX-all-5, UX-all-6.

**Verdict: NEEDS REVISION**

| ID | Severity | Area | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| UX-win-1 | major | Keyboard (A3) | While the card is open, a window-level handler turns Enter or Space into a click on the primary button and calls `preventDefault`, even when Share has focus. Keyboard players can't share a daily: pressing Enter on Share leaves the card | Handle Enter/Space only when focus is not on a button | S |
| UX-win-2 | minor | Flow | A level card offers only Continue (into the next level). The natural stopping point has no way back to Home; the player must start the next level, then use Settings → Home | Add a secondary "Home" button on level cards | S |
| UX-win-3 | minor | Screen reader | The dialog is named by its title only. Pours, the reward, the note and the shell row aren't referenced (`aria-describedby`), so focus landing on Continue skips the result | `aria-describedby` → text, reward, note, shell row | S |
| UX-win-4 | minor | Feedback | A failed Share (sheet dismissed, clipboard blocked) is silent, and the "Result copied" success toast draws under the overlay (UX-all-3) | Show the outcome inside the card ("Copied" / "Couldn't share") | S |
| UX-win-5 | nit | Consistency | Esc does nothing on the card. That is reasonable, since the card must be acknowledged, but it contradicts the GDD's input list | Document it in `feel-audio-ui.md`, or map Esc to the primary button | S |

## UX Review: `design/ux/profile.md`

**Checklist**: 3A · **Platform**: web, touch + keyboard + mouse · **Tier**: A1–A7

- **Completeness**: 15/15.
- **GDD alignment**: ALIGNED with player-profile §3.1, §3.2, §3.4 and §5. Doc gap: §3.2 says "two columns", but the build uses `auto-fill`.
- **Accessibility**: GAPS (UX-all-1, -2, -4; `--surface-2` contrast unverified, UX-all-5).
- **Pattern Library**: NOT ASSESSED.
- The screen itself is in good shape; its blocking issues are the cross-cutting UX-all-1, UX-all-2 and UX-all-4.

**Verdict: NEEDS REVISION**

| ID | Severity | Area | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| UX-profile-1 | minor | Clarity | The header badge says "Level 12" and the first tile says "Levels cleared 11". Both are correct, but side by side they read as a contradiction | Label the badge "On level 12", or drop one of the two | S |
| UX-profile-2 | nit | Clarity | The footnote "Some totals count from this update onwards" doesn't say which totals | Mark the 5 new counters (e.g. with an asterisk) | S |

## UX Review: `design/ux/edit-profile.md`

**Checklist**: 3A · **Platform**: web, touch + keyboard + mouse · **Tier**: A1–A7

- **Completeness**: 15/15.
- **GDD alignment**: ALIGNED with player-profile §3.3, §3.5 and §5 (draft, locked items, validation, Discard prompt, roving keys).
- **Accessibility**: GAPS (UX-all-1 on the sheet and the prompt, UX-all-4 tabs and ×, UX-all-5 pick note and name error in Moonlit).
- **Pattern Library**: NOT ASSESSED.

**Verdict: NEEDS REVISION**

| ID | Severity | Area | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| UX-edit-1 | minor | Feedback | Type an invalid name, then switch to Avatar or Frame: Save stays disabled, but the reason is hidden with the Name panel | Show the error next to Save as well, or mark the Name tab | S |
| UX-edit-2 | nit | Input | The name field has `maxlength=32` while the rule is 16, so a player can type twice the limit before learning it | Set `maxlength=16` (normalising already trims spaces), unless 32 is deliberate | S |
| UX-edit-3 | nit | Error recovery | Re-roll overwrites a typed name with no way back except Close → Discard, which also drops avatar and frame picks | Keep the previous name for one step, or accept as is | S |

## UX Review: `design/ux/shell-cabinet.md`

**Checklist**: 3A · **Platform**: web, touch + keyboard + mouse · **Tier**: A1–A7

- **Completeness**: 15/15.
- **GDD alignment**: ALIGNED with shell-collection §2.1, SC-6 and SC-8. Gap: §2.1 says shells come from levels **and** dailies, but "Next shell" counts levels only.
- **Accessibility**: GAPS (UX-all-1, -2, -4, -5; findings 1–2).
- **Pattern Library**: NOT ASSESSED.

**Verdict: NEEDS REVISION**

| ID | Severity | Area | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| UX-cab-1 | minor | Screen reader | Locked shells have the caption "?", read as "question mark", and the SVG has no name | Give the cell a visually hidden "Locked shell" label | S |
| UX-cab-2 | minor | Screen reader | Each set header is an `h3` inside a `button`, which drops it from heading navigation. Headers are also only about 26 px tall (UX-all-4) | Put the `button` inside the `h3`; min-height 44 px | S |
| UX-cab-3 | minor | Clarity | "Next shell: clear N more levels" ignores that today's daily also grants one. With all 40 shells, the line "Collection complete: +50 coins" reads as a payout just made | "…or solve today's daily"; "Collection complete: each milestone now pays 50 coins" | S |
| UX-cab-4 | nit | Delight | After a shell win, nothing marks the newest shell, so the player hunts for it | Mark the most recent shell (e.g. "New") until the cabinet is next closed | S |

## UX Review: `design/ux/scenes.md`

**Checklist**: 3A · **Platform**: web, touch + keyboard + mouse · **Tier**: A1–A7

- **Completeness**: 15/15.
- **GDD alignment**: ALIGNED with scenes §2.1 and §4 (preview, revert, buy, clock rules). Doc gap: the rule "choosing a scene by hand turns clock-matching off" is in the GDD but not on screen.
- **Accessibility**: GAPS (UX-all-1, -2, -5; price label).
- **Pattern Library**: NOT ASSESSED.
- Also affected by UX-all-3 (the purchase toast is hidden).

**Verdict: NEEDS REVISION**

| ID | Severity | Area | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| UX-scenes-1 | major | State display | After Use or Buy with Match my clock on, the save turns clock mode off, but `renderScenes()` never re-syncs the switch. It keeps showing "on" until the sheet is reopened, so the visible state is wrong | Set `set-auto.checked = save.themes.auto` in `renderScenes()` | S |
| UX-scenes-2 | minor | Clarity | Nothing on screen says that Use or Buy turns Match my clock off | Add a line under the switch, or a toast "Match my clock turned off" | S |
| UX-scenes-3 | minor | Screen reader | An unowned card's status reads as a bare number ("300"); the coin is a CSS `::before` | Accessible text "300 coins" | S |
| UX-scenes-4 | nit | Clarity | The preview is marked only by the card border and the live page; `scenePreviewing` ("Previewing X") exists in `strings.ts` but is unused | Show "Previewing {name}" above the button | S |
| UX-scenes-5 | nit | Consistency | Scenes closes with a bottom "Close" button, while the cabinet, Profile and Edit use a top-right × | Pick one close pattern for overlays (and record it in the future pattern library) | S |

## UX Review: `design/ux/settings.md`

**Checklist**: 3A · **Platform**: web, touch + keyboard + mouse · **Tier**: A1–A7

- **Completeness**: 15/15.
- **GDD alignment**: GAPS FOUND. Save-data D16 (two-tap restore) is built, but the arming can be bypassed. Save-data §2.1 says boards are not saved, and nothing warns before Home or Replay tutorial throws one away. `feel-audio-ui.md` §2.1 omits Save code.
- **Accessibility**: GAPS (UX-all-1, -2, -4; the patterns toggle has no explanation).
- **Pattern Library**: NOT ASSESSED.

**Verdict: NEEDS REVISION**

| ID | Severity | Area | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| UX-settings-1 | major | Data safety | Restore stays armed when the code is edited. A player can paste code A (the warning shows A's level and coins), then paste code B and tap: B replaces their progress without its own warning | Disarm on every `input` event in the code field | S |
| UX-settings-2 | major | Data safety | Home and Replay tutorial leave the board in play with no confirm, and the board isn't saved, so the next Play or Daily deals it again from scratch. Mid-level or mid-daily progress is lost | Confirm when moves > 0, or keep the session and offer "Continue" on Home | M |
| UX-settings-3 | major | Input (needs device check) | `body { user-select: none; -webkit-user-select: none }` is inherited by the Save code textarea and the name input. On iOS Safari this can block selecting, copying or pasting text, which would break the manual-copy fallback and restore. Not yet verified on a device | Set `user-select: text` on `textarea` and `input`; check on an iPhone in Q5 | S |
| UX-settings-4 | minor | Navigation | Scenes, Jar guide and Save code all replace Settings, and closing them drops the player on the board, not back in Settings | Return to Settings when a sub-screen was opened from it | S |
| UX-settings-5 | minor | Clarity (A1) | The Colour patterns switch has no explanation; `patternsTitle` ("Show a texture on each colour (colour-blind aid)") exists but isn't shown | Show it as helper text under the switch | S |
| UX-settings-6 | minor | Flow | The code field is pre-filled with this device's own code. To restore, the player must clear it and paste; tapping Restore on the pre-filled code arms a warning about their own progress | Separate "your code" (read-only + Copy) from a "paste a code" field | M |
| UX-settings-7 | nit | Focus | Settings opens with focus on Close, the last control, so the first Tab goes to the board behind (with UX-all-1) | Focus the first switch, or the sheet heading | S |

---

## Totals

| Severity | Cross-cutting | Home | Board/HUD | Win card | Profile | Edit profile | Cabinet | Scenes | Settings | **Total** |
|---|---|---|---|---|---|---|---|---|---|---|
| blocker | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | **1** |
| major | 5 | 1 | 3 | 1 | 0 | 0 | 0 | 1 | 3 | **14** |
| minor | 1 | 1 | 4 | 3 | 1 | 1 | 3 | 2 | 3 | **19** |
| nit | 0 | 1 | 2 | 1 | 1 | 2 | 1 | 2 | 1 | **11** |
| **All** | 6 | 3 | 10 | 5 | 2 | 3 | 4 | 5 | 7 | **45** |

Dimensions not assessed in every review: Pattern Library (no `design/ux/interaction-patterns.md`). Becomes checkable once the library is written from the patterns each spec lists.
