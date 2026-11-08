/**
 * B3 economy model (production/sprints/sprint-7.md; GA-ECON-1, GX-11, GX-12).
 *
 * A deterministic simulated player over 90 days, built on the shipped pure rules
 * (clearReward, spendBooster, recordDailySolve, grantShell, levelSpec) and reading every
 * value from src/config/game-config.json. No randomness: rates are applied with
 * accumulators, so every run gives the same numbers.
 *
 * Run from the repo root:  npx vite-node tools/balance/economy-model.ts
 * Prints a JSON report to stdout (the source of production/qa/sprint-7/economy-model.md).
 */
import rawConfig from '../../src/config/game-config.json';
import { type CollectionConfig, allShells, grantShell, milestoneDue } from '../../src/core/collection';
import { type DailyConfig, type StreakState, recordDailySolve, utcDateKey } from '../../src/core/daily';
import { type BoosterId, type EconomyConfig, type Wallet, addBoosters, addCoins, clearReward, newWallet, spendBooster } from '../../src/core/economy';
import { type GameConfig, levelSpec } from '../../src/core/levels';

type Config = GameConfig & EconomyConfig & DailyConfig & CollectionConfig & { themes: { list: { id: string; price: number }[] } };
const config = rawConfig as unknown as Config;

// ---- Stated assumptions (not in config: they describe the player, not the game) ----
/** Share of first clears won without hint, shuffle or extra jar. */
export const PERFECT_RATE = 0.5;
/** With spending on: paid boosters per 10 levels once the stored charges of that booster are gone. */
export const PAID_PER_10 = 2;
/** Day 1 of the simulation (a Monday, UTC). */
export const START = Date.UTC(2026, 10, 9);
export const DAYS = 90;
/** Ladder search space for the proposed scene curve. */
const LADDER_SIZE = 12;

/** A simulated player. */
interface Profile { readonly name: string; readonly levelsPerDay: number; readonly playsDaily: (dayIndex: number) => boolean }
const PROFILES: Profile[] = [
  // Daily on Mon-Thu, so the 3-day gap each weekend breaks the streak (a 2-day gap could be saved by a pass).
  { name: 'light', levelsPerDay: 3, playsDaily: (d) => d % 7 < 4 },
  { name: 'regular', levelsPerDay: 8, playsDaily: () => true },
  { name: 'heavy', levelsPerDay: 25, playsDaily: () => true },
];

/**
 * The booster a non-perfect clear uses: Extra Jar on a spare-swap level (the GX-12 case),
 * otherwise hint and shuffle 2:1.
 */
function boosterFor(level: number, spare: number, n: number): BoosterId {
  if (spare === 1) return 'extraJar';
  return n % 3 === 2 ? 'shuffle' : 'hint';
}

interface DayRow { day: number; coins: number; earned: number; spent: number; level: number; shells: number }
interface SimResult {
  profile: string; spend: boolean; days: DayRow[];
  bySource: Record<string, number>; boostersPaid: Record<string, number>; chargesUsed: number;
  coinsAtLevel: Record<number, number>; swapLevelsFrom60: number; incomeFrom60: number; firstDayAt60: number | null;
  purchases: { id: string; price: number; day: number }[];
}

/**
 * Runs one profile for DAYS days. `shop` is the list of scene prices to buy in order as
 * soon as the balance covers the next one (after the day's play); empty = never buy.
 */
