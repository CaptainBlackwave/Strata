# Sprint 16: come back tomorrow

> **Status: planned (2026-11-11), approved by the owner.** From the owner interview after the bug sweep (D135–D140 in `design/gdd/systems-index.md`). Target release: **0.15.0**, with a What's new card.

## Why
Live players say the game plays better since 0.14.1. The next goal is **bringing players back** (D135). Strata already gives reasons to return: the daily puzzle with growing streak coins and tide passes, and the weekly set of five. But a long streak earns nothing a player can keep, and a short visit that skips the daily earns little.

## Goal
Two reasons to open Strata every day, inside the brief's rules (no timers, no random rewards, nothing sold, no server):

1. **A streak reward track** (D136): fixed, visible rewards on streak days, mostly cosmetics that can only be earned this way.
2. **Daily goals** (D137): three small goals a day that pay coins, sized for a ten-minute visit.

There are **no reminders** (D138), and the release ships as **one release, 0.15.0** (D139).

## The plan

### Streak reward track (`design/gdd/daily-puzzle.md` §2.4, new)

| Streak day | Reward | Kind |
|---|---|---|
| 3 | Hint ×1, Shuffle ×1 | boosters |
| 7 | Hint ×2, Shuffle ×1, Jar ×1 | boosters |
| 14 | **Tide Line** avatar frame | streak-only |
| 30 | **Sea Lantern** jar glass | streak-only |
| 60 | **Lighthouse** name plate | streak-only |
| 100 | **Lighthouse Night** scene | streak-only |

- **Counting** (D140): the track counts the **current** streak. On each counted daily solve, every track day up to the new streak that is not yet claimed is claimed and paid. A player who already holds a 20-day streak claims days 3, 7 and 14 on the next solve.
- **Rewards are earned once and kept for good.** A missed day resets the streak, but no reward is lost, and a claimed day never pays again.
- **Placement.** The daily card on Home shows the next reward and the days left ("Next: Tide Line frame in 4 days"). The daily win card shows a claimed reward in its unlocks row. A small sheet opened from the daily card shows the whole track.
- **Streak-only items** never appear for sale: the Scenes and Jar styles sheets show them as "Streak reward · day 100". The existing coral frame (best streak 14) and the existing badges stay as they are.

### Daily goals (`design/gdd/daily-goals.md`, new)

- **Three goals each UTC day**, the same for every player, picked from the date with a seeded hash in the daily's style. The three are of different kinds, and at most one is "solve the daily".
- **Goal pool** (config `goals.pool`):

  | Goal | Sizes | Pays |
  |---|---|---|
  | Seal N jars | 15 / 25 | 20 / 30 |
  | Clear N levels (first clears or replays) | 2 / 4 | 20 / 40 |
  | Clear a level Perfect | 1 | 30 |
  | Solve today's daily | 1 | 20 |
  | Clear a weekly board | 1 | 30 |
  | Clear a level in N pours or fewer than its best | 1 | 40 |

- **Bonus**: 50 coins when all three are done. A day pays at most about 150 coins.
- **Paid at once** when a goal is reached. The win card shows "Goal done: seal 25 jars +30". Progress counts from the first play of the day.
- **Home card** "Today's goals" sits under the weekly card, with three rows, progress ("12 / 25") and a tick when done. It is hidden until the tutorial is done.
- **Save**: `goals: { date, progress: Record<kind, number>, done: number[], bonus: boolean }`. It is repaired field by field and resets on a new date. A date earlier than the saved one (the clock moved back) shows as fresh and leaves the save alone, as the daily does.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| T1 | **Track core**: `claimTrack(state, streak, config)` in `src/core/daily.ts` (pure), config `daily.track`, save `daily.claimed` | Claims every unclaimed day ≤ streak; never pays a day twice; tests for catch-up, reset and pass days |
| T2 | **Streak-only cosmetics**: frame `tideline`, glass `sealantern`, plate `lighthouse`, scene `lighthousenight` (CSS/SVG only), each granted by the track and not for sale | Not buyable; kept by save repair; plate contrast 4.5:1 (existing test); scene contrast as other scenes |
| T3 | **Track UI**: next reward on the daily card, a claimed reward on the win card, the track sheet | Screenshots at 390 and at 320 with 150% text |
| G1 | **Goals core**: `goalsFor(date)`, `recordGoalProgress(state, event)` in `src/core/goals.ts` (pure, DOM-free) | Same three goals for a date on every run; distinct kinds; progress, payout and bonus tests; date rollover and clock-back |
| G2 | **Goals wiring**: level, daily and weekly wins report jars sealed, clears, Perfect and pours | Counted for replays as the doc says; never for an out-of-order daily |
| G3 | **Goals UI**: Home card, win card row | Screenshots at 390 and at 320 with 150% text |
| D1 | **Docs**: `daily-goals.md` (8 sections), `daily-puzzle.md` §2.4, `economy.md` coin sources, `save-data.md`, decisions D135–D140 | As before |
| R1 | **0.15.0**: version bump and What's new ("Streak rewards", "Daily goals") | Upgrade play-through; card shown once |

## Out of scope
- Reminders, notifications and app badges (D138).
- Seasonal events and comeback rewards (not chosen in the interview).
- Changes to streak coins, passes, badges or the level curve.
