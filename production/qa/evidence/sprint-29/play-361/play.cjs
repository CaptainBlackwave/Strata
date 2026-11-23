// Sprint 29 R1: a full play-through of level 361 on the Classic (dom) and Realistic (gpu) boards, by
// tapping jars as a player would. It follows the solver's path from the dealt board, tries an Undo
// after the first pour, and checks after every step that the jars on screen match the session (unit
// count and the pair jars' state) and that the pair's order holds: the sunrise jar is the first jar
// filled and the sunset jar is filled by the winning pour.
// Usage (dev server running): PORT=5229 node production/qa/evidence/sprint-29/play-361/play.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5229}`;
const LEVEL = 361;
const SEEN = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam', 'wet', 'tide', 'crab', 'lighthouse', 'sun'];
const out = (f) => path.join(__dirname, f);

async function run(browser, board) {
  const context = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript(([level, seen, board]) => {
    localStorage.setItem('strata.save.v2', JSON.stringify({ tutorialDone: true, level, seenMechanics: seen, seenWhatsNew: '9.9.9',
      settings: { sound: false, music: false, haptics: false, realistic: board === 'gpu' },
      onboarding: { visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true } }));
  }, [LEVEL, SEEN, board]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?level=${LEVEL}&board=${board}`);
  await page.waitForSelector('#board .jar .unit', { state: 'attached', timeout: 60000 });
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; window.__B = await import('/src/core/board.ts'); window.__V = await import('/src/core/solver.ts'); });
  await page.waitForFunction((n) => window.__S?.session && window.__S.level === n, LEVEL, { polling: 100, timeout: 30000 });
  await page.waitForTimeout(1200);
  const idle = () => page.waitForFunction(() => !window.__S.busy && window.__S.returning.size === 0, null, { polling: 50, timeout: 20000 });
  const tap = async (i) => { const b = await page.locator('#board .jar').nth(i).boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.6); await page.waitForTimeout(100); };
  const check = () => page.evaluate(() => {
    const B = window.__B; const s = window.__S.session; const cap = s.board.capacity; const out = [];
    document.querySelectorAll('#board .jar').forEach((el, i) => {
      const j = s.board.jars[i];
      const n = el.querySelectorAll('.unit').length;
      if (n !== j.units.length) out.push(`jar ${i}: ${n} units on screen, ${j.units.length} in the session`);
      if (j.sun && el.classList.contains('sun-filled') !== B.isComplete(j, cap)) out.push(`jar ${i}: sun-filled class does not match`);
    });
    return out;
  });
  const order = () => page.evaluate(() => { const s = window.__S.session; const B = window.__B; const cap = s.board.capacity;
    return s.board.jars.map((j, i) => (B.isComplete(j, cap) && j.units.length ? i : -1)).filter((i) => i >= 0); });
  const pourStep = async (from, to) => { const m0 = await page.evaluate(() => window.__S.session.moves); await tap(from); await tap(to);
    await page.waitForFunction((b) => window.__S.session.moves > b, m0, { polling: 30, timeout: 5000 }); await idle(); };
  const steps = [];
  const sol = await page.evaluate(() => window.__V.solve(window.__S.session.board, 2_000_000));
  const rise = await page.evaluate(() => window.__S.session.board.jars.findIndex((j) => j.sun?.at === 'rise'));
  const set = await page.evaluate(() => window.__S.session.board.jars.findIndex((j) => j.sun?.at === 'set'));
  const filledOrder = [];
  for (let k = 0; k < sol.path.length; k++) {
    const m = sol.path[k];
    const before = await order();
    await pourStep(m.from, m.to);
    const after = await order();
    for (const i of after) if (!before.includes(i)) filledOrder.push(i);
    steps.push({ what: `pour ${m.from}->${m.to}`, mismatches: await check() });
    if (k === 0) {
      await page.locator('#btn-undo').click(); await idle(); await page.waitForTimeout(300);
      steps.push({ what: 'undo', mismatches: await check() });
      await pourStep(m.from, m.to);
      steps.push({ what: `pour ${m.from}->${m.to} again`, mismatches: await check() });
    }
  }
  await page.waitForTimeout(2500);
  const status = await page.evaluate(() => window.__S.session.status);
  await page.screenshot({ path: out(`play-${board}-win.png`) });
  await context.close();
  return { board, pours: sol.path.length, status, rise, set, filledOrder, sunriseFirst: filledOrder[0] === rise, sunsetLast: filledOrder[filledOrder.length - 1] === set,
    mismatches: steps.reduce((n, s) => n + s.mismatches.length, 0), errors, steps };
}

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const board of ['dom', 'gpu']) results[board] = await run(browser, board);
  await browser.close();
  fs.writeFileSync(out('play-results.json'), JSON.stringify(results, null, 2));
  for (const r of Object.values(results)) console.log(`${r.board}: ${r.status} in ${r.pours} pours; sunrise first ${r.sunriseFirst}, sunset last ${r.sunsetLast}; ${r.mismatches} mismatches; ${r.errors.length} page errors`);
})();
