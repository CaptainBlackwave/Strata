# UX Spec: Win Card (Level, Daily, Tutorial)

> **Status**: Implemented (spec written from the build for sprint 6 Q3; In Review)
> **Author**: ux-designer (from the build, owner-approved sprint task)
> **Last Updated**: 2026-11-08
> **Journey Phase(s)**: unknown: no player journey map
> **Screen / Flow Name**: `win` (`#win`, `showWin()`)
> **Platform Target**: Web, phone-first. Touch (primary), keyboard, mouse. Gamepad waived (D13)
> **Related GDDs**: `feel-audio-ui.md` §2.1, `economy.md` (rewards, M1 replay rule), `session-boosters.md` (Perfect), `daily-puzzle.md` §2.1 (Win card, Share), `shell-collection.md` §2.1, `player-profile.md` §3.7
> **Related ADRs**: none known
> **Related UX Specs**: `board-hud.md`, `home.md`
> **Accessibility Tier**: not named; A1–A7 apply
> **Template**: UX Spec

---

## 1. Purpose & Player Need

The player just sealed the last jar and wants the moment to land: a clear "done", what it was worth (coins, a new shell, a new cosmetic), and a one-tap way on. On a daily they also want to brag (Share) and to see the streak grow.

**Player goal**: see the result and continue (next level, or Home after a daily) in one tap.

**Game goal**: pay and explain rewards, mark Perfect clears, reveal shells and unlocks, invite Share on dailies.

## 2. Player Context on Arrival

| Question | Answer |
|---|---|
| Just doing | Final pour; 650 ms celebration (sand grains, win sound) |
| Emotional state | Relief, small pride |
| Cognitive load | Dropping to low |
| Already knows | They won |
| Trying to do | Move on; glance at the reward |
| Afraid of | Missing a reward; not knowing why replay paid nothing |

**Emotional design target**: a warm "nicely done" that never slows the next level.

## 3. Navigation Position

```
Board
  └── Win card (modal overlay, z 20)
        ├── Continue → next board (level / tutorial)
        └── Home → Home (daily)
```

**Modal behaviour**: modal (`role=dialog`, `aria-modal`). Dismissed only by its primary button (or Enter/Space anywhere). No Esc, no backdrop tap. No focus trap.

| Entry | Trigger | Notes |
|---|---|---|
| Board | Session `won`, after the last pour animation | 650 ms delay (0 with reduced motion) |

## 4. Entry & Exit Points

| Trigger | Source | Transition | Data in | Notes |
|---|---|---|---|---|
| Won | Board (level) | Fade 220 + pop 320 | moves, assists, level, best, challenge | Rewards computed and saved before the card shows |
| Won | Board (daily) | same | moves, date | `recordDailySolve` |
| Won | Board (tutorial) | same | — | `tutorialDone = true` |

| Exit | Destination | Transition | Data saved | Notes |
|---|---|---|---|---|
| Continue (level) | Level + 1 | Cut | Already saved | |
| "Start level 1" (tutorial) | Level 1 | Cut | Already saved | |
| Home (daily) | Home | Cut | Already saved | |
| Share (daily) | Native share sheet or clipboard | System sheet | none | Card stays open |

## 5. Layout Specification

### 5.1 ASCII Wireframe

```
╔══════════════════════════════╗
║(◎)        ▮ ▮ ▮              ║  small avatar (not tutorial), 3 decorative jars
║         Perfect!             ║  title
║   18 pours · new best        ║  text
║        ( (●) +35 )           ║  reward pill, counts up
║ No hint, shuffle or extra jar║  note (accent)
║ ┌──────────────────────────┐ ║
║ │(shell) New shell: Ghost  │ ║  shell row (+ set-complete line)
║ │        Scallop           │ ║
║ └──────────────────────────┘ ║
║ ┌──────────────────────────┐ ║
║ │(art) New frame: Coral    │ ║  unlock rows (0..n)
║ └──────────────────────────┘ ║
║ [          Share           ] ║  daily only
║ ╔══════════════════════════╗ ║
║ ║●        Continue         ║ ║  primary; focused on open
║ ╚══════════════════════════╝ ║
╚══════════════════════════════╝
```

### 5.2 Layout Zones

| Zone | Contents | Size | Scrollable? | Overflow |
|---|---|---|---|---|
| Card | All content, centred | max 320 px wide | Overlay scrolls at large text | Wraps |

### 5.3 Component Inventory

| Component | Type | Purpose | Required? | Reuses? |
|---|---|---|---|---|
| Small avatar | Portrait 40 px, `aria-hidden` | Identity (not tutorial) | Mode-dependent | `.portrait` |
| Title `win-title` | h2, dialog label | "Level cleared" / "Perfect!" / "Daily solved!" / "Nice pour!" | Yes | — |
| Text `win-text` | p | Pours and best, or pours and streak, or tutorial rule | Yes | — |
| Reward `win-reward` | Pill with count-up | "+N" coins | First clear / counted daily | New |
| Note `win-note` | p (accent) | Perfect, replay, pass used/earned, out-of-order | When relevant | — |
| Shell row `win-shell` | Row: art + text | New shell, set complete, or all-shells bonus | On milestone | New (reward row) |
| Unlock rows `win-unlocks` | Rows, `aria-live=polite` | New avatar / frame / plate | When a milestone unlocks one | Shell row |
| Share `btn-share` | Secondary | Share daily result | Daily | `.secondary` |
| Primary `btn-next` | Primary | Continue / Home / Start level 1 | Yes | `.primary` |

