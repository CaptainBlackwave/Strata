---
status: designed and built 2026-11-09 (sprint 11 A1, A2; owner decision D76)
source: src/core/badges.ts, src/core/win.ts, src/ui/storage.ts, src/ui/screens/sheets/badges.ts, src/ui/badge-art.ts, src/ui/strings.ts, src/config/game-config.json
date: 2026-11-09
verified-by: owner plan approval 2026-11-09 (sprint 11)
---

# Badges: Design Document

> **Sprint 11 A1** (`production/sprints/sprint-11.md`), from owner decision **D76** in
> `systems-index.md`: "a badge shelf with no rewards: about 20–30 earned badges shown on the
> profile; recognition only, the economy untouched". Every badge name, rule and drawing here is
> original and seaside-themed. Nothing is taken from another game.

---

## 1. Overview

**Purpose**: a quiet record of what the player has done. Badges are earned only by playing and
show on a **badge shelf** in the Profile sheet. They pay nothing: no coins, no boosters, no
cosmetics, no shells (D76). The economy (`economy.md`) does not read them.

**Scope**: a catalogue of **28 badges** in five families (play, mastery, collection, exploration,
daily), one new lifetime counter (`jarsSealed`), one new save list (`scenesPlayed`), the saved list
of earned badges, the back-fill of old saves, the badge row on the win card, a quiet toast for a
badge earned away from the win card, and the shelf. A sixth family, **weekly**, is reserved here
for the weekly set (sprint 11 W1/W2, D77) and is not built by this task.

**Out of scope**: rewards of any kind, badge-gated content, sharing badges, online lists (C11),
and the weekly set itself.

---

## 2. Player Fantasy

"I can see what I've done here." A row of small round seaside medallions, most still dim, a few
in colour. Tapping nothing, reading everything: each dim one says what it wants and how close you
are ("34/100 jars"). Earning one is a small smile on the win card, never a fanfare and never a
nag.

---

## 3. Detailed Rules

### 3.1 The catalogue

Badges live in `src/config/game-config.json` under `badges.list`, in shelf order. Each entry has an
`id` (kebab-case, stable forever), a `family`, a `name` key into `t.badges` in `src/ui/strings.ts`
(which holds the player-facing name and description), and a `rule`. There are two rule shapes:

- `{ "kind": "count", "of": <stat>, "count": N }`: earned when `progress[stat] >= N`.
- `{ "kind": "everyOwnedScene", "min": N }`: earned when the player owns at least `N` scenes and
  has won in **every** scene they own.

