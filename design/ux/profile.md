# UX Spec: Profile Screen

> **Status**: Implemented (spec written from the build for sprint 6 Q3; In Review)
> **Author**: ux-designer (from the build, owner-approved sprint task)
> **Last Updated**: 2026-11-08
> **Journey Phase(s)**: unknown: no player journey map
> **Screen / Flow Name**: `profile` (`#profile`, `openProfile()`, `renderProfile()`)
> **Platform Target**: Web, phone-first. Touch (primary), keyboard, mouse. Gamepad waived (D13)
> **Related GDDs**: `player-profile.md` §3.1, §3.2, §3.4, §5, §8
> **Related ADRs**: none known
> **Related UX Specs**: `home.md`, `edit-profile.md`
> **Accessibility Tier**: not named; A1–A7 apply
> **Template**: UX Spec

---

## 1. Purpose & Player Need

"This is my stall by the sea" (GDD §2). The player wants a quiet look at how far they've come (levels, streaks, shells) and their chosen look, without being sold anything.

**Player goal**: see their identity and lifetime stats at a glance, and reach Edit.

**Game goal**: reflect progress back to the player to reinforce the long-term goals.

## 2. Player Context on Arrival

| Question | Answer |
|---|---|
| Just doing | On Home; tapped the profile chip |
| Emotional state | Curious, relaxed |
| Cognitive load | Low |
| Already knows | Their name and avatar (from the chip) |
| Trying to do | Look at stats; change their look |
| Afraid of | Nothing much; confusing numbers |

**Emotional design target**: a trophy shelf, never a nag.

## 3. Navigation Position

```
Home
  └── Profile (modal, z 26)
        └── Edit Profile sheet (modal, z 27) → edit-profile.md
```

**Modal behaviour**: modal dialog. Closed by × or Esc. No backdrop tap. No focus trap.

| Entry | Trigger | Notes |
|---|---|---|
| Home profile chip | Tap / Enter / Space | Chip appears after the tutorial |

## 4. Entry & Exit Points

| Trigger | Source | Transition | Data in | Notes |
|---|---|---|---|---|
| Chip | Home | Fade 180 ms | save (profile, stats, level, daily, shells, themes) | Focus → close × |
| Edit Save | Edit sheet | Sheet hides | updated profile | Profile re-rendered; focus → edit button |
| Edit close / Discard | Edit sheet | Sheet hides | — | Focus → edit button |

| Exit | Destination | Transition | Data saved | Notes |
|---|---|---|---|---|
| × / Esc | Home | Cut | none | Focus is not returned to the chip |
| ✎ Edit | Edit sheet over Profile | Fade | none | |

## 5. Layout Specification

### 5.1 ASCII Wireframe

```
╔════════════════════════════════╗
║ Profile                    [●×]║
║ ┌────────────────────────────┐ ║
║ │ (◎◎)  [ Saffron Gull 42 ] [✎]│ ║ header card: portrait 88 px, plate, edit
║ │ (◎◎)  (Level 12)           │ ║ level badge
║ └────────────────────────────┘ ║
║ Stats                          ║
║ ┌─────────────┐┌─────────────┐ ║
║ │✓ Levels     ││★ Perfect    │ ║ 11 tiles, 2 columns
║ │  cleared 11 ││  clears 4   │ ║ (1 column at 150% text)
║ └─────────────┘└─────────────┘ ║
║   ...                          ║
║ Some totals count from this    ║ footnote
║ update onwards.                ║
╚════════════════════════════════╝
```

### 5.2 Layout Zones

| Zone | Contents | Size | Scrollable? | Overflow |
|---|---|---|---|---|
| Head | Title + × | full | No | — |
| Header card | Portrait, plate, level badge, edit | full | No | Plate wraps under the portrait; name clamps at 2 lines |
| Stats | 11 tiles | full | Card scrolls (max height = viewport − 16 px) | `auto-fill, minmax(9.5rem)` → 1 column at large text |
| Footnote | Text | full | — | Wraps |

### 5.3 Component Inventory

| Component | Type | Purpose | Required? | Reuses? |
|---|---|---|---|---|
| Close × `btn-close-profile` | Icon button 38 px, title "Close" | Close | Yes | `.icon-btn` (cabinet, edit) |
| Portrait | SVG, `aria-hidden` | Avatar in frame | Yes | `.portrait` |
| Name plate | Styled text | Name on plate | Yes | `plateEl` (chip, edit, win) |
| Level badge | Text | "Level N" (N = `save.level`) | Yes | — |
| Edit ✎ `btn-edit-profile` | Icon button 38 px, label "Edit profile" | Open Edit | Yes | `.icon-btn` |
| Stat tile ×11 | `dt`/`dd` in `dl` with icon | Label + value | Yes | New (stat tile) |
| Footnote | p | Explains the new counters | Yes | — |

**Primary focus element on open**: close ×.

### 5.4 Information Hierarchy

1. Portrait and name (identity).
2. Level badge.
3. Stats in GDD order: levels cleared, perfect clears, daily streak, best streak, dailies solved, shells, sets, scenes, total pours, coins earned, boosters used.
4. Footnote.

## 6. States & Variants

