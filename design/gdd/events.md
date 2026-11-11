---
status: designed (sprint 17)
source: src/core/events.ts, src/core/win.ts
date: 2026-11-11
verified-by: owner interview 2026-11-11 (D141–D147)
---

# Seasonal Events: Design Document

## 1. Overview

A seasonal event is a few weeks of the year with its own boards and a prize. Each event is a config entry (`events[]`) with yearly UTC dates, a number of gentle boards that open one a day (advent style), coins along the way and a prize for clearing every board. The same event returns every year on the same dates, and its progress is kept per year. The first event is **Winter Tide**, from 1 to 31 December, with 24 boards, 50 coins after every 6th board, and the Frost jar glass and the Winter Tide badge for all 24. The engine is shared, so a later event is only a new config entry and its art (D147).

## 2. Player Fantasy

"Something new is waiting each morning in December." A calm advent calendar at the seaside: one small board a day, never a timer, never a penalty for a missed day. Every player can finish it, whatever their level, and the prize is a visible keepsake of the season.

## 3. Detailed Rules

### 3.1 When an event runs
- `from` and `to` are `MM-DD` dates on the **UTC** calendar, the same clock as the daily puzzle and the weekly set.
- An event whose `to` is before its `from` runs into the next year (e.g. New Year, 12-26 to 01-06). Its year is the year it started.
- `activeEvent(date)` gives the event running that day, its year and its day (1 on the first day), or none.

### 3.2 Boards open one a day (D145)
- Board *n* opens on day *n* of the event: `openBoards = min(boards, day)`.
- Any open board can be played until the event's last day. A missed day costs nothing.
- After the last day the event is gone until next year. Boards not cleared are simply left.

### 3.3 Gentle boards (D144)
- Board *n* uses `recipes[(n − 1) mod recipes.length]`. For Winter Tide these are the weekly set's first three rows: 5, 6 and 7 colours, at most one buried layer, two empty jars and no special jars.
- Seed: FNV-1a of `id-year#n` with the event's `seedSalt`, through the daily's fallback chain. Every player gets the same board, and it never fails to build.
- Each year's boards are new, because the year is part of the seed.

### 3.4 Progress and rewards
- `recordEventClear` keeps, per event, `{ year, cleared[], pours{} }`. A clear in a new year starts that year fresh.
- **Coins**: `coins` after every `coinsEvery`-th **first** clear of the year. For Winter Tide that is 50 after boards 6, 12, 18 and 24, so 200 in a year.
- **Prize** on the clear that finishes every board: the jar piece (`prize.style`) and the badge (`prize.badge`). Each is granted **once and kept for good**. A player who completes again in a later year keeps one copy (D143).
- A replay pays nothing and only lowers best pours.
- Event wins count jars sealed for the badges and the daily goals' "Seal N jars", and count pours. They are not level clears, so they don't move the level, best-pours map or Perfect marks.

### 3.5 The prize piece is never sold
- The jar piece carries `"event": "<id>"` in `styles.slots`. `buyStyle` refuses it. The Jar styles sheet shows it locked as "Winter Tide prize · December" until owned, then wearable.

### 3.6 Where it shows
- **Home card**: shown while an event runs and after the tutorial. It shows the event name, "Board 12 open · 9 of 24 cleared" and the days left.
- **Chooser**: 24 boards, each open, cleared (with its best pours) or locked ("Opens Dec 14"); the prize line; Close.
- **Win card**: "Winter Tide · Board 6", the pours and "6 of 24 cleared", a coin row on a paying board, and the prize and badge rows on the last.

## 4. Formulas

| Name | Formula | Winter Tide |
|---|---|---|
| Day | `dayNumber(date) − dayNumber(year-from) + 1` | 12 December is day 12 |
| Open boards | `min(boards, day)` | day 12: 12; day 31: 24 |
| Coins on a clear | `coins` if it is a first clear and `cleared.length mod coinsEvery = 0`, else 0 | 50 on the 6th, 12th, 18th and 24th |
| Coins a year | `coins × floor(boards / coinsEvery)` | 200 |
| Seed | `FNV-1a(id-year#n, seedSalt)` | `wintertide-2026#1`, salt 7717 |

**Rationale.** 200 coins over a month is about ten level clears, small beside the daily streak and goals, so the event rewards turning up and not grinding. The prize is cosmetic and visible. Gentle boards (5–7 colours) take two to four minutes, an easy daily habit.

## 5. Edge Cases

- **A player who starts in mid-December**: on day 20 they find 20 boards open. They can still finish all 24 by the 31st.
- **The clock moved back**: the chooser shows the boards for that date. A board cleared later stays cleared, because clears are not undone.
- **Winning a board just after the event ends** (started on 31 Dec 23:58, won on 1 Jan): it records for the board's own year, because the board carries its year.
- **A board started before an update that changes the event**: `id` and `seedSalt` never change after an event has run (config comment), so boards stay the same.
- **Corrupt `events` in the save**: repaired field by field (`repairEvents`). Unknown events are dropped.
- **Two events at once**: `activeEvent` gives the first in config order. Dates must not overlap, and a later release checks this.
- **Prize already owned** (finished last year): this year's completion grants nothing new. The win card still says the set is complete.

## 6. Dependencies

- **Depends on**: `daily-puzzle.md` (UTC date, `dayNumber`, the fallback chain), `weekly-set.md` (recipes, pour caps), `jar-styles.md` (the prize piece), `badges.md` (the prize badge), `economy.md` (coins), `save-data.md` (`events`).
- **Depended on by**: `feel-audio-ui.md` (Home card, chooser, win card), `daily-goals.md` (event wins count jars sealed).

## 7. Tuning Knobs

| Knob | Config | Safe range | Affects |
|---|---|---|---|
| Dates | `from`, `to` | 1–6 weeks, no overlap | the season |
| Boards | `boards` | 7–31, no more than the days | the habit length |
| Recipes | `recipes[]` | weekly rows 1–3 | difficulty (gentle, D144) |
| Coins | `coinsEvery`, `coins` | every 4–8 boards, 25–100 | income |
| Prize | `prize.style`, `prize.badge` | one piece, one badge | the keepsake |
| Seed salt | `seedSalt` | never change after the event has run | the boards |

## 8. Acceptance Criteria

- [ ] Winter Tide runs from 1 to 31 December every year, and not on 30 November or 1 January (tested).
- [ ] Board *n* opens on day *n*. All 24 are open from the 24th to the 31st.
- [ ] Boards are the same on every run and differ by board and by year. Every board has at most 7 colours and one buried layer.
- [ ] 50 coins after every 6th first clear. A replay pays nothing.
- [ ] The 24th board grants the Frost glass and the Winter Tide badge once. A later year keeps one copy.
- [ ] Frost can't be bought.
- [ ] Home, the chooser and the win cards fit at 390px and at 320px with 150% text (screenshots on 1, 12 and 31 December).
