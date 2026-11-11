// strata-gbw.7: replay level 615 (and 545) from the map; the page must not freeze (no long task near 1 s).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'); const OUT = __dirname; const base = `http://localhost:${process.env.PORT ?? 4324}/`;
const w = (p, ms) => p.waitForTimeout(ms);
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const ONB = { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
(async () => {
  const b = await chromium.launch(); const R = {};
  for (const lvl of [615, 545]) {
    const SEED = { level: lvl + 3, boards: 30, tutorialDone: true, settings: QUIET, seenWhatsNew: require('../../../../../package.json').version, onboarding: ONB, seenMechanics: ['narrow','hourglass','locked','funnel','sieve','clam','lid','stone'] };
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
    await ctx.addInitScript(([v]) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } window.__lt = []; new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__lt.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: true }); }, [JSON.stringify(SEED)]);
    const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
    await p.goto(base); await w(p, 4000);
    await p.click('#btn-play'); await w(p, 1000);
    const stone = p.locator(`#map [data-level="${lvl}"]`);
    const n = await stone.count();
    if (!n) { R[lvl] = { error: 'no stone' }; await ctx.close(); continue; }
    await stone.scrollIntoViewIfNeeded(); await w(p, 400); await stone.click({ force: true }); await w(p, 400);
    await p.evaluate(() => (window.__lt = []));
    const t0 = Date.now();
    await p.click('#btn-stone-replay');
    await p.waitForFunction((l) => document.getElementById('level-label')?.textContent?.includes(String(l)), lvl, { timeout: 20000 });
    const t1 = Date.now();
    await w(p, 500);
    R[lvl] = { msToBoard: t1 - t0, longTasks: await p.evaluate(() => window.__lt), label: await p.textContent('#level-label'), errors: p.errors };
    await p.screenshot({ path: `${OUT}/M-replay-${lvl}.png` });
    await ctx.close();
  }
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(R, null, 1)); console.log(JSON.stringify(R, null, 1)); await b.close();
})();
