/**
 * Sprint 13 E1 (D99, D100): new prices for scene ladder rungs 6-12, with the long-streak steps on.
 *
 * Reuses the sprint 7 simulated players (tools/balance/economy-model.ts) over a year. Rungs 1-5
 * keep their prices. Rungs 6-12 follow price(k) = round50(R5 * g^k), k = 1..7, with the largest
 * g for which a regular player (8 levels and the daily a day, no booster buying: the scene
 * ladder's reference player since D32) buys each of those rungs at most 14 days after the one
 * before, buying scenes in price order. The report also shows the booster-buying mode and the
 * sprint 12 player who alternates scenes and jar styles. Deterministic.
 *
 * Run from the repo root:  npx vite-node tools/balance/late-ladder.ts
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
const DAYS = 365;
const HIGH = 14;
const round50 = (x: number) => Math.round(x / 50) * 50;

const starter = config.themes.list.filter((t) => t.price > 0 && t.price < 1000).sort((a, b) => a.price - b.price);
const rungs = config.themes.list.filter((t) => t.price >= 1000).sort((a, b) => a.price - b.price);
const keep = rungs.slice(0, 5);
const R5 = keep[4].price;
const relaid = (g: number) => rungs.slice(5).map((t, k) => ({ id: t.id, price: round50(R5 * g ** (k + 1)) }));
const scenesShop = (top: ShopItem[]) => [...starter, ...keep, ...top].map(({ id, price }) => ({ id: `scene:${id}`, price }));

/** Days between consecutive buys of rungs 6-12 (and rung 5 before them), for one profile and mode. */
function topGaps(profile: number, spend: boolean, top: ShopItem[]): number[] {
  const buys = simulate(PROFILES[profile], spend, scenesShop(top), DAYS).purchases;
  const from = starter.length + 4; // rung 5's purchase
  return buys.slice(from + 1).map((b, i) => b.day - buys[from + i].day);
}

let g = 1.0;
for (let g1000 = 1000; g1000 <= 1150; g1000 += 1) {
  const top = relaid(g1000 / 1000);
  const gaps = topGaps(1, false, top);
  if (gaps.length === top.length && gaps.every((d) => d <= HIGH) && new Set([...keep.map((x) => x.price), ...top.map((x) => x.price)]).size === keep.length + top.length && top[0].price > R5) g = g1000 / 1000;
}
const top = relaid(g);

/** The sprint 12 alternating player: starter scenes, then scene rung i, style i, ... */
const pieces = [1, 2, 3, 4].flatMap((rank) => (['glass', 'cork', 'sand'] as const).map((slot) => ({ id: `${slot}:${config.styles.slots[slot][rank].id}`, price: config.styles.slots[slot][rank].price, fromLevel: config.styles.unlockLevel })));
function alternating(allRungs: ShopItem[]): ShopItem[] {
  const out: ShopItem[] = starter.map(({ id, price }) => ({ id: `scene:${id}`, price }));
  for (let i = 0; i < Math.max(allRungs.length, pieces.length); i++) {
    if (allRungs[i]) out.push({ id: `scene:${allRungs[i].id}`, price: allRungs[i].price });
    if (pieces[i]) out.push(pieces[i]);
  }
  return out;
}

const report = {
  assumptions: { DAYS, target: `rungs 6-12 at most ${HIGH} days apart for a regular player who does not buy boosters (D100)`, longSteps: (rawConfig as { daily: { streak: { longSteps: unknown } } }).daily.streak.longSteps },
  fit: { R5, g, rule: `price(rung 5 + k) = round50(${R5} * ${g}^k), k = 1..7` },
  prices: { before: rungs.slice(5).map(({ id, price }) => ({ id, price })), after: top },
  totals: { before: rungs.reduce((a, t) => a + t.price, 0), after: keep.reduce((a, t) => a + t.price, 0) + top.reduce((a, t) => a + t.price, 0) },
  regular: {
    before: { gaps: topGaps(1, false, rungs.slice(5)), spendGaps: topGaps(1, true, rungs.slice(5)) },
    after: { gaps: topGaps(1, false, top), spendGaps: topGaps(1, true, top) },
  },
  scenesOnlyTimeline: Object.fromEntries(
    [false, true].flatMap((spend) => PROFILES.map((p) => [`${p.name}${spend ? '+spend' : ''}`, simulate(p, spend, scenesShop(top), DAYS).purchases.map((b) => `${b.price}@${b.day}`).join(' ')])),
  ),
  withStyles: Object.fromEntries(
    [false, true].map((spend) => {
      const r = simulate(PROFILES[1], spend, alternating([...keep, ...top]), DAYS);
      return [`regular${spend ? '+spend' : ''}`, { bought: `${r.purchases.length}/${starter.length + rungs.length + pieces.length}`, last: r.purchases.at(-1)?.day }];
    }),
  ),
};
console.log(JSON.stringify(report, null, 1));
