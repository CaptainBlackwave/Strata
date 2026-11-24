---
status: designed (sprint 17); sprint 31 changes designed (Winter Tide 1–25 Dec, board 25, New Tide, the Christmas Day gift, start cards)
source: src/core/events.ts, src/core/win.ts; sprint 31 adds src/core/gifts.ts
date: 2026-11-24
verified-by: owner interview 2026-11-11 (D141–D147); owner interview 2026-11-24 (D236–D243)
---

# Seasonal Events: Design Document

## 1. Overview

A seasonal event is a few weeks of the year with its own boards and a prize. Each event is a config entry (`events[]`) with yearly UTC dates, a number of gentle boards that open one a day (advent style), coins along the way and a prize for clearing every board. The same event returns every year on the same dates, and its progress is kept per year. The engine is shared, so a later event is only a new config entry and its art (D147).

Two events run back to back over Christmas and the New Year (sprint 31, D237, D240):

| Event | Dates (UTC) | Boards | Coins | Prize |
|---|---|---|---|---|
| **Winter Tide** (`wintertide`) | 1–25 December | 25: boards 1–24 plus a bonus **Christmas Day** board 25 | 50 after every 6th board, 200 a year | the Frost jar glass and the Winter Tide badge, for boards 1–24 (`prizeBoards: 24`) |
| **New Tide** (`newtide`) | 26 December – 6 January (crosses the year end) | 12 | 50 after boards 4, 8 and 12, 150 a year | the Sparkle glass and the New Tide badge, for all 12 |

Around them sit three small December extras: the **Christmas Day gift** (the Holly cap jar piece, 100 coins and a hint, once a year on the first open on 25 December UTC, D238), a one-time **start card** for each event (D242), and the **December look** (map lights, a Home garland during Winter Tide, the Winter scenes listed first; D241, owned by `level-map.md`, `scenes.md` and `feel-audio-ui.md`).

## 2. Player Fantasy

"Something new is waiting each morning in December." A calm advent calendar at the seaside: one small board a day, never a timer, never a penalty for a missed day. Every player can finish it, whatever their level, and the prize is a visible keepsake of the season.

Christmas Day is the calendar's last window: a bonus board and a small present waiting on Home, a surprise rather than a chore. New Tide then turns the page: "a fresh start, twelve small boards to open the year", lighter and sparkly rather than snowy. The MDA aesthetics served are **Submission** (a calm daily ritual), **Fantasy** (a seaside Christmas) and a light **Challenge** (gentle boards, a prize anyone can finish); the SDT need is mostly **Competence** with a visible keepsake, plus **Autonomy** from catch-up (play any open board, any day).

## 3. Detailed Rules

### 3.1 When an event runs
- `from` and `to` are `MM-DD` dates on the **UTC** calendar, the same clock as the daily puzzle and the weekly set.
- An event whose `to` is before its `from` runs into the next year (e.g. New Year, 12-26 to 01-06). Its year is the year it started.
- `activeEvent(date)` gives the event running that day, its year and its day (1 on the first day), or none.
- **Only one event runs on a given day.** Winter Tide ends on 25 December (`to: "12-25"`, was `"12-31"`, D237) and New Tide starts on 26 December (`from: "12-26"`, `to: "01-06"`, D240). Their windows touch and never overlap.

### 3.2 Boards open one a day (D145)
- Board *n* opens on day *n* of the event: `openBoards = min(boards, day)`.
- Any open board can be played until the event's last day (**catch-up**). A missed day costs nothing. Catch-up now ends on **25 December** for Winter Tide (it was the 31st, D237) and on **6 January** for New Tide.
- After the last day the event is gone until next year. Boards not cleared are simply left.

### 3.3 Gentle boards (D144)
- Board *n* uses `recipes[(n − 1) mod recipes.length]`. For Winter Tide and New Tide these are the weekly set's first three rows: 5, 6 and 7 colours, at most one buried layer, two empty jars and no special jars (D144, kept by D231). Winter Tide's board 25 is `recipes[0]` (5 colours); New Tide's board 12 is `recipes[2]` (7 colours).
- Seed: FNV-1a of `id-year#n` with the event's `seedSalt`, through the daily's fallback chain. Every player gets the same board, and it never fails to build.
- Each year's boards are new, because the year is part of the seed.

