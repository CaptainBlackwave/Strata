// S7: frame times on level 491 (16 jars) at 4x CPU throttle, 10 real pours, Realistic vs Classic.
// Headless Chromium uses software WebGL here, so Realistic numbers are pessimistic; the phone test is the gate.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const PORT = process.env.PORT ?? 4530;
const MOVES = [[0,14],[0,15],[11,15],[13,15],[8,13],[3,8],[4,3],[13,4],[4,13],[13,4]];
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const ONB = { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
async function run(b, board) {
  const save = { boards: 3, level: 500, wallet: { coins: 200, boosters: {} }, tutorialDone: true, settings: { ...QUIET, realistic: board === 'gpu' }, onboarding: ONB, seenWhatsNew: require('../../../../../package.json').version, seenMechanics: ['narrow','frozen','locked','funnel','hourglass','sieve','clam'] };
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 } });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save));
  const p = await ctx.newPage();
  for (let i = 0; i < 20; i++) { try { await p.goto(`http://localhost:${PORT}/?level=491&board=${board}`); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(2500);
  if (await p.locator('#intro:not([hidden])').count()) await p.click('#btn-intro-ok', { force: true });
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const gl = await p.evaluate(() => { const c = document.createElement('canvas').getContext('webgl'); const d = c && c.getExtension('WEBGL_debug_renderer_info'); return d ? c.getParameter(d.UNMASKED_RENDERER_WEBGL) : 'none'; });
  await p.evaluate(() => { window.__f = []; let last = performance.now(); const tick = (t) => { window.__f.push(t - last); last = t; requestAnimationFrame(tick); }; requestAnimationFrame(tick); });
  for (const [f, t] of MOVES) {
    await p.click(`#board .jar[data-index="${f}"]`, { force: true }); await p.waitForTimeout(150);
    await p.click(`#board .jar[data-index="${t}"]`, { force: true }); await p.waitForTimeout(1600);
  }
  const fr = (await p.evaluate(() => window.__f)).slice(5).sort((a, c) => a - c);
  const q = (x) => Math.round(fr[Math.min(fr.length - 1, Math.floor(fr.length * x))] * 10) / 10;
  const pours = await p.evaluate(() => document.getElementById('moves')?.textContent);
  await ctx.close();
  return { board, gl, frames: fr.length, median: q(0.5), p95: q(0.95), worst: Math.round(fr.at(-1) * 10) / 10, over20: fr.filter((x) => x > 20).length, pours };
}
(async () => {
  const b = await chromium.launch();
  const out = [await run(b, 'dom'), await run(b, 'gpu')];
  console.log(JSON.stringify(out, null, 1));
  require('fs').writeFileSync(__dirname + '/report.json', JSON.stringify(out, null, 2));
  await b.close();
})();
