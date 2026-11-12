// Sprint 21 H1 (D175, D176): the Home hero is the three logo jars. Realistic (a still drawn by the
// board's renderer) and Classic (?board=dom, the CSS logo jars), at 390 px and at 320 px with 150% text,
// and under reduced motion. Also counts requestAnimationFrame calls between sparkles: the ticker sleeps.
// Run with the dev server up: PORT=5181 node production/qa/evidence/sprint-21/hero/check.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = `http://localhost:${process.env.PORT ?? 5181}/`;
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false, realistic: true };
const ONB = { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = { boards: 3, level: 42, wallet: { coins: 300, boosters: { hint: 2, shuffle: 1, extraJar: 1 } }, tutorialDone: true, settings: QUIET, onboarding: ONB, seenWhatsNew: '0.19.1' };
const out = (f) => __dirname + '/' + f;
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = {};
  const run = async (name, { width, text = 100, query = '', reduced = false, count = false }) => {
    const ctx = await b.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await ctx.clock.setFixedTime(new Date('2026-11-12T10:00:00Z'));
    await ctx.addInitScript(([v, t]) => {
      if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
      if (t !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = t + '%'; });
      const raf = window.requestAnimationFrame.bind(window);
      window.__raf = 0;
      window.requestAnimationFrame = (cb) => { window.__raf++; return raf(cb); };
    }, [JSON.stringify(save), text]);
    const p = await ctx.newPage();
    await p.goto(URL + query);
    await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({
      mode: document.getElementById('home-hero').dataset.mode,
      label: document.getElementById('hero-stage').getAttribute('aria-label'),
      canvas: !!document.querySelector('#hero-stage canvas:not([hidden])'),
      splash: !!document.getElementById('splash'),
      scrollX: document.documentElement.scrollWidth > innerWidth,
    }));
    if (count) {
      // Before the first sparkle (firstSparkleMs 4000): nothing should ask for frames.
      const a = await p.evaluate(() => window.__raf);
      await p.waitForTimeout(1000);
      r.rafIdle1s = (await p.evaluate(() => window.__raf)) - a;
      await p.waitForSelector('.hero-sparkle', { timeout: 8000 }).catch(() => null);
      await p.waitForTimeout(500);
      r.sparkleSeen = await p.locator('.hero-sparkle').count();
      await p.locator('#home-hero').screenshot({ path: out(name + '-sparkle.png') });
      await p.waitForTimeout(1500);
      const c = await p.evaluate(() => window.__raf);
      await p.waitForTimeout(3000);
      r.rafBetweenSparkles3s = (await p.evaluate(() => window.__raf)) - c;
    }
    await p.screenshot({ path: out(name + '.png') });
    results[name] = r;
    await ctx.close();
  };
  await run('realistic-390', { width: 390, count: true });
  await run('realistic-320-text150', { width: 320, text: 150 });
  await run('classic-390', { width: 390, query: '?board=dom' });
  await run('classic-320-text150', { width: 320, text: 150, query: '?board=dom' });
  await run('realistic-390-reduced-motion', { width: 390, reduced: true, count: true });
  console.log(JSON.stringify(results, null, 1));
  require('fs').writeFileSync(out('results.json'), JSON.stringify(results, null, 2));
  await b.close();
})();
