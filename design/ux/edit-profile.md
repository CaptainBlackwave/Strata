# UX Spec: Edit Profile Sheet and "Discard changes?" Prompt

> **Status**: Implemented (spec written from the build for sprint 6 Q3; In Review)
> **Author**: ux-designer (from the build, owner-approved sprint task)
> **Last Updated**: 2026-11-08
> **Journey Phase(s)**: unknown: no player journey map
> **Screen / Flow Name**: `edit-profile` (`#edit-profile`, `#discard`; `openEditProfile()`, `renderEdit()`, `pick()`, `closeEditProfile()`)
> **Platform Target**: Web, phone-first. Touch (primary), keyboard, mouse. Gamepad waived (D13)
> **Related GDDs**: `player-profile.md` §3.3, §3.5, §3.6, §5, §8
> **Related ADRs**: none known
> **Related UX Specs**: `profile.md`
> **Accessibility Tier**: not named; A1–A7 apply
> **Template**: UX Spec

---

## 1. Purpose & Player Need

The player wants to make the stall theirs: try a lighthouse in a driftwood frame, see it before committing, and rename themselves. Locked items should say how to earn them, not sell them (PP-7).

**Player goal**: pick an avatar, frame, plate and name, preview them, and Save (or back out safely).

**Game goal**: show earned cosmetics and the path to the locked ones.

## 2. Player Context on Arrival

| Question | Answer |
|---|---|
| Just doing | Viewing Profile; tapped ✎ |
| Emotional state | Playful, exploratory |
| Cognitive load | Low–medium (three tabs, a draft) |
| Already knows | Their current look |
| Trying to do | Try options; maybe type a name |
| Afraid of | Losing a choice by closing; not knowing why Save is off |

**Emotional design target**: a dressing-up corner: try freely, nothing sticks until Save.

## 3. Navigation Position

```
Home → Profile
         └── Edit Profile (modal, z 27)
               └── Discard changes? (alertdialog, z 28)
```

**Modal behaviour**: Edit is modal (× / Esc → close or prompt). The prompt is a modal `alertdialog`: Keep editing (default focus, Esc) or Discard. No backdrop tap on either. No focus trap on either.

| Entry | Trigger | Notes |
|---|---|---|
| Profile ✎ | Tap / Enter / Space | Draft = copy of saved profile; Avatar tab |

## 4. Entry & Exit Points

| Trigger | Source | Transition | Data in | Notes |
|---|---|---|---|---|
| ✎ | Profile | Fade 180 ms | `save.profile`, progress | Focus → Avatar tab |

| Exit | Destination | Transition | Data saved | Notes |
|---|---|---|---|---|
| Save (enabled) | Profile | Cut | Draft → `save.profile` (name normalised); `writeSave` | Profile + chip re-render; focus → ✎ |
| Enter in the name field | Profile | Cut | Same as Save (if valid) | |
| × / Esc, draft unchanged | Profile | Cut | none | Focus → ✎ |
| × / Esc, draft changed | Discard prompt | Cut | none | Focus → Keep editing |
| Keep editing / Esc (prompt) | Edit sheet | Cut | none | Focus → active tab |
| Discard | Profile | Cut | Draft dropped | Focus → ✎ |

## 5. Layout Specification

### 5.1 ASCII Wireframe

```
╔════════════════════════════════╗
║ Edit profile               [×] ║
║ ┌────────────────────────────┐ ║
║ │ (◎) [ Saffron Gull 42 ]    │ ║ preview: draft portrait + plate
║ └────────────────────────────┘ ║
║ [●Avatar ][ Frame ][ Name ]    ║ tablist
║ ┌────┐┌────┐┌────┐┌────┐       ║ Avatar/Frame: grid of radios
║ │ ◎✓ ││ ◎  ││ ◎  ││ ◎🔒│       ║ check badge = selected, lock = locked
║ └────┘└────┘└────┘└────┘       ║
║ Name tab:                      ║
║  Your name                     ║
║  [ Saffron Gull 42      ][🎲]  ║ input + re-roll
║  Use 2–16 letters or numbers   ║ error (only when invalid)
║  Name plate                    ║
║  [plate][plate][plate🔒]       ║
║ Lighthouse: Clear 25 levels · 12/25 ║ pick note (locked tap)
║ ╔════════════════════════════╗ ║
║ ║           Save             ║ ║ disabled while the name is invalid
║ ╚════════════════════════════╝ ║
╚════════════════════════════════╝

   ╔══════════════════════════╗
   ║    Discard changes?      ║   prompt over the sheet
   ║ [●Keep editing][Discard] ║   Discard is red
   ╚══════════════════════════╝
```

### 5.2 Layout Zones

| Zone | Contents | Size | Scrollable? | Overflow |
|---|---|---|---|---|
| Head | Title, × | full | No | — |
| Preview | Draft portrait + plate | full | No | Plate wraps, ≤ 2 lines |
| Tabs | Avatar / Frame / Name | full | No | Equal thirds |
| Panel | Grid (8 / 6 / 6 items) or name + plates | full | Card scrolls | `auto-fill, minmax(4.75rem)`; plates `minmax(9rem)` |
| Footer | Pick note, Save | full | — | — |

