# UX Spec: Board, HUD and In-Level Overlays

> **Status**: Implemented (spec written from the build for sprint 6 Q3; In Review)
> **Author**: ux-designer (from the build, owner-approved sprint task)
> **Last Updated**: 2026-11-08
> **Journey Phase(s)**: unknown: no player journey map
> **Screen / Flow Name**: `board` (`#app` grid: `.hud`, `.subhud`, `#board`, `.toolbar`; overlays `#toast`, `#coach`, `#intro`)
> **Platform Target**: Web, phone-first. Touch (primary), keyboard, mouse. Gamepad waived (D13)
> **Related GDDs**: `feel-audio-ui.md` §2.1 (Input, Pour animation, Layout, Tutorial), `session-boosters.md` §2.1, `jar-mechanics.md` §2.1 (Player-facing), `daily-puzzle.md` §2.1, `pour-rules.md` (via the brief), `design/game-brief.md` (stuck state)
> **Related ADRs**: none known
> **Related UX Specs**: `home.md`, `win-card.md`, `settings.md`
> **Accessibility Tier**: not named; A1–A7 apply
> **Template**: UX Spec

> Scope note: this is the core gameplay screen. It is specced with the screen template (as
> asked by the sprint plan) rather than a separate `hud.md`, because the HUD, board and
> toolbar are one fixed layout with no world behind them.

---

## 1. Purpose & Player Need

The player wants to untangle the colours: read the jars, lift one, pour, and feel each jar seal. When they go wrong they want a cheap way back (Undo), and when they are stuck they want to be told so and offered a way out. Everything else on screen should stay out of the way of the jars.

**Player goal**: clear the board by making every jar empty or one full colour.

**Game goal**: show legal and illegal pours clearly, show boosters and their cost, teach new jar types, and hand off to the win card.

## 2. Player Context on Arrival

| Question | Answer |
|---|---|
| Just doing | Tapped Play/Daily on Home, Continue on a win card, or Replay tutorial |
| Emotional state | Calm focus; mild tension late in a level |
| Cognitive load | High: tracking colours, free space, buried units, mechanics |
| Already knows | The level number; first time: nothing (tutorial) |
| Trying to do | Find the next useful pour |
| Afraid of | Making an unrecoverable mess; wasting coins; losing progress |

**Emotional design target**: tidy, tactile, unhurried; a mistake costs a tap, not a level.

## 3. Navigation Position

```
Home
  └── Board (level | daily | tutorial)
        ├── Mechanic intro card / Jar guide (modal, #intro)
        ├── Settings sheet → settings.md
        └── Win card → win-card.md
```

**Modal behaviour**: base screen. Overlays: toast (non-modal, 2.6 s), coach (non-modal, tutorial), intro card (modal: Got it / Enter / Esc).

| Entry | Trigger | Notes |
|---|---|---|
| Home Play / Daily | tap | |
| Win card Continue | tap / Enter | Next level, or level 1 after the tutorial |
| Settings → Replay tutorial | tap | Abandons the current board |
| Boot with `?level=N` | URL | QA, replay only |

## 4. Entry & Exit Points

| Trigger | Source | Transition | Data in | Notes |
|---|---|---|---|---|
| Play | Home | Cut | `save.level` | New `GameSession`; intro card if a mechanic is new |
| Daily | Home | Cut | UTC date | Label = date, tag "Daily · {difficulty}" |
| Continue | Win card | Cut | level + 1 | |
| Replay tutorial | Settings | Cut | tutorial board | Boosters and Restart disabled |

| Exit | Destination | Transition | Data saved | Notes |
|---|---|---|---|---|
| Win | Win card | 650 ms delay, fade + pop | Win rewards (see `win-card.md`) | Delay 0 under reduced motion |
| Settings button | Settings sheet | Fade + rise | none | Board stays live behind |
| Reload / close tab | — | — | Nothing about the board | Level restarts (save-data §2.1) |

## 5. Layout Specification

### 5.1 ASCII Wireframe

