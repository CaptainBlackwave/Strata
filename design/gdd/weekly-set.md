---
status: designed 2026-11-09 (sprint 11 W1; owner decision D77), built in sprint 11 W2
source: src/core/weekly.ts, src/core/win.ts, src/ui/storage.ts, src/ui/screens/home.ts, src/ui/screens/sheets/weekly.ts, src/ui/screens/board.ts, src/ui/screens/win.ts, src/ui/strings.ts, src/config/game-config.json
date: 2026-11-09
verified-by: owner plan approval 2026-11-09 (sprint 11)
---

# Weekly Set: Design Document

> **Sprint 11 W1** (`production/sprints/sprint-11.md`), from owner decision **D77** in
> `systems-index.md`: "every Monday (UTC), five themed seeded boards, the same for everyone,
> playable all week; clearing all five earns a weekly badge; Share shows the pours". Theme names
> and rules here are original. Nothing is taken from another game.

---

## 1. Overview

**Purpose**: a second shared challenge with a slower rhythm than the daily. Every Monday at 00:00
UTC a new **set of five boards** opens. The boards are the same for every player, share one
**theme** (a featured jar mechanic, or deeper buried sand), rise gently in size, and stay
playable until the next Monday. Clearing all five earns that week's badge on the badge shelf
(`badges.md` §3.9). Share posts the pours of each board.

**Scope**: the ISO week key, the seeds, the theme rotation, the five recipes, progress and what
counts as cleared, the week boundary, what a weekly board pays (nothing: §3.7), the Home card, the
chooser, the win card, Share, and the save field.

**How it differs from the daily** (`daily-puzzle.md`):

| | Daily | Weekly set |
|---|---|---|
| Opens | 00:00 UTC every day | 00:00 UTC every Monday |
| Boards | 1 | 5, played in any order |
| Difficulty | a weekday rhythm (easy Monday … tall-jar Sunday) | a gentle ramp across the five, one theme for all five |
| Streak | yes, with tide passes | none: a week stands alone |
| Pays | streak coins and a shell | nothing; the reward is the week's badge |
| Share | one pour count and the streak | the pours of each of the five boards |

**Out of scope**: an archive of past weeks, leaderboards or any online comparison (C11), a
`?weekly=` share link (sprint 11 O3 owns links), coins for weekly boards (§3.7).

---

## 2. Player Fantasy

A small weekend project. On Monday the player sees "Lock and Key · 0 of 5" under the daily, plays
the first board over coffee, and comes back across the week to finish the set. The theme makes the
five boards feel like one outing rather than five random deals. Finishing the fifth board puts a
new medallion on the shelf and gives a tidy line of numbers to send to a friend who is playing the
same five boards.

---

## 3. Detailed Rules

### 3.1 The week key

- A week is an **ISO 8601 week of the UTC calendar**: it starts Monday 00:00:00.000 UTC and ends
  Sunday 23:59:59.999 UTC.
- Its key is **`YYYY-Www`**: the ISO week-numbering year and the two-digit week, `W01` to `W53`
  (`weekKey(date)`). The ISO year can differ from the calendar year at its edges: Monday
  2025-12-29 is in `2026-W01`, and Friday 2027-01-01 is in `2026-W53` (2026 has 53 ISO weeks).
- Keys of the same shape sort in time order as plain strings, so "earlier week" is a string
  comparison.
- The week follows the **same app clock as the daily** (`state.clock`, TD-16), so moving the
  device clock moves the week, as it moves the daily (there is no server time).

### 3.2 Seeds

- Each of the five boards has its own seed: **FNV-1a of the text `YYYY-Www#n`** (n = 1 to 5),
  with the offset basis `2166136261 XOR weekly.seedSalt` (salt **5309**), the same hash shape as
  the daily (`daily-puzzle.md` §3) but a different key text and a different salt, so a weekly
  board never repeats a daily board's seed (`weeklySeeds(week)`; tested for 2 years of weeks).
- The board is then generated like the daily: solver-proven, with the shared fallback chain
  (§3.4), so the same week and board number give every player the same board.

### 3.3 The theme of the week

- `weekly.themes` lists five themes, rotating one per week: **Narrow Necks** (narrow jar), **Cold
  Snap** (frozen jar), **Lock and Key** (locked jar), **Funnel Week** (funnel jar) and **Deep
  Sand** (no special jar; every board buries one more layer, up to `weekly.maxBuried` = 2).
- The theme is `themes[weekIndex mod 5]`, where `weekIndex` counts whole weeks since Monday
  1969-12-29 (§4). Week `2026-W46` (from Monday 9 November 2026) is Lock and Key.
