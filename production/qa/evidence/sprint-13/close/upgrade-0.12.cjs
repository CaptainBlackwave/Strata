// Sprint 13 close (R1): a 0.12.0 save at level 101 upgrades to 0.13.0, sees What's new, meets the hourglass and wins.
// usage: node upgrade-0.12.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [base, out] = process.argv.slice(2);
const OLD = {
  level: 101, best: {}, wallet: { coins: 6000, boosters: { hint: 99 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false },
  daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [],
  seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'],
  themes: { owned: ['midday', 'wintersnow'], selected: 'midday', auto: false },
  styles: { owned: ['glass:seaglass'], worn: { glass: 'seaglass', cork: 'cork', sand: 'plain' } },
  onboarding: { visits: 5, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true },
  seenWhatsNew: '0.12.0',
};
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(OLD));
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(String(e))); p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await p.goto(base); await p.waitForTimeout(900);
  const card = await p.evaluate(() => { const el = [...document.querySelectorAll('[role=dialog],[role=alertdialog]')].find((e) => e.offsetParent && /new/i.test(e.textContent)); return el ? el.innerText.replace(/\s+/g, ' ') : null; });
  console.log('whats new card:', card);
  await p.screenshot({ path: path.join(out, 'whats-new-0.13.0.png') });
  await p.getByRole('button', { name: 'Got it' }).click();
  let saved = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
  console.log('seenWhatsNew:', saved.seenWhatsNew, '| level:', saved.level, '| coins:', saved.wallet.coins, '| scenes owned:', saved.themes.owned.join(','), '| worn glass:', saved.styles.worn.glass);
  await p.click('#btn-play', { force: true }); await p.waitForTimeout(600);
  console.log('map play:', (await p.textContent('#btn-map-play')).trim());
  await p.click('#btn-map-play', { force: true }); await p.waitForTimeout(1200);
  const intro = await p.evaluate(() => { const el = document.querySelector('.intro-card'); return el && el.offsetParent ? el.innerText.replace(/\s+/g, ' ').slice(0, 160) : null; });
  console.log('intro card:', intro);
  await p.screenshot({ path: path.join(out, 'level-101-intro.png') });
  if (intro) { await p.click('#btn-intro-ok', { force: true }); await p.waitForTimeout(500); }
  console.log('hourglass on board:', await p.locator('#board .jar[data-hourglass], #board .jar.hourglass').count());
  await p.screenshot({ path: path.join(out, 'level-101-board.png') });
  let won = false;
  for (let i = 0; i < 300 && !won; i++) {
    if (await p.locator('#win:not([hidden])').count()) { won = true; break; }
    await p.keyboard.press('h'); await p.waitForTimeout(60);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await p.waitForTimeout(250); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await p.waitForTimeout(350);
  }
  console.log('won level 101 with hints:', won);
  await p.screenshot({ path: path.join(out, 'win-level-101.png') });
  saved = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
  console.log('after win: level', saved.level, '| seenMechanics', saved.seenMechanics.join(','), '| scenes owned:', saved.themes.owned.join(','));
  console.log('errors:', JSON.stringify(errors));
  await b.close();
})();
