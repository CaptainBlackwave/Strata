---
status: implemented 2026-11-08 (owner interview 2026-11-08, decisions PP-1 to PP-10)
source: src/core/profile.ts, src/ui/avatars.ts, src/ui/main.ts, src/ui/storage.ts, src/ui/strings.ts, src/ui/style.css, src/config/game-config.json
date: 2026-11-08
verified-by: owner interview 2026-11-08
---

# Player Profile: Design Document

> **Designed, then built** (evidence: `production/qa/evidence/player-profile/`). Every rule here was agreed with the owner in the
> interview of 2026-11-08 (PP-1 to PP-10). The owner's reference screenshots, taken from
> another game, were used **only for layout and flow** (a stats grid, an edit sheet with tabs
> and a Save button). No art, characters, names or features were taken from them. The
> project's CLAUDE.md and roadmap decision R5 ("no mascots", `design/competitive-roadmap.md`) apply.

---

## 1. Overview

**Purpose**: give players an identity and a place to see how far they've come. The home screen gets a small avatar chip. Tapping it opens a Profile screen with the player's avatar, frame, name on a name plate, their level and a grid of lifetime stats. An Edit Profile sheet lets them pick an avatar, a frame and a name plate, and change their name.

**Scope**: the home chip, the Profile screen, the Edit Profile sheet, the generated names and name rules, the cosmetics catalog (8 avatars, 6 frames, 6 name plates), the milestone unlocks, five new lifetime counters, the small avatar on the win card and the unlock notice on the win card.

**Out of scope**: online identity, teams, friends or leaderboards (C11 stays deferred), buying cosmetics with coins (PP-7), and showing the name in the daily Share text.

### Owner decisions (interview 2026-11-08)

| # | Decision |
|---|---|
| PP-1 | **Entry point**: a round avatar chip with its frame at the top-left of the home screen, with the name on a small plate beside it. It opens Profile |
| PP-2 | **Profile screen**: a header card (avatar in its frame, the name on its plate, a **Level N** badge, an edit button), then a stats grid |
| PP-3 | **Stats**: core progress, perfect clears, lifetime totals and scenes (all four groups; the list is in 3.4) |
| PP-4 | **Avatars**: original **seaside objects** drawn as SVG in the house style. No characters or creatures, so roadmap R5 holds |
| PP-5 | **Names**: a friendly generated name for new players (adjective + seaside noun + 2 digits) with a re-roll button. Players may also type their own: 2–16 characters, letters, numbers and single spaces (single hyphens were added during the build, see 3.5). The name is kept on this device only |
| PP-6 | **Name art = name plates**: styled banners behind the name. Every plate has its own fixed colours, so it reads the same in all 4 scenes |
| PP-7 | **Unlocks are earned by milestones only.** Coins are not involved. Locked items show how to earn them and the player's progress |
| PP-8 | **Edit sheet**: tabs **Avatar / Frame / Name** (the name field and the plates are on Name). The preview card updates as you tap. **Save** commits. Closing with unsaved changes asks "Discard changes?" |
| PP-9 | **Reach**: the home chip, a small avatar on the win card, and an unlock notice on the win card when a milestone pays out |
| PP-10 | **Catalog size**: 8 avatars, 6 frames, 6 plates; about half are open from the start. ("Kite" was proposed as a 9th avatar and dropped) |

---

## 2. Player Fantasy

"This is *my* stall by the sea." The profile is a quiet trophy shelf: a glance shows how many levels you've cleared, how long your streak is and what you've collected. Picking a lighthouse in a driftwood frame is self-expression that you earned by playing, not by paying. It is never a nag and never a store.

---

## 3. Detailed Rules

### 3.1 Home chip

- It sits at the top-left of the home screen, inside the safe area, in its own row above the logo (so it can never overlap it). Like Shells and Scenes, it appears once the tutorial is done. The avatar is drawn in the selected frame (44 px touch target minimum), with the name on the selected plate beside it.
- The name truncates with an ellipsis if space runs out. The chip never pushes or overlaps the logo, title, coins or Play.
- It is a `button`, labelled "Profile: {name}". Enter or Space opens Profile.

### 3.2 Profile screen

- A modal dialog in the same style as the cabinet and scenes sheets, with a close button (×). Escape closes it.
- **Header card**: the avatar in its frame (large), the name on its plate, a **Level N** badge (N = the level the player is on, `save.level`) and an edit button (✎) that opens the Edit sheet.
- **Stats grid**: two columns of tiles. Each tile has a small icon, a label and a value. A value of 0 shows "0", not "–", because every stat here has a meaning at 0.
- At 150% text the grid drops to one column. Nothing overflows horizontally at 320 px.

