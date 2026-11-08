# Economy model, 90 days (sprint 7, B3)

**How to run** (from the repo root, after `npm ci`):

```sh
npx vite-node tools/balance/economy-model.ts > economy.json   # JSON report on stdout; about 15 s
```

It is deterministic. Rates are applied with accumulators rather than random draws, so every run
gives the same numbers. It is built on the shipped pure rules (`clearReward`, `spendBooster`,
`addBoosters`, `recordDailySolve`, `grantShell`, `milestoneDue`, `levelSpec`), and every game value
comes from `src/config/game-config.json`. No change to `src/` was made. Source:
`production/sprints/sprint-7.md` B3; findings GA-ECON-1 (`gdd-reviews-a.md`), GX-11 and GX-12
(`gdd-cross-review.md`).

## Assumptions (about the player, not the game)

| Assumption | Value |
|---|---|
| Perfect rate on first clears | **50%** (every other clear uses one booster) |
| Booster on a non-perfect clear | Extra Jar on a spare-swap level, otherwise Hint and Shuffle 2:1 |
| Stored charges | Always used first (3 of each at start, plus 1 of each per completed set) |
| **With spending**: paid boosters once that booster's charges are gone | **2 per 10 levels** (Hint 60, Shuffle 80, Extra Jar 120) |
| **Without spending** | Charges are used, coins are never spent on boosters |
| Light | 3 levels a day. The daily Mon–Thu, so the 3-day weekend gap breaks the streak every week |
| Regular | 8 levels a day plus the daily every day |
| Heavy | 25 levels a day plus the daily every day |
| Start | Monday 2026-11-09 (UTC), 100 start coins, no replays, every level a first clear |
| Levels past 200 | `levelSpec` keeps going, so these are extrapolated. The B2 sweep measured only 1–200 |

Faucets modelled: 20 per first clear, +10 Perfect, +30 tall jar, the daily streak reward
(30 + 10/day, up to 100, with tide passes every 7 days, at most 2), a shell every 5th level and on
every counted daily, a set reward of 150 coins + 3 charges, and **50 coins per milestone once all 40
shells are owned**.

## Coins and level by day

Balance = coins held, with no scenes bought. "Spend" = with booster spending.

| Profile | Day 7 | Day 14 | Day 30 | Day 60 | Day 90 |
|---|---|---|---|---|---|
| Light, level | 21 | 42 | 90 | 180 | 270 |
| Light, coins (spend) | 1,010 (950) | 2,080 (1,880) | 4,460 (3,940) | 9,560 (7,480) | 14,500 (10,620) |
| **Regular, level** | 56 | **112** | **240** | 480 | **720** |
| **Regular, coins (spend)** | 2,520 (2,160) | **5,400 (4,640)** | **12,640 (9,360)** | 26,260 (17,580) | **39,880 (26,280)** |
| Heavy, level | 175 | 350 | 750 | 1,500 | 2,250 |
| Heavy, coins (spend) | 6,700 (4,760) | 14,420 (8,980) | 32,020 (18,020) | 65,020 (34,600) | 98,020 (51,360) |

Income after day 30: light 167 coins a day, **regular 454 a day**, heavy 1,100 a day (gross).
Booster spending takes 27% of gross for light, 34% for regular and 48% for heavy by day 90.

Coins earned by level (no spending): level 25 ≈ 930–1,290 · 50 ≈ 1,830–2,530 · 100 ≈ 3,620–5,000 ·
200 ≈ 7,670–10,590. The range is heavy to light: lighter players earn more per level from the daily.

Where the 90-day income comes from (regular): levels 36%, all-shells bonus 24%, daily 22%,
Perfect 9%, tall jar 5%, sets 3%. **The 50-coin bonus after 40 shells becomes the second-largest
faucet** (regular from day 15, heavy from day 7). It never ends (GA-ECON-2b).

## Days until each existing scene is affordable

| Profile | Dawn 300 | Sunset 500 | Moonlit 800 | All three bought in price order |
|---|---|---|---|---|
| Light | day 2 | day 4 | day 5 | days 2, 5, 11 (spend: 2, 5, 12) |
| Regular | day 1 | day 2 | day 3 | days 1, 3, 5 (spend: 1, 3, 6) |
| Heavy | day 1 | day 1 | day 1 | days 1, 1, 2 (spend: 1, 1, 3) |

This confirms GX-11. The whole current scene sink (1,600) is gone within the first week for every
profile, and within two weeks even for the light player.

## GX-12 check: Extra Jar on every spare-swap level from 60

The cost is 120 coins per swap level, plus the Perfect bonus it forfeits (10 × 50%). It is
compared with all income earned from the day the player reaches level 60.