| # | id | Family | Name | Description (requirement) | Rule | Stat it reads |
|---|----|--------|------|---------------------------|------|---------------|
| 1 | `first-seal` | play | First Seal | Seal your first jar | count, `jarsSealed` ≥ 1 | `stats.jarsSealed` (new) |
| 2 | `jars-100` | play | Jar Stacker | Seal 100 jars | count, `jarsSealed` ≥ 100 | `stats.jarsSealed` (new) |
| 3 | `jars-1000` | play | Jar Harbour | Seal 1,000 jars | count, `jarsSealed` ≥ 1000 | `stats.jarsSealed` (new) |
| 4 | `levels-10` | play | Paddler | Clear 10 levels | count, `levels` ≥ 10 | `save.level − 1` |
| 5 | `levels-50` | play | Rock Pooler | Clear 50 levels | count, `levels` ≥ 50 | `save.level − 1` |
| 6 | `levels-100` | play | Harbour Hand | Clear 100 levels | count, `levels` ≥ 100 | `save.level − 1` |
| 7 | `levels-250` | play | Old Salt | Clear 250 levels | count, `levels` ≥ 250 | `save.level − 1` |
| 8 | `pours-1000` | play | Steady Hand | Make 1,000 pours | count, `pours` ≥ 1000 | `stats.pours` |
| 9 | `pours-10000` | play | Sand River | Make 10,000 pours | count, `pours` ≥ 10000 | `stats.pours` |
| 10 | `perfect-1` | mastery | Smooth Sand | Clear a level Perfect | count, `perfectClears` ≥ 1 | `stats.perfectClears` |
| 11 | `perfect-25` | mastery | Still Water | Get 25 perfect clears | count, `perfectClears` ≥ 25 | `stats.perfectClears` |
| 12 | `perfect-100` | mastery | Glass Calm | Get 100 perfect clears | count, `perfectClears` ≥ 100 | `stats.perfectClears` |
| 13 | `tall-perfect-1` | mastery | Tall Order | Perfect a tall-jar level | count, `tallPerfect` ≥ 1 | `save.perfect` filtered to tall-jar levels |
| 14 | `tall-perfect-10` | mastery | High Tide | Perfect 10 tall-jar levels | count, `tallPerfect` ≥ 10 | `save.perfect` filtered to tall-jar levels |
| 15 | `shells-1` | collection | Beachcomber | Find your first shell | count, `shells` ≥ 1 | `save.shells.length` |
| 16 | `shells-20` | collection | Full Pockets | Collect 20 shells | count, `shells` ≥ 20 | `save.shells.length` |
| 17 | `sets-1` | collection | Matched Set | Complete a shell set | count, `sets` ≥ 1 | `setProgress(save.shells)` |
| 18 | `sets-8` | collection | Cabinet Complete | Complete all 8 shell sets | count, `sets` ≥ 8 | `setProgress(save.shells)` |
| 19 | `scenes-4` | collection | Change of Sky | Own 4 scenes | count, `scenesOwned` ≥ 4 | `save.themes.owned` (with free scenes) |
| 20 | `scenes-8` | collection | Painted Skies | Own 8 scenes | count, `scenesOwned` ≥ 8 | `save.themes.owned` (with free scenes) |
| 21 | `mechanics-1` | exploration | Narrow Escape | Meet your first special jar | count, `mechanicsSeen` ≥ 1 | `save.seenMechanics`, or `save.level` past a debut |
| 22 | `mechanics-4` | exploration | Odd Jars Out | Meet all four special jars | count, `mechanicsSeen` ≥ 4 | `save.seenMechanics`, or `save.level` past a debut |
| 23 | `scenes-played-2` | exploration | Day Tripper | Win in 2 different scenes | count, `scenesPlayed` ≥ 2 | `save.scenesPlayed` (new) |
| 24 | `every-shore` | exploration | Every Shore | Win in every scene you own (own 4 or more) | everyOwnedScene, min 4 | `save.scenesPlayed` (new), `save.themes.owned` |
| 25 | `daily-1` | daily | Morning Dip | Solve a daily puzzle | count, `dailiesSolved` ≥ 1 | `stats.dailiesSolved` |
| 26 | `daily-30` | daily | Tide Table | Solve 30 daily puzzles | count, `dailiesSolved` ≥ 30 | `stats.dailiesSolved` |
| 27 | `streak-7` | daily | Seven Tides | Reach a 7-day daily streak | count, `bestStreak` ≥ 7 | `daily.best` |
| 28 | `streak-30` | daily | Full Moon | Reach a 30-day daily streak | count, `bestStreak` ≥ 30 | `daily.best` |

Per family: play 9, mastery 5, collection 6, exploration 4, daily 4.

### 3.2 Counting rules

Existing stats are used wherever they say the right thing. Two new records are needed:

- **`stats.jarsSealed`** (new lifetime counter, in `Stats` beside the five of `player-profile.md`
  §3.4). It is counted **at the win**, not at each seal: a solved level or daily adds the number of
  jars sealed on the winning board. Counting at the win means Undo and Restart can't farm it (a jar
  sealed, undone and sealed again counts once), and it stays a pure rule of `applyWin`. Replays
  count, like `pours`, because they are real solved puzzles. The tutorial adds nothing. It shows on
  the Profile stats grid as "Jars sealed" with the "counted from this update" mark.
