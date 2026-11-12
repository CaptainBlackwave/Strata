// D164: Settings > Realistic sand switches the board in play between Classic and Realistic at once.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = `http://localhost:${process.env.PORT ?? 4520}/?level=7`;
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const ONB = { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = { boards: 3, level: 20, wallet: { coins: 200, boosters: {} }, tutorialDone: true, settings: QUIET, onboarding: ONB, seenWhatsNew: require('../../../../../package.json').version };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save));
  const p = await ctx.newPage();
  for (let i = 0; i < 20; i++) { try { await p.goto(URL); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(1500);
  const render = () => p.evaluate(() => document.getElementById('board').dataset.render ?? 'dom');
  const r = { start: await render() };
  await p.screenshot({ path: `${__dirname}/1-classic.png` });
  await p.click('#btn-settings'); await p.waitForTimeout(400);
  await p.locator('#set-realistic').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${__dirname}/2-settings.png` });
  await p.click('#set-realistic', { force: true }); await p.waitForTimeout(1500);
  await p.click('#btn-close-settings'); await p.waitForTimeout(800);
  r.afterOn = await render();
  await p.screenshot({ path: `${__dirname}/3-realistic.png` });
  await p.reload(); await p.waitForTimeout(2500);
  r.afterReload = await render();
  r.saved = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')).settings.realistic);
  await p.click('#btn-settings'); await p.waitForTimeout(400);
  await p.click('#set-realistic', { force: true }); await p.waitForTimeout(600);
  await p.click('#btn-close-settings'); await p.waitForTimeout(600);
  r.afterOff = await render();
  await p.screenshot({ path: `${__dirname}/4-classic-again.png` });
  console.log(JSON.stringify(r));
  require('fs').writeFileSync(__dirname + '/results.json', JSON.stringify(r, null, 2));
  await b.close();
})();