```
┌────────────────────────────────┐
│ STRATA [Tall jars]   (●)120 [↻][⚙] │ HUD: brand+tag, level label, coins, Restart, Settings
│ Level 12                       │
│                      14 pours  │ subhud
│                                │
│   ▯   ▯   ▯   ▯   ▯   ▯        │ board: jars wrap into ≤ 4 rows,
│   ▯   ▯   ▯   ▯   ▯   ▯        │ selected jar lifts; sealed jar gets a cork
│                                │
│        ( Tap a jar to lift it )│ coach (tutorial only)
│   ┌────────────────────────┐   │
│   │ No pours left. Undo... │   │ toast (bottom, 2.6 s)
│   └────────────────────────┘   │
│ [↶ Undo⁵][⤨ Shuffle³][+ Jar³][💡 Hint³] │ toolbar; badge = charges or coin price
└────────────────────────────────┘
```

### 5.2 Layout Zones

| Zone | Contents | Size | Scrollable? | Overflow |
|---|---|---|---|---|
| HUD | Brand (hidden < 360 px), tag, level, coins, Restart, Settings | full width, ~48 px | No | Brand text hides at ≤ 360 px |
| Subhud | Pour counter | right-aligned line | No | — |
| Board | Jars | remaining height (`1fr`) | No | `computeLayout`: jar width 26–68 px, up to 4 rows |
| Toolbar | 4 boosters | full width, ~57 px | No | Buttons shrink (max 96 px each) |
| Toast | One message | ≤ width − 32 px, bottom 96 px | No | Wraps |

### 5.3 Component Inventory

| Component | Type | Zone | Purpose | Required? | Reuses? |
|---|---|---|---|---|---|
| Level label + tag | Text | HUD | "Level N" / daily date; tag "Tall jars" or "Daily · hard" | Yes | — |
| Coins chip `coins-chip` | Display, `aria-live=polite` | HUD | Wallet; bumps after a reward | Yes | `.coins` |
| Restart `btn-restart` | Icon button 38 px, title "Restart (R)" | HUD | Back to the dealt board | Yes | `.icon-btn` |
| Settings `btn-settings` | Icon button 38 px | HUD | Open Settings | Yes | `.icon-btn` |
| Pour counter | Text | Subhud | Moves ("1 pour", "N pours") | Yes | — |
| Jar | `button`, `aria-pressed`, `aria-label` | Board | Lift / pour target | Yes | New (jar) |
| Booster tool ×4 | Button with icon, name, badge | Toolbar | Undo, Shuffle, Jar, Hint | Yes | `.tool` |
| Toast | `role=status`, polite | Overlay | One-line feedback | Yes | New (toast) |
| Coach | Ring + caption, polite | Overlay | Tutorial pointer | Tutorial | New |
| Intro card / Jar guide | Modal dialog | Overlay | Explain mechanics | When new | `.cabinet-card` |

**Primary focus element on open**: none (board). Intro card: "Got it".

### 5.4 Information Hierarchy

1. The jars and their top colours (the puzzle).
2. Selection state (which jar is lifted).
3. Toasts that explain a refusal or a stuck board.
4. Boosters and their charges/prices.
5. Level, pours, coins.

## 6. States & Variants