**Primary focus element on open**: the primary button.

### 5.4 Information Hierarchy

1. Title (won / Perfect).
2. Reward pill.
3. Shell and unlock rows (the long-term goals).
4. Pours/best/streak and the note.
5. Share, then the primary button.

## 6. States & Variants

| State | Trigger | Visual | Behaviour |
|---|---|---|---|
| Level first clear | `level ≥ save.level` | "Level cleared", reward pill counts up | Coins credited, best updated |
| Perfect | `assists = 0` | Title "Perfect!", note "No hint, shuffle or extra jar used" | Perfect bonus in reward; `perfectClears` +1 on first clear |
| Level replay | `level < save.level` (QA `?level=N`) | No pill; note "Already cleared: no coins this time" | Best still updated |
| Tall jars | Challenge level | As level | Challenge bonus in reward |
| Milestone shell | First clear of level `5k` | Shell row "New shell: X" | Shell granted |
| Set complete | That shell completes a set | Extra line "X set complete! +150 coins and 1 of each booster" | Coins and boosters credited |
| All shells owned | Milestone with nothing left | Row "Collection complete: +50 coins", no art | 50 coins |
| Unlocks | Milestone crosses a cosmetic threshold | One row per item (avatars, frames, plates order) | |
| Daily first solve | Counted solve | "Daily solved!", "N pours · S-day streak", pill, shell row, Share, primary "Home" | Streak, reward, shell |
| Daily pass used / earned | Streak rules | Note "A tide pass saved your streak" / "You earned a tide pass" | |
| Daily replay | Already solved today | No pill; note "Already solved today: no reward this time"; Share | No state change except pours stat |
| Daily out of order | Device date before last solve | No pill; note explains the date | |
| Tutorial | Tutorial won | No avatar, no pill; "Nice pour!", "Fill every jar with a single colour to clear a level.", "Start level 1" | `tutorialDone` saved |
| Share fallback | No `navigator.share` | Copies to clipboard; toast "Result copied" | Toast renders under the overlay |
| Share failure | Dismissed or blocked | Nothing | Silent |
| Reduced motion | System setting | No delay, no count-up, no particles | |

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual | Notes |
|---|---|---|---|---|
| Tab | Keyboard | Share ↔ primary, then out of the card into the board | Focus ring | No trap |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Animation | Audio | Notes |
|---|---|---|---|---|---|---|---|
| Tap / click | Touch, mouse | Primary | Continue / Home / Start level 1 | Card hides | Cut | — | |
| Enter / Space | Keyboard | **Any focus** | Clicks the primary | Card hides | Cut | — | Also when Share has focus |
| Tap / click | Touch, mouse | Share | Share sheet or copy | System sheet / toast | — | — | |
| Esc | Keyboard | Card | Nothing | — | — | — | |

### 7.3 State-Specific Behaviours

| State | Restriction | Reason |
|---|---|---|
| 650 ms before the card | Board input ignored | Celebration |
| Card open | Board keys (`1`–`0`, boosters) not handled | Global handler returns on win |

## 8. Data Requirements

| Data | Source | Update | Owner | Format | Null handling |
|---|---|---|---|---|---|
| Moves, assists | Session | At win | session-boosters | ints | — |
| Reward | `clearReward` / `recordDailySolve` | At win | economy / daily-puzzle | int | Pill hidden |
| Best | `save.best[level]` | At win | session-boosters | int | "new best" |
| Streak, pass used/earned, outOfOrder | `recordDailySolve` | At win | daily-puzzle | | note empty |
| Shell granted, set completed | `grantShell` | At first clear of a milestone / counted daily | shell-collection | Shell | Row hidden |
| Newly unlocked cosmetics | `newlyUnlocked(before, after)` | At win | player-profile | SlotItem[] | No rows |
| Profile portrait | `save.profile` | At win | player-profile | ids | default |

The card displays results the rules computed; `showWin()` writes the save once before showing.

## 9. Events Fired

| Player action | Event / call | Payload | Receiver | Notes |
|---|---|---|---|---|
| (on show) | `clearReward`, `earn`, `bumpStats`, `grantShell`, `recordDailySolve`, `writeSave` | level/date, moves, perfect | Economy, Daily, Collection, Profile stats, Save | Persistent state changes before the player acts |
| Continue / Start level 1 | `startLevel(n)` | n | Session | |
| Home | `showHome()` | — | UI | |
| Share | `navigator.share` / `clipboard.writeText` | text (date, difficulty, pours, streak, URL) | OS | No board spoilers |

