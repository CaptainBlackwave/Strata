// PR #8 review finding 1: closing the win card quickly must not leave coins flying over the next board.
// usage: node coin-flight.cjs <baseUrl>
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const VERSION = require('../../../../../package.json').version;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } },
    JSON.stringify({ level: 5, best: {}, wallet: { coins: 100, boosters: { hint: 99 } }, tutorialDone: true, settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false }, seenWhatsNew: VERSION }));
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(process.argv[2]); await p.waitForTimeout(800);
  await p.click('#btn-play', { force: true }); await p.waitForTimeout(500); await p.click('#btn-map-play', { force: true }); await p.waitForTimeout(900);
  for (let i = 0; i < 200; i++) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.keyboard.press('h'); await p.waitForTimeout(80);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await p.waitForTimeout(250); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await p.waitForTimeout(380);
  }
  await p.waitForSelector('#win:not([hidden])');
  // Count flying coins that appear after the card is closed, sampled every 50 ms for 2.5 s.
  await p.evaluate(() => { window.__strays = 0; new MutationObserver((ms) => { if (!document.getElementById('win').hidden) return; for (const m of ms) for (const n of m.addedNodes) if (n.classList?.contains('fly-coin')) window.__strays++; }).observe(document.body, { childList: true, subtree: true }); });
  await p.waitForTimeout(250);
  await p.click('#btn-next', { force: true }).catch(() => p.keyboard.press('Enter'));
  await p.waitForTimeout(2500);
  const r = await p.evaluate(() => ({ winHidden: document.getElementById('win').hidden, strayCoins: window.__strays, leftOver: document.querySelectorAll('.fly-coin').length }));
  console.log(JSON.stringify({ ...r, ok: r.winHidden && r.strayCoins === 0 && r.leftOver === 0, errors }));
  await b.close();
})();