### 5.3 Component Inventory

| Component | Type | Purpose | Required? | Reuses? |
|---|---|---|---|---|
| Close × | Icon button 38 px | Close / prompt | Yes | `.icon-btn` |
| Preview | Portrait 64 px + plate | Show the draft | Yes | `plateEl` |
| Tabs | `role=tablist` / `tab`, roving tabindex, `aria-selected` | Switch slot | Yes | New (tabs) |
| Pick grid | `role=radiogroup` of `role=radio` buttons, min 48 px | Choose an item | Yes | New (pick grid) |
| Locked item | Dimmed art + lock badge; label "{name}, locked: {requirement}" | Explain unlock | — | — |
| Name input | text, `maxlength=32`, `aria-describedby=name-error`, `aria-invalid` | Type a name | Yes | — |
| Re-roll 🎲 | Icon button 46 px, label "New random name" | Generate a name | Yes | `.icon-btn` |
| Name error | p, polite | Validation message | When invalid | — |
| Pick note | p, polite | Locked item requirement + progress | On locked tap | — |
| Save | Primary | Commit draft | Yes | `.primary` |
| Prompt | `alertdialog`: title, Keep editing, Discard (red) | Confirm losing the draft | When dirty | `.cabinet-card` |

**Primary focus element on open**: the Avatar tab. Prompt: Keep editing.

### 5.4 Information Hierarchy