- **Badge shelf** (sprint 11, D76): under the stats grid, the earned and not-yet-earned badges with their progress. Rules and layout: `badges.md`.

### 3.3 Edit Profile sheet

- It opens over Profile. At the top is a **preview card** (avatar in its frame, name on its plate) that shows the *draft*, not the saved profile.
- **Tabs** (`role="tablist"`, arrow keys move between tabs):
  - **Avatar**: a grid of the 8 avatars.
  - **Frame**: a grid of the 6 frames, each drawn around the draft avatar.
  - **Name**: a text field with the draft name, a 🎲 re-roll button and a grid of the 6 plates, each showing the draft name.
- **Grid items** are radio buttons (`role="radio"` in a `radiogroup`). The selected item has a check badge.
  - An unlocked item: tapping it selects it in the draft and updates the preview.
  - A locked item: it is shown dimmed with a lock. Tapping it shows its requirement and progress in a line under the grid, such as "Clear 25 levels · 12/25". It is never selected.
- **Name field**: the input is checked as you type (3.5). If it is invalid, the field shows why, such as "Use 2–16 letters or numbers", and Save is disabled. Re-roll replaces the draft name with a new generated one.
- **Save** writes the draft (avatar, frame, plate, name) to the save, closes the sheet and refreshes Profile, the home chip and any open views.
- **Closing** (× or Escape): if the draft equals the saved profile, it closes at once. Otherwise a small dialog asks "Discard changes?" with **Discard** and **Keep editing**.

### 3.4 Stats

| Stat | Value | Source | New counter? |
|---|---|---|---|
| Levels cleared | `save.level − 1` | existing | no |
| Perfect clears | first clears of a level won with `session.assists === 0`: the Perfect rule of `session-boosters.md` §2.1/§3 (M2). Undo is free and never counts (D19), and a Hint that finds nothing doesn't count | `stats.perfectClears` | **yes** |
| Daily streak | the live streak, as on the home card (`streakStatus(...).current`) | existing | no |
| Best streak | `daily.best` | existing | no |
| Dailies solved | daily solves that count (not replays, not out-of-order) | `stats.dailiesSolved` | **yes** |
| Shells | `owned / total`, total from `collection.sets` in config (40 today) | existing | no |
| Sets completed | `completed / total`, total from config (8 today) (`setProgress`) | existing | no |
| Scenes | `owned / total`, total from `themes.list` in config (4 today) | existing | no |
| Total pours | the sum of `moves` of every solved level or daily, replays included | `stats.pours` | **yes** |
| Coins earned | all coins credited by play: level rewards, daily rewards, set bonuses, the all-shells bonus | `stats.coinsEarned` | **yes** |
| Boosters used | Shuffle, Extra Jar and Hint applied (from a charge or bought with coins). Free Undo doesn't count (D25), and refunded attempts don't either | `stats.boostersUsed` | **yes** |
| Jars sealed | jars sealed on the winning board of every solved level or daily, replays included, counted at the win (`badges.md` §3.2, sprint 11) | `stats.jarsSealed` | **yes** |

- New counters start at **0** for every save, including existing players, because the past was never recorded. This is stated once in a footnote under the grid: "Some totals count from this update onwards."
- The tutorial adds nothing to any counter.
- Counters are only ever increased, never decreased.

### 3.5 Names

- **Generated name**: `{Adjective} {Noun} {NN}`, for example "Saffron Gull 42". Adjectives and nouns come from two word lists in `src/ui/strings.ts` (they are player-facing text). `NN` is 10–99. The generator takes an injected random source, so tests are deterministic.
  - Adjectives (16, at most 7 letters): Saffron, Coral, Sage, Lagoon, Plum, Sandy, Sunny, Breezy, Salty, Golden, Misty, Pebbly, Tidal, Calm, Amber, Azure.
  - Nouns (16, at most 5 letters): Gull, Tern, Dune, Wave, Tide, Cove, Reef, Kite, Sail, Jar, Shell, Pearl, Bay, Isle, Buoy, Skiff.
  - The length limits keep every combination within 16 characters. The first draft's lists ("Sea-Glass Harbour 42" = 20 characters) broke the rule; a unit test now checks every combination.
- **A new player** gets a generated name when the save is first created. Existing saves with no name get one on first load after the update.
- **Typed names**:
  - **Normalised**: leading and trailing spaces are trimmed and runs of spaces collapse to one.
  - **Valid if**: 2–16 characters after normalising, made of words of Unicode letters (with their combining marks) and numbers, joined by single spaces or hyphens: `/^[\p{L}\p{M}\p{N}]+(?:[ -][\p{L}\p{M}\p{N}]+)*$/u`. So "Ana-Maria" is valid, and "--" or "a--b" are not.
  - **Not filtered for words**: the name never leaves the device, so there is no word filter (re-check before the name is ever shared, see Follow-Up).