export function simulate(p: Profile, spend: boolean, shop: { id: string; price: number }[] = []): SimResult {
  let wallet: Wallet = newWallet(config);
  let streak: StreakState = { last: null, streak: 0, best: 0, passes: 0 };
  let shells: string[] = [];
  let level = 1;
  let perfectAcc = 0;
  let paidAcc = 0;
  let nonPerfect = 0;
  let earned = config.economy.startCoins;
  let spent = 0;
  let chargesUsed = 0;
  let swapLevelsFrom60 = 0;
  let incomeFrom60 = 0;
  let firstDayAt60: number | null = null;
  const bySource: Record<string, number> = { start: config.economy.startCoins, levels: 0, perfect: 0, challenge: 0, daily: 0, sets: 0, allShells: 0 };
  const boostersPaid: Record<string, number> = { hint: 0, shuffle: 0, extraJar: 0 };
  const coinsAtLevel: Record<number, number> = {};
  const purchases: SimResult['purchases'] = [];
  const days: DayRow[] = [];
  // Paid uses as a share of non-perfect clears that found no stored charge.
  const paidShare = PAID_PER_10 / (10 * (1 - PERFECT_RATE));

  const earn = (src: string, n: number) => {
    wallet = addCoins(wallet, n);
    bySource[src] += n;
    earned += n;
    if (level >= 60) incomeFrom60 += n;
  };
  const award = () => {
    const r = grantShell(shells, config);
    if (!r.shell) { earn('allShells', config.collection.coinsWhenComplete); return; }
    shells = r.owned;
    if (r.completedSet) {
      earn('sets', config.collection.setReward.coins);
      wallet = addBoosters(wallet, config.collection.setReward.boosters);
    }
  };

  for (let d = 0; d < DAYS; d++) {
    for (let k = 0; k < p.levelsPerDay; k++) {
      const spec = levelSpec(level, config);
      perfectAcc += PERFECT_RATE;
      const perfect = perfectAcc >= 1;
      if (perfect) perfectAcc -= 1;
      if (level >= 60 && firstDayAt60 === null) firstDayAt60 = d + 1;
      if (level >= 60 && spec.spare === 1) swapLevelsFrom60++;
      if (!perfect) {
        const id = boosterFor(level, spec.spare, nonPerfect++);
        if (wallet.boosters[id] > 0) { wallet = spendBooster(wallet, id, config).wallet; chargesUsed++; }
        else if (spend) {
          paidAcc += paidShare;
          if (paidAcc >= 1) {
            paidAcc -= 1;
            const r = spendBooster(wallet, id, config);
            if (r.ok && r.paidCoins > 0) { wallet = r.wallet; spent += r.paidCoins; boostersPaid[id]++; }
          }
        }
      }
      const reward = clearReward({ level, nextLevel: level, perfect, challenge: spec.challenge }, config);
      const e = config.economy;
      earn('levels', e.coinsPerLevel);
      if (perfect) earn('perfect', e.perfectBonus);
      if (spec.challenge) earn('challenge', e.challengeBonus);
      if (reward !== e.coinsPerLevel + (perfect ? e.perfectBonus : 0) + (spec.challenge ? e.challengeBonus : 0)) throw new Error('reward model drifted from clearReward');
      if (milestoneDue(level, config)) award();
      level++;
      if ([25, 50, 100, 150, 200, 300, 500, 1000].includes(level - 1)) coinsAtLevel[level - 1] = earned;
    }
    if (p.playsDaily(d)) {
      const r = recordDailySolve(streak, utcDateKey(new Date(START + d * 86_400_000)), config);
      streak = r.state;
      earn('daily', r.reward);
      award();
    }
    while (shop.length > purchases.length && wallet.coins >= shop[purchases.length].price) {
      const s = shop[purchases.length];
      wallet = { ...wallet, coins: wallet.coins - s.price };
      spent += s.price;
      purchases.push({ ...s, day: d + 1 });
    }
    days.push({ day: d + 1, coins: wallet.coins, earned, spent, level: level - 1, shells: shells.length });
  }
  return { profile: p.name, spend, days, bySource, boostersPaid, chargesUsed, coinsAtLevel, swapLevelsFrom60, incomeFrom60, firstDayAt60, purchases };
}

const scenes = config.themes.list.filter((t) => t.price > 0).sort((a, b) => a.price - b.price).map(({ id, price }) => ({ id, price }));
const round50 = (x: number) => Math.round(x / 50) * 50;
/** Proposed ladder: price_i = round50(P1 * g^(i-1)), i = 1..12. */
const ladder = (p1: number, g: number) => Array.from({ length: LADDER_SIZE }, (_, i) => ({ id: `new-${i + 1}`, price: round50(p1 * g ** i) }));

/** Animation tier per ladder rung (1 colour-only, 2 one ambient layer, 3 layered and reactive). */
export const tierOf = (rung: number) => (rung <= 5 ? 1 : rung <= 9 ? 2 : 3);

