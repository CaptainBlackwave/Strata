// Sprint 10 F5 (D68): screenshot sequences and frame times for the seal, the win, the coin
// flight, the map after a first clear, a replay's Perfect pop and the screen transitions.
// usage: node capture.cjs <baseUrl> <outDir> <label>   (after `npm run build` and `npx vite preview --port 5430 --strictPort`)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, out, label] = process.argv.slice(2);
const VERSION = JSON.parse(fs.readFileSync(path.join(__dirname, '../../../../../package.json'), 'utf8')).version;
const VIEW = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: false };
const seedSave = (extra = {}) => JSON.stringify({ seenWhatsNew: VERSION, tutorialDone: true, level: 5, wallet: { coins: 300, boosters: { hint: 50 } }, ...extra });
const log = [];
const say = (...a) => { const s = a.join(' '); log.push(s); console.log(s); };

async function newPage(b, opts = {}, save = seedSave()) {
  const ctx = await b.newContext({ ...VIEW, ...opts });
  await ctx.addInitScript((v) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
    window.__seals = []; window.__winAt = 0;
    new MutationObserver((ms) => {
      for (const m of ms) {
        const el = m.target;
        if (el.classList && el.classList.contains('just-sealed') && !(m.oldValue || '').includes('just-sealed')) window.__seals.push(Date.now());
        if (el.id === 'win' && !el.hidden && !window.__winAt) window.__winAt = Date.now();
      }
    }).observe(document, { subtree: true, attributes: true, attributeFilter: ['class', 'hidden'], attributeOldValue: true });
  }, save);
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && p.errors.push(m.text()));
  await p.goto(base);
  await p.waitForTimeout(700);
  return p;
}

/** Rapid screenshots for `ms`; returns [{t, buf}] with t in ms since `t0`. */
async function burstShots(p, ms, t0 = Date.now()) {
  const shots = [];
  while (Date.now() - t0 < ms) shots.push({ t: Date.now() - t0, buf: await p.screenshot() });
  return shots;
}
/** Saves the frames nearest each wanted time (ms since `zero`, a Date.now value). */
function keep(shots, t0, zero, wanted, name) {
  const used = new Set();
  const names = [];
  for (const w of wanted) {
    let best = null;
    for (const s of shots) if (!used.has(s) && (!best || Math.abs(s.t + t0 - zero - w) < Math.abs(best.t + t0 - zero - w))) best = s;
    if (!best) continue;
    used.add(best);
    const at = Math.round(best.t + t0 - zero);
    const f = `${name}-${label}-${String(names.length + 1).padStart(2, '0')}-${at}ms.png`;
    fs.writeFileSync(path.join(out, f), best.buf);
    names.push(f);
  }
  say(`${name}: ${names.join(', ')}`);
  return names;
}
const jarIndex = (p, sel) => p.evaluate((s) => [...document.querySelectorAll('#board .jar')].indexOf(document.querySelector(s)), sel);
const idle = (p) => p.waitForFunction(() => !document.querySelector('#board .pouring, #board .returning, .stream'), null, { timeout: 8000 }).catch(() => {});
const openUnsealed = (p) => p.evaluate(() => [...document.querySelectorAll('#board .jar')].filter((j) => !j.classList.contains('sealed') && j.querySelector('.sand')?.childElementCount).length);

