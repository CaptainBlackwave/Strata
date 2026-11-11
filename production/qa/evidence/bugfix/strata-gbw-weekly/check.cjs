// strata-gbw.6: the weekly chooser opened on Sunday 23:59 (week 46, board 1 in 20 pours) and left
// open past midnight still shares week 46. Serve the build on PORT (4323).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = `http://localhost:${process.env.PORT ?? 4323}/`;
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const ONB = { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = { level: 120, wallet: { coins: 100, boosters: {} }, tutorialDone: true, settings: QUIET, seenWhatsNew: require('../../../../../package.json').version, onboarding: ONB, weekly: { week: '2026-W46', cleared: [0], pours: { 0: 20 } } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(new Date('2026-11-15T23:59:00Z'));
  await ctx.addInitScript((v) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
    navigator.share = async (d) => { window.__shared = d.text; };
  }, JSON.stringify(save));
  const p = await ctx.newPage();
  for (let i = 0; i < 20; i++) { try { await p.goto(URL); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(1000);
  await p.click('#btn-weekly'); await p.waitForTimeout(300);
  const r = { sheet: await p.textContent('#weekly-sheet-sub') };
  await ctx.clock.setFixedTime(new Date('2026-11-16T00:00:30Z'));
  await p.click('#btn-weekly-share'); await p.waitForTimeout(500);
  await p.screenshot({ path: __dirname + '/share-after-midnight.png' });
  await p.click('#btn-share-send'); await p.waitForTimeout(500);
  r.shared = await p.evaluate(() => window.__shared);
  console.log(JSON.stringify(r));
  require('fs').writeFileSync(__dirname + '/results.json', JSON.stringify(r, null, 2));
  await b.close();
})();