- A mechanic theme puts its jar on **all five boards**. As with the daily's Saturday (D2), the
  set is the same for everyone and is not gated by progress: a player who has not reached the
  mechanic yet gets its intro card before the board (`jar-mechanics.md`).
- Five themes against the daily Saturday's four-mechanic rotation means the two rarely feature the
  same mechanic in the same week, and never for long.

### 3.4 The five boards: a gentle ramp

The boards **borrow the daily's Monday-to-Friday recipes** (`daily.week`), so they are sizes
players already know, and each is held to a **pour band** of `generator.pourBands` through its
`bandLevel` (the generator's length cap is `maxPoursFor(bandLevel)`, D36):

| Board | Borrows | Colours | Capacity | Spare | Buried | `bandLevel` | Pour cap |
|---|---|---|---|---|---|---|---|
| 1 | Monday (easy) | 5 | 4 | 2 | 0 | 1 | 45 |
| 2 | Tuesday (easy) | 6 | 4 | 2 | 0 | 21 | 58 |
| 3 | Wednesday (medium) | 7 | 4 | 2 | 1 | 21 | 58 |
| 4 | Thursday (medium) | 8 | 4 | 2 | 1 | 41 | 70 |
| 5 | Friday (tricky) | 9 | 4 | 2 | 2 | 41 | 70 |

Plus the theme's mechanic (or, for Deep Sand, one more buried layer, capped at 2). No tall jars:
the set stays a light week-long project, and the daily's Sunday already carries tall jars.

Measured on 40 weeks of every theme (200 boards a theme, sprint 11 W1): solver medians rise
about 20, 24, 29, 33, 37 pours from board 1 to 5, the longest board was 58 pours, no board needed
the fallback chain, and the slowest board took 21 ms to generate in Node.

**Never fails to load**: the daily's chain (`dailySteps`): the full recipe, then the same recipe
without its mechanic (capped by `generator.stepNodeBudget`), then the shared last resort
(`lastResort`: one more spare, then a board winnable by construction). The returned spec says
what was built, so a board whose mechanic was dropped shows no intro card.

**Where it runs**: on the main thread, synchronously, exactly as the daily does
(`startDaily` calls `generateDaily` directly; only numbered levels are prefetched in the worker,
P4). The measured cost (above) is well inside the per-step solver budgets the daily already uses.

### 3.5 Playing, out of order, and what counts as cleared

- The **weekly card** on Home (under the daily) opens a **chooser** listing the five boards. Any
  board can be played at any time during its week, in any order, as often as the player likes.
- A board is **cleared** when it is won once during its week. Boosters are allowed and do not
  matter (there is no Perfect on weekly boards), and Restart and Undo work as everywhere else.
- Each board keeps its **best pours** for the week: the first clear records its pours, and a
  later win of the same board lowers it if it used fewer. A replay changes nothing else.
- The set is **complete** when all five are cleared. The first time that happens, the week's
  badge `weekly-YYYY-Www` (`weeklyBadgeId`, `badges.md` §3.9) is added to the shelf and shown on
  the win card. Replays after that change only best pours.

### 3.6 The week boundary

- **A new week resets the set.** When Home (or a win) sees a week later than the saved one, the
  saved progress is replaced by an empty set for the new week. Unfinished boards of the old week
  simply lapse: no badge, no penalty, nothing carried over.
- **A board started before Monday 00:00 UTC and won after it** counts for the week it was started
  in, like the daily (`startWeekly` fixes the week). If that was the saved week, the clear counts
  and can still complete last week's set and earn its badge.
- **A board whose week is older than the saved week** (the clock was moved back, or another tab
  already moved on): the win is ignored for the set: nothing is recorded, and the win card says the
  board's week is over (D10's "don't punish, don't count").
- **The clock moved back into an earlier week**: Home shows that earlier week's set as not
  started, and its wins are ignored as above; the saved, later week is not overwritten. Moving the
  clock forward again shows the saved progress.

### 3.7 What a weekly board pays: nothing

- A weekly win pays **no coins, no shell and no Perfect bonus**. The reward is the week's badge,
  which is recognition only (D76), and Share.
- Why: the sprint plan keeps the economy untouched ("Out of scope: the late-game economy (D23)").
  Paying the daily's rule would mean either a streak (the weekly has none) or a flat clear reward;
  five more paying boards a week would add income the economy was not tuned for
  (`economy.md`). Paying nothing keeps every economy number valid.
- Boosters cost what they cost in a level (a charge, or coins), so the economy's sinks are
  unchanged.
- A weekly win still counts what every win counts for the profile and badges: its pours and
  sealed jars in the lifetime stats, and the scene it was won in (`badges.md` §3.2). It does not
  count as a level or a daily solve.

### 3.8 Home card, chooser and win card

