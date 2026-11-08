# UX Spec: Home Screen

> **Status**: Implemented (spec written from the build for sprint 6 Q3; In Review)
> **Author**: ux-designer (from the build, owner-approved sprint task)
> **Last Updated**: 2026-11-08
> **Journey Phase(s)**: unknown: no player journey map (`design/player-journey.md` absent)
> **Screen / Flow Name**: `home` (`#home`, `showHome()` in `src/ui/main.ts`)
> **Platform Target**: Web, phone-first. Touch (primary), keyboard, mouse. Gamepad waived (D13)
> **Related GDDs**: `design/gdd/feel-audio-ui.md` §2.1 (Screens, Input), `player-profile.md` §3.1, `daily-puzzle.md` §2.1 (Home card), `shell-collection.md` §2.1 (Cabinet entry), `scenes.md` §2.1 (Picker entry)
> **Related ADRs**: none known
> **Related UX Specs**: `board-hud.md`, `profile.md`, `shell-cabinet.md`, `scenes.md`, `settings.md`, `win-card.md`
> **Accessibility Tier**: not named in `design/accessibility-requirements.md`; requirements A1–A7 apply
> **Template**: UX Spec

---

## 1. Purpose & Player Need

The player has a few minutes and wants to get straight back to sorting sand, or to do today's puzzle before the streak lapses. Home is the calm doorway: one big Play, today's daily at a glance, and the two collections (shells, scenes) for when they want to look rather than play.

