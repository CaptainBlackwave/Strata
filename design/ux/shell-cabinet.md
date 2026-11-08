# UX Spec: Shell Cabinet

> **Status**: Implemented (spec written from the build for sprint 6 Q3; In Review)
> **Author**: ux-designer (from the build, owner-approved sprint task)
> **Last Updated**: 2026-11-08
> **Journey Phase(s)**: unknown: no player journey map
> **Screen / Flow Name**: `cabinet` (`#cabinet`, `openCabinet()`)
> **Platform Target**: Web, phone-first. Touch (primary), keyboard, mouse. Gamepad waived (D13)
> **Related GDDs**: `shell-collection.md` §2.1 (Cabinet), §2.1a (SC-6, SC-8), §3 (Levels to next shell), §4
> **Related ADRs**: none known
> **Related UX Specs**: `home.md`, `win-card.md`
> **Accessibility Tier**: not named; A1–A7 apply
> **Template**: UX Spec

---

## 1. Purpose & Player Need

The player wants to admire what they've collected and see what's next: how many shells each set still needs and how soon the next one arrives. It is the long-term goal made visible.

**Player goal**: see owned shells by set, and how many levels until the next shell.

**Game goal**: keep the collection goal (and the set reward) in view.

## 2. Player Context on Arrival

| Question | Answer |
|---|---|
| Just doing | On Home; tapped Shells (often right after a shell win) |
| Emotional state | Pleased, curious |
| Cognitive load | Low |
| Already knows | Count "Shells n/40" from the button |
| Trying to do | Find the new shell; check set progress |
| Afraid of | Nothing; maybe that shells are random (they are not) |

**Emotional design target**: a tidy glass cabinet you enjoy filling.

## 3. Navigation Position

```
Home
  └── Shell cabinet (modal, z 26)
```

**Modal behaviour**: modal dialog; × or Esc closes. No backdrop tap. No focus trap.

| Entry | Trigger | Notes |
|---|---|---|
| Home Shells button | Tap / Enter / Space | After the tutorial |

## 4. Entry & Exit Points

| Trigger | Source | Transition | Data in | Notes |
|---|---|---|---|---|
| Shells | Home | Fade 180 ms | `save.shells`, `save.level`, catalog | Focus → × |

| Exit | Destination | Transition | Data saved | Notes |
|---|---|---|---|---|
| × / Esc | Home | Cut | none | Focus not returned to Shells; expanded/collapsed state is not kept |

## 5. Layout Specification

### 5.1 ASCII Wireframe

```
╔════════════════════════════════╗
║ Shell cabinet              [●×]║
║ Next shell: clear 3 more levels║ accent line
║ ┌────────────────────────────┐ ║
║ │ Tide Pool             5/5 ›│ ║ completed set: collapsed header
║ └────────────────────────────┘ ║
║ ┌────────────────────────────┐ ║
║ │ Dune Coast            2/5 ˅│ ║ open set
║ │ (s) (s) (?) (?) (?)        │ ║ 5 across (fewer at large text)
║ │ Sand  Razor  ?   ?   ?     │ ║
║ │ Complete the set: 150 coins│ ║
║ │ + 1 of each booster        │ ║
║ └────────────────────────────┘ ║
║ ... 8 sets, one scrolling list ║
╚════════════════════════════════╝
```

### 5.2 Layout Zones

| Zone | Contents | Size | Scrollable? | Overflow |
|---|---|---|---|---|
| Head | Title, × | full | No | — |
| Next line | "Next shell: …" or completion text | full | No | Wraps |
| Sets list | 8 set sections | full | Card scrolls (max viewport − 16 px) | Grid `auto-fill, minmax(max(3.25rem, 20%))`, art ≤ 4 rem, names hyphenate |

### 5.3 Component Inventory

| Component | Type | Purpose | Required? | Reuses? |
|---|---|---|---|---|
| Close × | Icon button 38 px | Close | Yes | `.icon-btn` |
| Next line | p (accent) | Levels to the next shell | Yes | `.cabinet-next` (also Scenes note) |
| Set header | `button` with `h3` + count + chevron, `aria-expanded`, `aria-controls` | Expand/collapse | Yes | New (disclosure) |
| Shell cell | `figure` with SVG + `figcaption` | Owned: name; locked: silhouette + "?" | Yes | `shellSvg` (home icon, win row) |
| Set note | p | Reward text or "Set complete ✓" | Yes | — |

**Primary focus element on open**: ×.

### 5.4 Information Hierarchy