| State | Trigger | Visual | Behaviour | Notes |
|---|---|---|---|---|
| Playing, nothing lifted | Default | Jars at rest | Tap a non-empty, unsealed, open, non-funnel jar to lift | |
| Jar lifted | Tap a liftable jar | Jar rises by 32% of its width; `aria-pressed=true` | Next tap pours, re-lifts, or puts down (same jar) | |
| Pouring | Legal second tap | Tilt to 100°, stream, splash (~640 ms) | Taps ignored until the stream ends; the returning jar is excluded | Reduced motion: instant |
| Illegal target | Tap a jar that can't receive | Shake 300 ms + "nope" sound | Selection moves to the tapped jar if liftable, else drops | Reduced motion: shake 1 ms, no visible cue |
| Refused mechanic jar | Tap frozen / locked / funnel / narrow with nothing lifted | Shake + toast reason | | e.g. "Frozen: seal any jar to thaw it." |
| Sealed | Jar becomes full of one colour | Cork drops, shimmer, sparkles | Jar no longer liftable | |
| Thawed / Unlocked | A seal clears a mechanic | Crack/unlock effect, toast "Thawed!" / "Unlocked!" | | |
| Hint shown | Hint applied | "from" jar pulses teal, "to" jar saffron, 3 × 600 ms; cleared at 2.4 s | Charge or coins spent; counts against Perfect | Reduced motion: pulse cut to 1 ms (nothing visible) |
| Stuck | No useful pour | Toast "No pours left. Undo, shuffle or add a jar." for 2.6 s | Boosters remain | Nothing persists after the toast |
| Booster at 0 charges | Charges = 0 | Badge turns gold with the coin price | Tap spends coins at once; toast "Used N coins" | |
| Not enough coins | Price > coins | — | Toast "Needs N coins. Clear levels to earn more." | |
| Undo unavailable | Empty history | Undo disabled (45% opacity) | `Z` shows "Nothing to undo yet." | |
| No hint / no shuffle | Solver finds nothing | Toast | Wallet refunded | |
| Tutorial | Mode = tutorial | Coach ring + caption; boosters and Restart disabled | One-pour board | No explanation for disabled tools |
| Tall jars / Daily | Level spec | Tag in HUD | | |
| Intro card | First board with an unseen mechanic | Modal: "New jar!" + mini jar + rule | Got it / Enter / Esc closes | Saved as seen on show |
| Jar guide | Settings → Jar guide | Same card, kicker "Jar guide", unmet ones greyed "Unlocks at level N" | | |
| Colour patterns on | Setting | Texture per colour, lock pattern on padlocks | | A1 |
| Moonlit | Scene | Dark tokens | | |
| Loading / error | — | n/a: boards generate synchronously (worst ~196 ms) | | |

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual | Audio | Notes |
|---|---|---|---|---|---|
| Tab | Keyboard | HUD (Restart, Settings) → jars in order → boosters | Focus ring | — | |
| `1`–`9`, `0` | Keyboard | Tap jar 1–10 | As tap | As tap | Jars 11+ only by Tab + Enter |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Animation | Audio | Notes |
|---|---|---|---|---|---|---|---|
| Tap / Enter / Space | All | Jar | Lift / pour / put down | See states | Lift 160 ms; pour ~640 ms | select (pitched), pour, land, seal, nope | Vibration if on |
| `Esc` | Keyboard | Board | Put down the lifted jar | Jar drops | 160 ms | — | |
| Tap / `Z` | All | Undo | Undo last pour | Jars redraw | — | booster | Costs a charge or 40 coins |
| Tap / `S` | All | Shuffle | Re-deal free jars | Jars hop (25 ms stagger) | 260 ms | shuffle | Charge or 80 coins; refunded if none found |
| Tap / `J` | All | Jar | Add an empty jar | Board rebuilds | — | booster | Charge or 120 coins; no per-level cap (D5) |
| Tap / `H` | All | Hint | Show next move | Pulse on 2 jars | 1.8 s | booster | Charge or 60 coins |
| Tap / `R` | All | Restart | Back to the dealt board | Jars redraw | — | — | No confirm; history cleared |
| Tap | All | Settings | Open Settings | Sheet rises | 240 ms | — | |
| Tap / Enter / Esc | All | Intro "Got it" | Close card | Card hides | — | — | |

### 7.3 State-Specific Behaviours

| State | Input restriction | Reason |
|---|---|---|
| Pouring (`busy`) | Jar taps, boosters and Restart ignored; the returning jar ignores taps | Animation integrity |
| Won (650 ms before card) | All board input ignored | Hand-off to win card |
| Tutorial | Boosters, `Z S J H R` and Restart disabled | One-pour lesson |
| Any sheet/dialog open | Board keys not handled | Dialog handlers run first |

## 8. Data Requirements

