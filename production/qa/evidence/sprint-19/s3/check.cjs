// Sprint 19 S3: every jar mechanic, the sand pieces, a glass piece, patterns and a night scene on the
// GPU board, each beside the same board on the DOM (412 x 915). Plus a slowed pour strip on a
// locked level and a frozen level, and a thaw. PORT defaults to 4510. Joined with Python PIL after.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const BASE = `http://localhost:${process.env.PORT ?? 4510}/`;
const ONB = { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const MECH = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam'];
const OWNED = ['glass:seaglass', 'glass:cobalt', 'sand:fine', 'sand:glint', 'sand:layered', 'sand:ripple'];
function save({ patterns = false, scene = 'midday', glass = 'clear', sand = 'plain' } = {}) {
  return {
    boards: 3, level: 260, wallet: { coins: 200, boosters: {} }, tutorialDone: true,
    settings: { sound: false, music: false, haptics: false, patterns, southern: false }, onboarding: ONB,
    seenWhatsNew: require('../../../../../package.json').version, seenMechanics: MECH,
    themes: { owned: ['midday', 'moonlit'], selected: scene, auto: false },
    styles: { owned: OWNED, worn: { glass, cork: 'cork', sand } },
  };
}
const SHOTS = [
  ['narrow', 21, {}], ['frozen', 41, {}], ['locked', 61, {}], ['funnel', 81, {}], ['hourglass', 101, {}], ['sieve', 141, {}], ['clam', 181, {}],
  ['sand-fine', 7, { sand: 'fine' }], ['sand-glint', 7, { sand: 'glint' }], ['sand-layered', 7, { sand: 'layered' }], ['sand-ripple', 7, { sand: 'ripple' }],
  ['glass-seaglass', 7, { glass: 'seaglass' }], ['glass-cobalt-moonlit', 61, { glass: 'cobalt', scene: 'moonlit' }],
  ['patterns', 61, { patterns: true }], ['patterns-sieve', 141, { patterns: true }], ['moonlit-clam', 181, { scene: 'moonlit' }],
];
async function open(b, url, opts) {
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save(opts)));
  const p = await ctx.newPage();
  p.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  for (let i = 0; i < 20; i++) { try { await p.goto(url); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(1800);
  for (let k = 0; k < 3 && (await p.locator('#intro:not([hidden])').count()); k++) { await p.click('#btn-intro-ok', { force: true }); await p.waitForTimeout(300); }
  await p.waitForTimeout(400);
  return { ctx, p };
}
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
async function tap(p, i) { await p.click(`#board .jar[data-index="${i}"]`, { force: true }); }
(async () => {
  const b = await chromium.launch();
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
  for (const [name, level, opts] of SHOTS) {
    if (only && !only.includes(name)) continue;
    for (const board of ['gpu', 'dom']) {
      const { ctx, p } = await open(b, `${BASE}?board=${board}&level=${level}`, opts);
      const info = await p.evaluate(() => ({ render: document.querySelector('#board').dataset.render ?? 'dom', frames: document.querySelector('canvas.gpu-board')?.dataset.frames }));
      console.log(name, board, JSON.stringify(info));
      await p.screenshot({ path: `${__dirname}/${name}-${board}.png`, clip: { x: 0, y: 120, width: 412, height: 700 } });
      await ctx.close();
    }
  }
  // Pours, slowed 4x: level 61 (locked, 0 -> 9) and level 41 (frozen, 0 -> 9); then a thaw: pours until a jar seals.
  for (const [name, level, from, to] of [['pour-locked', 61, 0, 9], ['pour-frozen', 41, 0, 9]]) {
    if (only && !only.includes(name)) continue;
    const { ctx, p } = await open(b, `${BASE}?board=gpu&level=${level}`, {});
    await tap(p, from);
    await p.waitForTimeout(200);
    await slowClock(p, 0.25);
    await tap(p, to);
    const t0 = Date.now();
    for (const [k, ms] of [200, 450, 700, 950, 1200, 1500, 1900, 2400].entries()) {
      const w = ms - (Date.now() - t0);
      if (w > 0) await p.waitForTimeout(w);
      await p.screenshot({ path: `${__dirname}/${name}-${k + 1}.png`, clip: { x: 0, y: 120, width: 412, height: 700 } });
    }
    await ctx.close();
  }
  await b.close();
})();