## 10. Transitions & Animations

| Transition | Trigger | Type | Duration | Easing | Interruptible? | Reduced motion |
|---|---|---|---|---|---|---|
| Delay | Won | wait | 650 | — | No | 0 |
| Enter | Show | backdrop fade + card pop (scale .85 → 1) | 220 / 320 | ease-out / overshoot | No | 1 ms |
| Reward count-up | Show | number ticks every 55 ms, coin sound every 3 steps | ~660 | — | — | Final value at once |
| Shell / unlock art | Show | pop + rotate, 300 ms delay | 600 | overshoot | — | 1 ms after the delay |
| HUD coins bump | Count-up done | scale 1.18 | 380 | overshoot | — | 1 ms |
| Exit | Primary | Cut | 0 | — | — | n/a |

## 11. Input Method Completeness Checklist

Gamepad block dropped: waived (D13).

**Keyboard**
- [x] Share and primary reachable with Tab
- [x] Order follows reading order
- [ ] Every mouse action has a keyboard path (Share cannot be activated: Enter/Space always fire the primary)
- [x] Focus visible (primary and Share rings)
- [ ] Focus trap (none)
- [x] Esc: intentionally no-op (card must be acknowledged); undocumented in GDD

**Mouse**
- [ ] Hover states (none)
- [x] Targets ≥ 32 px
- [x] Right-click: default
- [x] Overlay scroll at large text

**Touch**
- [x] Primary ≥ 44 px; Share ~41 px
- [x] No swipes; one-handed; no long-press

## 12. Accessibility

| Text | Background | Required | Current | Pass? |
|---|---|---|---|---|
| Title (`--ink`) | card | 4.5:1 | tested | Yes |
| Text (`--ink-soft`) | card | 3:1 (A6) | tested | Yes |
| Reward `#8a5a10` on `#fff3d1` (fixed) | — | 4.5:1 | not in a test | Unverified |
| Note (`--accent`, 13 px) | card | 4.5:1 | ~3.2 Midday, ~3.8 Dawn (computed) | **No** |
| Shell row (`--ink` on `--surface-2`) | surface-2 | 4.5:1 | not in a test | Unverified |

| Element | Colour risk | Mitigation |
|---|---|---|
| Decorative jars | — | `aria-hidden` |
| Perfect | — | Title text changes |

**Focus order**: 1 Share (daily) → 2 primary. Focus starts on the primary.

| State change | Announcement | Timing |
|---|---|---|
| Card opens | Dialog name = title; focus lands on the primary | At show |
| Pours, reward, note, shell | Not referenced by the dialog (no `aria-describedby`); reachable by reading | — |
| Unlock rows | polite (container `aria-live`) | When filled (before the card is visible) |

**Cognitive load**: up to 7 items on a milestone daily (title, text, reward, note, shell, unlocks, Share). At the limit; the order follows importance.

## 13. Localization Considerations

| Text | EN length | Max | Expansion | Overflow | Risk |
|---|---|---|---|---|---|
| Titles | ≤ 13 | ~20 at 1.5 rem | 50% | Wraps | Low |
| Daily out-of-order note | 98 | wraps | — | Card grows; overlay scrolls | Low |
| Set-complete line | ~60 | wraps | — | Row grows | Low |
| "Start level 1" | 13 | ~25 | — | — | Low |
| Share text | multi-line | n/a (external) | — | — | Low |

Share text date is the ISO key; no locale formatting.

## 14. Acceptance Criteria

- [ ] The card appears 650 ms (± 50) after the final pour ends, or at once with reduced motion, with focus on the primary button.
- [ ] A first clear shows the reward pill counting up to the credited amount; a replay shows "Already cleared: no coins this time" and no pill.
- [ ] A clear with no hint, shuffle or extra jar (undo allowed) shows "Perfect!".
- [ ] The first clear of level 5 shows "New shell: {first shell}"; completing a set adds the set line.
- [ ] Clearing level 25 for the first time shows one "New avatar: Lighthouse" row.
- [ ] A daily win shows streak, Share and a "Home" primary; a second solve the same UTC day shows "Already solved today: no reward this time".
- [ ] The tutorial card shows "Nice pour!", no avatar, no pill, and "Start level 1".
- [ ] At 320 px and 150% text the card scrolls and nothing is cut off.
- [ ] With the keyboard only, the player can both Share and Continue on a daily card.

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|---|---|---|---|
| Player journey map not yet created | ux-designer | Sprint 7 | Open |
| Level card has no Home button (daily card does) | owner | Q6 | Open |
| Share is unreachable by keyboard; focus not trapped | ui-programmer | Q6 | Open |
| Share failure is silent; "Result copied" toast renders under the overlay | ui-programmer | Q6 | Open |
| Fixed colours `#8a5a10`/`#fff3d1` and accent-as-text are outside the per-scene contrast test | ui-programmer | Q5 | Open |
| No pattern library; reward row is an unrecorded pattern | ux-designer | Sprint 7 | Open |