- The **Name tab** in the reference had a list of names to pick from. Strata does not keep a name history. The re-roll button is the "pick" path.

### 3.6 Cosmetics catalog and unlocks

All three lists live in `game-config.json` under `profile`. Ids are fixed once shipped, because saves store them. Display names live in the config next to the ids, as shell names do.

**Unlock rule** (`unlock` is `null` for start items): `{ "kind": K, "count": N }`, met when `progress[K] ≥ N`.

| Kind | Progress value |
|---|---|
| `levels` | levels cleared (`save.level − 1`) |
| `perfectClears` | `stats.perfectClears` |
| `bestStreak` | `daily.best` |
| `dailiesSolved` | `stats.dailiesSolved` |
| `shells` | shells owned |
| `sets` | sets completed |

**Avatars (8)**: original seaside objects, drawn in `src/ui/avatars.ts` as SVG on a round tinted background, in the matte sand palette.

| id | Name | Unlock |
|---|---|---|
| `sand-jar` | Sand Jar | start (default) |
| `beach-hut` | Beach Hut | start |
| `sailboat` | Sailboat | start |
| `sun-hat` | Sun Hat | start |
| `lighthouse` | Lighthouse | clear 25 levels |
| `sandcastle` | Sandcastle | clear 50 levels |
| `anchor` | Anchor | complete 1 shell set |
| `lantern` | Lantern | clear 100 levels |

**Frames (6)**: a ring drawn around the avatar.

| id | Name | Look | Unlock |
|---|---|---|---|
| `sand` | Plain Sand | flat sand-coloured ring | start (default) |
| `rope` | Rope | twisted rope ring | start |
| `sea-glass` | Sea Glass | frosted sea-glass ring | start |
| `driftwood` | Driftwood | wood-grain ring | 10 perfect clears |
| `coral` | Coral | knobbly coral ring | best streak 14 |
| `gold` | Gold | gold ring with a soft shine | all 40 shells |

**Name plates (6)**: a banner behind the name. Each has a fixed background, edge and ink colour.

| id | Name | Look | Unlock |
|---|---|---|---|
| `cream` | Cream | plain cream pill | start (default) |
| `sand-stripes` | Sand Stripes | three soft sand layers | start |
| `sea-glass` | Sea Glass | frosted aqua pill | start |
| `driftwood` | Driftwood Sign | wooden sign with nail dots | clear 75 levels |
| `wave` | Wave Ribbon | ribbon with a wave edge | 30 dailies solved |
| `gold-leaf` | Gold Leaf | gold-leaf plaque | complete 4 shell sets |

**Unlocks are derived, not stored.** Whether an item is unlocked is computed from the progress values each time. Nothing extra is saved, and existing players get everything they have already earned the moment the update loads. Items earned this way on load get no notice (3.7).

### 3.7 Win card additions

- **Small avatar**: the player's avatar in its frame, shown small at the top of the win card, in every mode except the tutorial.
- **Unlock notice**: the set of unlocked items is computed before and after the win's save changes. Each newly unlocked item gets one row in the win card (art + "New avatar: Lighthouse", "New frame: Coral", "New name plate: Wave Ribbon"), under the shell row. It never appears for an item that was already unlocked, so loading an old save shows nothing. Rows use the existing reveal animation and respect reduced motion.

### 3.8 State and Data

- **Save** (`save-data.md`) gains two fields:
  - `profile: { name: string, avatar: string, frame: string, plate: string }`
  - `stats: { perfectClears, dailiesSolved, pours, coinsEarned, boostersUsed }` (non-negative integers)
- **Load and repair** follows the save's field-by-field rule:
  - a missing or invalid name is regenerated;
  - an unknown or **locked** avatar, frame or plate falls back to that list's default (a save code from another device could name one);
  - a counter that is missing or not a non-negative integer becomes 0.
- **Config**: `profile { name: { min: 2, max: 16 }, avatars[], frames[], plates[] }`.
- **Core**: `src/core/profile.ts`, pure and DOM-free. It holds `normaliseName`, `isValidName`, `generateName(rng, words)`, `progressOf(save-like input)`, `isUnlocked(item, progress)`, `unlockedIds(config, progress)`, `newlyUnlocked(before, after)`, `repairProfile(profile, config, progress)` and the counter bump helpers.

---

## 4. Formulas

