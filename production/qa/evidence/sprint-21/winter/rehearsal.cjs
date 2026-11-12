// Sprint 21 W1 (D178): the Winter Tide dress rehearsal (design/gdd/events.md §8). The date is faked
// with Playwright's clock (the app reads `new Date()` through src/ui/clock.ts systemClock).
// 1. Opening days: 30 Nov, 1/12/24/31 Dec, 1 Jan (card, chooser, days-left text).
// 2. On 24 Dec, all 24 boards won by taps on #board .jar along the solver's path: 1-12 Realistic
//    (?board=gpu), 13-24 Classic (?board=dom). Coins per board, the replay, Frost + badge once, Frost unsellable.
// 3. Snow on Home and event boards (not under reduced motion, not out of season); the music variation.
// 4. Screenshots at 390px and 320px/150% text on 1, 12, 31 Dec. 5. The rainbowafterrain hero, the night splash.
// Usage (dev server running):  PORT=5182 node production/qa/evidence/sprint-21/winter/rehearsal.cjs [part...]
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5182}`;
const KEY = 'strata.save.v2';
const OUT = __dirname;
const MECH = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam'];
const ONB = { visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true, pendingShare: null };
const parts = process.argv.slice(2).length ? process.argv.slice(2) : ['days', 'play', 'snow', 'shots', 'scenes'];
const results = fs.existsSync(path.join(OUT, 'results.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'results.json'), 'utf8')) : {};
const save = () => fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2) + '\n');
const at = (d) => new Date(`${d}T12:00:00Z`);

/** A context + page on `date`, seeded once per tab (sessionStorage flag), so progress survives navigation. */
async function open(browser, { date, width = 390, text = 100, reduced = false, seed = {}, block = null }) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 320 ? 640 : 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  // The app's modules can carry Vite's ?t= HMR stamp; importing the bare path would make a second
  // instance (a second `state`, a second GameAudio). __mod imports the URL the app itself loaded.
  await ctx.addInitScript(() => {
    const cache = {};
    const importers = ['/src/ui/main.ts', '/src/ui/app.ts', '/src/ui/screens/home.ts', '/src/ui/screens/board.ts', '/src/ui/screens/win.ts', '/src/ui/screens/sheets/event.ts'];
    window.__mod = (p) => (cache[p] ??= (async () => {
      for (const f of importers) {
        const text = await (await fetch(f)).text();
        const m = text.match(new RegExp('"(' + p.replace(/[.]/g, '\\.') + '(\\?t=\\d+)?)"'));
        if (m) return import(m[1]);
      }
      return import(p);
    })());
  });
  await ctx.addInitScript(([key, mech, onb, seed, text, goalsDate]) => {
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = text + '%'; });
    if (sessionStorage.getItem('seeded')) return;
    sessionStorage.setItem('seeded', '1');
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level: 60, seenMechanics: mech, seenWhatsNew: '9.9.9' });
    s.wallet = { coins: 1000, boosters: { hint: 3, shuffle: 3, extraJar: 1, undo: 5 } };
    s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false, realistic: true };
    s.onboarding = { ...(s.onboarding || {}), ...onb };
    // Today's goals already done, so a goal's coins never mix into the event's (goals.ts pays on event wins too).
    s.goals = { date: goalsDate, progress: [999, 999, 999], done: [0, 1, 2], bonus: true };
    Object.assign(s, seed);
    localStorage.setItem(key, JSON.stringify(s));
  }, [KEY, MECH, ONB, seed, text, date]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  if (block) await page.route(block, (r) => r.abort());
  await page.clock.setFixedTime(at(date));
  return { ctx, page };
}

const st = (page, fn, arg) => page.evaluate(async ([src, arg]) => { const m = await window.__mod('/src/ui/state.ts'); return new Function('m', 'arg', `return (${src})(m, arg)`)(m, arg); }, [fn.toString(), arg]);
const dismiss = (page) => page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));

async function boot(page, query = '') {
  await page.goto(`${BASE}/${query}`);
  await page.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('home').hidden, null, { timeout: 30000 });
  await dismiss(page);
  await page.evaluate(async () => { window.S = (await window.__mod('/src/ui/state.ts')).state; });
  await page.waitForTimeout(900);
}
// Playwright's waitForFunction takes a Promise as truthy, so every predicate below is synchronous on window.S.

const homeInfo = (page) => page.evaluate(async () => {
  const { winterSnowing } = await window.__mod('/src/ui/winter.ts');
  const { audio } = await window.__mod('/src/ui/state.ts');
  const tx = (id) => document.getElementById(id)?.textContent ?? null;
  return {
    card: !document.getElementById('btn-event').hidden, title: tx('event-title'), sub: tx('event-sub'), days: tx('event-days'),
    todayCard: !document.getElementById('btn-today-event').hidden, todaySub: tx('today-event-sub'), todayDays: tx('today-event-days'),
    snowing: winterSnowing(), snowCanvas: document.querySelectorAll('.winter-fx').length, snowParent: document.querySelector('.winter-fx')?.parentElement?.id || document.querySelector('.winter-fx')?.parentElement?.tagName || null,
    musicEvent: audio.event, musicKey: audio.musicKey?.() ?? null,
  };
});

async function openChooser(page) {
  await page.evaluate(async () => (await window.__mod('/src/ui/screens/sheets/event.ts')).openEvent(null));
  await page.waitForSelector('#event:not([hidden])');
  await page.waitForTimeout(500);
  return page.evaluate(() => ({
    sub: document.getElementById('event-sheet-sub').textContent, prize: document.getElementById('event-prize').textContent,
    open: document.querySelectorAll('.event-board.open').length, cleared: document.querySelectorAll('.event-board.cleared').length, locked: document.querySelectorAll('.event-board.locked').length,
    firstLocked: document.querySelector('.event-board.locked')?.getAttribute('aria-label') ?? null,
  }));
}

const idle = (page) => page.waitForFunction(() => !S.busy && S.returning.size === 0, null, { polling: 40, timeout: 20000 });
async function tap(page, i) {
  const box = await page.locator('#board .jar').nth(i).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
  await page.waitForTimeout(60);
}

/** Starts event board `n` from the chooser and wins it by taps along the solver's path. */
async function playBoard(page, n) {
  if (!(await page.locator('#event:not([hidden])').count())) await openChooser(page);
  await page.click(`.event-board[data-board="${n}"]`);
  await page.waitForFunction((n) => S.mode === 'event' && S.eventBoard === n && !!S.session && S.session.board.jars.length === document.querySelectorAll('#board .jar').length, n, { polling: 50, timeout: 20000 });
  await dismiss(page);
  await page.waitForTimeout(500);
  const onBoard = await homeInfo(page);
  const render = await page.evaluate(() => document.getElementById('board').dataset.render);
  let taps = 0;
  let misses = 0;
  const trace = [];
  for (let round = 0; round < 40; round++) {
    await idle(page);
    const s = await st(page, (m) => ({ won: m.state.session.status === 'won', sel: m.state.selected }));
    if (s.won) break;
    if (s.sel !== null && s.sel !== undefined) { await tap(page, s.sel); await idle(page); }
    const p = await page.evaluate(async () => { const { state } = await window.__mod('/src/ui/state.ts'); const { solve } = await window.__mod('/src/core/solver.ts'); return solve(state.session.board, 400000).path.map((m) => [m.from, m.to]); });
    let ok = true;
    trace.push(`r${round}:len${p.length}:${JSON.stringify(p[0])}`);
    for (const [f, t] of p) {
      const before = await st(page, (m) => m.state.session.moves);
      const selOk = async () => page.waitForFunction((f) => S.selected === f, f, { polling: 30, timeout: 1500 }).then(() => true, () => false);
      await tap(page, f); taps++;
      if (!(await selOk())) { misses++; await page.waitForTimeout(400); await tap(page, f); taps++; if (!(await selOk())) { ok = false; break; } }
      await tap(page, t); taps++;
      const counted = await page.waitForFunction((b) => S.session.moves === b + 1, before, { polling: 40, timeout: 3000 }).then(() => true, () => false);
      await idle(page);
      if (!counted) { ok = false; misses++; break; }
    }
    if (ok) break;
  }
  await page.waitForSelector('#win:not([hidden])', { timeout: 20000 }).catch(async (e) => {
    const dbg = await st(page, (m) => ({ status: m.state.session.status, moves: m.state.session.moves, busy: m.state.busy, sel: m.state.selected, mode: m.state.mode, jarsDom: document.querySelectorAll('#board .jar').length, jarsBoard: m.state.session.board.jars.length,
      hits: [...document.querySelectorAll('#board .jar')].map((j) => { const r = j.getBoundingClientRect(); const e = document.elementFromPoint(r.x + r.width / 2, r.y + r.height * 0.6); return `${e?.tagName}.${e?.className}`.slice(0, 40); }) }));
    await page.screenshot({ path: path.join(OUT, `fail-board${n}.png`) });
    throw new Error(`board ${n} no win card: ${JSON.stringify(dbg)} taps ${taps} trace ${trace.slice(0, 12).join(' ')}`);
  });
  await page.waitForTimeout(1400);
  const win = await page.evaluate(() => ({
    title: document.getElementById('win-title').textContent, text: document.getElementById('win-text').textContent, note: document.getElementById('win-note').textContent,
    coinsShown: !document.getElementById('win-reward').hidden ? document.getElementById('win-coins').textContent : null,
    rows: [...document.querySelectorAll('#win-unlocks > *')].filter((e) => !e.hidden).map((e) => e.textContent.trim().replace(/\s+/g, ' ')),
  }));
  return { n, render, taps, misses, snowOnBoard: onBoard.snowing, musicOnBoard: onBoard.musicEvent, win };
}
const nextFromWin = async (page) => { await page.click('#btn-next'); await page.waitForSelector('#event:not([hidden])', { timeout: 10000 }); await page.waitForTimeout(400); };
const saved = (page) => page.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); return { coins: s.wallet.coins, events: s.events, frostOwned: s.styles.owned.filter((x) => x === 'glass:frost').length, badge: s.badges.filter((b) => (b.id ?? b) === 'event-wintertide').length, badges: s.badges.length, level: s.level }; }, KEY);

async function frostSheet(page) {
  const coins0 = (await saved(page)).coins;
  await page.evaluate(async () => (await window.__mod('/src/ui/screens/sheets/styles.ts')).openStyles(null));
  await page.waitForSelector('#styles:not([hidden])');
  await page.waitForTimeout(400);
  const btn = page.locator('[data-slot="glass"][data-id="frost"]');
  const status = await btn.locator('.scene-status').textContent();
  const locked = await btn.locator('.scene-status.locked').count();
  await btn.click();
  await page.waitForTimeout(300);
  const action = await page.evaluate(() => { const b = document.getElementById('btn-style-action'); return { hidden: b.hidden, disabled: b.disabled, text: b.textContent }; });
  if (!action.hidden && !action.disabled) { await page.click('#btn-style-action'); await page.waitForTimeout(300); }
  const after = await saved(page);
  const direct = await page.evaluate(async () => { const { buyStyle } = await window.__mod('/src/core/styles.ts'); const { state, config } = await window.__mod('/src/ui/state.ts'); return buyStyle({ ...state.save.wallet, coins: 999999 }, state.save.styles, 60, 'glass', 'frost', config).ok; });
  await page.keyboard.press('Escape');
  await page.evaluate(() => document.querySelector('#styles:not([hidden]) [id^="btn-close"]')?.click());
  await page.waitForTimeout(300);
  return { status, locked: !!locked, action, coinsBefore: coins0, coinsAfter: after.coins, frostOwned: after.frostOwned, buyStyleOk: direct };
}

(async () => {
  const browser = await chromium.launch();

  if (parts.includes('days')) {
    results.days = {};
    for (const d of ['2026-11-30', '2026-12-01', '2026-12-12', '2026-12-24', '2026-12-31', '2027-01-01']) {
      const { ctx, page } = await open(browser, { date: d });
      await boot(page);
      const r = await homeInfo(page);
      if (r.card) r.chooser = await openChooser(page);
      r.errors = page.errors;
      results.days[d] = r;
      await ctx.close();
    }
    save();
  }

  if (parts.includes('play')) {
    const { ctx, page } = await open(browser, { date: '2026-12-24' });
    const out = { boards: [], frostBefore: null, frostAfter: null };
    await boot(page, '?board=gpu');
    out.frostBefore = await frostSheet(page);
    await openChooser(page);
    for (let n = 1; n <= 24; n++) {
      if (n === 13) { await page.goto(`${BASE}/?board=dom`); await page.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('home').hidden); await dismiss(page); await page.evaluate(async () => { window.S = (await window.__mod('/src/ui/state.ts')).state; }); await page.waitForTimeout(800); await openChooser(page); }
      const before = await saved(page);
      const r = await playBoard(page, n);
      const after = await saved(page);
      Object.assign(r, { coinDelta: after.coins - before.coins, cleared: after.events.wintertide?.cleared.length, frostOwned: after.frostOwned, badge: after.badge });
      if (n === 1 || n === 6 || n === 13 || n === 24) await page.screenshot({ path: path.join(OUT, `play-${r.render}-board${n}-win.png`) });
      out.boards.push(r);
      console.log('board', n, r.render, 'delta', r.coinDelta, 'cleared', r.cleared, 'frost', r.frostOwned, 'badge', r.badge, r.win.title, '|', r.win.rows.join(' / '));
      await nextFromWin(page);
    }
    // Replays: one Classic now, one Realistic after a reload; neither pays nor re-grants.
    for (const [n, q] of [[24, null], [3, '?board=gpu']]) {
      if (q) { await page.goto(`${BASE}/${q}`); await page.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('home').hidden); await dismiss(page); await page.evaluate(async () => { window.S = (await window.__mod('/src/ui/state.ts')).state; }); await page.waitForTimeout(800); }
      const before = await saved(page);
      const r = await playBoard(page, n);
      const after = await saved(page);
      out[`replay${n}`] = { ...r, coinDelta: after.coins - before.coins, frostOwned: after.frostOwned, badge: after.badge, badges: after.badges - before.badges, eventsAfter: after.events.wintertide };
      if (n === 24) await page.screenshot({ path: path.join(OUT, 'play-dom-board24-replay-win.png') });
      await nextFromWin(page);
    }
    await page.keyboard.press('Escape');
    await page.evaluate(() => document.getElementById('btn-close-event')?.click());
    await page.waitForTimeout(400);
    out.frostAfter = await frostSheet(page);
    out.final = await saved(page);
    out.errors = page.errors;
    results.play = out;
    save();
    await ctx.close();
  }

  if (parts.includes('snow')) {
    const out = {};
    for (const [tag, date, reduced] of [['dec24', '2026-12-24', false], ['dec24-reduced', '2026-12-24', true], ['nov30', '2026-11-30', false], ['jan01', '2027-01-01', false]]) {
      const { ctx, page } = await open(browser, { date, reduced });
      await boot(page);
      const home = await homeInfo(page);
      let board = null;
      if (home.card) { await openChooser(page); await page.click('.event-board[data-board="1"]'); await page.waitForFunction(() => S.mode === 'event'); await page.waitForTimeout(800); board = await homeInfo(page); if (tag === 'dec24') await page.screenshot({ path: path.join(OUT, 'snow-event-board.png') }); }
      // A level board turns it off again.
      await page.evaluate(async () => (await window.__mod('/src/ui/screens/board.ts')).startLevel(5));
      await page.waitForTimeout(800);
      const level = await homeInfo(page);
      out[tag] = { home: { snowing: home.snowing, canvas: home.snowCanvas, parent: home.snowParent, music: home.musicEvent, key: home.musicKey }, eventBoard: board && { snowing: board.snowing, canvas: board.snowCanvas, music: board.musicEvent }, levelBoard: { snowing: level.snowing, canvas: level.snowCanvas, music: level.musicEvent } };
      await ctx.close();
    }
    // The variation the music would play (music.ts), read without audio.
    const { ctx, page } = await open(browser, { date: '2026-12-24' });
    await boot(page);
    out.variation = await page.evaluate(async () => { const m = await window.__mod('/src/ui/music.ts'); const v = m.musicFor('event:wintertide'); return { wintertide: v, sameAsMidday: JSON.stringify(v) === JSON.stringify(m.musicFor('midday')) }; });
    await ctx.close();
    results.snow = out;
    save();
  }

  if (parts.includes('shots')) {
    const out = {};
    const cleared23 = { wintertide: { year: 2026, cleared: Array.from({ length: 23 }, (_, i) => i + 1), pours: Object.fromEntries(Array.from({ length: 23 }, (_, i) => [String(i + 1), 20 + i])) } };
    const some = { wintertide: { year: 2026, cleared: [1, 2, 3, 5, 8], pours: { 1: 18, 2: 22, 3: 25, 5: 31, 8: 27 } } };
    for (const [wtag, width, text] of [['390', 390, 100], ['320-150', 320, 150]]) {
      for (const d of ['2026-12-01', '2026-12-12', '2026-12-31']) {
        const tag = `${wtag}-${d.slice(5)}`;
        const { ctx, page } = await open(browser, { date: d, width, text, seed: d === '2026-12-12' ? { events: some } : {} });
        await boot(page, '?board=dom');
        await page.screenshot({ path: path.join(OUT, `shot-${tag}-home.png`) });
        await page.click('#home-tab-today'); await page.waitForTimeout(600);
        await page.screenshot({ path: path.join(OUT, `shot-${tag}-today.png`) });
        await page.click('#home-tab-play'); await page.waitForTimeout(400);
        const ch = await openChooser(page);
        await page.screenshot({ path: path.join(OUT, `shot-${tag}-chooser.png`) });
        await page.evaluate(() => { const l = document.querySelector('#event-boards li:last-child'); l?.scrollIntoView(); });
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(OUT, `shot-${tag}-chooser-end.png`) });
        const fit = await page.evaluate(() => { const w = document.documentElement.clientWidth; return [...document.querySelectorAll('#event *, #btn-event *, #win *')].filter((e) => e.offsetParent && e.getBoundingClientRect().right > w + 1).map((e) => e.id || e.className).slice(0, 8); });
        const n = d === '2026-12-12' ? 4 : 1;
        const r = await playBoard(page, n);
        await page.screenshot({ path: path.join(OUT, `shot-${tag}-win.png`) });
        const winFit = await page.evaluate(() => { const w = document.documentElement.clientWidth; const h = window.innerHeight; const b = document.getElementById('btn-next').getBoundingClientRect(); return { overflowX: document.documentElement.scrollWidth > w, nextVisible: b.bottom <= h && b.top >= 0 }; });
        out[tag] = { chooser: ch, overflowEls: fit, win: r.win, winFit, errors: page.errors };
        await ctx.close();
        if (d === '2026-12-31') {
          const { ctx, page } = await open(browser, { date: d, width, text, seed: { events: cleared23 } });
          await boot(page, '?board=dom');
          await page.screenshot({ path: path.join(OUT, `shot-${tag}-home-23.png`) });
          const r = await playBoard(page, 24);
          await page.screenshot({ path: path.join(OUT, `shot-${tag}-prize-win.png`) });
          const winFit = await page.evaluate(() => { const h = window.innerHeight; const b = document.getElementById('btn-next').getBoundingClientRect(); return { overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth, nextVisible: b.bottom <= h && b.top >= 0 }; });
          await nextFromWin(page);
          await page.screenshot({ path: path.join(OUT, `shot-${tag}-chooser-complete.png`) });
          await page.evaluate(() => document.getElementById('btn-close-event').click()); await page.waitForTimeout(600);
          await page.screenshot({ path: path.join(OUT, `shot-${tag}-home-complete.png`) });
          out[`${tag}-prize`] = { win: r.win, winFit, home: await homeInfo(page), errors: page.errors };
          await ctx.close();
        }
      }
    }
    results.shots = out;
    save();
  }

  if (parts.includes('scenes')) {
    const out = {};
    const rainbow = { themes: { owned: ['rainbowafterrain'], selected: 'rainbowafterrain', auto: false } };
    for (const q of ['gpu', 'dom']) {
      const { ctx, page } = await open(browser, { date: '2026-11-20', seed: rainbow });
      await boot(page, `?board=${q}`);
      await page.waitForTimeout(1200);
      await page.screenshot({ path: path.join(OUT, `scene-rainbow-home-${q}.png`) });
      await page.locator('.hero, #hero-stage').first().screenshot({ path: path.join(OUT, `scene-rainbow-hero-${q}.png`) }).catch(() => {});
      out[`rainbow-${q}`] = { scene: await page.evaluate(async () => (await window.__mod('/src/ui/theme.ts')).currentTheme()), errors: page.errors };
      await ctx.close();
    }
    const night = { themes: { owned: ['lighthousenight'], selected: 'lighthousenight', auto: false } };
    {
      // The splash alone: main.ts blocked, so it stays up.
      const { ctx, page } = await open(browser, { date: '2026-11-20', seed: night, block: '**/src/ui/main.ts*' });
      await page.goto(`${BASE}/`); await page.waitForTimeout(800);
      await page.screenshot({ path: path.join(OUT, 'scene-night-splash.png') });
      out.nightSplash = await page.evaluate(() => ({ splash: !!document.getElementById('splash'), bg: document.getElementById('splash')?.style.background.slice(0, 120) }));
      await ctx.close();
    }
    {
      const { ctx, page } = await open(browser, { date: '2026-11-20', seed: night });
      await boot(page);
      await page.screenshot({ path: path.join(OUT, 'scene-night-home.png') });
      out.nightHome = { scene: await page.evaluate(async () => (await window.__mod('/src/ui/theme.ts')).currentTheme()), bodyBg: await page.evaluate(() => getComputedStyle(document.body).backgroundColor) };
      await ctx.close();
    }
    results.scenes = out;
    save();
  }
  await browser.close();
  console.log(JSON.stringify({ days: results.days && Object.fromEntries(Object.entries(results.days).map(([d, r]) => [d, [r.card, r.sub, r.days, r.chooser && `${r.chooser.open}o/${r.chooser.cleared}c/${r.chooser.locked}l`, r.snowing, r.musicEvent]])) }));
})().catch((e) => { console.error(e); save(); process.exit(1); });
