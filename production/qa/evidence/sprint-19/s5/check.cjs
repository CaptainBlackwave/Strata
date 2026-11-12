// Sprint 19 S5/S6 on the GPU board (412 x 915): a seal with the canvas cork (slowed), the hint lift,
// the win glow run (slowed strip), Undo and Shuffle snapping at once, a WebGL context lost mid-pour
// (play goes on on the DOM board) then restored, and a reduced-motion pour. Level 2's solution is
// from the core solver. PORT defaults to 4510. Strips are joined with Python PIL after.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = `http://localhost:${process.env.PORT ?? 4510}/`;
const ONB = { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const SOLVE2 = [[0, 3], [2, 0], [0, 4], [2, 4], [0, 2], [3, 2], [1, 0], [1, 3], [2, 3], [0, 1], [1, 2]];
const save = (cork = 'cork') => ({
  boards: 3, level: 60, wallet: { coins: 500, boosters: { undo: 5, shuffle: 5, hint: 5, extraJar: 5 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false, realistic: true }, onboarding: ONB,
  seenWhatsNew: require('../../../../../package.json').version, seenMechanics: ['narrow', 'frozen', 'locked'],
  styles: { owned: ['cork:brass', 'cork:rope'], worn: { glass: 'clear', cork, sand: 'plain' } },
});
const CLIP = { x: 0, y: 100, width: 412, height: 720 };
async function open(b, url, { reduced = false, cork } = {}) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save(cork)));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  for (let i = 0; i < 20; i++) { try { await p.goto(url); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(1800);
  for (let k = 0; k < 3 && (await p.locator('#intro:not([hidden])').count()); k++) { await p.click('#btn-intro-ok', { force: true }); await p.waitForTimeout(300); }
  await p.waitForTimeout(300);
  return { ctx, p };
}
async function slowClock(p, rate) {
  await p.evaluate((rate) => {
    const real = performance.now.bind(performance);
    const t0 = real();
    performance.now = () => t0 + (real() - t0) * rate;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf(() => cb(performance.now()));
    const st = window.setTimeout.bind(window);
    window.setTimeout = (f, d, ...rest) => st(f, (d || 0) / rate, ...rest);
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (k, o) { const a = orig.call(this, k, o); a.playbackRate = rate; return a; };
  }, rate);
}
const state = (p) => p.evaluate(() => ({ render: document.querySelector('#board').dataset.render, moves: document.querySelector('#moves').textContent, frames: document.querySelector('canvas.gpu-board')?.dataset.frames, win: !document.querySelector('#win').hidden }));
async function pourKeys(p, [f, t], wait = 1300) { await p.keyboard.press(String(f + 1)); await p.waitForTimeout(80); await p.keyboard.press(String(t + 1)); await p.waitForTimeout(wait); }
async function strip(p, name, times) {
  const t0 = Date.now();
  for (const [k, ms] of times.entries()) {
    const w = ms - (Date.now() - t0);
    if (w > 0) await p.waitForTimeout(w);
    await p.screenshot({ path: `${__dirname}/${name}-${k + 1}.png`, clip: CLIP });
  }
}
(async () => {
  const b = await chromium.launch();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  const run = (n) => !only || only.includes(n);
  if (run('seal')) for (const cork of ['cork', 'brass']) {
    // The first seal on level 2 is the 4th pour of the solution: three pours, then the sealing one slowed 4x.
    const { ctx, p } = await open(b, `${BASE}?level=2`, { cork });
    for (const m of SOLVE2.slice(0, 3)) await pourKeys(p, m);
    await p.keyboard.press(String(SOLVE2[3][0] + 1));
    await p.waitForTimeout(250);
    await slowClock(p, 0.25);
    await p.keyboard.press(String(SOLVE2[3][1] + 1));
    await strip(p, `seal-${cork}`, [1400, 1700, 2000, 2300, 2700, 3400]);
    console.log('seal', cork, JSON.stringify(await state(p)));
    await ctx.close();
  }
  if (run('hint')) {
    const { ctx, p } = await open(b, `${BASE}?level=7`);
    await p.keyboard.press('h');
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${__dirname}/hint-lift-gpu.png`, clip: CLIP });
    const h = await p.evaluate(() => [...document.querySelectorAll('#board .jar')].map((el, i) => (el.classList.contains('hint-from') ? `from ${i}` : el.classList.contains('hint-to') ? `to ${i}` : '')).filter(Boolean));
    console.log('hint', JSON.stringify(h));
    await ctx.close();
    const d = await open(b, `${BASE}?level=7&board=dom`);
    await d.p.keyboard.press('h');
    await d.p.waitForTimeout(500);
    await d.p.screenshot({ path: `${__dirname}/hint-lift-dom.png`, clip: CLIP });
    await d.ctx.close();
  }
  if (run('win')) {
    const { ctx, p } = await open(b, `${BASE}?level=2`);
    for (const m of SOLVE2.slice(0, -1)) {
      await p.waitForFunction(() => !document.querySelector('#board .jar.gpu-away'), null, { timeout: 5000 });
      await pourKeys(p, m, 1600);
    }
    console.log('before the last pour', JSON.stringify(await state(p)));
    await p.keyboard.press(String(SOLVE2.at(-1)[0] + 1));
    await p.waitForTimeout(250);
    // The last pour and the glow run after it, with the clock slowed 4x.
    await slowClock(p, 0.25);
    await p.keyboard.press(String(SOLVE2.at(-1)[1] + 1));
    await p.waitForFunction(() => !document.querySelector('#board .jar.gpu-away'), null, { timeout: 8000 });
    await strip(p, 'win-glow', [50, 300, 550, 800, 1050, 1300, 1700, 2400]);
    console.log('win', JSON.stringify(await state(p)));
    await ctx.close();
  }
  if (run('snap')) {
    const { ctx, p } = await open(b, `${BASE}?level=7`);
    await p.screenshot({ path: `${__dirname}/undo-0-before.png`, clip: CLIP });
    await pourKeys(p, [0, 5], 0);
    await p.waitForTimeout(450); // mid-pour (the jar is flying home, the target settling)
    await p.screenshot({ path: `${__dirname}/undo-1-mid-pour.png`, clip: CLIP });
    await p.waitForTimeout(700);
    await p.keyboard.press('z');
    await p.waitForTimeout(60);
    await p.screenshot({ path: `${__dirname}/undo-2-snapped.png`, clip: CLIP });
    console.log('undo', JSON.stringify(await state(p)));
    await pourKeys(p, [0, 5], 1500);
    await p.screenshot({ path: `${__dirname}/shuffle-0-before.png`, clip: CLIP });
    await p.keyboard.press('s');
    await p.waitForTimeout(700);
    await p.screenshot({ path: `${__dirname}/shuffle-1-snapped.png`, clip: CLIP });
    console.log('shuffle', JSON.stringify(await state(p)));
    await ctx.close();
  }
  if (run('lost')) {
    const { ctx, p } = await open(b, `${BASE}?level=7`);
    await p.evaluate(() => { const c = document.querySelector('canvas.gpu-board'); window.__lose = (c.getContext('webgl2') || c.getContext('webgl')).getExtension('WEBGL_lose_context'); });
    await pourKeys(p, [0, 5], 0);
    await p.waitForTimeout(260); // mid-pour
    await p.screenshot({ path: `${__dirname}/lost-0-mid-pour.png`, clip: CLIP });
    await p.evaluate(() => window.__lose.loseContext());
    await p.waitForTimeout(150);
    await p.screenshot({ path: `${__dirname}/lost-1-dom-at-once.png`, clip: CLIP });
    console.log('lost', JSON.stringify(await state(p)));
    await pourKeys(p, [1, 6], 1500); // play goes on, on the DOM board
    await p.screenshot({ path: `${__dirname}/lost-2-played-on-dom.png`, clip: CLIP });
    console.log('played on dom', JSON.stringify(await state(p)));
    await p.evaluate(() => window.__lose.restoreContext());
    await p.waitForTimeout(800);
    await p.screenshot({ path: `${__dirname}/lost-3-restored.png`, clip: CLIP });
    console.log('restored', JSON.stringify(await state(p)));
    await ctx.close();
  }
  if (run('reduced')) {
    const { ctx, p } = await open(b, `${BASE}?level=7`, { reduced: true });
    await p.screenshot({ path: `${__dirname}/reduced-0-before.png`, clip: CLIP });
    const f0 = (await state(p)).frames;
    await pourKeys(p, [0, 5], 0);
    await p.waitForTimeout(60);
    await p.screenshot({ path: `${__dirname}/reduced-1-snapped.png`, clip: CLIP });
    await p.waitForTimeout(600);
    const s = await state(p);
    console.log('reduced', JSON.stringify(s), 'frames drawn for the pour:', Number(s.frames) - Number(f0));
    await ctx.close();
  }
  await b.close();
})();
