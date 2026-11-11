# Sprint 17: Winter Tide

> **Status: built (2026-11-11), approved by the owner.** Released as 0.16.0. Evidence: `production/qa/evidence/sprint-17/`. From the owner interview after 0.15.0 (D141–D147 in `design/gdd/systems-index.md`). Target release: **0.16.0**, live **before 1 December 2026**, after the 0.15.1 patch.

## Why
0.15 gives players daily reasons to return (streak rewards, daily goals). The next step chosen by the owner is **seasonal events** (D141): a few weeks with their own boards and a prize, returning every year.

## Goal
A reusable **event engine** and its first event, **Winter Tide** (1–31 December, every year).

## The plan

### Event engine (`design/gdd/events.md`, new; `src/core/events.ts`)
- An event is a config entry: `{ id, name, from: 'MM-DD', to: 'MM-DD', boards, opensFrom, prize }`. It **returns every year** on the same dates (D143), and its progress is kept per year (`events: { [id]: { year, cleared[], pours{} } }`).
- **Boards open one a day** (D145): board *n* opens on day *n* of the event, and any opened board can be played until the event ends. Missing a day costs nothing.
- **Gentle boards** (D144): built from the weekly set's Monday-to-Wednesday recipes and generator with the event's own seed salt, so every player can finish them, whatever their level. Each board is the same for every player.
- **Prize** (D146): a cosmetic for clearing every board, plus small coins along the way. The cosmetic is earned once and kept for good. A player who missed it can earn it in a later year (D143).
- **Home card**: shown only while an event runs, and after the tutorial. It shows the event name, "Board 12 open · 9 of 12 cleared" and the days left. Tapping it opens a chooser like the weekly one.

### Winter Tide (D142, D145, D146)

| | |
|---|---|
| Dates | 1–31 December, every year (UTC) |
| Boards | 24, advent style: board *n* opens on 1 Dec + (*n* − 1) days; all can be caught up until 31 Dec |
| Coins | 50 after every 6th board cleared (6, 12, 18, 24): 200 in total |
| Prize | **Frost** jar glass (icy white, snowflake etching) and a **Winter Tide** badge for all 24 |
| Scene | Plays in the player's chosen scene; Winter lights, if owned, already takes over in season |

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| E1 | **Event core**: `activeEvent(date)`, `openBoards(event, date)`, `eventBoard(event, year, n)`, `recordEventClear` (pure, DOM-free) | Same boards every run; board *n* opens on day *n*; nothing opens outside the dates; progress resets by year; tests cover 1 Dec, 24 Dec, 31 Dec, 1 Jan and leap years |
| E2 | **Prize**: Frost glass (earned, never sold; same `earned` path as Sea Lantern), Winter Tide badge, coins every 6th clear | Granted once; kept across years; not buyable |
| E3 | **Event UI**: Home card in season, chooser (24 boards, open, locked and cleared states), win card rows | Screenshots at 390px and at 320px with 150% text, on 1 Dec, 12 Dec and 31 Dec |
| E4 | **Save**: `events` field, repaired field by field; a save from before 0.16 loads with none | Save tests |
| D1 | **Docs**: `events.md` (8 sections), `save-data.md`, `economy.md`, `badges.md`, decisions D141–D147 | As before |
| R1 | **0.16.0**: What's new ("Winter Tide, from 1 December"), the changelog section, the release | Upgrade play-through; the card shown once; released before 1 Dec |

## Notes from the build
- Prize badges are kept by save repair through `eventBadgeIds` (they are not in the badge catalogue, and no rule awards them).
- Event pieces are locked in the Jar styles sheet as "Winter Tide prize · December" and are never sold (`styleAction`, `buyStyle`).
- Share is hidden on event win cards; the badge row keeps its moment Share.

## Out of scope
- Other events (summer, New Year): the engine supports them, and each is a later config entry.
- Event-only goals, leaderboards and anything sold.
