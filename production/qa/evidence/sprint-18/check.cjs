// Sprint 18 evidence (F1-F4, W1; D149, D151) at 390x844:
//  1. perf: level 491 (16 jars), CDP CPU throttle 4x, 10 pours by real taps; long tasks and frame times.
//  2. frame strips: a pour (grains and pile), a seal (cork bounce and sparkle), a win glow run.
//  3. Home on 12 Dec 2026 with Winter Tide's snow; a reduced-motion Home on the same day (two shots, compared).
// Usage: PREVIEW=http://localhost:4390 DEV=http://localhost:4391 node production/qa/evidence/sprint-18/check.cjs
// The pours in 1 and 2 are chosen by the game's own solver (src/core/solver.ts) through the dev server's
// modules, then made with real mouse taps on the jars; Home shots use the built dist (PREVIEW).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const OUT = __dirname;
const PREVIEW = process.env.PREVIEW || 'http://localhost:4390';
const DEV = process.env.DEV || 'http://localhost:4391';
const KEY = 'strata.save.v2';
const VIEW = { width: 390, height: 844 };
// PARTS=perf,strips,win,home runs only those parts (each merges into report.json).
const PARTS = (process.env.PARTS || 'perf,strips,win,home').split(',');
const MECHANICS = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam'];

async function seeded(browser, base, url, date, { reduced = false, level = 80 } = {}) {
  const context = await browser.newContext({ viewport: VIEW, deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.clock.setFixedTime(new Date(`${date}T12:00:00Z`));
  const page = await context.newPage();
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.evaluate(([key, level, mech]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    s.tutorialDone = true;
    s.level = level;
    s.seenMechanics = mech;
    s.settings = { ...(s.settings || {}), sound: false, music: false };
    s.onboarding = { ...(s.onboarding || {}), visits: 1, installShown: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
    localStorage.setItem(key, JSON.stringify(s));
  }, [KEY, level, MECHANICS]);
  await page.goto(base + url);
  await page.waitForTimeout(1200);
  if (process.env.DEBUG) console.log('loaded', url, await page.evaluate(() => [...document.querySelectorAll('#app > [id]:not([hidden])')].map((e) => e.id).join(',')));
  const want = /level=(\d+)/.exec(url);
  if (want && base === DEV)
    await page.waitForFunction(async (n) => {
      const { state } = await import('/src/ui/state.ts');
      return state.mode === 'level' && state.level === n && !!state.session && state.session.board.jars.length === document.querySelectorAll('#board .jar').length;
    }, Number(want[1]), { polling: 100, timeout: 20000 });
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await page.waitForTimeout(300);
  return { context, page };
}

/** The solver's path for the board now in play (dev server modules). */
const solvePath = (page) =>
  page.evaluate(async () => {
    const { state } = await import('/src/ui/state.ts');
    const { solve } = await import('/src/core/solver.ts');
    return solve(state.session.board, 400000).path.map((m) => [m.from, m.to]);
  });
/** Whether pouring from -> to now seals a jar (dev modules, the core rules). */
const sealsNext = (page, [from, to]) =>
  page.evaluate(
    async ([from, to]) => {
      const { state } = await import('/src/ui/state.ts');
      const core = await import('/src/core/board.ts');
      const b = state.session.board;
      const before = b.jars.filter((j) => core.isSealed(j, b.capacity)).length;
      const r = core.pour(b, from, to).board;
      return r.jars.filter((j) => core.isSealed(j, r.capacity)).length > before;
    },
    [from, to],
  );
async function tapJar(page, i) {
  const box = await page.locator('#board .jar').nth(i).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
}
/** Taps from, then to; waits until the pour has finished and the jar is home. */
async function pourBy(page, [from, to]) {
  const before = await page.evaluate(async () => (await import('/src/ui/state.ts')).state.session.moves);
  await tapJar(page, from);
  await page.waitForTimeout(60);
  await tapJar(page, to);
  try {
    await waitPoured(page, before);
  } catch {
    // a tap missed (a jar still settling): deselect and let the caller solve again from the board as it is
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}
/** Waits until the pour counted (moves went up) and the jar is home. */
function waitPoured(page, before) {
  return page.waitForFunction(async (n) => {
    const { state } = await import('/src/ui/state.ts');
    return state.session.moves > n && !state.busy && state.returning.size === 0;
  }, before, { polling: 50, timeout: 6000 });
}
async function strip(page, name, n, every, clip) {
  const files = [];
  for (let k = 0; k < n; k++) {
    const f = path.join(OUT, `${name}-${k + 1}.png`);
    await page.screenshot({ path: f, clip });
    files.push(path.basename(f));
    await page.waitForTimeout(every);
  }
  return files;
}

(async () => {
  const browser = await chromium.launch();
  const reportFile = path.join(OUT, 'report.json');
  const report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : {};

  // 1. Performance at 4x CPU throttle: 10 pours on level 491.
  if (PARTS.includes('perf')) {
    const base = !!process.env.PERF_REDUCED; // the same pours with every effect off: the board's own cost
    const { context, page } = await seeded(browser, DEV, '/?level=491', '2026-11-20', { level: 491, reduced: base });
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
    for (const m of moves) await pourBy(page, m);
    await page.waitForTimeout(400);
    const perf = await page.evaluate(() => {
      window.__perf.stop = true;
      const f = window.__perf.frames.slice(2).sort((a, b) => a - b);
      const pct = (p) => f[Math.min(f.length - 1, Math.floor(f.length * p))];
      return { frames: f.length, median: pct(0.5), p95: pct(0.95), p99: pct(0.99), worst: f[f.length - 1], over20: f.filter((x) => x > 20).length, over34: f.filter((x) => x > 34).length, longTasks: window.__perf.long };
    });
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    report[base ? 'perfReducedBaseline' : 'perf'] = { level: 491, jars, pours: moves.length, cpuThrottle: 4, ...perf };
    await context.close();
  }

  // 2. Frame strips, animations slowed 5x (CDP Animation.setPlaybackRate) so the shots catch them.
  if (PARTS.includes('strips')) {
    const { context, page } = await seeded(browser, DEV, '/?level=491', '2026-11-20', { level: 491 });
    const cdp = await context.newCDPSession(page);
    await cdp.send('Animation.enable');
    const box = await page.locator('#board').boundingBox();
    const clip = { x: 0, y: Math.max(0, box.y - 40), width: VIEW.width, height: Math.min(VIEW.height - Math.max(0, box.y - 40), box.height + 80) };
    const next = async () => (await solvePath(page))[0];
    const idle = () => page.waitForFunction(async () => { const { state } = await import('/src/ui/state.ts'); return !state.busy && state.returning.size === 0; }, null, { polling: 50, timeout: 20000 });
    // a pour that does not seal
    let m = await next();
    while (m && (await sealsNext(page, m))) { await pourBy(page, m); m = await next(); }
    const movesAt = await page.evaluate(async () => (await import('/src/ui/state.ts')).state.session.moves);
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.2 });
    await tapJar(page, m[0]);
    await page.waitForTimeout(80);
    await tapJar(page, m[1]);
    report.pourStrip = await strip(page, 'strip-pour', 8, 140, clip);
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
    await waitPoured(page, movesAt);
    await page.waitForTimeout(600);
    // the next pour that seals
    m = await next();
    while (m && !(await sealsNext(page, m))) { await pourBy(page, m); m = await next(); }
    if (m) {
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 0.25 });
      await tapJar(page, m[0]);
      await page.waitForTimeout(80);
      await tapJar(page, m[1]);
      await page.waitForTimeout(250);
      report.sealStrip = await strip(page, 'strip-seal', 8, 160, clip);
      await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
    }
    await context.close();
  }
  // the win glow run on a short level: every move but the last, then the last with shots until the card
  if (PARTS.includes('win')) {
    const { context, page } = await seeded(browser, DEV, '/?level=12', '2026-11-20', { level: 12 });
    // Every move but the last straight through the game session (the reduced-motion path: no animation),
    // then the last one by real taps, so the strip shows the glow run as a player sees it.
    const last = await page.evaluate(async () => {
      const { state } = await import('/src/ui/state.ts');
      const { solve } = await import('/src/core/solver.ts');
      const path = solve(state.session.board, 400000).path;
      for (const m of path.slice(0, -1)) state.session.pour(m.from, m.to);
      const l = path[path.length - 1];
      return [l.from, l.to];
    });
    await page.waitForTimeout(1500);
    await tapJar(page, last[0]);
    await page.waitForTimeout(80);
    await tapJar(page, last[1]);
    await page.waitForTimeout(450);
    report.winStrip = await strip(page, 'strip-win', 8, 110);
    report.winCardOpen = await page.evaluate(() => !document.getElementById('win').hidden);
    await context.close();
  }

  // 3. Home on 12 Dec: snow; and the same Home under reduced motion (nothing moves).
  if (PARTS.includes('home')) {
    const { context, page } = await seeded(browser, PREVIEW, '/', '2026-12-12');
    await page.waitForTimeout(1500);
    report.snowCanvas = await page.evaluate(() => !!document.querySelector('#home canvas.winter-fx'));
    await page.screenshot({ path: path.join(OUT, 'home-2026-12-12-snow.png') });
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, 'home-2026-12-12-snow-b.png') });
    await context.close();
  }
  if (PARTS.includes('home')) {
    const { context, page } = await seeded(browser, PREVIEW, '/', '2026-12-12', { reduced: true });
    await page.waitForTimeout(800);
    const a = await page.screenshot({ path: path.join(OUT, 'home-2026-12-12-reduced.png') });
    await page.waitForTimeout(1200);
    const b = await page.screenshot({ path: path.join(OUT, 'home-2026-12-12-reduced-later.png') });
    report.reducedHome = { snowCanvas: await page.evaluate(() => !!document.querySelector('canvas.winter-fx')), identicalAfter1200ms: Buffer.compare(a, b) === 0, runningAnimations: await page.evaluate(() => document.getAnimations().filter((x) => x.playState === 'running').length) };
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
