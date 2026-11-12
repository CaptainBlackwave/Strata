// Weekly card on the Today tab: five jars side by side, theme as the title (0.20.1 fix).
// Usage (dev server running): PORT=5184 node production/qa/evidence/0.20.1/weekly/check.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5184}`;
(async () => {
  const browser = await chromium.launch();
  for (const [tag, cleared, vw, text] of [['complete-412', 5, 412, 1], ['two-412', 2, 412, 1], ['two-320-150', 2, 320, 1.5]]) {
    const ctx = await browser.newContext({ viewport: { width: vw, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await ctx.addInitScript(([n]) => {
      if (sessionStorage.getItem('seeded')) return; sessionStorage.setItem('seeded', '1');
      const s = { tutorialDone: true, level: 60, seenWhatsNew: '9.9.9', settings: { sound: false, music: false } };
      s.onboarding = { visits: 9, installShown: true, installAsks: 2, offlineNoticed: true, homeHintSeen: true };
      localStorage.setItem('strata.save.v2', JSON.stringify(s));
      window.__cleared = n;
    }, [cleared]);
    const page = await ctx.newPage();
    await page.goto(BASE + '/');
    await page.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('home').hidden, null, { timeout: 30000 });
    await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
    await page.waitForTimeout(800);
    await page.evaluate(async (n) => {
      const { state } = await import('/src/ui/state.ts');
      const { weekKey } = await import('/src/core/weekly.ts').catch(() => ({}));
      state.save.weekly = { ...state.save.weekly, week: weekKey ? weekKey(state.clock()) : state.save.weekly.week, cleared: [...Array(n).keys()] };
      const m = await import('/src/ui/screens/sheets/weekly.ts');
      m.renderWeeklyCard();
    }, cleared);
    if (text !== 1) await page.evaluate((t) => { document.documentElement.style.fontSize = t * 100 + '%'; }, text);
    await page.click('#home-tab-today').catch(() => {});
    await page.waitForTimeout(500);
    const card = page.locator('#btn-weekly');
    await card.scrollIntoViewIfNeeded();
    const info = await page.evaluate(() => {
      const c = document.getElementById('btn-weekly').getBoundingClientRect();
      const jars = [...document.querySelectorAll('#weekly-jars i')].map((i) => i.getBoundingClientRect());
      return { title: document.getElementById('weekly-title').textContent, sub: document.getElementById('weekly-sub').textContent,
        progress: document.getElementById('weekly-progress').textContent,
        pageOverflow: document.documentElement.scrollWidth > innerWidth, cardRight: Math.round(c.right), vw: innerWidth,
        oneRow: jars.every((j) => Math.abs(j.top - jars[0].top) < 1), insideCard: jars.every((j) => j.bottom <= c.bottom && j.top >= c.top) };
    });
    console.log(tag, JSON.stringify(info));
    await card.screenshot({ path: path.join(__dirname, `weekly-${tag}.png`) });
    await ctx.close();
  }
  await browser.close();
})();
