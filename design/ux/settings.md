# UX Spec: Settings Sheet and Save Code Sheet

> **Status**: Implemented (spec written from the build for sprint 6 Q3; In Review)
> **Author**: ux-designer (from the build, owner-approved sprint task)
> **Last Updated**: 2026-11-08
> **Journey Phase(s)**: unknown: no player journey map
> **Screen / Flow Name**: `settings` (`#settings`, `openSettings()`), `transfer` (`#transfer`, `openTransfer()`, `copySaveCode()`, `restoreSaveCode()`)
> **Platform Target**: Web, phone-first. Touch (primary), keyboard, mouse. Gamepad waived (D13)
> **Related GDDs**: `feel-audio-ui.md` §2.1 (Settings, Tutorial), `save-data.md` §2.1, §3 (export/import, D16), `jar-mechanics.md` §2.1 (Jar guide), `scenes.md` §2.1 (entry)
> **Related ADRs**: none known
> **Related UX Specs**: `board-hud.md`, `home.md`, `scenes.md`
> **Accessibility Tier**: not named; A1–A7 apply (A1 patterns and A7 sound switches live here)
> **Template**: UX Spec

---

## 1. Purpose & Player Need

Mid-level, the player wants to quiet the game (sound off on the bus), switch on colour patterns, look up a jar rule, or step out to Home. Occasionally they want to move their progress to a new phone. Settings is the toolbox; Save code is the moving box.

**Player goal**: change a preference or go somewhere, then get back to the board in one tap. For Save code: copy a code, or paste one and restore safely.

**Game goal**: keep accessibility switches one tap away; move a save with no server and no accidental overwrite.

## 2. Player Context on Arrival

| Question | Answer |
|---|---|
| Just doing | Playing a board (Settings is only in the HUD) |
| Emotional state | Calm; occasionally annoyed (sound) or anxious (new phone) |
| Cognitive load | Medium: their board is waiting |
| Already knows | Their board state |
| Trying to do | Flip a switch; open a sub-screen; leave |
| Afraid of | Losing the board in play; overwriting progress with the wrong code |

**Emotional design target**: quick and safe: nothing here destroys progress by surprise.

## 3. Navigation Position

```
Board
  └── Settings (bottom sheet, z 25)
        ├── Home              → home.md            (closes Settings)
        ├── Replay tutorial   → tutorial board     (closes Settings)
        ├── Jar guide         → intro card         (closes Settings)
        ├── Scenes            → scenes.md          (closes Settings)
        └── Save code         → Save code sheet    (closes Settings)
```

**Modal behaviour**: both are modal bottom sheets. Settings: Close or Esc. Save code: Close or Esc. No backdrop tap; no focus trap. Every sub-screen replaces Settings; closing a sub-screen returns to the board.

| Entry | Trigger | Notes |
|---|---|---|
| HUD ⚙ | Tap | Board only; not reachable from Home |

## 4. Entry & Exit Points

| Trigger | Source | Transition | Data in | Notes |
|---|---|---|---|---|
| ⚙ | Board | fade 180 + rise 240 | `save.settings` | Focus → Close |
| Save code | Settings | Settings hides; Save code rises | `exportSave(save)` pre-filled | No initial focus |

| Exit | Destination | Transition | Data saved | Notes |
|---|---|---|---|---|
| Close / Esc | Board | Cut | (toggles already saved) | Focus not returned to ⚙ |
| Home | Home | Cut | none | Board in play discarded on next Play/Daily, no confirm |
| Replay tutorial | Tutorial board | Cut | none | Board in play discarded, no confirm |
| Jar guide | Intro card | Cut | none | Got it → board |
| Scenes | Scenes sheet | Cut | none | Close → board |
| Save code Close / Esc | Board | Cut | none | |
| Restore (2nd tap) | Home | Cut | Imported save written | Toast "Progress restored" is hidden under Home |

## 5. Layout Specification

### 5.1 ASCII Wireframe

```
╔════════════════════════════════╗
║ Settings                       ║
║ Sound effects           [ ●] ║ switches (label row is the target)
║ Music                   [ ●] ║
║ Vibration               [ ●] ║
║ Colour patterns         [○  ] ║
║ [  Home  ][Replay tutorial][Jar guide] ║ wraps at large text
║ [ Scenes ][ Save code ]        ║
║ ╔════════════════════════════╗ ║
║ ║●          Close            ║ ║ focused on open
║ ╚════════════════════════════╝ ║
╚════════════════════════════════╝

╔════════════════════════════════╗
║ Save code                      ║
║ Copy this code to move your    ║ status (polite): help / copied / warning / error
║ progress to another device...  ║
║ ┌────────────────────────────┐ ║
║ │STRATA1:eyJsZXZlbCI6MTIsIm..│ ║ textarea, 4 rows, pre-filled
║ └────────────────────────────┘ ║
║ [ Copy code ][Restore from code] ║ 2nd tap label: "Tap again to replace my progress"
║ ╔════════════════════════════╗ ║
║ ║          Close             ║ ║
║ ╚════════════════════════════╝ ║
╚════════════════════════════════╝
```

