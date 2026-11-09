// TD-13 (docs/tech-debt.md): the longest main-thread block during Hint and Shuffle, and a
// level won with hints only. Run against a `vite preview` of a build:
//   node td13-longtask.cjs <baseUrl> <label> <outDir>
// Pixel 7 viewport, reduced motion (quick scripted pours), CDP 4x CPU throttle, Date.now()
// frozen so Shuffle's clock seed (and so its board and cost) is the same before and after.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, label, outDir] = process.argv.slice(2);
const FROZEN_NOW = 1767225600000;

const mkSave = (level) => ({
  level, best: {}, wallet: { coins: 5000, boosters: { undo: 3, shuffle: 99, extraJar: 3, hint: 999 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false }, daily: { last: null, streak: 0, best: 0, passes: 0 },
  shells: ['periwinkle'], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false },
  profile: { name: 'Tester', avatar: 'sand-jar', frame: 'plain', plate: 'plain' }, stats: { perfectClears: 0, dailiesSolved: 0, pours: 0, coinsEarned: 0, boostersUsed: 0 },
  dailyShare: null, seenWhatsNew: '0.9.0',
});

const errs = [];
async function open(b, level) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.addInitScript(([save, now]) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', save); sessionStorage.setItem('s', '1'); }
    Date.now = () => now;
    // Test hook for the screenshot only: when `__delayAssist` is set, a Hint/Shuffle reply from
    // the worker reaches the page that many ms late, so the brief "Thinking…" cue can be
    // photographed. Inert (no delay) for every measurement above it.
    const W = window.Worker;
    if (W) window.Worker = class extends W {
      set onmessage(f) { super.onmessage = f && ((e) => (window.__delayAssist && e.data && e.data.result && e.data.result.kind ? setTimeout(() => f.call(this, e), window.__delayAssist) : f.call(this, e))); }
      get onmessage() { return super.onmessage; }
    };
    window.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push(e.duration); }).observe({ type: 'longtask', buffered: true });
  }, [JSON.stringify(mkSave(level)), FROZEN_NOW]);
  const p = await ctx.newPage();
  p.setDefaultTimeout(90_000);
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  const cdp = await ctx.newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.goto(base + '/');
  await p.waitForTimeout(1500);
  await p.click('#btn-play', { force: true });
  await p.waitForTimeout(800);
  await p.click('#btn-map-play', { force: true });
  await p.waitForSelector('#board .jar');
  await p.waitForTimeout(2500); // let the level start and the prefetch of the next one settle
  return { ctx, p };
}

const moves = (p) => p.evaluate(() => Number(document.getElementById('moves').textContent));
const idle = (p) => p.waitForFunction(() => !document.querySelector('.tool[aria-busy="true"]'));
async function pourJar(p, from, to) {
  const m = await moves(p);
  await p.locator('#board .jar').nth(from).click();
  await p.locator('#board .jar').nth(to).click();
  await p.waitForFunction((m0) => Number(document.getElementById('moves').textContent) > m0, m, { timeout: 10_000 });
  await p.waitForTimeout(250);
}
/** Clicks a tool and records the long tasks until it has answered. */
async function measure(p, tool, shot) {
  await p.evaluate(() => (window.__lt.length = 0));
  const t0 = process.hrtime.bigint();
  await p.click(tool);
  let thinking = null;
  if (shot) {
    // The cue shows after 150 ms; catch it while the worker is still searching (the old build never shows one).
    await p.waitForSelector(tool + '.thinking', { timeout: 1500 }).catch(() => {});
    await p.locator('nav.toolbar').screenshot({ path: path.join(outDir, `${label}-${shot}-toolbar.png`) });
    thinking = await p.evaluate((sel) => {
      const b = document.querySelector(sel);
      return { disabled: b.disabled, ariaBusy: b.getAttribute('aria-busy'), cls: b.className, text: b.querySelector('.tool-name').textContent, label: b.getAttribute('aria-label') };
    }, tool);
    await p.screenshot({ path: path.join(outDir, `${label}-${shot}.png`) });
  }
  await idle(p);
  const wallMs = Number(process.hrtime.bigint() - t0) / 1e6;
  await p.waitForTimeout(600);
  const lt = await p.evaluate(() => window.__lt.slice());
  const result = await p.evaluate(() => ({ hint: [...document.querySelectorAll('#board .jar')].map((j, i) => (j.classList.contains('hint-from') ? `from${i}` : j.classList.contains('hint-to') ? `to${i}` : '')).filter(Boolean).join(','), toast: document.getElementById('toast').textContent, jars: [...document.querySelectorAll('#board .jar')].map((j) => j.getAttribute('aria-label')).join(' | ') }));
  return { longestMs: Math.round(Math.max(0, ...lt)), longTasks: lt.length, totalBlockedMs: Math.round(lt.reduce((a, b) => a + b, 0)), wallMs: Math.round(wallMs), thinking, result: { hint: result.hint, toast: result.toast, jarsHash: hash(result.jars) } };
}
function hash(s) { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(16); }

