// Every Home tab at 412px and at 320px with 150% text: nothing wider than the screen (0.20.1).
// Usage (dev server running): PORT=5184 node production/qa/evidence/0.20.1/weekly/tabs.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5184}`;
(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const [tag, vw, pct] of [['412', 412, 100], ['320-150', 320, 150]]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await ctx.addInitScript(() => {
      if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1');
      localStorage.setItem('strata.save.v2', JSON.stringify({ tutorialDone: true, level: 60, seenWhatsNew: '9.9.9',
        settings: { sound: false, music: false }, onboarding: { visits: 9, installAsks: 2, installShown: true } }));
    });
    const p = await ctx.newPage();
    await p.goto(BASE + '/');
    await p.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('home').hidden);
    await p.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
    await p.waitForTimeout(500);
    await p.evaluate((x) => { document.documentElement.style.fontSize = x + '%'; }, pct);
    for (const tab of ['play', 'today', 'collection', 'profile']) {
      await p.click(`#home-tab-${tab}`); await p.waitForTimeout(500);
      out[`${tab}-${tag}`] = await p.evaluate((tab) => {
        const panel = document.getElementById(`home-panel-${tab}`);
        const wide = [...panel.querySelectorAll('*')].filter((e) => e.getClientRects().length && e.getBoundingClientRect().right > innerWidth + 0.5 && !e.closest('[aria-hidden="true"]'))
          .map((e) => e.id || String(e.className).slice(0, 30));
        return { wide: wide.slice(0, 8) };
      }, tab);
      const h = await p.evaluate((tab) => document.getElementById(`home-panel-${tab}`).scrollHeight, tab);
      await p.setViewportSize({ width: vw, height: Math.min(Math.max(900, h + 260), 4000) });
      await p.waitForTimeout(300);
      await p.screenshot({ path: path.join(__dirname, `tab-${tab}-${tag}.png`) });
      await p.setViewportSize({ width: vw, height: 900 });
    }
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  require('fs').writeFileSync(path.join(__dirname, 'tabs.json'), JSON.stringify(out, null, 1));
  await browser.close();
})();