### 3.4 Progress and rewards
- `recordEventClear` keeps, per event, `{ year, cleared[], pours{} }`. A clear in a new year starts that year fresh.
- **Coins**: `coins` after every `coinsEvery`-th **first clear of a prize board** (boards 1 to `prizeBoards`) in the year (as built in sprint 31, owner direction). A bonus board above `prizeBoards` is never counted and never pays, in any order. For Winter Tide that is 50 on the 6th, 12th, 18th and 24th prize-board clear, so 200 in a year whether board 25 is played first, last or not at all. For New Tide it is 50 on the 4th, 8th and 12th, so 150 in a year.
- **Prize boards** (`prizeBoards`, new in sprint 31, D237): the prize needs boards **1 to `prizeBoards`** cleared. It defaults to `boards`, so an event without the field behaves as before. Winter Tide sets `prizeBoards: 24`, so board 25 is a bonus and is never needed for the prize. New Tide leaves it unset (all 12).
- **Prize** on the first clear that makes boards 1 to `prizeBoards` all cleared: the jar piece (`prize.style`) and the badge (`prize.badge`). Each is granted **once and kept for good**. A player who completes again in a later year keeps one copy (D143). Clearing a bonus board (above `prizeBoards`) never grants the prize, before or after the set is complete.
- A replay pays nothing and only lowers best pours.
- Event wins count jars sealed for the badges and the daily goals' "Seal N jars", and count pours. They are not level clears, so they don't move the level, best-pours map or Perfect marks.

### 3.5 The prize piece is never sold
- The jar piece carries `"event": "<id>"` in `styles.slots`. `buyStyle` refuses it. The Jar styles sheet shows it locked as "Winter Tide prize · December" until owned, then wearable.
- New Tide's prize, the Sparkle glass (`glass:sparkle`, `"event": "newtide"`), follows the same rule (`jar-styles.md` §3.6). Its locked label needs its own wording, because the event starts in December and ends in January (see Edge Cases).
- The Christmas Day gift's Holly cap is never sold either; it is a gift piece (`"gift": "christmas"`), not an event prize (§3.9, `jar-styles.md` §3.6).

