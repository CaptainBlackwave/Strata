# UX Spec: Scenes Sheet

> **Status**: Implemented (spec written from the build for sprint 6 Q3; In Review)
> **Author**: ux-designer (from the build, owner-approved sprint task)
> **Last Updated**: 2026-11-08
> **Journey Phase(s)**: unknown: no player journey map
> **Screen / Flow Name**: `scenes` (`#scenes`, `openScenes()`, `renderScenes()`, `confirmScene()`, `closeScenes()`)
> **Platform Target**: Web, phone-first. Touch (primary), keyboard, mouse. Gamepad waived (D13)
> **Related GDDs**: `scenes.md` §2.1 (Picker, Which scene is shown), §4, §6; `economy.md` (coins)
> **Related ADRs**: none known
> **Related UX Specs**: `home.md`, `settings.md`
> **Accessibility Tier**: not named; A1–A7 apply
> **Template**: UX Spec

---

## 1. Purpose & Player Need

The player has saved some coins and wants their stall to feel different: a pink dawn, a warm sunset, a starry night. They want to try a look before paying for it, and maybe let the game follow their clock.

**Player goal**: preview a scene, then buy or use it (or switch on "Match my clock").

**Game goal**: give coins a long-term use with a risk-free preview.

## 2. Player Context on Arrival

| Question | Answer |
|---|---|
| Just doing | On Home (Scenes button) or on a board (Settings → Scenes) |
| Emotional state | Relaxed, browsing |
| Cognitive load | Low |
| Already knows | Their coin balance (Home) |
| Trying to do | See what each scene looks like; buy one |
| Afraid of | Spending coins on something they don't like; losing the preview |

**Emotional design target**: window-shopping with no pressure.

## 3. Navigation Position

```
Home ──┐
       ├── Scenes sheet (bottom sheet, z 25)
Board → Settings ──┘
```

**Modal behaviour**: modal bottom sheet. Close button or Esc closes and drops any preview. No backdrop tap. No focus trap. The theme clock re-check (every 60 s) is paused while it is open.

| Entry | Trigger | Notes |
|---|---|---|
| Home Scenes | Tap | After the tutorial |
| Settings Scenes | Tap | Settings closes first; closing Scenes returns to the board, not Settings |

## 4. Entry & Exit Points

| Trigger | Source | Transition | Data in | Notes |
|---|---|---|---|---|
| Scenes | Home | fade 180 + rise 240 | themes, wallet | No initial focus set |
| Scenes | Settings | as above | as above | Focus was on the now-hidden Settings button |

| Exit | Destination | Transition | Data saved | Notes |
|---|---|---|---|---|
| Close / Esc | Previous screen (Home or board) | Cut | none | Unconfirmed preview reverted |
| (Buy / Use do not close) | — | — | — | — |

## 5. Layout Specification

### 5.1 ASCII Wireframe

```
╔════════════════════════════════╗
║ Scenes                (●) 420  ║ title + coins
║ ┌─────────────┐┌─────────────┐ ║
║ │ [swatch ▮▮▮]││ [swatch ▮▮▮]│ ║ 2 × 2 grid of scene cards
║ │ Midday      ││ Dawn        │ ║ selected (previewing) = accent border
║ │ In use      ││ (●) 300     │ ║ status: In use / Owned / price
║ └─────────────┘└─────────────┘ ║
║ ┌─────────────┐┌─────────────┐ ║
║ │ Sunset      ││ Moonlit tide│ ║
║ │ (●) 500     ││ (●) 800     │ ║
║ └─────────────┘└─────────────┘ ║
║ ╔════════════════════════════╗ ║
║ ║      Buy Dawn · 300        ║ ║ hidden when the previewed scene is in use
║ ╚════════════════════════════╝ ║ "Use X" if owned; "Needs N coins (you have M)" disabled
║ Match my clock          [  ○] ║ switch
║ Dawn 5–9 · Midday 9–17 · ...   ║ note
║ [           Close            ] ║
╚════════════════════════════════╝
```

### 5.2 Layout Zones

| Zone | Contents | Size | Scrollable? | Overflow |
|---|---|---|---|---|
| Head | Title, coins | full | No | — |
| Grid | 4 scene cards | 2 columns | Sheet scrolls (max 100%) | Names wrap |
| Action | Buy/Use button | full | — | Label wraps |
| Clock | Switch + note | full | — | Wraps |
| Footer | Close | full | — | — |

