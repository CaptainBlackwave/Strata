// S1: Settings shows "Your stats"; the sheet lists the sections and Copy puts plain text on the clipboard.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = `http://localhost:${process.env.PORT ?? 4395}/`;
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const ONB = { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = { boards: 3, level: 80, wallet: { coins: 2400, boosters: {} }, tutorialDone: true, settings: QUIET, onboarding: ONB, seenWhatsNew: require('../../../../../package.json').version, daily: { last: '2026-12-12', streak: 6, best: 21, passes: 0 }, events: { wintertide: { year: 2026, cleared: [1, 2, 3], pours: {} } }, badges: ['daily-1'] };
(async () => {
  const b = await chromium.launch();
  const out = {};
  for (const [tag, vp, big] of [['390', { width: 390, height: 844 }, false], ['320-150', { width: 320, height: 568 }, true]]) {
    const ctx = await b.newContext({ viewport: vp, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.clock.setFixedTime(new Date('2026-12-12T12:00:00Z'));
    await ctx.addInitScript(([v, big]) => {
      if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
      if (big) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });
    }, [JSON.stringify(save), big]);
    const p = await ctx.newPage();
    for (let i = 0; i < 20; i++) { try { await p.goto(URL); break; } catch { await p.waitForTimeout(500); } }
    await p.waitForTimeout(1200);
    await p.click('#btn-home-settings'); await p.waitForTimeout(400);
    await p.locator('#btn-stats').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${__dirname}/settings-${tag}.png` });
    await p.click('#btn-stats'); await p.waitForTimeout(400);
    await p.screenshot({ path: `${__dirname}/stats-${tag}.png` });
    await p.click('#btn-copy-stats'); await p.waitForTimeout(300);
    out[tag] = { status: await p.textContent('#stats-status'), clip: await p.evaluate(() => navigator.clipboard.readText()), overflow: await p.evaluate(() => document.documentElement.scrollWidth > innerWidth) };
    await p.locator('#btn-close-stats').scrollIntoViewIfNeeded();
    await p.screenshot({ path: `${__dirname}/stats-${tag}-end.png` });
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  require('fs').writeFileSync(__dirname + '/results.json', JSON.stringify(out, null, 2));
  await b.close();
})();