- **Home card** (`#btn-weekly`, after the tutorial, like the daily card): "Weekly set", the theme
  ("Lock and Key"), the progress ("2 of 5 cleared", or "Set complete ✓"), and how long is left
  ("4 days left", "Last day"). Its accessible name is that whole text.
- **Chooser** (a dialog over Home): the heading "Weekly set", "Week 46 · Lock and Key", the
  progress, then five buttons, one per board: "Board 2", and "Cleared · best 31 pours" or "Not
  cleared yet". Focus goes to the first uncleared board (or board 1 when all are cleared). A Share
  button shows once a board is cleared. Close returns focus to the Home card.
- **Board screen**: the `weekly` mode of the existing board screen; the label reads "Week 46 ·
  Board 2" and the tag shows the theme. Boosters, Restart and the stuck banner behave as in a level.
- **Win card**: "Board 2 cleared" (or "Weekly set complete!" when this win completes the set), then
  "31 pours · 3 of 5 cleared". The note says "New best: 29 pours" on a better replay, "Already
  cleared this week" on any other replay, and "This board's week is over, so it isn't counted" for
  an ignored win. The badge row shows the week's badge when it is earned. Share is shown;
  Continue returns to Home with the chooser open.
- Everything fits at 150% text on a 320 px wide screen: the card text wraps, the chooser is one
  column and scrolls.

### 3.9 Share

Native share sheet, else the clipboard, with the result shown inside the card (as the daily,
UX-win-4):

```
Strata Weekly 2026-W46 (Lock and Key)
3 of 5 boards: 23 · 31 · – · 40 · –
https://<the game's address>
```

and when all five are cleared:

```
Strata Weekly 2026-W46 (Lock and Key)
All 5 boards: 23 · 31 · 35 · 40 · 44 (173 pours)
https://<the game's address>
```

The numbers are each board's **best pours this week**, in board order; `–` marks a board not
cleared. No board layout is shared (no spoilers). The address is the page without query or hash,
as the daily.

### 3.10 State and data

- **Save** gains `weekly: { week: string, cleared: number[], pours: Record<string, number> }`.
  `week` is the set's key (`''` before the first weekly clear), `cleared` the 0-based board
  indices cleared, ascending, and `pours` the best pours by board index (as a string key).
- **Repair**, field by field (`repairWeekly`): `week` must be a well-formed key with a week of 01
  to 53, else the whole field resets to empty; `cleared` keeps integers from 0 to board count − 1,
  each once, ascending; `pours` keeps non-negative integer values whose key is a cleared index.
  A save code carries it and `importSave` repairs it like a load.
- **Config**: `weekly { seedSalt, maxBuried, boards[], themes[] }` (§7).
- **Core**: `src/core/weekly.ts`, pure and DOM-free: `weekKey`, `parseWeek`, `weekIndex`,
  `weekMonday`, `daysLeft`, `weeklyTheme`, `weeklySeeds`, `weeklySpec`, `weeklySteps`,
  `generateWeekly`, `weeklyFor`, `recordWeeklyClear`, `weeklyBadge`, `weeklyShareLine`,
  `repairWeekly`. `src/core/win.ts` applies a weekly win.

---

## 4. Formulas

| Formula | Expression | Variables and range | Example |
|---|---|---|---|
| ISO week | Thursday of the date's week `T = date + 3 − ((utcDay + 6) mod 7)` days; `isoYear = year(T)`; `week = 1 + floor((T − Jan 1 of isoYear) / 7 days)` | `utcDay` 0 = Sunday … 6 = Saturday; week 1–53 | 2026-11-15 23:59 UTC → `2026-W46`; 2026-11-16 00:00 UTC → `2026-W47` |
| Week index | `floor((dayNumber(monday) + 3) / 7)` | `dayNumber` = whole days since 1970-01-01; Monday 1969-12-29 is week 0 | `2026-W46` → 2967 |
| Theme | `themes[weekIndex mod themes.length]` | 5 themes | 2967 mod 5 = 2 → Lock and Key |
| Board seed | `FNV-1a("YYYY-Www#n")`, basis `2166136261 XOR seedSalt` | n = 1–5, `seedSalt` 5309 | `2026-W46#1` |
| Buried layers | `min(maxBuried, board.buriedDepth + theme.buriedBonus)` | `buriedBonus` 0 or 1, `maxBuried` 2 | Deep Sand board 4: min(2, 1 + 1) = 2 |
| Pour cap | `maxPoursFor(board.bandLevel)` from `generator.pourBands` | 45, 58 or 70 | board 3 (`bandLevel` 21) → 58 |
| Days left | `7 − (dayNumber(today) − dayNumber(monday))` | 1 (Sunday, "Last day") to 7 (Monday) | Thursday → 4 |

---

## 5. Edge Cases