1. Preview (what I'll look like).
2. Active tab's choices, selected item marked.
3. Locked items and their requirement.
4. Save.

## 6. States & Variants

| State | Trigger | Visual | Behaviour |
|---|---|---|---|
| Clean draft | Open | Saved choices checked | × closes at once |
| Dirty draft | Any pick, name edit or re-roll | Preview updates | × / Esc opens the prompt |
| Back to saved | Re-pick saved choices | — | Draft equals saved → no prompt |
| Locked item tapped | Tap / Enter / Space on locked | Pick note "{name}: {req} · have/need"; nope sound | Never selected; focus stays on it |
| Arrow onto locked | Arrow key | Focus moves; nothing selected | — |
| Arrow onto unlocked | Arrow key | Selects it (radio behaviour), select sound | — |
| Invalid name | Fails `isValidName` (2–16, letters/numbers, single spaces or hyphens) | Red border, "Use 2–16 letters or numbers", Save at 45% opacity | Save disabled; plates show the saved name |
| Invalid name, other tab | Switch tab after an invalid edit | Save disabled; error text is hidden with the Name panel | No visible reason |
| Re-roll | 🎲 | New generated name in field | Valid by construction |
| Storage blocked | — | Works; not kept after reload | |
| Large text / 320 px | 150% | Grids reflow; card scrolls | |
| Loading / error | — | n/a (local) | |

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual | Notes |
|---|---|---|---|---|
| Tab | Keyboard | × → active tab → checked item in the grid → (Name: input → 🎲 → plate grid) → Save | Focus ring | Roving tabindex in tabs and grids; no trap |
| ← → ↑ ↓ | Keyboard | In tabs: switch tab (wraps). In a grid: next/previous item (wraps) | Focus moves | Unlocked items get selected |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Animation | Audio |
|---|---|---|---|---|---|---|
| Tap / Enter / Space | All | Tab | Activate tab | Panel swaps | — | — |
| Tap / Enter / Space | All | Unlocked item | Select in draft | Check badge, preview updates | — | select |
| Tap / Enter / Space | All | Locked item | Show requirement | Pick note | — | nope |
| Type | All | Name input | Edit draft name | Live validation | — | — |
| Enter | Keyboard | Name input | Save (if valid) | Sheet closes | — | select |
| Tap | All | 🎲 | New name | Field updates | — | shuffle |
| Tap / Enter | All | Save | Commit | Sheet closes | — | select |
| Tap / Esc | All | × | Close or prompt | | — | — |
| Tap / Esc | All | Prompt Keep editing | Back to sheet | | — | — |
| Tap | All | Prompt Discard | Drop draft, close | | — | — |

### 7.3 State-Specific Behaviours

| State | Restriction | Reason |
|---|---|---|
| Name invalid | Save disabled; Enter does nothing | Never save an invalid name |
| Prompt open | Only Esc handled globally (→ Keep editing) | Layering |

## 8. Data Requirements

| Data | Source | Update | Owner | Format | Null handling |
|---|---|---|---|---|---|
| Saved profile | `save.profile` | On open | player-profile | ids, name | Repaired at load |
| Draft | UI-local copy (`draft`) | On every pick/edit | **UI (transient draft only)** | Profile | — |
| Catalog | config `profile` | Static | player-profile | 8/6/6 items | First item default |
| Unlock progress | `progressNow()` | On render | player-profile | per-kind counts | 0 |
| Name rules | config `profile.name` (2/16), `isValidName` | Static | player-profile | | — |

The draft is presentation state; only Save writes, through `save.profile = …; writeSave`.

## 9. Events Fired

| Player action | Event / call | Payload | Receiver | Notes |
|---|---|---|---|---|
| Save | `normaliseName`, `writeSave` | profile | Save | Persistent change |
| Pick / re-roll / type | `withPick` / `generateName` (draft only) | slot, id / name | UI | No persistence |
| Discard | none | — | — | Draft dropped |

## 10. Transitions & Animations

| Transition | Trigger | Type | Duration | Easing | Interruptible? | Reduced motion |
|---|---|---|---|---|---|---|
| Sheet enter | ✎ | fade | 180 | ease-out | — | 1 ms |
| Sheet / prompt exit | Save, ×, Discard | Cut | 0 | — | — | n/a |
| Prompt enter | Dirty close | fade | 180 | ease-out | — | 1 ms |

## 11. Input Method Completeness Checklist

Gamepad block dropped: waived (D13).

**Keyboard**
- [x] All elements reachable (Tab + arrows)
- [x] Order follows reading order
- [x] Every action has a key path (GDD §8 keyboard walkthrough)
- [x] Focus visible (tabs, picks, input, buttons)
- [ ] Focus trap (none, on sheet or prompt)
- [x] Esc closes / prompts; Esc on prompt = Keep editing

**Mouse**
- [ ] Hover states (none)
- [x] Targets ≥ 32 px
- [x] Right-click default; wheel scrolls the card

**Touch**
- [ ] Targets ≥ 44 px (× 38 px, tabs ~37 px tall, prompt buttons ~41 px)
- [x] No swipes; one-handed; no long-press

## 12. Accessibility

| Text | Background | Required | Current | Pass? |
|---|---|---|---|---|
| Tab labels (ink-soft / accent-ink on accent) | surface-2 / accent | 3:1 (A6) | accent pair tested; surface-2 not | Partly unverified |
| Name error `#b3412b` (13 px) | card | 4.5:1 | ~5.4 Midday; ~2.5 Moonlit (computed) | **No (Moonlit)** |
| Pick note (`--accent`, 13 px) | card | 4.5:1 | ~3.2 Midday (computed) | **No** |
| Discard (white on `#b3412b`) | — | 4.5:1 | ~5.7 | Yes |

| Element | Colour risk | Mitigation |
|---|---|---|
| Selected item (accent border) | Colour | Check badge |
| Locked item (dimmed) | Low vision | Lock badge + "locked: …" label |
| Invalid field (red border) | Colour | Error text, `aria-invalid` |

**Focus order**: 1 × → 2 active tab → 3 selected item of the active grid → (Name tab: input → 🎲 → selected plate) → 4 Save. Prompt: Keep editing → Discard.

| State change | Announcement | Timing |
|---|---|---|
| Item selected | radio "checked" | On focus |
| Locked tapped | Pick note, polite | On tap |
| Name invalid | Error, polite; `aria-invalid=true` | On input |
| Prompt | alertdialog "Discard changes?" | On open |

**Cognitive load**: preview, 3 tabs, up to 8 items, note, Save: within 7±2.

## 13. Localization Considerations

| Text | EN length | Max | Expansion | Overflow | Risk |
|---|---|---|---|---|---|
| Tabs (Avatar, Frame, Name) | 4–6 | ~8 per third at 320 px | 30% | Wraps in the tab | **High** |
| "Use 2–16 letters or numbers" | 27 | wraps | — | — | Low |
| Unlock line "Lighthouse: Clear 25 levels · 12/25" | 35 | wraps | — | — | Low |
| "Keep editing" / "Discard" | 12 / 7 | ~14 each at 320 px | 15% | Row wraps | Medium |
| Generated names | ≤ 16 | 16 | n/a | Word lists per locale | Medium |

## 14. Acceptance Criteria

- [ ] Edit opens within 200 ms with focus on the Avatar tab; arrow keys switch tabs.
- [ ] Tapping an unlocked item updates the preview and moves the check badge; the saved profile is unchanged until Save.
- [ ] Tapping a locked item shows "{name}: {requirement} · have/need" and does not select it.
- [ ] Typing "a" shows "Use 2–16 letters or numbers", sets `aria-invalid=true` and disables Save; "Zoë" and "Ana-Maria" are valid.
- [ ] × with no changes closes at once; × after a change opens "Discard changes?" with focus on Keep editing; Esc there returns to the sheet.
- [ ] Save closes the sheet, updates Profile and the Home chip, and survives a reload.
- [ ] At 320 px and 150% text, all three tabs and the Save button are reachable without horizontal scroll.

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|---|---|---|---|
| Player journey map not yet created | ux-designer | Sprint 7 | Open |
| Save disabled with no visible reason when the invalid name is on a hidden tab | ui-programmer | Q6 | Open |
| Focus trap on sheet and prompt; 44 px targets for ×, tabs and prompt buttons | ui-programmer | Q6 | Open |
| `maxlength=32` while the rule is 16: intentional (lets a paste be trimmed)? | game-designer | Q6 | Open |
| Name error colour fails in Moonlit; accent text fails in Midday/Dawn | ui-programmer | Q5 | Open |
| No pattern library; tabs, pick grid, confirm prompt are unrecorded patterns | ux-designer | Sprint 7 | Open |
