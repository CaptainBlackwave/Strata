// Sprint 13 E1 (D99, D100): the long-streak step on a daily win, and the new top scene prices.
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5532 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base, out] = process.argv.slice(2);
const NOW = new Date('2026-11-12T12:00:00Z');
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const R = {};
async function page(b, save) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(NOW);
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save));
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base); await p.waitForTimeout(900);
  return { ctx, p };
}
async function winWithHints(p) {
  for (let i = 0; i < 300; i++) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.keyboard.press('h'); await p.waitForTimeout(70);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await p.waitForTimeout(250); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await p.waitForTimeout(380);
  }
  await p.waitForSelector('#win:not([hidden])'); await p.waitForTimeout(800);
}
(async () => {
  const b = await chromium.launch();
  const seed = { seenWhatsNew: VERSION, tutorialDone: true, level: 70, settings: QUIET, seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], onboarding: { visits: 1, installShown: true, offlineNoticed: true }, wallet: { coins: 100, boosters: { hint: 99 } } };
  // Day 30 of a streak: the daily pays 125 and says why.
  { const { ctx, p } = await page(b, { ...seed, daily: { last: '2026-11-11', streak: 29, best: 29, passes: 0 } });
    await p.click('#btn-daily', { force: true }); await p.waitForTimeout(800);
    if (await p.locator('#intro:not([hidden])').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
    await winWithHints(p);
    R.day30 = await p.evaluate(() => ({ text: document.getElementById('win-text').textContent, reward: document.getElementById('win-coins').textContent, note: document.getElementById('win-note').textContent, save: JSON.parse(localStorage.getItem('strata.save.v2')).daily }));
    await p.screenshot({ path: path.join(out, 'daily-day30-long-streak.png') });
    R.errors30 = p.errors; await ctx.close(); }
  // The new top scene prices in the Scenes sheet.
  { const { ctx, p } = await page(b, { ...seed, wallet: { coins: 5000 } });
    await p.click('#btn-scenes', { force: true }); await p.waitForTimeout(500);
    R.prices = await p.evaluate(() => [...document.querySelectorAll('#scene-grid .scene-card')].map((c) => `${c.querySelector('.scene-name').textContent}: ${c.querySelector('.scene-status').textContent.trim()}`));
    await p.locator('#scene-grid .scene-card').last().scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(out, 'scenes-top-prices.png') });
    R.errorsScenes = p.errors; await ctx.close(); }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
})();
