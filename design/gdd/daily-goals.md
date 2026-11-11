---
status: designed (sprint 16)
source: src/core/goals.ts, src/core/win.ts
date: 2026-11-11
verified-by: owner interview 2026-11-11 (D135, D137, D138)
---

# Daily Goals: Design Document

## 1. Overview

Each UTC day brings three small goals, the same for every player, such as "Seal 25 jars", "Clear 2 levels" or "Clear a level Perfect". Each goal pays 20–40 coins once when it is reached. Finishing all three pays a 50-coin bonus. The goals are picked from the date, so nothing random is rolled for a player and nothing is sold. They count ordinary play: levels (first clears and replays), the daily puzzle and the weekly boards. A Home card shows today's goals and progress. There are no reminders (D138).

## 2. Player Fantasy

"I have ten minutes. What's worth doing today?" A player who skips the daily, or has already solved it, still has a clear, small target that pays. Goals are sized so that two or three levels finish most of them. They should feel like a friendly to-do list at the seaside, never a chore or a timer.

## 3. Detailed Rules

### 3.1 Picking a day's goals

- `goalsFor(date)` seeds `createRng(mixSeed(dayNumber(date), goals.seedSalt))`. It shuffles the distinct kinds in `goals.pool`, takes `perDay` (3) of them, and picks one size of each kind.
- The three goals are of **different kinds**, so "solve the daily" appears at most once.
- The day is the **UTC date**, the same clock as the daily puzzle (`daily-puzzle.md`).

### 3.2 Goal kinds

| Kind | Counts | Notes |
|---|---|---|
| `seal` | jars sealed on a won board | level, daily or weekly win; replays count |
| `clear` | 1 per level won | first clears and replays; not dailies or weekly boards |
| `perfect` | 1 per level won with no assists | Undo is free and doesn't break it; replays count |
| `daily` | 1 per counted daily solve | not a replay of today, not out of order |
| `weekly` | 1 per weekly board won | any of the five, replays count |
| `beatBest` | 1 per level replay that beats its best pours | the same "New best" the win card shows |

### 3.3 Progress and payout

- Progress for goal `i` is stored in `save.goals.progress[i]` and stops at its target.
- When a goal reaches its target it is added to `done` and pays its coins at once, on that win card ("Goal done: Seal 25 jars · +30").
- When all three are done, the bonus pays once ("All of today's goals done · +50").
- Goal coins count toward the Coins earned stat. They are not part of the win card's reward count-up, which stays the level's own reward.
- A daily that does not count (already solved today, or out of order) moves no goal.

### 3.4 A new day

- The first win on a later date starts the day fresh: no progress, nothing done, no bonus.
- A date earlier than the saved one (the clock moved back) records nothing and leaves the save alone, as the daily does (D10).
- The Home card always shows today's goals: today's progress if the save holds today, otherwise zeros.

### 3.5 Where it shows

- **Home card** "Today's goals", under the weekly card. It shows three rows with the goal text and progress ("12/25") or a tick, and a bonus line ("+50 when all three are done", then "All done"). It is hidden until the tutorial is done.
- **Win card**: one row per goal reached by this win, plus the bonus row.

## 4. Formulas

| Name | Formula | Example |
|---|---|---|
| Day seed | `mixSeed(dayNumber(date), seedSalt)` with `seedSalt` 4421 | the same three goals on every device for 2026-11-12 |
| Progress | `min(target, progress + step(kind, win))` | seal 25, progress 22, a win sealing 5 jars: 25 (done) |
| Day's coins | `Σ coins(goal) + bonus` | 30 + 20 + 40 + 50 = 140 |
| Range | lowest 20 + 20 + 20 + 50 = 110 (with three 20-coin goals); highest 40 + 40 + 30 + 50 = 160 | about 7 level clears' worth of coins |

`step(kind, win)` is from §3.2: jars sealed for `seal`, otherwise 0 or 1.

**Rationale.** A regular player earns about 20 coins a level plus 30–150 streak coins a day (`economy.md`). Goals add up to about 150 coins a day for about 10 minutes of play: enough to feel worth a visit, about one Hint (60) or one Shuffle (80) a goal. That is small against the jar style ladder (1,700–3,350 each), so styles stay a long-term goal.

## 5. Edge Cases

- **Out-of-order daily, or a replay of today's daily**: moves nothing (`counted: false`).
- **Tutorial**: moves nothing.
- **Winning a board just after midnight UTC**: counts toward the new day; the previous day's unfinished goals are simply gone (no carry-over).
- **One win that finishes two goals and the last one**: pays both goals and the bonus, all on that card.
- **A goal already done**: further wins of that kind add nothing and pay nothing.
- **Clock moved back**: records nothing (§3.4).
- **Saved progress for a different day**: shown as zeros on Home and replaced by the next win.
- **Corrupt `goals` in the save**: repaired field by field (`repairGoals`). A bad date gives no progress, and bad numbers become 0.
- **The config pool changes in a later release**: today's goals change for everyone, so `seedSalt` and the pool order must never change once released (config comment).

## 6. Dependencies

- **Depends on**: `daily-puzzle.md` (UTC date and `dayNumber`, counted solves), `economy.md` (coins, Coins earned), `weekly-set.md` (weekly wins), `session-boosters.md` (assists and Perfect), `level-map.md` (replays and best pours), `save-data.md` (`goals` field).
- **Depended on by**: `feel-audio-ui.md` (Home card, win card rows), `economy.md` (a coin faucet).

## 7. Tuning Knobs

| Knob | Config | Safe range | Affects |
|---|---|---|---|
| Goals a day | `goals.perDay` | 2–4, no more than the number of kinds | how long a visit takes |
| Bonus | `goals.bonus` | 30–80 | the pull to finish all three |
| Goal sizes and coins | `goals.pool[]` | seal 10–40, clear 1–5, coins 10–50 | difficulty and income |
| Seed salt | `goals.seedSalt` | never change after release | which goals a day gets |

## 8. Acceptance Criteria

- [ ] The same date gives the same three goals on every run, and they are of three different kinds (tested over a year of dates).
- [ ] A seal goal reaches its target from jars sealed, pays its coins once, and stops at the target.
- [ ] A Perfect goal moves only on a level won with no assists. A daily goal moves only on a counted solve.
- [ ] Finishing all three pays the bonus once.
- [ ] A new date starts fresh. An earlier date records nothing.
- [ ] Home shows the three goals with progress at 390px and at 320px with 150% text, with no clipping (screenshot).
- [ ] A win card that finishes a goal shows its row and coins (screenshot).