| Formula | Expression | Variables | Example |
|---|---|---|---|
| Levels cleared | `L = save.level − 1` | `save.level` ≥ 1 | On level 112 → 111 cleared |
| Unlocked | `unlock == null or progress[kind] ≥ count` | `kind`, `count` from config | Lighthouse: `levels ≥ 25`. A player on level 26 (25 cleared) has it |
| Progress line | `min(progress[kind], count) / count` | | "Clear 25 levels · 12/25" |
| Newly unlocked | `unlocked(after) − unlocked(before)` | before and after one win | Clearing level 25 adds Lighthouse |
| Total pours | `pours += session.moves` on every solved level or daily | `moves` ≥ 1 | A 31-pour daily adds 31 |
| Coins earned | `coinsEarned += c` for every play reward `c` credited | | Perfect clear 30 + set bonus 150 → +180 (level rewards are 20, 30, 50 or 60, `economy.md` §3) |
| Generated names | `16 × 16 × 90 = 23,040` combinations; length ≤ `7 + 1 + 5 + 1 + 2 = 16` | | Collisions don't matter, since names are device-local |

**Pacing of the unlocks** (rationale for the counts). Assumed play rate: a daily player clears about 3.5 levels a day (25 a week) and solves the daily every day, the same rate as `shell-collection.md` §3.
- Levels: 25 / 50 / 75 / 100 levels arrive at roughly 1, 2, 3 and 4 weeks at that rate.
- 10 perfect clears is a first-week goal.
- A best streak of 14 is two tide-pass cycles (S2-2).
- 30 dailies solved is about a month.
- 1 set (5 shells): about 25 levels for a player who skips the daily. A daily player earns about 1.7 shells a day (0.7 from levels + 1 from the daily), so a set every 3 days, or about 10 levels.
- 4 sets is the halfway point of the cabinet; all 40 shells is the long goal.

---

## 5. Edge Cases

| Situation | What happens |
|---|---|
| Storage blocked or private window | A name is generated for the session and edits work but aren't kept, the same as all other progress |
| Save code names an unknown or locked avatar, frame or plate | It falls back to that list's default on load. The name is kept if valid, otherwise regenerated |
| Typed name is all spaces, 1 character or 17+ characters | Save is disabled and the field says "Use 2–16 letters or numbers". The saved name is unchanged |
| Name with emoji or symbols | Invalid, with the same message. Letters from any script (é, ß, 日本) are valid |
| Very wide name (16 × "W") | It truncates with an ellipsis on the home chip. The Profile header wraps to two lines at most |
| Re-roll gives the current name | Allowed (1 in 23,040). No retry is needed |
| Tap a locked item | Only the requirement line shows. The selection does not change |
| Close the Edit sheet after only toggling back to the saved choice | Draft equals saved, so it closes with no prompt |
| Escape on the "Discard changes?" dialog | Means **Keep editing**: the dialog closes and the draft is kept |
| Win unlocks two items at once (level 100 + a 4th set) | Two notice rows, in config order (avatars, frames, plates) |
| A daily replay, or a solve with the device date moved back | Neither `dailiesSolved` nor `coinsEarned` changes. `pours` still counts, because it was a real solved puzzle |
| A level replay | `pours` counts. `perfectClears` and `coinsEarned` don't, because replays are not first clears and pay nothing (M1) |
| Booster bought but refunded (shuffle found nothing) | `boostersUsed` unchanged |
| Tutorial | No counter changes. No avatar or unlock rows on its win card |
| Save is imported mid-session | The chip, Profile and the counters reload from the imported save |

---

## 6. Dependencies

- **Depends on**:
  - `save-data.md` (new fields and repair)
  - `economy.md` (coin credits counted)
  - `session-boosters.md` (Perfect, boosters applied, moves)
  - `daily-puzzle.md` (streak, counted solves)
  - `shell-collection.md` (shells and sets as unlock progress)
  - `scenes.md` (scenes owned, and plates must read in every scene)
- **Depended on by**: `feel-audio-ui.md`, which presents its home chip, Profile screen, Edit sheet and win-card rows (`systems-index.md` row 9 lists system 11), and `badges.md`, whose shelf sits in the Profile sheet and reads these stats. This system does not depend on feel-audio-ui.
- **Technical**:
  - `collection.ts` (`setProgress`)
  - `daily.ts` (`streakStatus`)
  - `themes.ts` (`contrastRatio` for the plate check)
  - `storage.ts` (`SaveData`)

---

## 7. Tuning Knobs