### 5.3 Component Inventory

| Component | Type | Purpose | Required? | Reuses? |
|---|---|---|---|---|
| Coins | Display | Wallet | Yes | `.coins` |
| Scene card ×4 | `button`, `aria-pressed` (= previewing) | Preview a scene | Yes | New (swatch card) |
| Buy/Use `btn-scene-buy` | Primary | Confirm: buy (if unowned) and use | Yes | `.primary` |
| Match my clock `set-auto` | Checkbox switch in a label | Follow the local hour | Yes | `.toggle` (Settings) |
| Clock note | p | Hour ranges | Yes | `.cabinet-next` |
| Close | Secondary | Close, revert preview | Yes | `.secondary` |

**Primary focus element on open**: none set (see review).

### 5.4 Information Hierarchy

1. The live preview (the whole page behind the sheet re-themes).
2. Cards: which scene, owned or price.
3. The Buy/Use button and its price or shortfall.
4. Match my clock.

## 6. States & Variants

| State | Trigger | Visual | Behaviour |
|---|---|---|---|
| Open | Open | Current scene's card pressed; button hidden (in use) | |
| Previewing owned | Tap an owned card | Page re-themes; button "Use {name}" | |
| Previewing unowned, affordable | Tap; coins ≥ price | "Buy {name} · {price}" | |
| Previewing unowned, unaffordable | coins < price | Disabled "Needs {price} coins (you have {coins})" | |
| Bought | Buy | Coins drop; status "In use"; toast "{name} unlocked!"; coin sound | Clock matching turned off |
| Used | Use | Status "In use"; button hidden | Clock matching turned off |
| Clock on | Switch on | Scene follows the hour among owned scenes | Preview reset to the clock's scene |
| Clock turned off by Use/Buy | Confirm with the switch on | **Switch still shows on** until the sheet is reopened | State saved as off |
| Closed with an unconfirmed preview | Close / Esc | Real scene restored | |
| Moonlit | Scene | Dark mode; stars | |
| Loading / error | — | n/a; a failed buy (not affordable) does nothing (button disabled) | |

## 7. Interaction Map

### 7.1 Navigation Inputs

| Input | Platform | Action | Visual | Notes |
|---|---|---|---|---|
| Tab | Keyboard | Cards (4) → Buy/Use → switch → Close | Focus ring | No trap; no initial focus |

### 7.2 Action Inputs

| Input | Platform | Context | Action | Response | Animation | Audio |
|---|---|---|---|---|---|---|
| Tap / Enter / Space | All | Card | Preview | Page re-themes; card pressed | instant | select |
| Tap / Enter / Space | All | Buy/Use | Buy and/or use | Status, coins, toast | — | coin (buy) |
| Tap / Space | All | Switch | Toggle clock mode | Page re-themes | 160 ms knob | — |
| Tap / Esc | All | Close | Close, revert preview | Sheet hides | Cut | — |

### 7.3 State-Specific Behaviours

| State | Restriction | Reason |
|---|---|---|
| Unaffordable preview | Button disabled | No partial spend |
| Sheet open | Clock re-check paused | Keep the preview stable |

## 8. Data Requirements

| Data | Source | Update | Owner | Format | Null handling |
|---|---|---|---|---|---|
| Scenes (name, price, hours, tokens) | config `themes.list` | Static | scenes | 4 entries | — |
| Owned, selected, auto | `save.themes` | On open; after buy/use/toggle | scenes | ids, bool | Midday always owned |
| Active scene | `activeTheme(themes, hour)` | On render | scenes | id | Midday |
| Coins | wallet | On render | economy | int | 0 |
| Preview id | UI-local | On card tap | **UI (transient)** | id | null on close |

## 9. Events Fired

| Player action | Event / call | Payload | Receiver | Notes |
|---|---|---|---|---|
| Buy | `buyTheme(wallet, owned, id)` → `writeSave` | id, price | Economy, Scenes, Save | Persistent coin spend |
| Use | `save.themes.selected = id; auto = false` → `writeSave` | id | Scenes, Save | |
| Toggle clock | `save.themes.auto` → `writeSave` | bool | Scenes, Save | |
| Preview / close | `applyTheme` | id | UI only | |

## 10. Transitions & Animations