### 5.2 Layout Zones

| Zone | Contents | Size | Scrollable? | Overflow |
|---|---|---|---|---|
| Switches | 4 toggles | full | Sheet scrolls (max 100%) | Labels wrap |
| Button rows | 3 + 2 secondary buttons | full | — | Wrap (`flex: 1 1 8rem`) |
| Footer | Close | full | — | — |
| Save code: status, code, actions | text, textarea, 2 buttons | full | Sheet scrolls | Code breaks anywhere |

### 5.3 Component Inventory

| Component | Type | Purpose | Required? | Reuses? |
|---|---|---|---|---|
| Toggle ×4 | Native checkbox styled as a switch, wrapped in `label` | Sound, music, vibration, colour patterns | Yes | `.toggle` (Scenes) |
| Home, Replay tutorial, Jar guide, Scenes, Save code | Secondary buttons | Navigate | Yes | `.secondary` |
| Close | Primary | Close | Yes | `.primary` |
| Status `transfer-status` | p, polite | Help, copied, manual-copy, restore warning, invalid code | Yes | New |
| Code `transfer-code` | textarea, labelled by the title | Show/paste code | Yes | New |
| Copy code | Secondary | Clipboard, else select for manual copy | Yes | `.secondary` |
| Restore from code | Secondary, two-tap | Validate → warn → replace | Yes | New (two-tap confirm) |

**Primary focus element on open**: Settings → Close. Save code → none set.

### 5.4 Information Hierarchy

1. Switches (the most frequent need, especially sound).
2. Navigation buttons.
3. Close.
Save code: 1 status line (what this does / what will happen) → 2 code → 3 actions.

## 6. States & Variants

| State | Trigger | Visual | Behaviour |
|---|---|---|---|
| Settings default | Open | Switches reflect `save.settings` | Each change saves at once |
| Tutorial in progress | Open during tutorial | Same | Replay tutorial restarts it |
| Save code default | Open | Help text; this device's code | `restoreArmed = false` |
| Copied | Copy, clipboard OK | "Copied! Paste it into Strata on your other device." | |
| Clipboard blocked | Copy fails | Code selected; "Copying is blocked here; the code is selected so you can copy it yourself." | |
| Invalid code | Restore with a bad code | "That isn't a Strata save code. Check you copied all of it."; nope sound | Disarmed |
| Armed | Restore with a valid code | Warning "This code is at level L with C coins. Restoring replaces your progress on this device."; button "Tap again to replace my progress" | Next tap restores **whatever the field then holds** |
| Restored | 2nd tap | Sheet closes; Home | Save replaced; theme and audio re-applied |
| Storage blocked | — | Restore applies for the session only | |
| Large text | 150% | Rows wrap; sheet scrolls | |

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Notes |
|---|---|---|---|
| Tab | Keyboard | Settings: 4 switches → Home → Replay tutorial → Jar guide → Scenes → Save code → Close. Save code: textarea → Copy → Restore → Close | No trap; Settings focus starts on Close (last) |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Audio |
|---|---|---|---|---|---|
| Tap row / Space | All | Switch | Toggle setting | Knob slides 160 ms; saved | (sound follows new state) |
| Tap / Enter | All | Nav buttons | See section 4 | Sheet closes | — |
| Tap / Esc | All | Close | Close | — | — |
| Tap | All | Copy code | Copy | Status line | — |
| Tap ×2 | All | Restore | Validate, warn, restore | Status / Home | nope on invalid |
| Paste / type | All | Code field | Edit code | — | — |

### 7.3 State-Specific Behaviours

| State | Restriction | Reason |
|---|---|---|
| Armed | Second tap restores | Two-tap confirm (D16) |
| Settings open | Board keys not handled | Layering |

## 8. Data Requirements

| Data | Source | Update | Owner | Format | Null handling |
|---|---|---|---|---|---|
| sound, music, haptics, patterns | `save.settings` | On open; on toggle | feel-audio-ui / save-data | bools | defaults |
| Save code | `exportSave(save)` | On open and on Copy | save-data | `STRATA1:` + base64 | — |
| Imported save preview | `importSave(text)` | On Restore tap | save-data | SaveData or null | Invalid message |

## 9. Events Fired

| Player action | Event / call | Payload | Receiver | Notes |
|---|---|---|---|---|
| Toggle | `save.settings[key]`, `writeSave`, `audio.configure`; patterns → `renderAllJars` | key, bool | Save, Audio, Board | Persistent |
| Home | `showHome()` | — | UI | Board lost on next Play |
| Replay tutorial | `startTutorial()` | — | Session | Board lost |
| Jar guide | `showMechanicCards(all)` | — | UI | |
| Copy | `clipboard.writeText` | code | OS | |
| Restore | `importSave` → `save = imported`, `repairSaveProfile`, `writeSave`, `startLevel`, `showHome` | save | Save, all systems | Destructive; replaces all progress |

