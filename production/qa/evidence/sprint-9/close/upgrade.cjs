// Sprint 9 close: an existing 0.8.0 save (no `perfect` field) upgrades to 0.9.0 and plays through the map.
// usage: node upgrade.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [base, out] = process.argv.slice(2);
const OLD = { level: 12, best: { 3: 14, 7: 20 }, wallet: { coins: 300, boosters: { hint: 50 } }, tutorialDone: true, settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: ['periwinkle'], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false }, stats: { perfectClears: 4, dailiesSolved: 0, pours: 200, coinsEarned: 400, boostersUsed: 1 }, seenWhatsNew: '0.8.0' };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(OLD));
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(base); await p.waitForTimeout(800);
  const card = await p.evaluate(() => { const el = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].find((e) => e.offsetParent && /new/i.test(e.textContent)); return el ? el.innerText.replace(/\s+/g, ' ') : null; });
  console.log('whats new card:', card);
  await p.screenshot({ path: path.join(out, 'whats-new-0.9.0.png') });
  await p.getByRole('button', { name: 'Got it' }).click();
  const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
  console.log('seenWhatsNew:', saved.seenWhatsNew, '| perfect:', JSON.stringify(saved.perfect), '| level:', saved.level, '| perfectClears:', saved.stats.perfectClears);
  await p.click('#btn-play', { force: true }); await p.waitForTimeout(600);
  console.log('map open:', await p.locator('#map:not([hidden])').count() === 1, '| map play:', await p.textContent('#btn-map-play'));
  await p.keyboard.press('Enter'); await p.waitForTimeout(900);
  console.log('board label:', (await p.textContent('.hud')).replace(/\s+/g, ' ').trim().slice(0, 40));
  let won = false;
  for (let i = 0; i < 200 && !won; i++) {
    if (await p.locator('#win:not([hidden])').count()) { won = true; break; }
    await p.keyboard.press('h'); await p.waitForTimeout(60);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await p.waitForTimeout(250); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await p.waitForTimeout(350);
  }
  console.log('won level 12:', won);
  await p.screenshot({ path: path.join(out, 'win-level-12.png') });
  const after = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
  console.log('after win: level', after.level, '| best[12]', after.best[12], '| perfect', JSON.stringify(after.perfect));
  console.log('errors:', JSON.stringify(errors));
  await b.close();
})();