- **Sunday 23:59 UTC vs Monday 00:00 UTC**: different weeks (tested). The card switches at the
  first Home render after 00:00 UTC.
- **Year boundary and week 53**: ISO years with 53 weeks (2026, 2032) give `W53`; 2027-01-01 is
  `2026-W53`; 2025-12-29 is `2026-W01` (tested). Badge ids accept W53 (`badges.md` §3.9).
- **Board started before the boundary, won after**: counts for its week if that is still the saved
  week (§3.6), so it can complete last week's set and earn that badge.
- **Win for a week older than the saved one**: ignored; the card says so; nothing pays anyway.
- **Clock moved back**: the earlier week shows as not started; its wins are ignored; the later
  saved week is kept.
- **All five cleared, then replayed**: no second badge (the id is added once); only best pours change.
- **A best that gets worse**: a replay with more pours never raises the stored best.
- **Mechanic not yet unlocked**: its intro card shows before the board (D2's rule).
- **Generation fails** (any recipe): the fallback chain always returns a board (§3.4).
- **Save damaged**: repaired field by field (§3.10); an unreadable week resets the set, which costs
  at most this week's progress and never a badge already on the shelf.
- **Board count changed in config**: repair drops indices at or past the new count.
- **Storage blocked**: the set plays, but progress is not kept, like everything else (`save-data.md`).
- **Tutorial not done**: the weekly card is hidden, like the daily card.
- **Badge already present** (e.g. a save code from another device already holds it): not added twice.

---

## 6. Dependencies

- **Depends on**: `daily-puzzle.md` (the recipes borrowed, the hash shape, the fallback chain and
  the UTC rule), `level-generation.md` (`generateFromSpec`, `pourBands`, `lastResort`),
  `jar-mechanics.md` (the themes' jars and intro cards), `badges.md` §3.9 (the weekly badge id
  and its place on the shelf), `save-data.md` (the `weekly` field), `session-boosters.md`
  (boosters as in a level), `feel-audio-ui.md` (Home card, chooser, win card).
- **Depended on by**: `badges.md` (weekly badges are awarded here), `player-profile.md` (weekly
  wins add pours and sealed jars to the lifetime stats). The sprint 11 O3 share link may open the
  set later (`?weekly=YYYY-Www`); it is not built here.
- **Economy**: none (§3.7). `economy.md` does not read the weekly set.

---

## 7. Tuning Knobs

All in `weekly` in `src/config/game-config.json`.

| Knob | Value | Safe range | Affects |
|---|---|---|---|
| `seedSalt` | 5309 | any 32-bit integer, but **never change it once released**: every player's boards for the current week would change mid-week | which boards are dealt |
| `boards[]` | 5 rows (§3.4) | 3–7 rows; `colors` 4–10, `capacity` 4, `spare` 2, `buriedDepth` 0–2, `bandLevel` ≥ 1 | the ramp and the length caps; more rows means a longer set and a later badge |
| `themes[]` | 5 themes | 1 or more; `mechanic` one of the four ids or absent; `buriedBonus` 0–1 | the weekly variety; a count that is not a multiple of 4 keeps it out of step with the daily Saturday |
| `maxBuried` | 2 | 0–2 (3 buries all but the top unit of a 4-jar) | how hard Deep Sand gets |

---

## 8. Acceptance Criteria

- [ ] `weekKey`: Sunday 23:59:59 UTC and Monday 00:00 UTC are different weeks; 2025-12-29 is
  `2026-W01`; 2027-01-01 is `2026-W53`; 2027-01-04 is `2027-W01`; the same instant in four time
  zones gives the same key.
- [ ] `weeklySeeds`: deterministic, five distinct seeds, and none equal to a daily seed of the same
  week, for 104 weeks.
- [ ] A fixture of 8 weeks × 5 boards (board hashes) matches on every run.
- [ ] Every board of 8 weeks is solvable, starts with nothing sealed, carries its theme's mechanic,
  and is within its pour cap; colours rise from board 1 to 5.
- [ ] Clearing boards in any order records each once, with the best pours kept; the fifth distinct
  clear returns the week's badge once; a new week resets; an older week's win is ignored.
- [ ] Repair: a damaged `weekly` field is repaired field by field; a save code round-trips it.
- [ ] A weekly win pays no coins and no shell, adds the badge to `save.badges`, and counts pours and
  sealed jars.
- [ ] Home card, chooser, a weekly board, the mid-week win card, the completing win card with the
  badge, the Share text and 150% text at 320 px are captured in
  `production/qa/evidence/sprint-11/weekly/`.

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-11-09 | Claude (sprint 11 W1) | Designed from D77: ISO week key, seeds, five themes, the five-board ramp, the week boundary, no coins, Share |