| Knob | Where | Default | Safe range | Affects |
|---|---|---|---|---|
| `profile.name.min` / `max` | config | 2 / 16 | min 1–3, max 12–20 | Name length, and chip layout at 320 px (re-screenshot if max > 16) |
| Each item's `unlock.count` | config | see 3.6 | ≥ 1; levels within the range generation has been swept (≤ ~500, `level-generation.md` §4; levels themselves are endless); shells and sets ≤ the config totals (40, 8) | When cosmetics arrive |
| Each item's `unlock.kind` | config | see 3.6 | one of the six kinds | What the player chases |
| Plate colours (`bg`, `edge`, `ink`) | config | see art | ink vs bg contrast ≥ 4.5 : 1 | Readability, enforced by a unit test |
| Name word lists | `strings.ts` | 16 × 16 | ≥ 8 each | Variety of generated names |

---

## 8. Acceptance Criteria

**Logic** (unit tests in `tests/unit/profile/`: `profile.test.ts`, `profile-save.test.ts`, `avatar-art.test.ts`; 41 tests):
- [x] `generateName` with a fixed rng returns a stable name of the form `Adj Noun NN` that passes `isValidName`.
- [x] `isValidName` accepts "Saffron Gull 42", "Zoë", "日本"; rejects "", "a", 17 characters, "😀😀", "a_b". `normaliseName("  Sea   Gull ")` returns "Sea Gull".
- [x] `isUnlocked` is true for start items. It is false at count − 1 and true at count, for each of the six kinds.
- [x] `newlyUnlocked` returns only the difference. Clearing level 25 yields `lighthouse`, and nothing else from a fresh save.
- [x] `repairProfile` replaces unknown or locked ids with the defaults and regenerates an invalid name.
- [x] Catalog: 8 / 6 / 6 items with unique ids per list; exactly one default per list; at least 3 start items per list; every plate's ink-on-bg contrast is ≥ 4.5.
- [x] `loadSave` on an old save (no `profile`, no `stats`) gives all counters at 0, and `repairProfile` then gives a valid generated name and the defaults (the save layer stores the profile as read; the repair needs the catalog and progress, so `main.ts` runs it after every load and restore). It round-trips through `exportSave` / `importSave`.
- [x] Every avatar and frame id has SVG artwork, and every pair renders differently.

**UI** (screenshots and results in `production/qa/evidence/player-profile/README.md`, 412 px and 320 px, 100% and 150% text):
- [x] Home screen with the chip: no overlap with the logo, title, coins or Play, in at least two scenes.
- [x] Profile screen with stats; a fresh save; a long-progress save.
- [x] Edit sheet: the Avatar, Frame and Name tabs; a locked item tapped (requirement line); an invalid name (Save disabled); the "Discard changes?" prompt.
- [x] Win card with the small avatar and an unlock notice row.
- [x] Keyboard: chip → Profile → Edit → tabs by arrows → radio selection → Save, with no pointer.

**Definition of Done**:
- [x] All of the above checked, `npm test` and `npm run build` pass, evidence retained, systems index updated.

---

## Open Questions and Follow-Up Work

None open: the owner answered every interview question.

**Implementation notes** (2026-11-08):
- Enter on the home screen used to start a level whatever had focus. It now activates the focused button (profile chip, daily card, Shells, Scenes), and only plays when nothing else has focus.
- In the grids, the arrow keys select the next unlocked item (radio-group behaviour). On a locked item they move focus only.

### Flagged Follow-Up Work
- [x] Owner review of the 8 avatars, 6 frames, 6 name plates and their names: all approved as they are, no renames or redraws (2026-11-08, sprint 6 Q8).
- [ ] If the name is ever shared (daily Share text, leaderboards C11), add a word filter first.
- [ ] More cosmetics later (seasonal items, shell avatars), keeping unlocks milestone-based.

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-11-08 | Claude | Designed from the owner interview (PP-1 to PP-10) |
| 2026-11-08 | Claude | Built; word lists shortened to fit the 16-character limit; scenes count corrected to 4; chip shown after the tutorial |
| 2026-11-08 | Claude (sprint 6, F9) | Perfect clears use M2's rule `assists === 0` (GX-2, GB-PP-1); roadmap decisions cited as R4/R5 (GX-8, GB-PP-2); hyphen note on PP-5; play-rate assumption stated and the daily-player set line added (GB-PP-6); coins-earned example fixed (GB-PP-8); totals read from config (GB-PP-9); Escape on "Discard changes?" (GB-PP-10); depended on by feel-audio-ui (GX-10); unlock-count range reworded (GB-PP-7) |
| 2026-11-09 | Claude (sprint 11 A1) | Jars sealed stat and the badge shelf added under the stats (D76, `badges.md`) |
