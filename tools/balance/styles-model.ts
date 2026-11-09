/**
 * Sprint 12 S5 balance pass (D86, D88): prices for the 12 jar style pieces (design/gdd/jar-styles.md).
 *
 * Reuses the sprint 7 simulated players (tools/balance/economy-model.ts) over a year. The shop is
 * every priced scene plus the 12 style pieces, which open at styles.unlockLevel. The player buys the
 * starter scenes, then alternates between the next ladder scene and the next style piece (D91: the
 * two ladders share one pace), each as soon as it is affordable. A cheapest-first player would buy
 * every style before the next scene and stall the ladder for months, which is not the intent.
 * The prices are one rising ladder price(i) = round50(P1 * g^(i-1)), i = 1..12, assigned glass,
 * cork, sand in turn: the first piece costs 7 days and the last 14 days of a regular player's net
 * income from level 60 (D86), taking the mean of the with- and without-spending modes. The
 * alternating timeline is reported to show the pace. Deterministic: same numbers every run.
 *
 * Run from the repo root:  npx vite-node tools/balance/styles-model.ts
 * Prints a JSON report (the source of production/qa/sprint-12/balance.md).
 */
import rawConfig from '../../src/config/game-config.json';

process.env.STRATA_MODEL_LIB = '1'; // economy-model.ts then skips its own report
const { PROFILES, simulate } = await import('./economy-model');
type ShopItem = { id: string; price: number; fromLevel?: number };

interface Cfg {
  themes: { list: { id: string; price: number }[] };
  styles: { unlockLevel: number; slots: Record<'glass' | 'cork' | 'sand', { id: string; price: number }[]> };
}
const config = rawConfig as unknown as Cfg;
/** One year: long enough for a regular player to reach the end of both ladders. */
const DAYS = 365;
const LOW = 7;
const HIGH = 14;
const round50 = (x: number) => Math.round(x / 50) * 50;

const scenes: ShopItem[] = config.themes.list.filter((t) => t.price > 0).map(({ id, price }) => ({ id: `scene:${id}`, price }));
/** The 12 bought pieces in ladder order: the cheapest of each slot first, then the next, and so on. */
const pieces = [1, 2, 3, 4].flatMap((rank) => (['glass', 'cork', 'sand'] as const).map((slot) => `${slot}:${config.styles.slots[slot][rank].id}`));

const ladder = (p1: number, g: number) => pieces.map((id, i) => ({ id, price: round50(p1 * g ** i), fromLevel: config.styles.unlockLevel }));
/** Starter scenes, then scene rung 1, style 1, scene rung 2, style 2, ... (whatever is left of either). */
const shopOf = (styles: ShopItem[]) => {
  const sorted = [...scenes].sort((a, b) => a.price - b.price);
  const starter = sorted.filter((x) => x.price < 1000);
  const rungs = sorted.filter((x) => x.price >= 1000);
  const out: ShopItem[] = [...starter];
  for (let i = 0; i < Math.max(rungs.length, styles.length); i++) {
    if (rungs[i]) out.push(rungs[i]);
    if (styles[i]) out.push(styles[i]);
  }
  return out;
};

/** Days between a style purchase and the purchase before it, for one profile and mode. */
function styleGaps(profile: number, spend: boolean, styles: ShopItem[]) {
  const buys = simulate(PROFILES[profile], spend, shopOf(styles), DAYS).purchases;
  return buys.map((b, i) => ({ id: b.id, price: b.price, day: b.day, gap: i === 0 ? null : b.day - buys[i - 1].day })).filter((b) => !b.id.startsWith('scene:'));
}

/** Net coins a day (earned minus boosters bought) from the first day at level 60 to day 365, with no shop. */
function netPerDay(profile: number, spend: boolean): number {
  const r = simulate(PROFILES[profile], spend, [], DAYS);
  const a = r.firstDayAt60 ?? 1;
  const d0 = r.days[a - 1];
  const d1 = r.days[DAYS - 1];
  return (d1.earned - d1.spent - (d0.earned - d0.spent)) / (DAYS - a);
}

// The fit (D86): a regular player earns the first piece in LOW days and the last in HIGH days of
// income. "Income" is the mean of the two regular modes (with and without booster spending), since
// one price cannot sit inside 7-14 days for both: the spending player nets about half as much.
const income = { regular: netPerDay(1, false), regularSpend: netPerDay(1, true) };
const mid = (income.regular + income.regularSpend) / 2;
const p1 = round50(LOW * mid);
const g = (round50(HIGH * mid) / p1) ** (1 / (pieces.length - 1));
const best = { p1, g: Number(g.toFixed(4)), score: 0 };
const styles = ladder(best.p1, best.g);
const report = {
  assumptions: { DAYS, target: `${LOW}-${HIGH} days between purchases (D86)`, unlockLevel: config.styles.unlockLevel },
  income: { regularNetPerDay: Math.round(income.regular), regularSpendNetPerDay: Math.round(income.regularSpend), midPerDay: Math.round(mid) },
  fit: { p1: best.p1, g: best.g, rule: `price(i) = round50(${best.p1} * ${best.g}^(i-1)): ${LOW} to ${HIGH} days of the mid income` },
  daysOfIncome: styles.map(({ id, price }) => ({ id, price, regular: Number((price / income.regular).toFixed(1)), regularSpend: Number((price / income.regularSpend).toFixed(1)), mid: Number((price / mid).toFixed(1)) })),
  prices: styles.map(({ id, price }) => ({ id, price })),
  total: styles.reduce((a, s) => a + s.price, 0),
  profiles: Object.fromEntries(
    [false, true].flatMap((spend) =>
      PROFILES.map((p, i) => {
        const r = simulate(p, spend, shopOf(styles), DAYS);
        return [`${p.name}${spend ? '+spend' : ''}`, {
          firstDayAt60: r.firstDayAt60,
          styleBuys: styleGaps(i, spend, styles).map((g) => `${g.id}@${g.day}(+${g.gap})`),
          sceneBuys: r.purchases.filter((b) => b.id.startsWith('scene:')).map((b) => `${b.price}@${b.day}`).join(' '),
          bought: `${r.purchases.length}/${scenes.length + styles.length}`,
          coinsDay365: r.days[DAYS - 1].coins,
        }];
      }),
    ),
  ),
  baselineScenesOnly: Object.fromEntries(PROFILES.map((p) => [p.name, simulate(p, false, [...scenes].sort((a, b) => a.price - b.price), DAYS).purchases.map((b) => `${b.price}@${b.day}`).join(' ')])),
};
console.log(JSON.stringify(report, null, 1));
