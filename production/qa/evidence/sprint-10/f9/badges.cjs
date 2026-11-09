// F9: at 200% text, do the booster badges cover their tool's icon? Measures overlap area and screenshots.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const [base, out, tag] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const [dev, text, coins, charges] of [['iPhone SE', 200, 500, 3], ['iPhone SE', 200, 500, 0], ['Pixel 7', 200, 500, 3], ['iPhone SE', 100, 500, 3], ['Pixel 7', 100, 500, 0]]) {
    const ctx = await b.newContext({ ...devices[dev], reducedMotion: 'reduce' });
    await ctx.addInitScript(([v, t]) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } if (t !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = t + '%'; }); },
      [JSON.stringify({ level: 5, best: {}, wallet: { coins, boosters: { undo: 0, shuffle: charges, extraJar: charges, hint: charges ? 50 : 0 } }, tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false }, seenWhatsNew: require('/home/user/Strata/package.json').version }), text]);
    const p = await ctx.newPage(); await p.goto(base); await p.waitForTimeout(700);
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(500); await p.click('#btn-map-play', { force: true }); await p.waitForTimeout(900);
    const m = await p.evaluate(() => [...document.querySelectorAll('.toolbar .tool')].filter((t) => t.querySelector('.badge') && getComputedStyle(t.querySelector('.badge')).display !== 'none' && t.querySelector('.badge').textContent.trim()).map((t) => {
      const a = t.querySelector('.badge').getBoundingClientRect(), i = t.querySelector('svg').getBoundingClientRect(), n = t.querySelector('.tool-name').getBoundingClientRect(), tool = t.getBoundingClientRect();
      const ov = Math.max(0, Math.min(a.right, i.right) - Math.max(a.left, i.left)) * Math.max(0, Math.min(a.bottom, i.bottom) - Math.max(a.top, i.top));
      return { tool: t.querySelector('.tool-name').textContent, badge: t.querySelector('.badge').textContent, iconCovered: Math.round((100 * ov) / (i.width * i.height)) + '%', overName: a.bottom > n.top + 1, insideScreen: a.right <= innerWidth && a.top >= 0 };
    }));
    const k = `${dev.replace(' ', '').toLowerCase()}-${text}-${charges ? 'charges' : 'prices'}`;
    await p.locator('.toolbar').screenshot({ path: `${out}/badges-${k}-${tag}.png` });
    res[k] = m; await ctx.close();
  }
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