| Transition | Trigger | Type | Duration | Easing | Interruptible? | Reduced motion |
|---|---|---|---|---|---|---|
| Enter | Open | backdrop fade + sheet rise (40% → 0) | 180 / 240 | ease-out / overshoot | — | 1 ms |
| Exit | Close | Cut | 0 | — | — | n/a |
| Preview | Card tap | Token swap (instant) | 0 | — | Yes | n/a |

## 11. Input Method Completeness Checklist

Gamepad block dropped: waived (D13).

**Keyboard**
- [x] All elements reachable; order follows reading order
- [x] Every action has a key path
- [x] Focus visible (cards, button, switch)
- [ ] Initial focus on open (none)
- [ ] Focus trap (none)
- [x] Esc closes (and reverts preview)

**Mouse**
- [ ] Hover states (none)
- [x] Targets ≥ 32 px; right-click default; wheel scrolls

**Touch**
- [x] Cards, Buy, switch row ≥ 44 px; Close ~41 px
- [x] No swipes; one-handed; no long-press

## 12. Accessibility

| Text | Background | Required | Current | Pass? |
|---|---|---|---|---|
| Scene name (`--ink`) | surface-2 | 4.5:1 | not in the scene test | Unverified |
| Status (`--ink-soft`, 12 px) | surface-2 | 3:1 (A6) | not tested | Unverified |
| Clock note (`--accent`, 13 px) | card | 4.5:1 | ~3.2 Midday (computed) | **No** |
| Buy label | accent | 3:1 (A6) | tested | Yes |

| Element | Colour risk | Mitigation |
|---|---|---|
| Previewing card (accent border) | Colour | `aria-pressed`; the page itself changes |
| Swatches | Decorative | Name is text |
| Switch on/off (accent vs grey + knob position) | Colour | Knob position; native checkbox state |

**Focus order**: 1–4 scene cards (Midday, Dawn, Sunset, Moonlit) → 5 Buy/Use (if shown) → 6 Match my clock → 7 Close.

| State change | Announcement | Timing |
|---|---|---|
| Preview | card "pressed" | On activation |
| Bought | toast "{name} unlocked!" (polite) | On buy; toast is visually under the sheet |
| Price on a card | "300" (no "coins") | On read |

**Cognitive load**: 4 cards, coins, one button, one switch: low.

## 13. Localization Considerations

| Text | EN length | Max | Expansion | Overflow | Risk |
|---|---|---|---|---|---|
| "Needs 800 coins (you have 420)" | 30 | ~34 at 320 px | 15% | Wraps in button | Medium |
| "Buy Moonlit tide · 800" | 22 | ~34 | 50% | Wraps | Low |
| Clock note | 81 | wraps | — | — | Low |
| Scene names (config) | ≤ 12 | half-width card | — | Wraps | Medium |

Hour ranges are hard-coded in the string, not formatted from config.

## 14. Acceptance Criteria

- [ ] The sheet opens within 200 ms with the current scene's card pressed and the button hidden.
- [ ] Tapping an unowned card re-themes the whole page; closing without buying restores the previous scene.
- [ ] With fewer coins than the price, the button reads "Needs N coins (you have M)" and is disabled.
- [ ] Buying deducts the price once, marks the card "In use" and survives a reload.
- [ ] Using a scene with Match my clock on turns the mode off and the switch shows off at once.
- [ ] With Match my clock on at 21:00 and Moonlit owned, the Moonlit scene shows.
- [ ] Keyboard: Tab reaches all cards, the button, the switch and Close; Esc closes.
- [ ] At 320 px and 150% text the sheet scrolls and nothing overflows horizontally in all 4 scenes.

## 15. Open Questions

| Question | Owner | Deadline | Resolution |
|---|---|---|---|
| Player journey map not yet created | ux-designer | Sprint 7 | Open |
| Clock switch does not re-sync after Use/Buy | ui-programmer | Q6 | Open |
| No initial focus; no focus trap; Settings → Scenes returns to the board, not Settings | ui-programmer | Q6 | Open |
| "Scene unlocked!" toast is drawn under the sheet | ui-programmer | Q6 | Open |
| `scenePreviewing` string exists but is unused; should the sheet say "Previewing X"? | owner | Q6 | Open |
| Buy is one tap (up to 800 coins); preview-first is the safeguard. Confirm intended | owner | Q6 | Open |
| No pattern library; swatch card is an unrecorded pattern | ux-designer | Sprint 7 | Open |
