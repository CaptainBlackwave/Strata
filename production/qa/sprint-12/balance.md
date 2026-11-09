# Balance pass: jar style prices (sprint 12, S5; D86, D88)

Source: `npx vite-node tools/balance/styles-model.ts` (raw output: `styles-model.json`). It reuses the
sprint 7 simulated players (`tools/balance/economy-model.ts`: light 3 levels a day, regular 8 plus the
daily, heavy 25 plus the daily) over **365 days**, with every value read from `game-config.json`.

## Income from level 60

| Player | Reaches level 60 | Net coins a day, no boosters bought | Net coins a day, buying boosters |
|---|---|---|---|
| Light | day 20 | 111 | 49 |
| Regular | day 8 | **326** | **154** |
| Heavy | day 3 | 802 | 267 |

A regular player who buys boosters nets about half as much, so one price cannot cost 7–14 days for
both. The ladder uses the **mean of the two regular modes, 240 coins a day**.

## The prices (D86)

`price(i) = round50(1700 × 1.0636^(i−1))`, i = 1…12, assigned glass, cork, sand in turn: the first
piece costs 7 days and the last 14 days of the mean income. Total 29,250 coins.

| Rank | Glass | Cork | Sand |
|---|---|---|---|
| 1 | Sea glass 1,700 | Driftwood 1,800 | Fine grain 1,900 |
| 2 | Amber bottle 2,050 | Rope knot 2,200 | Glint 2,300 |
| 3 | Cobalt rim 2,450 | Scallop cap 2,600 | Layered 2,800 |
| 4 | Pearl 2,950 | Brass lid 3,150 | Ripple 3,350 |

Days of a regular player's income for each piece: 5.2–10.3 without buying boosters, 11–21.7 when buying
them, 7–14 at the mean. `tests/unit/balance/style-prices.test.ts` keeps the config on this ladder.

## The pace, alternating scenes and styles (D91)

The model's player buys the starter scenes, then alternates between the next ladder scene and the next
style piece. (A player who always buys the cheapest thing would buy all 12 styles before the next scene
and stall the scene ladder for months.)

| Player | Everything bought in a year | Styles bought | Notes |
|---|---|---|---|
| Regular | 27 of 27, last on day 317 | 12 (days 16–317) | the scene ladder ends on day 306, against day 226 without styles |
| Regular, buying boosters | 19 of 27 | 8 | |
| Heavy | 27 of 27 by day 128 | 12 | still the heavy player's goal for four months |
| Light | 16 of 27 | 6 | |

The styles add about 80 days of goals for a regular player (29,250 coins at 326 a day; about 190 days
when buying boosters).

## Findings for the owner

- **The scene ladder's top rungs now take 3–5 weeks each for a regular player.** That holds even with
  no styles: rungs 2,500…11,650 land on days 11, 19, 29, 41, 54, 70, 88, 108, 132, 159, 190, 226, so the
  gaps grow from 8 to 36 days. The sprint 7 fit assumed the 50-coin post-collection bonus, which D38
  then removed. This sprint does not change scene prices (out of scope). Repricing the top rungs, or
  adding a late faucet, is a question for a later balance pass.
- **D87 was asked from a stale line.** `economy.md` still listed the 50-coin post-collection bonus as a
  live faucet, but D38 removed it in sprint 7 (`collection.coinsWhenComplete: 0`). "Keep it" therefore
  keeps the current behaviour: no bonus. The stale lines in `economy.md` are corrected in this sprint.