/** One hinted pour. Returns the move, or null if no hint showed. */
async function hintMove(p) {
  for (let k = 0; k < 3; k++) {
    await p.keyboard.press('h');
    try { await p.waitForSelector('#board .hint-from', { timeout: 1500 }); break; } catch { /* a priced hint needs a second press */ }
  }
  if (!(await p.locator('#board .hint-from').count())) return null;
  const move = [await jarIndex(p, '#board .hint-from'), await jarIndex(p, '#board .hint-to')];
  await p.locator('#board .hint-from').first().click({ force: true });
  await p.locator('#board .hint-to').first().click({ force: true });
  return move;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();

  // ---- A: transitions, seal, win, coins, map after a first clear ----
  const p = await newPage(b);
  let t0 = Date.now();
  await p.click('#btn-play', { force: true });
  keep(await burstShots(p, 450, t0), t0, t0, [0, 70, 140, 260], 'trans-home-to-map');
  await p.waitForTimeout(500);
  t0 = Date.now();
  await p.click('#btn-map-play', { force: true });
  keep(await burstShots(p, 450, t0), t0, t0, [0, 70, 140, 260], 'trans-map-to-board');
  await p.waitForTimeout(800);
  const moves = [];
  let sealDone = false;
  let won = false;
  for (let i = 0; i < 120 && !won; i++) {
    const maybeLast = (await openUnsealed(p)) <= 2;
    const seals = await p.evaluate(() => window.__seals.length);
    const m0 = Date.now();
    const mv = await hintMove(p);
    if (!mv) { await p.waitForTimeout(300); continue; }
    moves.push(mv);
    if (maybeLast) {
      const shots = await burstShots(p, 3400, m0);
      const winAt = await p.evaluate(() => window.__winAt);
      if (winAt) {
        won = true;
        keep(shots, m0, winAt, [-650, -20, 200, 450, 950], 'win');
        keep(shots, m0, winAt, [640, 760, 880, 1000, 1150], 'coins');
        break;
      }
    } else if (!sealDone) {
      const shots = await burstShots(p, 1300, m0);
      const s = await p.evaluate((n) => window.__seals[n] || 0, seals);
      if (s) { sealDone = true; keep(shots, m0, s, [0, 180, 330, 480, 700], 'seal'); }
    }
    await idle(p);
    if (await p.locator('#win:not([hidden])').count()) won = true;
  }
  say('A: won level 5:', won, '| moves:', moves.length);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: path.join(out, `win-settled-${label}.png`) });
  t0 = Date.now();
  await p.click('#btn-win-home', { force: true });
  keep(await burstShots(p, 450, t0), t0, t0, [0, 70, 140, 260], 'trans-board-to-home');
  await p.waitForTimeout(500);
  t0 = Date.now();
  await p.click('#btn-play', { force: true });
  keep(await burstShots(p, 1200, t0), t0, t0, [0, 150, 300, 450, 600, 1000], 'map-after-first-clear');
  await p.waitForTimeout(400);
  t0 = Date.now();
  await p.keyboard.press('Escape');
  keep(await burstShots(p, 450, t0), t0, t0, [0, 70, 140, 260], 'trans-map-to-home');
  say('A errors:', JSON.stringify(p.errors));
  await p.context().close();

  // ---- B: a replay that earns Perfect, then back to the map ----
  const q = await newPage(b, {}, seedSave({ level: 6, best: { 5: 99 } }));
  await q.click('#btn-play', { force: true });
  await q.waitForTimeout(600);
  await q.locator('.stone[data-level="5"]').click({ force: true });
  await q.waitForTimeout(300);
  await q.click('#btn-stone-replay', { force: true });
  await q.waitForTimeout(900);
  for (const [f, t] of moves) {
    await q.locator('#board .jar').nth(f).click({ force: true });
    await q.locator('#board .jar').nth(t).click({ force: true });
    await idle(q);
  }
  await q.waitForSelector('#win:not([hidden])', { timeout: 5000 }).catch(() => {});
  say('B: win note:', (await q.textContent('#win-note')) || '', '| title:', await q.textContent('#win-title'));
  await q.waitForTimeout(1200);
  t0 = Date.now();
  await q.click('#btn-next', { force: true });
  keep(await burstShots(q, 900, t0), t0, t0, [0, 180, 260, 360, 520, 800], 'map-perfect-pop');
  say('B errors:', JSON.stringify(q.errors));
  await q.context().close();

  // ---- C: reduced motion: the same moments, twice each, to show nothing moves ----
  const r = await newPage(b, { reducedMotion: 'reduce' });
  const same = (a, c, n) => {
    if (process.env.SCRATCH) { fs.writeFileSync(path.join(process.env.SCRATCH, `${n}-1.png`), a); fs.writeFileSync(path.join(process.env.SCRATCH, `${n}-2.png`), c); }
    return a.equals(c);
  };
  await r.click('#btn-play', { force: true });
  let a1 = await r.screenshot(); await r.waitForTimeout(150); let a2 = await r.screenshot();
  fs.writeFileSync(path.join(out, `reduced-map-${label}.png`), a2);
  say('C: map open, frames 150 ms apart identical:', same(a1, a2, 'map'));
  await r.click('#btn-map-play', { force: true });
  await r.waitForTimeout(500);
  let sealShot = false;
  for (let i = 0; i < 120; i++) {
    const seals = await r.evaluate(() => window.__seals.length);
    if (!(await hintMove(r))) { await r.waitForTimeout(300); continue; }
    await r.waitForTimeout(60);
    if (!sealShot && (await r.evaluate((n) => window.__seals.length > n, seals)) && !(await r.locator('#win:not([hidden])').count())) {
      sealShot = true;
      a1 = await r.screenshot(); await r.waitForTimeout(200); a2 = await r.screenshot();
      fs.writeFileSync(path.join(out, `reduced-seal-${label}.png`), a1);
      say('C: seal, frames 200 ms apart identical:', same(a1, a2, 'seal'));
    }
    if (await r.locator('#win:not([hidden])').count()) break;
  }
  await r.waitForTimeout(100);
  a1 = await r.screenshot(); await r.waitForTimeout(400); a2 = await r.screenshot();
  fs.writeFileSync(path.join(out, `reduced-win-${label}.png`), a1);
  say('C: win card, frames 400 ms apart identical:', same(a1, a2, 'win'), '| fx nodes:', await r.evaluate(() => document.querySelectorAll('#fx > *, .win-bloom').length));
  await r.click('#btn-win-home', { force: true });
  await r.waitForTimeout(200);
  await r.click('#btn-play', { force: true });
  await r.waitForTimeout(60);
  a1 = await r.screenshot(); await r.waitForTimeout(300); a2 = await r.screenshot();
  fs.writeFileSync(path.join(out, `reduced-map-after-first-clear-${label}.png`), a1);
  say('C: map after a first clear, frames 300 ms apart identical:', same(a1, a2, 'mapclear'), '| reveal overlay:', await r.locator('.map-path-reveal').count());
  say('C errors:', JSON.stringify(r.errors));
  await r.context().close();

  // ---- D: frame times at a 4x CPU throttle, during the seal and the win (no screenshots) ----
  const d = await newPage(b);
  const cdp = await d.context().newCDPSession(d);
  await d.click('#btn-play', { force: true });
  await d.waitForTimeout(500);
  await d.click('#btn-map-play', { force: true });
  await d.waitForTimeout(800);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await d.evaluate(() => {
    window.__frames = [];
    const tick = () => { window.__frames.push(Date.now() + (performance.now() % 1)); requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  let sealWin = null;
  for (let i = 0; i < 160; i++) {
    const seals = await d.evaluate(() => window.__seals.length);
    if (!(await hintMove(d))) { await d.waitForTimeout(300); continue; }
    await idle(d);
    await d.waitForTimeout(900);
    const s = await d.evaluate((n) => window.__seals[n] || 0, seals);
    if (s && !sealWin && !(await d.evaluate(() => window.__winAt))) sealWin = [s - 50, s + 180 + 800];
    if (await d.evaluate(() => window.__winAt)) break;
  }
  await d.waitForTimeout(2600);
  const res = await d.evaluate(([sw]) => {
    const f = window.__frames;
    const longest = (lo, hi) => { let m = 0; for (let i = 1; i < f.length; i++) if (f[i] >= lo && f[i - 1] <= hi) m = Math.max(m, f[i] - f[i - 1]); return Math.round(m * 10) / 10; };
    const w = window.__winAt;
    const lastSeal = window.__seals.at(-1);
    return { seal: sw ? longest(sw[0], sw[1]) : null, win: longest(lastSeal - 50, w + 2000), frames: f.length };
  }, [sealWin]);
  say(`D (4x CPU throttle): longest frame during the seal ${res.seal} ms, during the win ${res.win} ms (frames recorded ${res.frames})`);
  say('D errors:', JSON.stringify(d.errors));
  await b.close();
  fs.writeFileSync(path.join(out, `log-${label}.txt`), log.join('\n') + '\n');
})();