| Data | Source | Update | Owner | Format | Null handling |
|---|---|---|---|---|---|
| Board (jars, units, hidden, mechanics) | `GameSession.board` | On each session event | session-boosters / pour-rules | `Board` | — |
| Pours | `session.moves` | On pour/undo/restart | session-boosters | int | 0 |
| Coins, charges | `save.wallet` | After booster use, after reward count-up | economy | ints | 0 |
| Booster prices | config `boosters` | Static | economy | ints | — |
| Status (playing/won/stuck) | `session.status` | After pour, shuffle, jar | session-boosters | enum | — |
| Hint move | `session.hint()` | On Hint | session-boosters | `{from,to}` or null | Toast "No way forward…" |
| Seen mechanics | `save.seenMechanics` | On board start | jar-mechanics | ids | [] |
| Patterns setting | `save.settings.patterns` | On toggle | feel-audio-ui | bool | false |

## 9. Events Fired

| Player action | Event / call | Payload | Receiver | Notes |
|---|---|---|---|---|
| Pour | `session.pour(from,to)` → `pour`, then `won`/`stuck` | move, moved, colour, sealed | Session → UI | |
| Undo / Shuffle / Jar / Hint | `spendBooster` then `session.undo/shuffle/addExtraJar/hint` | booster id | Economy, Session | Wallet restored if not applied; `stats.boostersUsed` +1 if applied; save written |
| Restart | `session.restart()` | — | Session | Assists kept |
| Intro shown | `save.seenMechanics` += ids; `writeSave` | ids | Save | Written on show, not on dismiss |

## 10. Transitions & Animations

| Transition | Trigger | Type | Duration (ms) | Easing | Interruptible? | Reduced motion |
|---|---|---|---|---|---|---|
| Board enter | New session | Cut | 0 | — | — | n/a |
| Lift | Tap | translateY | 160 | cubic-bezier(.3,.7,.4,1) | Yes | 1 ms |
| Pour | Legal tap | lift 210, stream 90, flow 230, stream out 90, return 220 | ~840 | custom | Next pour allowed during return | Skipped: instant |
| Seal | Seal | shimmer 700, cork drop, sparkles | ~700 | — | — | Sparkles off; cork appears |
| Hint pulse | Hint | box-shadow pulse ×3 | 1800 | ease-in-out | Next hint replaces | **Nothing visible** (see review) |
| Toast | Any toast | fade + 12 px rise | 200 in, shows 2600 | — | Replaced by next toast | 1 ms |
| Intro card | Show | fade | 180 | ease-out | — | 1 ms |

## 11. Input Method Completeness Checklist

Gamepad block dropped: waived (D13).

**Keyboard**
- [x] All interactive elements reachable with Tab
- [x] Tab order follows reading order
- [x] Every pointer action has a key (`1`–`0`, `Z S J H R`, Esc)
- [x] Focus visible on jars, tools, icon buttons
- [ ] Focus trap in the intro card (none)
- [x] Esc deselects on the board; closes the intro card

**Mouse**
- [ ] Hover states (none)
- [x] Hit targets ≥ 32 px (jar ≥ 26 px wide but tall; icon buttons 38 px)
- [x] Right-click: browser default
- [x] No scroll zones

**Touch**
- [ ] All targets ≥ 44 px (Restart and Settings are 38 px; narrowest jars 26 px wide)
- [x] No custom swipes
- [x] One-handed portrait (toolbar at the bottom)
- [x] No long-press

## 12. Accessibility

| Text | Background | Required | Current | Pass? |
|---|---|---|---|---|
| Level, pours (`--ink`) | bg | 4.5:1 | tested ≥ 4.5 | Yes |
| Tool names (`--ink` on `--card`) | card | 4.5:1 | tested | Yes |
| Badge (accent-ink on accent) | accent | 3:1 (A6) | tested ≥ 3 | Yes (11 px text; below AA 4.5 for small text) |
| Toast | toast bg | 4.5:1 | tested ≥ 4.5 | Yes |
| Intro kicker (`--accent` text) | card | 4.5:1 | ~3.2 Midday (computed) | **No** |

