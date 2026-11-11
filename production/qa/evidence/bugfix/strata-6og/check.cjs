// strata-6og: a hand-edited v2 save (no tutorialDone, level -5, best 1-44, coins 1e300) resumes at 45 with no tutorial.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = process.env.URL ?? 'http://localhost:4320/';
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 390, height: 844 } });
  const best = Object.fromEntries(Array.from({ length: 44 }, (_, i) => [String(i + 1), 12]));
  await p.addInitScript((best) => {
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    localStorage.setItem('strata.save.v2', JSON.stringify({ level: -5, best, perfect: [], wallet: { coins: 1e300, boosters: {} }, seenWhatsNew: '0.14.1' }));
  }, best);
  for (let i = 0; i < 20; i++) { try { await p.goto(URL); break; } catch { await new Promise((r) => setTimeout(r, 500)); } }
  await p.waitForTimeout(1500);
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
  const coins = await p.textContent('#home-coins').catch(() => null);
  const tutorial = await p.locator('.tutorial, #tutorial, [data-tutorial]').count();
  await p.screenshot({ path: __dirname + '/home.png' });
  const out = { level: saved.level, tutorialDone: saved.tutorialDone, coins: saved.wallet.coins, homeCoins: coins, tutorialNodes: tutorial };
  console.log(JSON.stringify(out));
  require('fs').writeFileSync(__dirname + '/results.json', JSON.stringify(out, null, 2));
  await b.close();
})();