## 10. Transitions & Animations

| Transition | Trigger | Type | Duration | Easing | Interruptible? | Reduced motion |
|---|---|---|---|---|---|---|
| Sheet enter | Open | fade + rise | 180 / 240 | ease-out / overshoot | — | 1 ms |
| Sheet exit | Close / nav | Cut | 0 | — | — | n/a |
| Switch | Toggle | knob slide, colour | 160 | — | — | 1 ms |

## 11. Input Method Completeness Checklist

Gamepad block dropped: waived (D13).

**Keyboard**
- [x] All elements reachable; order follows reading order
- [x] Every action has a key path
- [x] Focus visible (switches, Close, textarea; secondary buttons rely on the browser default ring)
- [ ] Focus trap (none, on either sheet)
- [ ] Initial focus on Save code (none)
- [x] Esc closes either sheet

**Mouse**
- [ ] Hover states (none)
- [x] Targets ≥ 32 px; right-click default (textarea: native menu); wheel scrolls

**Touch**
- [ ] Targets ≥ 44 px (secondary buttons ~41 px; switch rows ≥ 44)
- [x] No swipes; one-handed; no long-press (beyond native text selection)

## 12. Accessibility

| Text | Background | Required | Current | Pass? |
|---|---|---|---|---|
| Switch labels, buttons (`--ink`) | card / surface-2 | 4.5:1 | card tested; surface-2 not | Partly unverified |
| Status (`--ink-soft`, 14 px) | card | 3:1 (A6) | tested | Yes |
| Code (`--ink`, 12 px mono) | surface-2 | 4.5:1 | not tested | Unverified |

| Element | Colour risk | Mitigation |
|---|---|---|
| Switch on/off | Accent vs grey | Knob position; native checked state |

**Focus order**: Settings: 1 Sound effects → 2 Music → 3 Vibration → 4 Colour patterns → 5 Home → 6 Replay tutorial → 7 Jar guide → 8 Scenes → 9 Save code → 10 Close (focus starts at 10). Save code: 1 code → 2 Copy → 3 Restore → 4 Close.

| State change | Announcement | Timing |
|---|---|---|
| Switch | checkbox checked/unchecked | On toggle |
| Copied / blocked / invalid / warning | status line, polite | On action |
| Armed | button label change | On read |
| Restored | toast, polite (visually hidden under Home) | After restore |

**Cognitive load**: 4 switches + 5 buttons + Close = 10 controls: above 7±2 but chunked (switches, then navigation). Save code: low.

## 13. Localization Considerations

| Text | EN length | Max | Expansion | Overflow | Risk |
|---|---|---|---|---|---|
| "Replay tutorial" | 15 | ~12 per button at 320 px in a 3-row | — | Wraps the row | Medium |
| "Tap again to replace my progress" | 32 | half-width button | — | Wraps (2–3 lines) | **High** |
| Restore warning | ~95 | wraps | — | — | Low |
| Switch labels | ≤ 15 | ~25 | 60% | Wraps | Low |

## 14. Acceptance Criteria

- [ ] Settings opens within 200 ms with focus on Close and the switches matching the save.
- [ ] Each switch takes effect at once and survives a reload; Colour patterns redraws the board with textures.
- [ ] Jar guide shows all four mechanics, with unmet ones greyed and "Unlocks at level N".
- [ ] Copy code puts a `STRATA1:` code on the clipboard and says so; with the clipboard blocked the code is selected and the manual-copy message shows.
- [ ] Restore with a non-code shows the invalid message and changes nothing.
- [ ] Restore with a valid code shows its level and coins and changes the button; a second tap replaces the save and lands on Home with the imported level.
- [ ] Editing the code after the warning disarms the restore (requires the warning again).
- [ ] Esc closes either sheet; at 320 px and 150% text nothing is cut off.

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|---|---|---|---|
| Player journey map not yet created | ux-designer | Sprint 7 | Open |
| Restore stays armed after the code is edited | ui-programmer | Q6 | Open |
| Home and Replay tutorial discard the board in play without asking; boards are not saved (save-data §2.1) | owner | Q6 | Open |
| Settings and Save code are unreachable from Home (new-device restore needs the tutorial first) | owner | Q6 | Open |
| Sub-screens return to the board, not to Settings | owner | Q6 | Open |
| `patternsTitle` helper text exists in `strings.ts` but is not shown | ui-programmer | Q6 | Open |
| `body { user-select: none; -webkit-user-select: none }` is inherited by the textarea and name input; on iOS Safari this can block selecting or pasting. Needs a device check | qa | Q5 | Open |
| `feel-audio-ui.md` §2.1 lists Settings without Save code | game-designer | Q6 | Doc gap |
| No pattern library; two-tap confirm is an unrecorded pattern | ux-designer | Sprint 7 | Open |
