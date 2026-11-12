// Sprint 21 P2 (strata-8j3, D177): the board's frame cost during pours at 4x CPU throttle.
// Level 491 (16 jars) at 390x844, the first 10 pours of the game's own solver path made with real
// mouse taps, on the Classic board (?board=dom) and the Realistic board (?board=gpu), with motion on
// and with reduced motion (every effect off: the board's own redraw cost). Each case runs RUNS times.
// Method as sprint 18's check.cjs: a rAF loop records every frame interval; long tasks are observed.
// Usage (dev server running):  PORT=5182 LABEL=before node production/qa/evidence/sprint-21/perf/perf.cjs
// Writes results-<LABEL>.json next to this file.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5182}`;
const LABEL = process.env.LABEL || 'run';
const RUNS = Number(process.env.RUNS || 3);
// POLL=1: wait on the game state between pours (sprint 18's method) instead of fixed waits.
const BOARDS = (process.env.BOARDS || 'dom,gpu').split(',');
const KEY = 'strata.save.v2';
const VIEW = { width: 390, height: 844 };
const MECHANICS = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam'];
const QUIET = { sound: false, music: false, haptics: false };
const ONB = { visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };

async function open(browser, board, reduced) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.clock.setFixedTime(new Date('2026-11-20T12:00:00Z'));
  await context.addInitScript(([key, mech, quiet, onb]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level: 491, seenMechanics: mech, seenWhatsNew: '9.9.9' });
    s.settings = { ...(s.settings || {}), ...quiet };
    s.onboarding = { ...(s.onboarding || {}), ...onb };
    localStorage.setItem(key, JSON.stringify(s));
  }, [KEY, MECHANICS, QUIET, ONB]);
  const page = await context.newPage();
  await page.goto(`${BASE}/?level=491&board=${board}`);
  await page.waitForFunction(async () => {
    const { state } = await import('/src/ui/state.ts');
    return state.mode === 'level' && state.level === 491 && !!state.session && state.session.board.jars.length === document.querySelectorAll('#board .jar').length;
  }, null, { polling: 100, timeout: 30000 });
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await page.waitForTimeout(1200);
  return { context, page };
}

const solvePath = (page) =>
  page.evaluate(async () => {
    const { state } = await import('/src/ui/state.ts');
    const { solve } = await import('/src/core/solver.ts');
    return solve(state.session.board, 400000).path.map((m) => [m.from, m.to]);
  });
async function tapJar(page, i) {
  const box = await page.locator('#board .jar').nth(i).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
}
/**
 * Taps from, then to, and waits until the pour is over. Without polling (the default), it waits a
 * fixed time: the harness then runs no script in the page while frames are timed (a poll every
 * 50 ms costs a few ms of main thread at 4x throttle and lands in the frames it measures).
 * POLL=1 polls the game state instead, as sprint 18's check.cjs did.
 */
async function pourBy(page, [from, to], settleMs = 1800) {
  if (!process.env.POLL) {
    await tapJar(page, from);
    await page.waitForTimeout(250);
    await tapJar(page, to);
    await page.waitForTimeout(settleMs);
    return;
  }
  const before = await page.evaluate(async () => (await import('/src/ui/state.ts')).state.session.moves);
  await tapJar(page, from);
  await page.waitForTimeout(60);
  await tapJar(page, to);
  await page.waitForFunction(async (n) => {
    const { state } = await import('/src/ui/state.ts');
    return state.session.moves > n && !state.busy && state.returning.size === 0;
  }, before, { polling: 50, timeout: 15000 });
}

async function measure(browser, board, reduced) {
  const { context, page } = await open(browser, board, reduced);
  const render = await page.evaluate(() => document.getElementById('board').dataset.render ?? 'dom');
  const jars = await page.locator('#board .jar').count();
  const moves = (await solvePath(page)).slice(0, 10);
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.evaluate(() => {
    window.__perf = { long: [], frames: [] };
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__perf.long.push(Math.round(e.duration)))).observe({ type: 'longtask', buffered: false });
    let last = performance.now();
    const loop = (t) => {
      window.__perf.frames.push(t - last);
      last = t;
      if (!window.__perf.stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  for (const m of moves) await pourBy(page, m, reduced ? 700 : 1800);
  await page.waitForTimeout(400);
  const poured = await page.evaluate(async () => (await import('/src/ui/state.ts')).state.session.moves);
  const perf = await page.evaluate(() => {
    window.__perf.stop = true;
    const f = window.__perf.frames.slice(2).sort((a, b) => a - b);
    const pct = (p) => Math.round(f[Math.min(f.length - 1, Math.floor(f.length * p))] * 10) / 10;
    return { frames: f.length, median: pct(0.5), p95: pct(0.95), p99: pct(0.99), worst: Math.round(f[f.length - 1]), over20: f.filter((x) => x > 20).length, over34: f.filter((x) => x > 34).length, longTasks: window.__perf.long };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await context.close();
  return { board, render, reducedMotion: reduced, level: 491, jars, pours: moves.length, poured, polled: !!process.env.POLL, cpuThrottle: 4, ...perf };
}

module.exports = { open, solvePath, pourBy };

if (require.main === module) (async () => {
  const browser = await chromium.launch();
  const out = { label: LABEL, at: new Date().toISOString(), runs: RUNS, cases: {} };
  for (const board of BOARDS)
    for (const reduced of [false, true]) {
      const name = `${board}${reduced ? '-reduced' : ''}`;
      const runs = [];
      for (let r = 0; r < RUNS; r++) runs.push(await measure(browser, board, reduced));
      const med = (k) => runs.map((x) => x[k]).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
      out.cases[name] = { medianOfRuns: { p95: med('p95'), p99: med('p99'), worst: med('worst'), over20: med('over20') }, runs };
      console.log(name, JSON.stringify(out.cases[name].medianOfRuns), 'render=' + runs[0].render);
    }
  fs.writeFileSync(path.join(__dirname, `results-${LABEL}.json`), JSON.stringify(out, null, 2) + '\n');
  await browser.close();
})();