1. "Next shell: clear N more levels" (what's next).
2. Open (incomplete) sets and their owned/total.
3. Shell names and silhouettes.
4. Completed sets (collapsed).

## 6. States & Variants

| State | Trigger | Visual | Behaviour |
|---|---|---|---|
| Empty | 0 shells (after tutorial) | All sets open, all silhouettes "?" | |
| Partial | Some owned | Owned show art + name | |
| Set complete | 5/5 | Header collapsed, green-tinted section, "Set complete ✓" in body | Tap header to open |
| Night Shore | Owned glow shells | Soft blue halo, slow pulse | Pulse stops with reduced motion; halo stays |
| Ancient Cliffs | Owned stone shells | Speckled texture | |
| All 40 owned | Collection complete | Next line reads "Collection complete: +50 coins" | Every set collapsed |
| Large text | 150% | Fewer, wider columns; card scrolls | |
| Loading / error | — | n/a (local SVG, synchronous) | |

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual | Notes |
|---|---|---|---|---|
| Tab | Keyboard | × → set headers in order | Focus ring (accent, 3 px) | No trap |
| Scroll | Touch, mouse | Scroll list | — | |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Animation | Audio |
|---|---|---|---|---|---|---|
| Tap / Enter / Space | All | Set header | Toggle set | Body shows/hides, chevron rotates | 200 ms chevron | select / deselect |
| Tap / Enter / Esc | All | × / dialog | Close | Hides | Cut | — |

### 7.3 State-Specific Behaviours

None beyond modal layering.

## 8. Data Requirements

| Data | Source | Update | Owner | Format | Null handling |
|---|---|---|---|---|---|
| Owned ids | `save.shells` | On open | shell-collection | ids | [] |
| Sets, shells, effects | config `collection.sets` | Static | shell-collection | 8 × 5 | — |
| Levels to next shell | `everyLevels − ((save.level − 1) mod everyLevels)` | On open | shell-collection | int | — |
| Set reward | config `collection.setReward` | Static | shell-collection | coins + boosters | — |

Read-only.

## 9. Events Fired

| Player action | Event | Payload | Receiver | Notes |
|---|---|---|---|---|
| Toggle / close | none | — | — | UI only; nothing persisted |

## 10. Transitions & Animations

| Transition | Trigger | Type | Duration | Easing | Interruptible? | Reduced motion |
|---|---|---|---|---|---|---|
| Enter | Shells | fade | 180 | ease-out | — | 1 ms |
| Exit | × / Esc | Cut | 0 | — | — | n/a |
| Expand / collapse | Header | Instant show/hide; chevron rotate | 200 | — | Yes | 1 ms |
| Glow pulse | Night Shore | filter alternate | 3200 loop | ease-in-out | — | Stopped; halo kept |

## 11. Input Method Completeness Checklist

Gamepad block dropped: waived (D13).

**Keyboard**
- [x] × and all headers reachable; order follows reading order
- [x] Every action has a key path
- [x] Focus visible
- [ ] Focus trap (none)
- [x] Esc closes
- [ ] Focus returns to Shells on close (it does not)

**Mouse**
- [ ] Hover states (none)
- [x] Targets ≥ 32 px wide (headers are full width, ~26 px tall)
- [x] Right-click default; wheel scrolls

**Touch**
- [ ] Targets ≥ 44 px (× 38 px; headers ~26 px tall)
- [x] No swipes; one-handed; no long-press

## 12. Accessibility

| Text | Background | Required | Current | Pass? |
|---|---|---|---|---|
| Next line (`--accent`, 13 px) | card | 4.5:1 | ~3.2 Midday, ~3.8 Dawn (computed) | **No** |
| Set name (`--ink`) | surface-2 / complete gradient `#e8f5f0`–`#cfe9e1` | 4.5:1 | not in the scene test; fixed gradient in Moonlit with light ink is unchecked | Unverified |
| Shell names (10 px) | surface-2 | 4.5:1 | not tested | Unverified |
| Set note (`--ink-soft`, 11 px) | surface-2 | 3:1 (A6) | not tested | Unverified |

| Element | Colour risk | Mitigation |
|---|---|---|
| Owned vs locked | Silhouette | Name vs "?" caption |
| Completed set | Green tint | "5/5" count + "Set complete ✓" |

**Focus order**: 1 × → 2…9 set headers (expanded bodies contain no focusable items).

| State change | Announcement | Timing |
|---|---|---|
| Header toggled | `aria-expanded` true/false | On activation |
| Locked shell | figcaption "?" (read as "question mark") | On read |

**Cognitive load**: one next-shell line + 8 headers; open sets add 5 cells each. Low.

## 13. Localization Considerations

| Text | EN length | Max | Expansion | Overflow | Risk |
|---|---|---|---|---|---|
| Shell names ("Spiral Ammonite") | ≤ 15 | ~2 lines in a 3.25 rem cell | — | Hyphenates, wraps | Medium |
| Set names | ≤ 14 | header | — | Wraps | Low |
| Next line | ≤ 32 | wraps | — | — | Low |
| Reward note | 47 | wraps | — | — | Low |

Shell and set names live in `game-config.json`, not `strings.ts`: a translation would need a config table.

## 14. Acceptance Criteria

- [ ] The cabinet opens within 200 ms with focus on ×.
- [ ] Completed sets start collapsed; incomplete sets start open; Enter/Space on a header toggles it and flips `aria-expanded`.
- [ ] With `save.level = 13`, the next line reads "Next shell: clear 3 more levels".
- [ ] With all 40 owned, every set is collapsed and the line reads the completion text.
- [ ] Locked shells show a silhouette with no glow or stone effect.
- [ ] At 320 px and 150% text, no shell name breaks mid-word without a hyphen and nothing overflows horizontally.
- [ ] Esc closes the cabinet.

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|---|---|---|---|
| Player journey map not yet created | ux-designer | Sprint 7 | Open |
| "Next shell" counts levels only, though a counted daily also grants a shell | game-designer | Q6 | Open |
| Completion line reads like a reward just paid ("+50 coins") | game-designer | Q6 | Open |
| Locked "?" captions and `h3` inside `button` for screen readers | ui-programmer | Q6 | Open |
| Focus trap, focus return, 44 px targets | ui-programmer | Q6 | Open |
| No pattern library; disclosure header is an unrecorded pattern | ux-designer | Sprint 7 | Open |
