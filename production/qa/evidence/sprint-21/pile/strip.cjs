// Sprint 21 P1 (strata-2en, D177): a mid-pour frame strip of the target jar on the Realistic board.
// Level 12 at 390x844 (DPR 3), the first pour of the game's own solver path made with real taps.
// The page clock is Playwright's fake clock, so every frame is taken at the same simulated time on
// every run: rAF and performance.now advance only by clock.runFor (16 ms a frame), and the sand
// sim is seeded per pour, so "before" and "after" strips show the same pour at the same moments.
// Usage (dev server running):  PORT=5182 LABEL=before node production/qa/evidence/sprint-21/pile/strip.cjs
// Writes <LABEL>-<k>.png (the target jar, one per FRAMES entry) and <LABEL>-strip.png (all of them side by side).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5182}`;
const LABEL = process.env.LABEL || 'run';
const LEVEL = Number(process.env.LEVEL || 12);
const MOVE = Number(process.env.MOVE || 0); // which solver move to film
/** Milliseconds after the second tap at which each frame is taken. */
const FRAMES = (process.env.FRAMES || '900,1050,1200,1350,1500,1700,1950,2400').split(',').map(Number);
const KEY = 'strata.save.v2';
const MECHANICS = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam'];

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, serviceWorkers: 'block' });
  await context.addInitScript(([key, level, mech]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level, seenMechanics: mech, seenWhatsNew: '9.9.9' });
    s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false, realistic: true };
    s.onboarding = { ...(s.onboarding || {}), visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
    localStorage.setItem(key, JSON.stringify(s));
  }, [KEY, LEVEL, MECHANICS]);
  await context.clock.install({ time: new Date('2026-11-20T12:00:00Z') });
  const page = await context.newPage();
  await page.goto(`${BASE}/?level=${LEVEL}&board=gpu`);
  const ready = async () =>
    page.evaluate(async (n) => {
      const { state } = await import('/src/ui/state.ts');
      return state.mode === 'level' && state.level === n && !!state.session && document.getElementById('board').dataset.render === 'gpu';
    }, LEVEL);
  for (let k = 0; k < 200 && !(await ready()); k++) await context.clock.runFor(100);
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await context.clock.runFor(1500);
  const [from, to] = await page.evaluate(async (k) => {
    const { state } = await import('/src/ui/state.ts');
    const { solve } = await import('/src/core/solver.ts');
    const m = solve(state.session.board, 400000).path[k];
    return [m.from, m.to];
  }, MOVE);
  // Play the solver's moves before MOVE, so the filmed pour lands on a pile.
  const pour = async (f, t) => {
    for (const i of [f, t]) {
      const box = await page.locator('#board .jar').nth(i).boundingBox();
      await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
      await context.clock.runFor(80);
    }
  };
  const prior = await page.evaluate(async (k) => {
    const { state } = await import('/src/ui/state.ts');
    const { solve } = await import('/src/core/solver.ts');
    return solve(state.session.board, 400000).path.slice(0, k).map((m) => [m.from, m.to]);
  }, MOVE);
  for (const [f, t] of prior) {
    await pour(f, t);
    await context.clock.runFor(4000);
  }
  const box = await page.locator('#board .jar').nth(to).boundingBox();
  const clip = { x: box.x - 6, y: box.y - 20, width: box.width + 12, height: box.height + 26 };
  await pour(from, to);
  let t = 80;
  const files = [];
  for (const [k, at] of FRAMES.entries()) {
    while (t + 16 <= at) {
      await context.clock.runFor(16);
      t += 16;
    }
    const f = path.join(__dirname, `${LABEL}-${k + 1}.png`);
    await page.screenshot({ path: f, clip });
    files.push(f);
  }
  // One image with the frames side by side, labelled with their time.
  const strip = await browser.newPage({ viewport: { width: 200, height: 200 }, deviceScaleFactor: 1 });
  const imgs = files.map((f) => 'data:image/png;base64,' + require('fs').readFileSync(f).toString('base64'));
  await strip.setContent(`<body style="margin:0;background:#222;color:#eee;font:14px sans-serif;display:flex;gap:6px;padding:6px;width:max-content">${imgs
    .map((src, k) => `<figure style="margin:0;text-align:center"><img src="${src}" style="height:420px;display:block"><figcaption>${LABEL} ${FRAMES[k]} ms</figcaption></figure>`)
    .join('')}</body>`);
  await strip.screenshot({ path: path.join(__dirname, `${LABEL}-strip.png`), fullPage: true });
  console.log(JSON.stringify({ level: LEVEL, from, to, frames: FRAMES, files: files.map((f) => path.basename(f)) }));
  await browser.close();
})();