/** Days between buys of the regular player, counted from the last existing scene; 0 when inside 7-14. */
function gapPenalty(p: Profile, spend: boolean, shop: { id: string; price: number }[]): number {
  const buys = simulate(p, spend, shop).purchases;
  const daysOf = buys.slice(scenes.length - 1).map((x) => x.day);
  let score = 0;
  for (let i = 1; i < daysOf.length; i++) { const gap = daysOf[i] - daysOf[i - 1]; score += gap < 7 ? 7 - gap : gap > 14 ? gap - 14 : 0; }
  return score + Math.max(0, DAYS - (daysOf[daysOf.length - 1] ?? 0) - 14); // no long dry spell before day 90
}

/**
 * Grid search for one ladder that works with and without booster spending: the regular
 * player's buys stay 7-14 days apart in both modes, and the heavy player who never buys
 * boosters (the richest case) still has the top rung unbought at day 90.
 */
function searchLadder() {
  let best: { p1: number; g: number; score: number } | null = null;
  for (let p1 = 1000; p1 <= 6000; p1 += 250) {
    for (let g100 = 100; g100 <= 135; g100 += 1) {
      const g = g100 / 100;
      const shop = [...scenes, ...ladder(p1, g)];
      if (simulate(PROFILES[2], false, shop).purchases.length >= shop.length) continue;
      const score = gapPenalty(PROFILES[1], false, shop) + gapPenalty(PROFILES[1], true, shop) + (g - 1) * 2; // tie-break: flatter
      if (!best || score < best.score) best = { p1, g, score };
    }
  }
  return best!;
}

const report: Record<string, unknown> = { assumptions: { PERFECT_RATE, PAID_PER_10, start: utcDateKey(new Date(START)), DAYS, scenes } };
const checkpoints = [7, 14, 30, 60, 90];
for (const spend of [false, true]) {
  for (const p of PROFILES) {
    const r = simulate(p, spend);
    const at = Object.fromEntries(checkpoints.map((d) => [d, { coins: r.days[d - 1].coins, earned: r.days[d - 1].earned, spentBoosters: r.days[d - 1].spent, level: r.days[d - 1].level, shells: r.days[d - 1].shells }]));
    const affordable = Object.fromEntries(scenes.map((s) => [s.id + ':' + s.price, r.days.find((x) => x.coins >= s.price)?.day ?? null]));
    const inOrder = simulate(p, spend, [...scenes]).purchases.map((x) => `${x.id}@day${x.day}`);
    const jar = config.boosters.extraJar.price;
    const gx12Cost = r.swapLevelsFrom60 * (jar + config.economy.perfectBonus * PERFECT_RATE);
    report[`${p.name}${spend ? '+spend' : ''}`] = {
      at, affordable, inOrder, bySource: r.bySource, boostersPaid: r.boostersPaid, chargesUsed: r.chargesUsed, coinsAtLevel: r.coinsAtLevel,
      perDayAfter30: Math.round((r.days[89].earned - r.days[29].earned) / 60),
      gx12: { firstDayAt60: r.firstDayAt60, swapLevelsFrom60: r.swapLevelsFrom60, costCoins: gx12Cost, incomeFrom60: r.incomeFrom60, share: r.incomeFrom60 ? Number((gx12Cost / r.incomeFrom60).toFixed(3)) : null },
    };
  }
}
{
  const best = searchLadder();
  const rungs = ladder(best.p1, best.g);
  const shop = [...scenes, ...rungs];
  const buys = (spend: boolean) => Object.fromEntries(PROFILES.map((p) => [p.name, simulate(p, spend, shop).purchases.map((x) => `${x.price}@${x.day}`).join(' ')]));
  report.ladder = {
    p1: best.p1, g: best.g, score: Number(best.score.toFixed(2)),
    rungs: rungs.map((x, i) => ({ rung: i + 1, tier: tierOf(i + 1), price: x.price })),
    total: rungs.reduce((a, x) => a + x.price, 0), buys: buys(false), buysWithSpend: buys(true),
  };
}
console.log(JSON.stringify(report, null, 1));
console.error(`shells in catalog: ${allShells(config).length}`);