- **`save.scenesPlayed`** (new list of scene ids, each once, in the order first won in). A level or
  daily win, replays included, adds the scene that was active when it was won (`currentTheme()`:
  the picked scene, or the clock's scene in Match my clock). The tutorial adds nothing.

Derived values (nothing stored):

- **`levels`** = `save.level − 1`, as for unlocks.
- **`tallPerfect`** = the levels in `save.perfect` that are tall-jar levels (`levelSpec(n).challenge`,
  every 10th level today). `save.perfect` exists from the M3 update on, so it is honest history.
  The daily's tall-jar Sunday is not a numbered level and does not count.
- **`scenesOwned`** = scenes in `themes.list` that `isOwned` (free scenes included), as in the stats grid.
- **`ownedScenesPlayed`** = owned scenes that are in `scenesPlayed`.
- **`mechanicsSeen`** = special jars (config `mechanics.list`) that are in `save.seenMechanics`
  (their intro card was shown, from a level or a daily) **or** whose debut level the player has
  passed (`save.level > unlockAt`), the same "known" rule as the Jar guide. The second half
  back-fills players who passed a debut before intro cards existed.
- `shells`, `sets`, `perfectClears`, `pours`, `dailiesSolved`, `bestStreak` as in `player-profile.md`.

### 3.3 Earning and the saved list

- `save.badges` is the list of earned ids, **in the order earned**. An id is added once and never
  removed. Within one award, new ids are added in catalogue order.
- A badge is earned when its rule is met and it isn't in `save.badges` yet. Once earned it stays,
  even if its rule stops being true (buying a ninth scene does not take away Every Shore).
- `earnedBadges(progress)` lists the ids whose rules are met now, in catalogue order.
  `newlyEarned(before, after)` lists the ids met in `after` that are not in `before` (the saved
  list), in catalogue order.

### 3.4 Award points

Rules are checked wherever their stats change:

| Where | What changes | How it shows |
|---|---|---|
| A level or daily win (`applyWin`) | levels, jars sealed, pours, Perfect, tall Perfect, shells, sets, dailies, streak, scenes played, and any special jar met at the start of that level | A row on the win card |
| Buying a scene (Scenes sheet) | scenes owned | A quiet toast, joined to the "scene bought" toast |
| Load: start-up, a save code import, another tab's newer save | anything | Nothing: awarded quietly (3.5) |

- **Seals** are counted at the win (3.2), so a seal badge appears on that win's card.
- **Special jars** are met when their intro card shows at a level's start. The badge appears on the
  card of the next win, normally that same level. If the game is reloaded first, it is awarded
  quietly at load.

### 3.5 Back-fill of old saves

On every load (start-up, import, other-tab reload), after the save is repaired, every badge whose
rule is already met is added to `save.badges`, **quietly**: no row, no toast, no sound. A returning
player opens the shelf and finds what they had already done. Badges reading the new records
(`jarsSealed`, `scenesPlayed`) start from this update, like the other new counters.

### 3.6 Win card

- Under the shell row and the cosmetic unlock rows, **one** row for all badges this win earned:
  "New badge: First Seal", or "New badges: First Seal, Paddler" for several. The row's art is the
  first badge's medallion.
- The row is part of the card's description (`aria-describedby`), so a screen reader hears it with
  the result. It uses the unlock sound once (shared with cosmetic unlocks) and the existing reveal,
  which respects reduced motion.

### 3.7 Toast away from the win card

A badge earned outside a win (a scene purchase) shows in the polite status toast:
"Scene bought: Dawn · New badge: Change of Sky". The toast is a `role="status"` live region, so it
is read out. No sound beyond the purchase's own.

### 3.8 The shelf

- In the Profile sheet, under the stats grid: a heading **Badges** and a count "3 of 28 earned".
- A grid of tiles in catalogue order. Each tile: the medallion (CSS/SVG), the name, the description.
  - **Earned**: the medallion in its family colour.
  - **Not yet**: the medallion dimmed (greyscale, lower opacity), with a progress line such as
    "34/100 jars" (the value capped at the target). Screen readers hear "not earned yet" with it.
- Two columns where they fit; one column at 150% text; nothing overflows at 320 px.
- Weekly badges (3.9), once W2 awards them, are listed after the catalogue, earned ones only.

### 3.9 Reserved: the weekly family

- Id pattern **`weekly-YYYY-Www`**, the ISO 8601 week-numbering year and week (`W01`–`W53`) of the
  Monday (UTC) the set opened, e.g. `weekly-2026-W46`. Family `weekly`.
- Rule shape (built in W2): `{ "kind": "weeklySet", "week": "YYYY-Www" }`, earned when all five
  boards of that week's set are cleared (D77). There is one weekly badge per week; they are not in
  `badges.list` (they are generated, not listed).
- This task reserves the pattern: `isWeeklyBadgeId` and `weeklyBadgeId(year, week)` in
  `src/core/badges.ts`, and save repair keeps any well-formed weekly id (a week from 01 to 53).
  **Built in W2** (`weekly-set.md` §3.5): the fifth distinct board cleared in a week adds the id once,
  first on that win card's badge row. A weekly win also counts its sealed jars and its scene (§3.2).

### 3.10 State and data

- **Save** gains `badges: string[]`, `scenesPlayed: string[]` and `stats.jarsSealed`.
- **Repair**, field by field: `badges` keeps strings that are a catalogue id or a well-formed
  weekly id, each once, in their saved order; anything else is dropped. `scenesPlayed` keeps known
  scene ids, each once. `jarsSealed` that is missing or not a non-negative integer becomes 0.
- A save code carries all three, and `importSave` repairs them like a load.
- **Config**: `badges { list[] }` with `id`, `family`, `name`, `rule`.
- **Core**: `src/core/badges.ts`, pure and DOM-free: `badgeProgressOf`, `isEarned`,
  `badgeProgress`, `earnedBadges`, `newlyEarned`, `awardBadges`, `repairBadges`, and the weekly id
  helpers.

---

## 4. Formulas

| Formula | Expression | Example |
|---|---|---|
| Count rule | `progress[of] >= count` | `jarsSealed` 99 → not earned; 100 → earned |
| Every owned scene | `scenesOwned >= min and ownedScenesPlayed == scenesOwned` | Own 5, won in 4 of them → no; won in all 5 → yes |
| Progress line | `min(have, need) / need`; for every-shore `have = ownedScenesPlayed`, `need = max(min, scenesOwned)` | "34/100 jars"; own 2, played both → "2/4 scenes" |
| Jars sealed per win | sealed jars on the winning board; on a won board that is one per colour | A 5-colour level adds 5 |
| Tall Perfect | `count(n in save.perfect where levelSpec(n).challenge)` | Perfect on levels 10, 13, 20 → 2 |
| Newly earned | `earned(after) − saved` | Clearing level 10 from a fresh save adds `levels-10` |

**Pacing** (the daily player of `player-profile.md` §4: about 25 levels and 7 dailies a week).
A level seals 3–8 jars, so `jars-100` arrives in the first week and `jars-1000` after about two
months. `levels-10/50/100/250` land at about half a week, 2 weeks, 4 weeks and 10 weeks. A level
takes 15–40 pours, so `pours-1000` is about week two, `pours-10000` a few months. `daily-30` and
`streak-30` are a month of daily play; `streak-7` the first week. The scene badges follow the
scene prices (`scenes.md`): 4 scenes is the four time-of-day scenes, 8 is a long goal.

---

## 5. Edge Cases

| Situation | What happens |
|---|---|
| Several badges in one win | One combined row: "New badges: A, B, C" in catalogue order |
| A badge earned with a cosmetic unlock and a shell | Shell row, then unlock rows, then the badge row; the unlock sound plays once |
| Old save loads | Badges already met are added quietly, once. Loading again adds nothing |
| Save code names an unknown badge id, or one twice | Dropped, and duplicates removed, on import |
| Save code holds a badge whose rule isn't met (an edited code) | Kept: the shelf is a record and pays nothing, so there is nothing to protect |
| A badge is removed from the config later | Its id is dropped at the next load |
| A threshold is raised later | Badges already earned stay earned |
| Rule stops being true (a new scene breaks Every Shore) | The badge stays |
| Undo a seal and seal again | Counted once, at the win |
| Daily replay or out-of-order solve | `jarsSealed`, `pours` and `scenesPlayed` count (a real solve); `dailiesSolved` and the streak don't |
| Level replay | `jarsSealed`, `pours`, `scenesPlayed` count; a replay's first Perfect counts for `tallPerfect` (D52) |
| Tutorial | No counter or list changes; no badge row |
| Scene changes by the clock mid-level | The scene active when the level is won counts |
| A special jar met at a level's start, then the game is closed | Awarded quietly at the next load |
| Storage blocked | Badges are earned for the session only, like all progress |
| Any badge earned | Wallet, boosters, shells and cosmetics are unchanged (tested) |
| 150% text at 320 px | The shelf is one column, names and progress wrap, no horizontal scroll |

---

## 6. Dependencies

- **Depends on**: `player-profile.md` (the Profile sheet and its stats), `save-data.md` (fields and
  repair), `session-boosters.md` (Perfect), `level-map.md` (the per-level Perfect list, D52),
  `level-generation.md` (tall-jar levels), `jar-mechanics.md` (the special jars and intro cards),
  `shell-collection.md` (shells and sets), `scenes.md` (scenes owned and active),
  `daily-puzzle.md` (dailies solved, best streak).
- **Depended on by**: `daily-puzzle.md` W1/W2 (the weekly set awards `weekly-YYYY-Www` badges),
  `feel-audio-ui.md` (presents the shelf, the win row and the toast).
- **Does not touch**: `economy.md`. No badge credits or debits anything (D76).

---

## 7. Tuning Knobs

| Knob | Where | Default | Safe range | Affects |
|---|---|---|---|---|
| Each badge's `rule.count` | config | 3.1 | ≥ 1; `shells` ≤ 40, `sets` ≤ 8, `scenesOwned` ≤ 16, `mechanicsSeen` ≤ 4 (the config totals; a unit test checks) | When a badge arrives |
| `every-shore` `rule.min` | config | 4 | 2 to the scene count | How many scenes Every Shore needs |
| Order of `badges.list` | config | by family | any | Shelf order and the order within one award |
| Names and descriptions | `strings.ts` `t.badges` | 3.1 | short: a name of at most 18 characters, so tiles stay tidy at 320 px | Shelf text |

---

## 8. Acceptance Criteria

**Logic** (unit tests in `tests/unit/badges/`, written first and seen failing):
- [x] Every badge in the catalogue: not earned at count − 1, earned at count (every-shore: owning `min` with one unplayed scene → no; all played → yes; fewer than `min` owned → no).
- [x] `newlyEarned` returns only ids not already saved, in catalogue order; `awardBadges` appends them after the saved ones.
- [x] Back-fill: an old save (no `badges`, no `scenesPlayed`, no `jarsSealed`) on level 60 with shells and a streak gets exactly the badges its existing stats meet, and a second pass adds nothing.
- [x] `applyWin` counts `jarsSealed` and `scenesPlayed` (not in the tutorial) and lists the new badges on the card; the wallet after a badge-earning win equals the wallet with an empty badge catalogue.
- [x] Save repair drops unknown ids and duplicates, keeps the saved order and well-formed weekly ids; `scenesPlayed` keeps known scenes; the save code round-trips all three.
- [x] Catalogue: 20–30 badges, unique ids, every family used, every name key in `t.badges`, no reward fields, counts within the config totals.

**UI** (screenshots in `production/qa/evidence/sprint-11/badges/`):
- [x] The shelf on a fresh save (none earned), part-earned, and at 150% text on 320 px.
- [x] A badge earned on the win card.

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-11-09 | Claude (sprint 11 A1) | Designed from D76: 28 badges in five families, the weekly family reserved, `jarsSealed` and `scenesPlayed` added, back-fill at load |
| 2026-11-09 | Claude (sprint 11 A2) | Built; tests in `tests/unit/badges/` (4 files, 66 tests); medallion rank dots capped at 4; evidence in `production/qa/evidence/sprint-11/badges/` |

## Event badges (sprint 17)

An event's prize badge (`event-<id>`, e.g. `event-wintertide`) is granted by the event on the clear that finishes all its boards (`events.md` §3.4), once and kept for good. Like weekly badges it is not earned by a catalogue rule, and like every badge it pays nothing (D76).