(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch();
  const out = { label, cpuThrottle: 4, frozenNow: FROZEN_NOW };
  try {
    // Level 141: Hint and Shuffle on the dealt board.
    {
      const { ctx, p } = await open(b, 141);
      out.l141hint = await measure(p, '#btn-hint');
      out.l141shuffle = await measure(p, '#btn-shuffle');
      await ctx.close();
    }
    // Level 152, one of the slowest late boards: Hint on the dealt board, Hint after an
    // off-plan pour (a fresh search), then Shuffle after two pours (a costly re-deal).
    {
      const { ctx, p } = await open(b, 152);
      out.l152hint = await measure(p, '#btn-hint');
      await pourJar(p, 8, 15);
      out.l152hintAfterPour = await measure(p, '#btn-hint', 'thinking-hint');
      await p.keyboard.press('r'); await p.waitForTimeout(200); await p.keyboard.press('r'); await p.waitForTimeout(500);
      await pourJar(p, 10, 14);
      await pourJar(p, 4, 15);
      out.l152shuffle = await measure(p, '#btn-shuffle', 'thinking-shuffle');
      await p.screenshot({ path: path.join(outDir, `${label}-after-shuffle.png`) });
      // Stale reply: start a Shuffle and Undo at once; the shuffle must not land or be charged.
      const before = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')).wallet.boosters.shuffle);
      const m0 = await moves(p);
      await p.click('#btn-shuffle');
      await p.keyboard.press('z');
      await p.waitForTimeout(3000);
      await idle(p);
      out.staleShuffle = { shuffleChargesBefore: before, after: await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')).wallet.boosters.shuffle), movesBefore: m0, movesAfter: await moves(p), toast: await p.evaluate(() => document.getElementById('toast').textContent) };
      await ctx.close();
    }
    // The thinking cue, photographed with the reply held back 1.5 s (the new build only).
    if (label === 'after') {
      const { ctx, p } = await open(b, 152);
      await p.evaluate(() => (window.__delayAssist = 1500));
      out.cue = {};
      for (const tool of ['#btn-hint', '#btn-shuffle']) {
        await p.click(tool);
        await p.waitForSelector(tool + '.thinking', { timeout: 1500 });
        const name = tool.slice(5);
        out.cue[name] = await p.evaluate(() => [...document.querySelectorAll('.tool[data-booster]')].map((b) => ({ id: b.dataset.booster, disabled: b.disabled, ariaBusy: b.getAttribute('aria-busy'), cls: b.className, text: b.querySelector('.tool-name').textContent, label: b.getAttribute('aria-label') })));
        await p.screenshot({ path: path.join(outDir, `${label}-cue-${name}.png`) });
        await p.locator('nav.toolbar').screenshot({ path: path.join(outDir, `${label}-cue-${name}-toolbar.png`) });
        await idle(p);
        await p.waitForTimeout(800);
      }
      await p.screenshot({ path: path.join(outDir, `${label}-cue-done.png`) });
      await ctx.close();
    }
    // Level 141 won with hints only: tap Hint, pour what it shows, repeat until the win card.
    {
      const { ctx, p } = await open(b, 141);
      let hints = 0;
      let longest = 0;
      for (; hints < 200; hints++) {
        if (await p.evaluate(() => !document.getElementById('win').hidden)) break;
        await p.evaluate(() => (window.__lt.length = 0));
        await p.click('#btn-hint');
        await idle(p);
        const mv = await p.evaluate(() => { const js = [...document.querySelectorAll('#board .jar')]; return [js.findIndex((j) => j.classList.contains('hint-from')), js.findIndex((j) => j.classList.contains('hint-to'))]; });
        longest = Math.max(longest, ...(await p.evaluate(() => window.__lt.slice())), 0);
        if (mv[0] < 0 || mv[1] < 0) { out.winError = await p.evaluate(() => document.getElementById('toast').textContent); break; }
        await pourJar(p, mv[0], mv[1]);
        await p.waitForTimeout(300);
      }
      await p.waitForTimeout(1500);
      out.winWithHints = { hints, won: await p.evaluate(() => !document.getElementById('win').hidden), longestHintMs: Math.round(longest), moves: await moves(p) };
      await p.screenshot({ path: path.join(outDir, `${label}-win-with-hints.png`) });
      await ctx.close();
    }
  } finally {
    out.errors = errs;
    fs.writeFileSync(path.join(outDir, `${label}.json`), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
    await b.close();
  }
})();