**Player goal**: start the next level (or today's daily) in one tap.

**Game goal**: show progress (level on Play, coins, streak, shells) and invite the daily habit.

## 2. Player Context on Arrival

| Question | Answer |
|---|---|
| What was the player just doing? | Launching the game; finishing a daily (win card → Home); Settings → Home from a board; restoring a save code |
| Emotional state | Calm, unhurried |
| Cognitive load | Low |
| Information they already have | Roughly where they are; maybe their streak |
| Most likely trying to do | Play the next level, or the daily |
| Afraid of | Losing the streak; not knowing whether today's daily is done |

**Emotional design target**: "My stall is open; one tap and I'm sorting."

## 3. Navigation Position

```
Boot
  └── Home  (root; full-screen overlay, z-index 22, covers the HUD and board)
        ├── Board (Play / Daily)          → board-hud.md
        ├── Profile (chip)                → profile.md
        ├── Shell cabinet (Shells)        → shell-cabinet.md
        └── Scenes sheet (Scenes)         → scenes.md
```

**Modal behaviour**: root screen. Not dismissable; it is left by choosing a destination. The board is built behind it at boot (`startLevel(level)` then `showHome()`).

| Entry point | Triggered by | Notes |
|---|---|---|
| Boot | Page load without `?level=N` | `?level=N` skips Home (QA only) |
| Daily win card | Home button (`btn-next` in daily mode) | |
| Settings | Home button | Abandons the board in play (see `settings.md`) |
| Save code restore | Successful second tap on Restore | |

## 4. Entry & Exit Points

| Trigger | Source | Transition | Data passed in | Notes |
|---|---|---|---|---|
| Page load | Boot | None (instant) | Save | |
| Home on daily win card | Win card | Card hides, Home shows (instant) | Updated save | |
| Home in Settings | Settings sheet | Sheet hides, Home shows | Save | Board session stays in memory but is discarded by the next Play |
| Restore | Save code sheet | Sheet hides, Home shows | Imported save | A "Progress restored" toast fires but sits under Home (z 10 < 22) |

| Exit action | Destination | Transition | Data saved | Notes |
|---|---|---|---|---|
| Play | Tutorial (first launch) or level `save.level` | Instant | none | Regenerates the level; Enter/Space also plays when no other home button has focus |
| Daily card | Today's daily board | Instant | none | Allowed after a solve (replay pays nothing) |
| Profile chip | Profile dialog over Home | Fade 180 ms | none | |
| Shells | Shell cabinet over Home | Fade 180 ms | none | |
| Scenes | Scenes sheet over Home | Fade 180 ms + rise 240 ms | none | |

There is no route from Home to Settings.

## 5. Layout Specification

### 5.1 ASCII Wireframe

```
┌────────────────────────────────┐
│ [(◎) Saffron Gull 42 ]         │  home-top: profile chip (after tutorial)
│                                │
│          ▮  ▮▮  ▮              │  logo jars (decorative)
│           STRATA               │  h1
│  Sort the sand. Seal the jars. │  tagline
│           (●) 120              │  coins
│ ╔════════════════════════════╗ │
│ ║ ● Play · Level 12          ║ │  primary, breathing
│ ╚════════════════════════════╝ │
│ ┌────────────────────────────┐ │
│ │[SUN]  Daily puzzle         │ │  daily card (after tutorial)
│ │[ 8 ]  Today: hard          │ │
│ │       3-day streak · 1 pass│ │
│ └────────────────────────────┘ │
│ [ (shell) Shells 7/40 ][ ◐ Scenes ] │ (after tutorial)
└────────────────────────────────┘
```

### 5.2 Layout Zones

| Zone | Contents | Size | Scrollable? | Overflow |
|---|---|---|---|---|
| Top row | Profile chip | full width, min 48 px tall | No | Name truncates with ellipsis (chip max 18 rem) |
| Centre column | Logo, title, tagline, coins, Play, daily card, Shells/Scenes row | max 340 px wide, centred | Yes (whole Home scrolls at large text) | Shells/Scenes row stays 2-up |

### 5.3 Component Inventory

| Component | Type | Zone | Purpose | Required? | Reuses? |
|---|---|---|---|---|---|
| Profile chip `btn-profile` | Button (portrait + plate) | Top | Open Profile; label "Profile: {name}" | After tutorial | New (chip) |
| Logo jars | Decorative | Centre | Brand | No | — |
| Title / tagline | Text | Centre | Brand | Yes | — |
| Coins | Display | Centre | Wallet | Yes | `.coins` (also HUD, Scenes) |
| Play `btn-play` | Primary button | Centre | "Play" (tutorial) or "Play · Level N" | Yes | `.primary` |
| Daily card `btn-daily` | Card button | Centre | Day, date, difficulty, solved state, streak/passes | After tutorial | New (daily card) |
| Shells `btn-shells` | Secondary button | Centre | "Shells n/40" + last shell icon | After tutorial | `.secondary` |
| Scenes `btn-scenes` | Secondary button | Centre | Open Scenes | After tutorial | `.secondary` |

**Primary focus element on open**: none is set; focus stays where it was (often `body`). Enter/Space on `body` plays.

### 5.4 Information Hierarchy

1. Play and its level number (the main job).
2. Daily card: today's difficulty and whether it is done (habit, streak risk).
3. Coins (context for Scenes and boosters).
4. Profile chip, Shells, Scenes (browse, not urgent).

## 6. States & Variants

| State | Trigger | Visual | Behaviour | Notes |
|---|---|---|---|---|
| First launch | `tutorialDone = false` | Only logo, title, tagline, coins, "Play" | Play starts the tutorial | Chip, daily, Shells, Scenes hidden (progressive disclosure) |
| Populated | Tutorial done | All components; Play reads "Play · Level N" | | |
| Daily new | Not solved today | "Today: {difficulty}" | Daily pays on first solve | |
| Daily solved | Solved today (UTC) | "Solved today ✓", accent border | Daily replay pays nothing | Not colour-only: text changes |
| Streak none | `current = 0` | "Start a streak today" | | |
| Streak live | `current > 0` | "N-day streak[ · P tide passes]" | | |
| Pass at risk | `gap == 2` and a pass held | "A tide pass will save your streak" | | |
| Shells none | 0 owned | Silhouette icon, "Shells 0/40" | | |
| Moonlit scene | Theme = moonlit | Dark tokens; moon at top-right | | |
| Large text | 150% text | Home scrolls vertically | | Verified sprint 5 |
| Loading / error | — | n/a: all data is local and synchronous | Blocked storage = fresh save | No loading state needed |

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual response | Audio | Notes |
|---|---|---|---|---|---|
| Tab / Shift+Tab | Keyboard | Chip → Play → Daily → Shells → Scenes | 3 px blue focus ring | — | Native order |
| Scroll / swipe | Touch, mouse | Scroll Home at large text | — | — | |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Animation | Audio | Notes |
|---|---|---|---|---|---|---|---|
| Tap / click / Enter / Space | All | Play | Start tutorial or level | Home hides | None | Audio unlocked | |
| Enter / Space | Keyboard | Focus on `body` or Play | Play | as above | | | Global handler |
| Tap / Enter / Space | All | Daily card | Start daily | Home hides | None | | |
| Tap / Enter / Space | All | Chip / Shells / Scenes | Open dialog | Overlay fades in | 180 ms | — | Native activation |

### 7.3 State-Specific Behaviours

| State | Input restriction | Reason |
|---|---|---|
| A dialog is open over Home | Global Enter/Space-plays is skipped (dialog handlers run first) | Prevents playing from under a dialog |

## 8. Data Requirements

| Data | Source system | Update frequency | Owner | Format | Null handling |
|---|---|---|---|---|---|
| Level | Save (`save.level`) | On each `showHome()` | level-generation / save-data | int ≥ 1 | Repaired to 1 |
| Coins | Economy wallet | On `showHome()` and after Scenes purchase | economy | int ≥ 0 | 0 |
| Today, weekday, difficulty | `utcDateKey`, `daily.week` | On `showHome()` | daily-puzzle | date key, name | — |
| Streak status | `streakStatus(save.daily, today)` | On `showHome()` | daily-puzzle | `{current, solvedToday, passAtRisk}` | "Start a streak today" |
| Passes | `save.daily.passes` | On `showHome()` | daily-puzzle | int 0–2 | omitted at 0 |
| Shells owned / total, last shell | `save.shells`, `allShells` | On `showHome()` | shell-collection | ids | silhouette of first shell |
| Profile name, avatar, frame, plate | `save.profile` (repaired) | On `showHome()`, after Edit Save | player-profile | strings | Repaired at load |
| Tutorial done | `save.tutorialDone` | On `showHome()` | feel-audio-ui | bool | false |

Home writes nothing.

## 9. Events Fired

| Player action | Event | Payload | Receiver | Notes |
|---|---|---|---|---|
| Play | `play()` → `startTutorial()` / `startLevel(save.level)` | level | Session | No analytics (offline game) |
| Daily card | `startDaily()` | UTC date key | Daily / Session | |
| Chip / Shells / Scenes | open dialog | none | UI only | |

## 10. Transitions & Animations

| Transition | Trigger | Type | Duration | Easing | Interruptible? | Reduced motion |
|---|---|---|---|---|---|---|
| Home enter | `showHome()` | Cut | 0 | — | — | n/a |
| Home exit | Play / Daily | Cut | 0 | — | — | n/a |
| Play "breathe" | Always | Scale 1 → 1.03 | 2400 loop | ease-in-out | — | Reduced to one 1 ms cycle (static) |

## 11. Input Method Completeness Checklist

Gamepad block dropped: waived (D13).

**Keyboard**
- [x] All interactive elements reachable with Tab
- [x] Tab order follows reading order
- [x] Every mouse action has a keyboard path
- [x] Focus visible (3 px `--focus` ring on chip, Play, daily, Shells, Scenes)
- [ ] Initial focus on arrival defined (none set; see Open Questions)
- [x] Esc: no-op on Home (root screen; nothing to close)

**Mouse**
- [ ] Hover states (none defined)
- [x] Hit targets ≥ 32 px
- [x] Right-click: browser default
- [x] Scroll wheel scrolls Home at large text

**Touch**
- [x] Targets ≥ 44 px (chip 48, Play ~56, daily ~70, Shells/Scenes ~41–44 px: see review)
- [x] No custom swipes
- [x] One-handed portrait
- [x] No long-press

## 12. Accessibility

| Text | Background | Required | Current | Pass? |
|---|---|---|---|---|
| Title, coins, daily title (`--ink`) | Home bg / card | 4.5:1 | ≥ 4.5 (unit-tested per scene) | Yes |
| Tagline, daily sub (`--ink-soft`) | bg / card | 3:1 (A6 soft text) | ≥ 3 (tested) | Yes |
| Streak line (`#c8553d`, 13 px bold) | card | 4.5:1 | ~4.2 Midday, ~3.3 Moonlit (computed) | **No** |
| Play label (`--accent-ink` on `--accent`) | accent | 3:1 (A6 buttons) | ≥ 3 (tested) | Yes |

| Element | Colour risk | Mitigation |
|---|---|---|
| Daily solved border | Accent only | Text "Solved today ✓" |
| Logo jars | Decorative | `aria-hidden` |

**Focus order**: 1 Profile chip → 2 Play → 3 Daily card → 4 Shells → 5 Scenes. First launch: Play only.

| State change | Announcement | Timing |
|---|---|---|
| Home shown | none | — |
| Coins value | "120" (no unit; icon is `aria-hidden`) | On read |

**Cognitive load**: 5 streams (level, coins, daily status, streak, shells). Within 7±2; first launch shows only 2.

## 13. Localization Considerations

| Text | EN length | Max chars | Expansion | Overflow | Risk |
|---|---|---|---|---|---|
| "Play · Level 123" | 16 | ~24 at 320 px | 50% | Wraps inside button | Low |
| Tagline | 29 | ~40 | 40% | Wraps | Low |
| Streak "12-day streak · 2 tide passes" | 29 | ~34 at 320 px | 15% | Wraps in card | **High** |
| "A tide pass will save your streak" | 33 | ~34 | 3% | Wraps | **High** |
| "Shells 40/40" | 12 | ~14 (half width) | 15% | Wraps | Medium |

Weekday uses `toLocaleDateString('en')`: hard-coded English locale. No RTL support.

## 14. Acceptance Criteria

- [ ] Home is visible within 500 ms of page load on a mid-range phone.
- [ ] On a fresh save only the logo, title, tagline, coins and a "Play" button show; Play starts the tutorial.
- [ ] After the tutorial, the chip, daily card, Shells and Scenes appear, and Play reads "Play · Level N" with N = `save.level`.
- [ ] After solving today's daily, the card reads "Solved today ✓" and has an accent border.
- [ ] With a 1-day gap and a pass held, the card reads "A tide pass will save your streak".
- [ ] At 320 px and 150% text, no horizontal scroll, no overlap of chip and logo, all content reachable by vertical scroll, in all 4 scenes.
- [ ] Tab reaches chip, Play, daily, Shells, Scenes in that order with a visible ring; Enter on the chip opens Profile (does not play).
- [ ] Enter with nothing focused starts Play.
- [ ] All text on Home meets A6 in all 4 scenes.

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|---|---|---|---|
| Player journey map not yet created. Author it from `.claude/docs/templates/player-journey.md` | ux-designer | Sprint 7 | Open |
| No Settings entry on Home: colour patterns, sound and Save code are only reachable from a board (UX-home-1) | owner | Q6 | Open |
| No initial focus on Home; no hover states (checklist items unticked) | ui-programmer | Q6 | Open |
| `feel-audio-ui.md` lists Home without the profile chip | game-designer | Q6 | Doc gap |
| No pattern library (`design/ux/interaction-patterns.md`); daily card and chip are unrecorded patterns | ux-designer | Sprint 7 | Open |
