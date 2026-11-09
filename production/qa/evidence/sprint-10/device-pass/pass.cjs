// Emulated run of production/qa/device-checklist.md (D58, D62) against the live game.
// usage: node pass.cjs <outDir> [baseUrl]   (Chromium device emulation; not Safari, not a real phone)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [out, base = 'https://captainblackwave.github.io/Strata/'] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const ALL = ['midday', 'auroranight', 'winterlights', 'newyear'];
const save = (o = {}) => ({ level: 5, best: {}, wallet: { coins: 500, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 50 } }, tutorialDone: true, settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ALL, selected: 'midday', auto: false }, seenWhatsNew: '0.9.1', ...o });
const R = {}; const w = (p, ms) => p.waitForTimeout(ms);
async function open(b, s, { device = 'Pixel 7', text = 100, reduced = false, offlineReady = false } = {}) {
  const ctx = await b.newContext({ ...devices[device], reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(([k, v, t]) => {
    if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); }
    if (t !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = t + '%'; });
  }, [KEY, JSON.stringify(s), text]);
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base); await w(p, 1200);
  return { ctx, p, errors };
}
async function toBoard(p) {
  await p.click('#btn-play', { force: true }); await w(p, 600);
  if (await p.locator('#map:not([hidden])').count()) { await p.click('#btn-map-play', { force: true }); await w(p, 1000); }
}
async function solve(p, max = 200) {
  for (let i = 0; i < max; i++) {
    if (await p.locator('#win:not([hidden])').count()) return true;
    await p.keyboard.press('h'); await w(p, 120);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await w(p, 300); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await w(p, 450);
  }
  return false;
}
async function frames(p, ms) {
  return p.evaluate((ms) => new Promise((res) => { const ts = []; const t0 = performance.now(); const f = (t) => { ts.push(t); if (t - t0 < ms) requestAnimationFrame(f); else { const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b); res({ frames: d.length, p50: +d[Math.floor(d.length / 2)].toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), max: +d[d.length - 1].toFixed(1) }); } }; requestAnimationFrame(f); }), ms);
}
(async () => {
  const b = await chromium.launch();
  // 1. Smoothness in heavy scenes, at a 4x CPU throttle (a mid-range phone stand-in).
  for (const id of ['auroranight', 'winterlights']) {
    const { ctx, p, errors } = await open(b, save({ themes: { owned: ALL, selected: id, auto: false } }));
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await toBoard(p); const idle = await frames(p, 4000);
    await p.screenshot({ path: path.join(out, `smooth-${id}.png`) });
    R[`smooth_${id}`] = { idle, errors }; await ctx.close();
  }
  { // New Year fireworks win card
    const { ctx, p, errors } = await open(b, save({ themes: { owned: ALL, selected: 'newyear', auto: false } }));
    const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await toBoard(p); const won = await solve(p); const during = await frames(p, 2500);
    await p.screenshot({ path: path.join(out, 'fireworks-win.png') });
    R.fireworksWin = { won, during, errors }; await ctx.close();
  }
  // 2. Zoom: the viewport allows pinch; the board blocks double-tap zoom (touch-action).
  {
    const { ctx, p, errors } = await open(b, save({ level: 120 }));
    const meta = await p.$eval('meta[name=viewport]', (m) => m.content);
    await toBoard(p);
    const touch = await p.evaluate(() => ({ board: getComputedStyle(document.getElementById('board')).touchAction, body: getComputedStyle(document.body).touchAction }));
    // Jar hit areas at level 120: at least 44 px, and no two overlap.
    const hits = await p.evaluate(() => [...document.querySelectorAll('#board .jar')].map((j) => { const r = j.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }));
    let overlap = 0; for (let i = 0; i < hits.length; i++) for (let k = i + 1; k < hits.length; k++) { const a = hits[i], c = hits[k]; if (a.l < c.r - 0.5 && c.l < a.r - 0.5 && a.t < c.b - 0.5 && c.t < a.b - 0.5) overlap++; }
    // Fast repeated taps on one jar: the page scale stays 1.
    const jar = p.locator('#board .jar').first(); for (let i = 0; i < 6; i++) await jar.tap({ force: true });
    const scale = await p.evaluate(() => window.visualViewport.scale);
    await p.screenshot({ path: path.join(out, 'level-120-hits.png') });
    R.zoom = { meta, pinchAllowed: !/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/.test(meta), touch, jars: hits.length, minHitW: Math.min(...hits.map((h) => h.w)).toFixed(1), minHitH: Math.min(...hits.map((h) => h.h)).toFixed(1), overlap, scaleAfterTaps: scale, errors };
    await ctx.close();
  }
  // 3. Largest text (200%) on a small phone: nothing cut off, no sideways scroll, jars above the toolbar.
  for (const [device, text] of [['iPhone SE', 200], ['Pixel 7', 200]]) {
    const { ctx, p, errors } = await open(b, save(), { device, text });
    const tag = device.replace(' ', '').toLowerCase();
    const sideways = async () => p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    const res = { home: await sideways() };
    await p.screenshot({ path: path.join(out, `text200-${tag}-home.png`) });
    await toBoard(p);
    res.board = await sideways();
    res.jarsAboveToolbar = await p.evaluate(() => { const tb = document.querySelector('.toolbar').getBoundingClientRect().top; return [...document.querySelectorAll('#board .jar')].every((j) => j.getBoundingClientRect().bottom <= tb + 1); });
    await p.screenshot({ path: path.join(out, `text200-${tag}-board.png`) });
    res.won = await solve(p); res.win = await sideways();
    res.winFits = await p.evaluate(() => { const c = document.querySelector('#win .win-card, #win [class*=card]'); return c ? c.scrollHeight <= c.clientHeight + 1 || getComputedStyle(c).overflowY !== 'visible' : null; });
    await p.screenshot({ path: path.join(out, `text200-${tag}-win.png`) });
    R[`text200_${tag}`] = { ...res, errors }; await ctx.close();
  }
  // 4. Screen reader announcements (the polite live region's text).
  {
    const { ctx, p, errors } = await open(b, save());
    await toBoard(p);
    const live = () => p.evaluate(() => [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent.trim()).filter(Boolean));
    await p.keyboard.press('h'); await w(p, 300); const afterHint = await live();
    await p.locator('#board .hint-from').first().click({ force: true }); await p.locator('#board .hint-to').first().click({ force: true }); await w(p, 900);
    const afterPour = await live();
    R.screenReader = { afterHint, afterPour, errors }; await ctx.close();
  }
  // 5. Offline: first visit online, then offline reload and play the next level.
  {
    const { ctx, p, errors } = await open(b, save());
    await p.evaluate(() => navigator.serviceWorker.ready); await w(p, 500); await p.reload(); await w(p, 3000);
    await ctx.setOffline(true); await p.reload(); await w(p, 1500);
    await toBoard(p);
    const jars = await p.locator('#board .jar').count();
    await p.screenshot({ path: path.join(out, 'offline-board.png') });
    R.offline = { jars, errors }; await ctx.close();
  }
  // 6. Updates: What's new once (a save that last saw 0.9.0), then never again.
  {
    const { ctx, p, errors } = await open(b, save({ seenWhatsNew: '0.9.0' }));
    const first = await p.evaluate(() => [...document.querySelectorAll('[role=dialog]')].some((d) => d.offsetParent && /new/i.test(d.textContent)));
    await p.screenshot({ path: path.join(out, 'whats-new.png') });
    await p.getByRole('button', { name: 'Got it' }).click().catch(() => undefined); await w(p, 300);
    await p.reload(); await w(p, 1200);
    const again = await p.evaluate(() => [...document.querySelectorAll('[role=dialog]')].some((d) => d.offsetParent && /new/i.test(d.textContent)));
    R.whatsNew = { first, again, errors }; await ctx.close();
  }
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
