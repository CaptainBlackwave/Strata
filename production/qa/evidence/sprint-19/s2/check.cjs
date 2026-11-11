// Sprint 19 S2/S4: the GPU board at a 412 x 915 phone. For each level: the idle GPU board (and that
// the canvas stops drawing when idle), keyboard selection with digit keys, a mid-pour frame strip
// with the clock slowed 4x, and the same level on the DOM board. PORT defaults to 4510.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = `http://localhost:${process.env.PORT ?? 4510}/`;
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const ONB = { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = { boards: 3, level: 60, wallet: { coins: 200, boosters: {} }, tutorialDone: true, settings: QUIET, onboarding: ONB, seenWhatsNew: require('../../../../../package.json').version, seenMechanics: ['narrow', 'frozen', 'locked'] };
const LEVELS = [[7, 0, 5], [52, 2, 9]]; // level, from, to (legal first pours)
const FRAMES = [80, 260, 420, 600, 800, 1000, 1250, 1600]; // ms after the second tap, real time (clock at 0.25x)

async function open(b, url, slow) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  for (let i = 0; i < 20; i++) { try { await p.goto(url); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(1800);
  if (await p.locator('#intro:not([hidden])').count()) await p.click('#btn-intro-ok', { force: true });
  await p.waitForTimeout(400);
  return { ctx, p };
}

/** Slows every clock the page animates by (performance.now, rAF times, WAAPI) to `rate`. */
async function slowClock(p, rate) {
  await p.evaluate((rate) => {
    const real = performance.now.bind(performance);
    const t0 = real();
    performance.now = () => t0 + (real() - t0) * rate;
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = (cb) => raf(() => cb(performance.now()));
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (k, o) { const a = orig.call(this, k, o); a.playbackRate = rate; return a; };
  }, rate);
}

(async () => {
  const b = await chromium.launch();
  for (const [level, from, to] of LEVELS) {
    const dir = __dirname;
    // GPU board, idle.
    let { ctx, p } = await open(b, `${BASE}?board=gpu&level=${level}`);
    const info = await p.evaluate(() => ({ render: document.querySelector('#board').dataset.render, canvas: !!document.querySelector('canvas.gpu-board'), hidden: document.querySelector('canvas.gpu-board')?.getAttribute('aria-hidden'), frames: document.querySelector('canvas.gpu-board')?.dataset.frames }));
    await p.waitForTimeout(1000);
    const later = await p.evaluate(() => document.querySelector('canvas.gpu-board')?.dataset.frames);
    console.log(level, 'gpu', JSON.stringify(info), 'frames after 1 s idle:', later, later === info.frames ? '(idle: no frames drawn)' : '(STILL DRAWING)');
    await p.screenshot({ path: `${dir}/level-${level}-gpu-idle.png` });
    // Keyboard: the digit key selects a jar; the canvas lifts it too.
    await p.keyboard.press(String(from + 1));
    await p.waitForTimeout(400);
    const sel = await p.evaluate((i) => { const el = document.querySelector(`#board .jar[data-index="${i}"]`); return { selected: el.classList.contains('selected'), pressed: el.getAttribute('aria-pressed'), label: el.getAttribute('aria-label') }; }, from);
    console.log(level, 'key', from + 1, JSON.stringify(sel));
    await p.screenshot({ path: `${dir}/level-${level}-gpu-key-selected.png` });
    // Pour by keyboard too, with the clock slowed so the frames land mid-pour.
    await slowClock(p, 0.25);
    if (to < 9) await p.keyboard.press(String(to + 1));
    else await p.click(`#board .jar[data-index="${to}"]`, { force: true });
    const t0 = Date.now();
    for (let k = 0; k < FRAMES.length; k++) {
      const wait = FRAMES[k] - (Date.now() - t0);
      if (wait > 0) await p.waitForTimeout(wait);
      await p.screenshot({ path: `${dir}/level-${level}-gpu-pour-${k + 1}.png`, clip: { x: 0, y: 100, width: 412, height: 700 } });
    }
    await p.waitForTimeout(6000);
    const end = await p.evaluate(() => ({ moves: document.querySelector('#moves').textContent, busy: document.querySelector('#board').dataset.render }));
    console.log(level, 'after pour', JSON.stringify(end));
    await p.screenshot({ path: `${dir}/level-${level}-gpu-after-pour.png` });
    await ctx.close();
    // The same level on the DOM board.
    ({ ctx, p } = await open(b, `${BASE}?level=${level}`));
    console.log(level, 'dom', await p.evaluate(() => ({ render: document.querySelector('#board').dataset.render ?? null, canvas: !!document.querySelector('canvas.gpu-board') })));
    await p.screenshot({ path: `${dir}/level-${level}-dom-idle.png` });
    await ctx.close();
  }
  await b.close();
})();