| State | Trigger | Visual | Behaviour |
|---|---|---|---|
| Fresh save (post-tutorial) | Counters 0 | All tiles show "0" or "0/40" (never "–") | |
| Long progress | Large values | `toLocaleString('en')` separators (e.g. 12,345) | |
| Long name | 16 × "W" | Plate wraps to ≤ 2 lines | |
| After Edit Save | Draft saved | Header re-renders | Focus to ✎ |
| Large text / 320 px | 150% | Grid 1 column; card scrolls | |
| Moonlit | Scene | Dark tokens; plates keep fixed colours (PP-6) | |
| Loading / error | — | n/a: local, synchronous; blocked storage = session-only profile | |

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual | Notes |
|---|---|---|---|---|
| Tab | Keyboard | × → ✎, then out of the dialog | Focus ring | No trap |
| Scroll | Touch, mouse | Scroll card | — | |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Animation | Audio |
|---|---|---|---|---|---|---|
| Tap / Enter / Space | All | × | Close | Dialog hides | Cut | — |
| Esc | Keyboard | Dialog | Close | Dialog hides | Cut | — |
| Tap / Enter / Space | All | ✎ | Open Edit | Edit sheet | Fade 180 ms | — |

### 7.3 State-Specific Behaviours

| State | Restriction | Reason |
|---|---|---|
| Edit sheet open | Profile Esc not handled (Edit's handler runs first) | Layering |

## 8. Data Requirements

| Data | Source | Update | Owner | Format | Null handling |
|---|---|---|---|---|---|
| Name, avatar, frame, plate | `save.profile` | On open; after Edit Save | player-profile | ids, string | Repaired at load |
| Level | `save.level` | On open | save-data | int | 1 |
| Levels cleared | `save.level − 1` | On open | player-profile | int | 0 |
| Perfect clears, dailies solved, pours, coins earned, boosters used | `save.stats` | On open | player-profile | ints | 0 |
| Daily streak | `streakStatus(...).current` | On open | daily-puzzle | int | 0 |
| Best streak | `save.daily.best` | On open | daily-puzzle | int | 0 |
| Shells, sets | `save.shells`, `setProgress` | On open | shell-collection | n/40, n/8 | 0 |
| Scenes | `save.themes.owned` | On open | scenes | n/4 | 1/4 |

Read-only.

## 9. Events Fired

| Player action | Event | Payload | Receiver | Notes |
|---|---|---|---|---|
| Open / close | none | — | — | UI only |
| Edit | `openEditProfile()` | — | UI | Draft copy of profile |

## 10. Transitions & Animations

| Transition | Trigger | Type | Duration | Easing | Interruptible? | Reduced motion |
|---|---|---|---|---|---|---|
| Enter | Chip | Backdrop + card fade | 180 | ease-out | — | 1 ms |
| Exit | × / Esc | Cut | 0 | — | — | n/a |

## 11. Input Method Completeness Checklist

Gamepad block dropped: waived (D13).

**Keyboard**
- [x] × and ✎ reachable; order follows reading order
- [x] Every action has a key path
- [x] Focus visible
- [ ] Focus trap (none)
- [x] Esc closes
- [ ] Focus returns to the chip on close (it does not)

**Mouse**
- [ ] Hover states (none)
- [x] Targets ≥ 32 px (38 px)
- [x] Right-click default; wheel scrolls the card

**Touch**
- [ ] Targets ≥ 44 px (× and ✎ are 38 px)
- [x] No swipes; one-handed; no long-press

## 12. Accessibility

| Text | Background | Required | Current | Pass? |
|---|---|---|---|---|
| Stat values (`--ink`) | `--surface-2` | 4.5:1 | not in the scene test (surface-2) | Unverified |
| Stat labels (`--ink-soft`, 12 px) | `--surface-2` | 3:1 (A6) | not in the scene test | Unverified |
| Plate text | plate bg/bg2 | 4.5:1 | unit-tested | Yes |
| Level badge (accent-ink on accent) | accent | 3:1 (A6) | tested | Yes |

| Element | Colour risk | Mitigation |
|---|---|---|
| Stat icons | — | Decorative (`aria-hidden`); labels are text |

**Focus order**: 1 × → 2 ✎.

| State change | Announcement | Timing |
|---|---|---|
| Open | Dialog "Profile" | On open |
| Stats | `dl` term/value pairs | On read |

**Cognitive load**: 11 stat tiles is above 7±2 if read at once; it is a browse screen and tiles are grouped in GDD order (progress, daily, collection, totals). Acceptable.

## 13. Localization Considerations

| Text | EN length | Max | Expansion | Overflow | Risk |
|---|---|---|---|---|---|
| Stat labels ("Levels cleared", "Boosters used") | ≤ 15 | ~16 per tile at 2 columns | 10% | Wraps in tile | Medium |
| Footnote | 39 | wraps | — | — | Low |
| Numbers | — | — | — | `toLocaleString('en')`: English separators only | Medium |

## 14. Acceptance Criteria

- [ ] Profile opens within 200 ms of tapping the chip, with focus on ×.
- [ ] It shows the portrait, plate, "Level N" (N = `save.level`) and 11 stat tiles in the order of `player-profile.md` §3.4.
- [ ] On a fresh save every tile shows "0" (or "0/40", "0/8", "1/4"), never "–".
- [ ] Esc and × close it; ✎ opens Edit.
- [ ] At 320 px and 150% text the grid is one column and nothing overflows horizontally.
- [ ] A 16 × "W" name wraps to at most 2 lines in the header.

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|---|---|---|---|
| Player journey map not yet created | ux-designer | Sprint 7 | Open |
| Focus trap and return of focus to the chip | ui-programmer | Q6 | Open |
| × and ✎ below 44 px | ui-programmer | Q6 | Open |
| `--surface-2` backgrounds are not in the per-scene contrast test | ui-programmer | Q5 | Open |
| GDD §3.2 says "two columns"; the build uses `auto-fill` (2 at 320–480 px, possibly 3+ on wider screens) | game-designer | Q6 | Doc gap |
| No pattern library; stat tile is an unrecorded pattern | ux-designer | Sprint 7 | Open |