| Element | Colour risk | Mitigation |
|---|---|---|
| Sand colours | All CVD types | Colour patterns toggle (14 textures); screen-reader colour names |
| Padlock colour | Matching lock to key colour | Pattern on padlock in patterns mode; label "locked until {colour} is sealed" |
| Buried units | Grey | "?" glyph |
| Hint from vs to | Teal vs saffron only | **None** |
| Booster price vs charges | Gold vs teal badge | Coin dot before price |

**Focus order**: 1 Restart → 2 Settings → 3…n jars (DOM order = visual order, row by row) → Undo → Shuffle → Jar → Hint.

| State change | Announcement | Timing |
|---|---|---|
| Jar contents/state | Jar label "Jar 3: coral, sage, buried (frozen)" | On focus |
| Lifted | `aria-pressed=true` | On focus / re-read |
| Toast (refusal, stuck, thaw, coins used) | toast text, polite | On show |
| Coach caption | polite | On change |
| Coins change | number, polite | After count-up |
| Pour result, seal, hint | none | — |

**Cognitive load**: jars (up to 14 × up to 8 units), selection, 4 booster counts, pours, coins: above 7±2 at high levels by nature of the puzzle. Mitigations: buried units shown as "?", mechanics introduced one at a time every 20 levels, intro cards, jar guide.

## 13. Localization Considerations

| Text | EN length | Max | Expansion | Overflow | Risk |
|---|---|---|---|---|---|
| Tool names (Undo, Shuffle, Jar, Hint) | 3–7 | ~9 at 320 px | 30% | Wrap breaks the tool | **High** |
| Tag "Daily · tricky" | 14 | ~16 | 15% | `nowrap`, pushes HUD | **High** |
| Level label "Sun, Nov 8" | 10 | ~14 | 40% | — | Medium |
| Toasts (longest ~62 chars) | 62 | ~90 (wraps) | 45% | Wraps | Low |
| Coach caption | 29 | `nowrap` | — | Can exceed 320 px | **High** |
| Mechanic rules (intro) | ≤ 98 | wraps | — | Card scrolls | Low |

Colour names in jar labels are palette ids (English).

## 14. Acceptance Criteria

- [ ] A new board is interactive within 300 ms of Play on a mid-range phone (generation ≤ 200 ms).
- [ ] Tapping a liftable jar lifts it and sets `aria-pressed=true`; tapping it again puts it down.
- [ ] A legal pour moves `min(run, free space)` units and increments the pour counter; an illegal target shakes and plays "nope".
- [ ] Tapping a frozen, locked, funnel or narrow jar with nothing lifted shows its one-line reason toast.
- [ ] With 0 charges, a booster badge shows its coin price; tapping it with too few coins shows "Needs N coins…" and changes nothing.
- [ ] A stuck board shows "No pours left. Undo, shuffle or add a jar."
- [ ] `1`–`9`/`0`, `Z`, `S`, `J`, `H`, `R`, Esc work as in 7.2 with no pointer.
- [ ] With reduced motion on, pours complete instantly and the win card appears with no delay.
- [ ] At 320 px with 14 jars and 150% text, nothing overflows horizontally, in all 4 scenes.
- [ ] Every jar's accessible name lists its contents and mechanic state.
- [ ] First board with an unseen mechanic shows the intro card with focus on "Got it"; Enter closes it.

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|---|---|---|---|
| Player journey map not yet created | ux-designer | Sprint 7 | Open |
| Stuck state: the brief says the game "offers Undo, Restart or the extra jar"; the build shows a 2.6 s toast that omits Restart | owner | Q6 | Open |
| `strings.ts` `noJars` ("Only one extra jar per level.") and the brief's "one extra-jar rescue per level" contradict D5 (no cap); unreachable in code | game-designer | Q6 | Doc gap |
| `feel-audio-ui.md` says 12 colour patterns; build and A1 have 14 | game-designer | Q6 | Doc gap |
| Hint under reduced motion has no visible state; from/to differ by colour only | ui-programmer | Q6 | Open |
| Focus trap for intro card; hover states; 44 px targets for Restart/Settings | ui-programmer | Q6 | Open |
| No pattern library; jar, toast, coach, booster tool are unrecorded patterns | ux-designer | Sprint 7 | Open |