| Profile | Reaches 60 | Swap levels from 60 in 90 days | Cost | Income from 60 | **Share of income** |
|---|---|---|---|---|---|
| Light | day 20 | 122 | 15,250 | 11,640 | **131%** |
| Regular | day 8 | 424 | 53,000 | 37,290 | **142%** |
| Heavy | day 3 | 1,473 | 184,125 | 95,930 | **192%** |

**Reading.** Buying back the removed spare on *every* swap level costs more than the player earns,
so coins cannot cancel the ramp lever wholesale. It limits itself, more so as the swap chance rises
toward 75%. Past level 150 a swap level costs about 94 coins on average, against about 57 a level
earned by the regular player. Partial use is affordable, and the modelled spender does exactly that:
regular buys 93 Extra Jars in 90 days (11,160 coins, 28% of gross income), and heavy buys 330.
**Recommendation:** no Jar price change is needed for GX-12. Count "one bought Jar on some swap
levels" in the B2 target instead, since a bought Jar turns a swap board back into a 2-spare board.

## Proposed price curve for about 12 more scenes

**Targets (from the brief for this task):** for the regular player, a new scene about every
1–2 weeks. For the heavy player, still a goal at day 90. The curve has to work with and without
booster spending.

**Formula:** `price(n) = round50(2750 × 1.19^(n−1))` for rung n = 1…12. The existing 300/500/800
scenes stay as the first-week starter tier, bought in order before rung 1. The tiers follow the
rungs, so the richer animation costs more: **tier 1 (colour-only) = rungs 1–5, tier 2 (one ambient
layer) = 6–9, tier 3 (layered and reactive) = 10–12.**

`p1` and `g` were found by a grid search in the script (P1 1,000–6,000 in steps of 250,
g 1.00–1.35 in steps of 0.01). The search minimises the regular player's days outside the 7–14-day
window in both modes, and requires that the non-spending heavy player cannot buy the whole ladder
by day 90.

| Rung | Tier | Price | Regular buys (spend) | Heavy buys (spend) | Light buys (spend) |
|---|---|---|---|---|---|
| 1 | 1 | 2,750 | day 12 (14) | day 5 (7) | day 30 (34) |
| 2 | 1 | 3,250 | day 19 (25) | day 8 (12) | day 50 (64) |
| 3 | 1 | 3,900 | day 28 (39) | day 12 (20) | day 73 (–) |
| 4 | 1 | 4,650 | day 38 (55) | day 16 (28) | – |
| 5 | 1 | 5,500 | day 50 (74) | day 21 (37) | – |
| 6 | 2 | 6,550 | day 65 (–) | day 27 (49) | – |
| 7 | 2 | 7,800 | day 82 (–) | day 34 (63) | – |
| 8 | 2 | 9,300 | – | day 43 (80) | – |
| 9 | 2 | 11,050 | – | day 53 (–) | – |
| 10 | 3 | 13,150 | – | day 65 (–) | – |
| 11 | 3 | 15,650 | – | day 79 (–) | – |
| 12 | 3 | 18,650 | – | **not by day 90** | – |

The ladder totals 102,200 coins.

**How it meets the targets.** Regular, no spending: 7 rungs in 90 days, 7–17 days apart
(7, 7, 9, 10, 12, 15, 17). Regular with spending: 5 rungs, 8–19 days apart. Heavy, no spending:
11 of 12 by day 79, so the 18,650 top rung is still a goal at day 90 (with spending, 8 of 12).
Light: one rung every 3–4 weeks.

**Rationale and trade-off.** Heavy income is about 2.4× regular. A flat ladder that suits the
regular player (one every 10 days) is bought out by the heavy player in about 7 weeks. The 19% step
spends that gap: early rungs come fast for everyone, and the regular player's later gaps stretch
to 15–19 days past day 50. The search found two near-alternatives, each good in one mode only:

- `3000 × 1.06^(n−1)` (3,000 to 5,700) suits the *spending* regular player best (gaps 8–14 days).
  But the non-spending heavy player buys all 12 by day 49.
- `4250 × 1.11^(n−1)` (4,250 to 13,400) suits the *non-spending* regular player (gaps 10–16 days).
  But the light player gets only 2 rungs in 90 days.

**Things the owner should know before B4 sets prices.**

1. The jump from Moonlit (800) to rung 1 (2,750) is large. One option is to reprice the existing
   three to sit on the curve (for example 1,000 / 1,500 / 2,000). That would give week 1 a goal
   instead of a shopping spree. This is an owner call and is not modelled here.
2. About a quarter of late income is the 50-coin all-shells bonus (GA-ECON-2b). Lowering it, or
   ending it, is the biggest single lever if these prices feel too high: at 0 the regular player
   earns about 28% less from day 15 onward (9,700 of about 34,000).
3. All of this assumes a 50% Perfect rate. Every 10 points of Perfect rate moves level income by
   about 1 coin a level (±4%), which is small next to the profile differences.
