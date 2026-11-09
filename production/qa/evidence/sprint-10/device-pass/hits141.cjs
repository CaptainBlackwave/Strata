const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const dev of ['iPhone SE', 'Pixel 7']) {
    const ctx = await b.newContext({ ...devices[dev] });
    await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify({ level: 141, best: {}, wallet: { coins: 0, boosters: {} }, tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false }, seenWhatsNew: '0.9.1' }));
    const p = await ctx.newPage(); await p.goto('https://captainblackwave.github.io/Strata/'); await p.waitForTimeout(1200);
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(600); await p.click('#btn-map-play', { force: true }); await p.waitForTimeout(1500);
    const hits = await p.evaluate(() => [...document.querySelectorAll('#board .jar')].map((j) => { const r = j.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; }));
    let overlap = 0; for (let i = 0; i < hits.length; i++) for (let k = i + 1; k < hits.length; k++) { const [a, bb, c, d] = hits[i], [e, f, g, h] = hits[k]; if (a < g - 0.5 && e < c - 0.5 && bb < h - 0.5 && f < d - 0.5) overlap++; }
    // Tap the centre of every jar; the selected jar must be the tapped one.
    let wrong = 0; const jars = p.locator('#board .jar');
    for (let i = 0; i < hits.length; i++) { await jars.nth(i).tap({ force: true }); await p.waitForTimeout(60); const sel = await p.evaluate(() => [...document.querySelectorAll('#board .jar')].findIndex((j) => j.classList.contains('selected') || j.getAttribute('aria-pressed') === 'true')); if (sel !== -1 && sel !== i) wrong++; await jars.nth(i).tap({ force: true }); await p.waitForTimeout(60); }
    await p.screenshot({ path: `production/qa/evidence/sprint-10/device-pass/level-141-${dev.replace(' ', '').toLowerCase()}.png` });
    out[dev] = { jars: hits.length, minW: Math.min(...hits.map((h) => h[2] - h[0])).toFixed(1), minH: Math.min(...hits.map((h) => h[3] - h[1])).toFixed(1), overlap, wrongSelections: wrong };
    await ctx.close();
  }
  console.log(JSON.stringify(out)); await b.close();
})();