### 3.6 Where it shows
- **Home card**: shown while an event runs and after the tutorial. On the Play tab it shows the event name, "9 of 24 cleared" and the days left; the Today tab's card and the chooser show the full "Board 12 open · 9 of 24 cleared" (since sprint 20; confirmed in the sprint 31 rehearsal). The count is of boards 1 to `prizeBoards` (so "of 24" for Winter Tide, "of 12" for New Tide); a cleared bonus board does not move it.
- **Chooser**: one tile per board (25 for Winter Tide, 12 for New Tide), each open, cleared (with its best pours) or locked (the tile shows its date, "Dec 14"; its spoken label says "opens Dec 14"); the prize line (in a later year, before that year's set is done, "You already have the prize from an earlier year"); Close. Winter Tide's 25th tile is labelled "Christmas Day" and set apart as a bonus, so the 24 prize boards read as the set.
- **Win card**: "Winter Tide · Board 6", the pours and "6 of 24 cleared", a coin row on a paying clear, and the prize and badge rows on the clear that completes the prize boards. New Tide has its own Home card, chooser and win card in the same layout (D240).
- **Atmosphere**: Winter Tide keeps its light snow behind Home and its music; while it runs, Home also has a small garland across the top (D241, `feel-audio-ui.md`). New Tide has no snow: a few gentle sparkles on Home while it runs, off under reduced motion (D240).

### 3.7 Board 25, Christmas Day (D237)
- Winter Tide has `boards: 25` and `prizeBoards: 24`. Board 25 opens on day 25, 25 December, the event's last day, so it can only be played that day.
- It is a gentle board like the rest (`recipes[0]`: 5 colours, no buried layer, no special jars) and its seed follows the usual rule (`wintertide-<year>#25`).
- It is a **bonus**: not needed for the prize, and never granting it.
- Its jars show the **Holly cap** on their stoppers whatever cork the player wears (a board look only: it changes no worn style and no rule). It is labelled "Winter Tide · Christmas Day" on the board, the chooser and the win card.
- Its first clear never pays coins and never counts toward the prize (§3.4).

### 3.8 New Tide (D240)
- Config entry `newtide`: `from: "12-26"`, `to: "01-06"`, `boards: 12`, the same three gentle recipes as Winter Tide, `coinsEvery: 4`, `coins: 50`, `prize: { style: "glass:sparkle", badge: "event-newtide" }`, its own new `seedSalt` (chosen in C3, distinct from every other salt; never changed after its first run).
- It crosses the year end. **Its year is the year it starts**: the season from 26 December 2026 to 6 January 2027 is New Tide 2026, and its boards and progress belong to 2026.
- 26 December is day 1, 31 December day 6, 1 January day 7 and 6 January day 12. Board 12 opens on 6 January, the last day.
- The New Tide badge is a new badge (`badges.md`), granted with the Sparkle glass once and kept for good, like Winter Tide's (D143).

### 3.9 The Christmas Day gift (D238)
- **When**: the first time the player reaches Home on 25 December (UTC date, the daily's clock), after the tutorial. Once per year.
- **What**: the **Holly cap** jar piece (`cork:holly`), **100 coins** and **1 hint** booster.
  - The Holly cap is granted once and kept for good. In a later year, a player who already owns it gets the coins and the hint only, and the card says so.
  - The gift is a keepsake, never for sale (`jar-styles.md` §3.6).
- **How it shows**: a small gift card on Home with the three items and one button to take it. The grant happens when the card is shown, so closing the app without tapping still keeps it.
- **Save**: a pure module (`src/core/gifts.ts`: date in, gift out) and a save field that stores the year it was last given (proposed `gifts: { christmas: <year> }`, final name set in C3 and `save-data.md`). The gift is due only when the stored year is **less than** this year, so it can't be claimed twice.
- There is no catch-up: a player who does not open the game on 25 December (UTC) gets no gift that year.

### 3.10 Start cards (D242)
- **Winter Tide**: on the first Home from 1 December each year while Winter Tide runs, a one-time card: "Winter Tide has begun: a new board every day until Christmas." with **Play** (opens the event chooser) and Close.
- **New Tide**: on the first Home from 26 December while New Tide runs: "New Tide is here: 12 boards to start the year." with Play and Close.
- Each is shown at most once per event year, after the tutorial, and is dismissed for that year once seen (shown counts as seen). The save stores, per event, the event year it was last shown (proposed `startCards: { [eventId]: <year> }`).
- In-app only: Strata has no push service (out of scope).
- **One card at a time**: on 25 December the gift card takes priority. A Winter Tide start card still unseen on 25 December is marked seen without showing, because "a new board every day until Christmas" no longer fits on Christmas Day (proposed; see Edge Cases).

### 3.11 First run of Winter Tide
- Winter Tide shipped in sprint 17 (0.16.0) but has never run: its first season starts on 1 December 2026. **No player has any progress**, so changing `to` (12-31 → 12-25), `boards` (24 → 25) and adding `prizeBoards` before then breaks nothing.
- **Boards 1–24 are byte-identical** to the ones built in sprint 17: a board's seed is its event id, year and number (`FNV-1a(id-year#n, seedSalt)`) and its recipe is `recipes[(n − 1) mod 3]`, and neither depends on `boards`, `to` or `prizeBoards`. Fixtures pin them (C3).
- The dress rehearsal (D236) runs the built game on 30 Nov, 1, 12, 24 and 25 Dec, 26 and 31 Dec, 1, 6 and 7 Jan before release (`production/sprints/sprint-31.md`).

## 4. Formulas

Variables: `date` is the UTC date; `year` is the event year (the year its `from` falls in); `day` is the event day, 1 on `from`; `cleared` is the set of boards first-cleared this event year; `boards` 7–31; `prizeBoards` 1–`boards` (default `boards`).

| Name | Formula | Winter Tide | New Tide |
|---|---|---|---|
| Event year | the year of `date` if `date ≥ from` in that year, else (only for an event whose `to` is before its `from`) the year before | 2026 | 31 Dec 2026 → 2026; 3 Jan 2027 → 2026 |
| Day | `dayNumber(date) − dayNumber(year-from) + 1` | 12 December is day 12; 25 December day 25 | 26 Dec day 1; 1 Jan day 7; 6 Jan day 12 |
| Running | `1 ≤ day ≤ length`, where `length = dayNumber(to of the run) − dayNumber(year-from) + 1` | 25 days | 12 days |
| Open boards | `min(boards, day)` | day 12: 12; day 24: 24; day 25: 25 | day 7: 7; day 12: 12 |
| Coins on a clear | `coins` if it is a first clear and `cleared.length mod coinsEvery = 0`, else 0 | 50 on the 6th, 12th, 18th and 24th first clear | 50 on the 4th, 8th and 12th |
| Coins a year | `coins × floor(boards / coinsEvery)` | 50 × floor(25 / 6) = 200 | 50 × floor(12 / 4) = 150 |
| Prize complete | `{1 … prizeBoards} ⊆ cleared` | boards 1–24 | boards 1–12 |
| Prize granted on this clear | first clear ∧ complete after it ∧ not complete before it ∧ not already owned (each of piece and badge separately) | the clear of the last missing board among 1–24 | the clear of the last missing board |
| Seed | `FNV-1a(id-year#n, seedSalt)` | `wintertide-2026#1`, salt 7717 | `newtide-2026#1`, new salt (C3) |
| Christmas gift due | `MM-DD(date) = 12-25 ∧ tutorialDone ∧ giftYear < year(date)` (absent `giftYear` counts as 0) | 25 Dec 2026, first Home: due; stores 2026 | — |
| Christmas gift | `coins + 100`, `hint + 1`, `owned ∪ {cork:holly}` | 100 coins, 1 hint, the Holly cap (first year only) | — |
| Start card due | event running ∧ tutorialDone ∧ `startCardYear[id] < year` ∧ no other Home card has priority (§3.10) | first Home from 1 Dec | first Home from 26 Dec |

**Rationale.**
- **Coins.** 200 coins over Winter Tide is about ten level clears, small beside the daily streak and goals, so the event rewards turning up and not grinding. New Tide pays 150 over 12 days (12.5 a day, against Winter Tide's 8 a day) because it is shorter and comes straight after; it still pays less than one day of a regular late player's income (about 240 a day, `jar-styles.md` §4).
- **The gift.** 100 coins plus a hint (worth 60 coins at the booster price, `boosters.hint.price`) is about 160 coins of value: a present, not an income line. Over the whole season (Winter Tide 200, the gift about 160, New Tide 150) the extra is about 510 coins, roughly two days of a regular player's income, so the economy (`economy.md`) does not move. The value of both events and the gift is in the keepsakes, which are cosmetic and visible.
- **Board 25 pays nothing.** It is a bonus on a day that already brings the gift; the year's coin total is unchanged by adding it (`floor(25/6) = floor(24/6) = 4`).
- **Gentle boards** (5–7 colours) take two to four minutes, an easy daily habit.
- **`giftYear < year`, not `≠`.** A player who moves the clock forward to a later Christmas and back cannot claim twice; the honest player is unaffected.

## 5. Edge Cases

- **A player who starts in mid-December**: on day 20 they find 20 boards open. They can still finish boards 1–24 by the 25th. A player who first opens on 25 December finds all 25 open and can still win the prize that day.
- **The shorter catch-up**: board 24 now has two days (24 and 25 December) instead of eight, and New Tide's board 12 has one (6 January). A player who misses the last day cannot finish that year. Accepted by D237 and D240 (no timer, no penalty: the event simply returns next year).
- **The clock moved back**: the chooser shows the boards for that date. A board cleared later stays cleared, because clears are not undone.
- **Winning a board just after the event ends** (started on 25 Dec 23:58, won on 26 Dec, when New Tide is running): it records for Winter Tide and the board's own year, because the board carries its event and year. The same holds for a New Tide board started on 6 Jan and won on 7 Jan (New Tide of the previous year).
- **New Tide across the year end**: a board played on 2 January 2027 is New Tide 2026 (seed `newtide-2026#n`), and its progress is the 2026 record. On 26 December 2027 a fresh 2027 record starts.
- **Board 25 played out of order**: coins count only clears of prize boards 1–24 (§3.4), so board 25 never pays and never shifts the count, in any order; the year total is 200 either way.
- **Board 25 cleared, prize boards not**: the count on Home stays at "n of 24"; the prize waits for boards 1–24. Clearing board 25 after the set is complete grants nothing more.
- **`prizeBoards` out of range**: missing, non-integer, below 1 or above `boards` means `boards` (the config check in C3 rejects such values in tests).
- **A board started before an update that changes the event**: `id` and `seedSalt` never change after an event has run (config comment), so boards stay the same.
- **Corrupt `events` in the save**: repaired field by field (`repairEvents`). Unknown events are dropped. A cleared board above `boards` is dropped (so a save that somehow holds board 25 under an older 24-board config is repaired cleanly).
- **Two events at once**: `activeEvent` gives the first in config order. Dates must not overlap; with Winter Tide and New Tide back to back, a config test now checks that no two events share a day in any year (including the year-end crossing).
- **Prize already owned** (finished last year): this year's completion grants nothing new. The win card still says the set is complete.
- **Sparkle glass's locked label**: the built label is "<event> prize · <first month>", which would read "New Tide prize · December" although most of New Tide is in January. C5 picks the wording (proposed "New Tide prize · New Year").
- **Christmas gift, time zone**: the gift follows the UTC date, like the daily. A player at UTC−8 can receive it on the evening of 24 December local time; a player at UTC+13 from 13:00 on 25 December local time to 13:00 on the 26th. Accepted (one clock for every dated feature).
- **Christmas gift, tutorial unfinished**: the gift waits until the tutorial is done, if that is still 25 December (UTC). Otherwise there is no gift that year.
- **Christmas gift, Holly cap already owned**: 100 coins and the hint only; the card names just those.
- **Christmas gift, player below level 60**: the Holly cap is owned, so the Styles button shows (the existing rule, `jar-styles.md` §3.2: a player who owns a piece sees Styles). Frost and Sparkle glass behave the same.
- **Christmas gift, clock games**: moving the clock to 25 December grants that year's gift once; moving it back and forth cannot grant twice (`giftYear < year`). Moving it to a later Christmas claims that year's early and leaves nothing for it later. Cosmetic and single-player, so accepted.
- **Christmas gift, corrupt save field**: a year that is not a whole number from 2000 is dropped (treated as never given). The save code round-trips the field.
- **Christmas gift, two tabs**: the one-active-tab rule (D57) covers it.
- **Start card, first open on 25 December**: the gift card shows; the Winter Tide start card is marked seen for that year without showing (§3.10). The event's Home card still shows as usual.
- **Start card, first open after the event ended**: never shown that year (the card needs the event running).
- **Start card and other Home cards**: one card at a time; the start card waits behind the tutorial and the gift, and shows on the next Home while its event still runs.

## 6. Dependencies

- **Depends on**: `daily-puzzle.md` (UTC date, `dayNumber`, the fallback chain), `weekly-set.md` (recipes, pour caps), `jar-styles.md` (the prize pieces Frost and Sparkle glass, and the gift's Holly cap), `badges.md` (the Winter Tide and New Tide badges), `economy.md` (coins, the hint booster), `save-data.md` (`events`, and the new gift year and start-card years), `onboarding` (the tutorial gates the cards and the gift).
- **Depended on by**: `feel-audio-ui.md` (Home cards, chooser, win cards, the gift card, the start cards, the Home garland and New Tide sparkles), `daily-goals.md` (event wins count jars sealed), `scenes.md` and `level-map.md` (the December look, D241, which sits beside the events but keys off the date, not the event).
- **Data flow**: `src/core/events.ts` (event windows, boards, coins, prize) and `src/core/gifts.ts` (the Christmas gift, date in, gift out) are pure and DOM-free; the UI reads them and writes the save.

## 7. Tuning Knobs

| Knob | Config | Safe range | Affects |
|---|---|---|---|
| Dates | `from`, `to` | 1–6 weeks, no overlap | the season (gate) |
| Boards | `boards` | 7–31, no more than the days | the habit length (gate) |
| Prize boards | `prizeBoards` (new) | 1–`boards`; default `boards` | how many boards the prize needs; the rest are bonus boards (gate) |
| Recipes | `recipes[]` | weekly rows 1–3 | difficulty (gentle, D144) (curve) |
| Coins | `coinsEvery`, `coins` | every 4–8 boards, 25–100 | income (curve) |
| Prize | `prize.style`, `prize.badge` | one piece, one badge | the keepsake |
| Seed salt | `seedSalt` | never change after the event has run | the boards |

Sprint 31 values:

| Knob | Winter Tide | New Tide | Why |
|---|---|---|---|
| `from`, `to` | `12-01`, `12-25` (was `12-31`) | `12-26`, `01-06` | back to back, one event a day (D237, D240) |
| `boards` | 25 (was 24) | 12 | 24 advent boards plus Christmas Day; one New Tide board a day |
| `prizeBoards` | 24 | unset (12) | Christmas Day is a bonus (D237) |
| `coinsEvery`, `coins` | 6, 50 | 4, 50 | 200 and 150 a year (§4) |
| `prize` | `glass:frost`, `event-wintertide` | `glass:sparkle`, `event-newtide` | keepsakes |
| `seedSalt` | 7717 (unchanged) | new, chosen in C3 | boards 1–24 stay byte-identical |

The Christmas Day gift and the start cards are new config (proposed shape; final keys set in C3):

| Knob | Proposed config | Value | Safe range | Affects |
|---|---|---|---|---|
| Gift date | `gifts.christmas.date` | `12-25` | a single `MM-DD` | when the gift is given |
| Gift coins | `gifts.christmas.coins` | 100 | 0–300 | the present's size (economy: once a year) |
| Gift boosters | `gifts.christmas.boosters` | `{ "hint": 1 }` | 0–3 of any booster | the present's size |
| Gift piece | `gifts.christmas.style` | `cork:holly` | one gift piece (`"gift": "christmas"`) | the keepsake |
| Start card | per event, `announce: true` | both events on | on/off | the one-time card |

## 8. Acceptance Criteria

Sprint 31 (supersedes the sprint 17 list, which said 1–31 December and 24 boards):

**Winter Tide** (unit tests, `tests/unit/events/`):
- [ ] Runs from 1 to 25 December every year; not on 30 November or 26 December.
- [ ] Board *n* opens on day *n*; board 25 opens on 25 December only; all 25 are open on the 25th.
- [ ] Boards 1–24 match fixtures taken from the sprint 17 build (byte-identical); board 25 is a gentle 5-colour board with no special jars.
- [ ] 50 coins on the 6th, 12th, 18th and 24th first clear; 200 a year; the 25th first clear pays nothing; a replay pays nothing.
- [ ] The prize (Frost glass and the Winter Tide badge) is granted on the clear that completes boards 1–24, once; clearing board 25 never grants it; a later year keeps one copy.
- [ ] An event without `prizeBoards` needs all its boards (default `boards`).

**New Tide** (unit tests):
- [ ] Runs from 26 December to 6 January; not on 25 December or 7 January; 1–6 January belong to the previous year's run.
- [ ] Board *n* opens on day *n* (26 Dec = 1, 1 Jan = 7, 6 Jan = 12); boards are deterministic (fixtures) and differ by board and year; at most 7 colours, one buried layer, no special jars.
- [ ] 50 coins on the 4th, 8th and 12th first clear (150 a year); the 12th grants the Sparkle glass and the New Tide badge once.
- [ ] No two configured events share a day in any year (config test).

**Christmas Day gift** (unit tests on `src/core/gifts.ts`):
- [ ] Due on 25 December (UTC) when the stored year is lower or absent; never on 24 or 26 December; never twice in one year; the year is stored.
- [ ] Grants 100 coins, one hint and the Holly cap; a player who owns the cap gets the coins and the hint only.
- [ ] Waits for the tutorial; the save field is repaired and round-trips in the save code.

**Start cards** (unit tests on the rule, screenshots of the cards):
- [ ] Winter Tide's card shows on the first Home from 1 December, New Tide's from 26 December, once per event year; Play opens that event's chooser.
- [ ] On 25 December the gift card shows and Winter Tide's unseen start card is marked seen without showing.

**Never sold**: Frost, Sparkle glass and the Holly cap are refused by `buyStyle` (unit test).

**Screens** (`production/qa/evidence/sprint-31/`): Home, the chooser and the win cards of both events, the gift card and both start cards fit at 412px and at 320px with 150% text, light and dark, on both boards; the full dress rehearsal (D236) on 30 Nov, 1, 12, 24, 25, 26 and 31 Dec, 1, 6 and 7 Jan with a clean findings list.

**Experiential** (playtest during the rehearsal and owner review): the Christmas Day board and the gift read as a present, not a task; New Tide reads as a fresh, lighter season, not "Winter Tide again"; no player-facing text still promises "until the 31st" (the 0.16.0 What's new entry stays as history).

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-11-11 | Claude (sprint 17) | Designed from D141–D147: yearly UTC events, advent boards, gentle recipes, coins and a prize; Winter Tide 1–31 December, 24 boards |
| 2026-11-24 | Claude (sprint 31, C1) | From D236–D243: Winter Tide 1–25 December with a bonus Christmas Day board 25 and `prizeBoards: 24`; New Tide (26 Dec – 6 Jan, 12 boards, 150 coins, the Sparkle glass and the New Tide badge); the Christmas Day gift (Holly cap, 100 coins, a hint, once a year, year stored); start cards; formulas, knobs, edge cases and acceptance criteria for each; boards 1–24 byte-identical and no player progress yet (first run) |
| 2026-11-24 | Claude (sprint 31 integration) | As built: coins count prize-board clears only (board 25 never pays); the start-card key is `announce`; the Home and chooser wording as the rehearsal found it; the board screen shows "Board 6" or "Christmas Day" with the event's name in its tag (rehearsal finding 2); a later year's completion names no prize piece already owned (finding 1) |
