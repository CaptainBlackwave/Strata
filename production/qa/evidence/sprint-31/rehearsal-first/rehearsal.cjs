// Sprint 31 C2: dress rehearsal of Winter Tide on the unchanged code of e70ed708 (0.26.1 game code).
// Runs against a Vite dev server started from a clean worktree of that commit.
// Usage: WT=<worktree> PORT=5240 OUT=<log.json> node rehearsal.cjs
// Each context fixes its clock (context.clock.setFixedTime) to the date under test, seeds a save once
// (guarded by sessionStorage so a reload keeps what the game wrote), then checks the Home card (Play and
// Today tabs), the chooser, a played win, the save, snow and the event music key.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const WT = process.env.WT;
const config = require(path.join(WT, 'src/config/game-config.json'));
const BASE = `http://localhost:${process.env.PORT || 5240}`;
const KEY = 'strata.save.v2';
const ALL = config.mechanics.list.map((m) => m.id);
const out = (f) => path.join(__dirname, f);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const progress = (year, cleared) => ({ wintertide: { year, cleared, pours: Object.fromEntries(cleared.map((n) => [String(n), 30 + n])) } });

async function open(browser, { date, time = '09:00:00', width = 412, height = 860, text = 100, reduced = false, dsf = 1, level = 120, seed = {} }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.clock.setFixedTime(new Date(`${date}T${time}Z`));
  await context.addInitScript(([key, seen, level, text, seed]) => {
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1');
      const s = JSON.parse(localStorage.getItem(key) || '{}');
      Object.assign(s, { tutorialDone: true, level, seenMechanics: seen, seenWhatsNew: '9.9.9' });
      s.wallet = { coins: 100, boosters: { hint: 3, shuffle: 3, extraJar: 1, undo: 5 } };
      s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false };
      s.onboarding = { ...(s.onboarding || {}), visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
      Object.assign(s, seed);
      localStorage.setItem(key, JSON.stringify(s));
    }
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
  }, [KEY, ALL, level, text, seed]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`); });
  await page.goto(`${BASE}/?board=dom`);
  const homeUp = await page.waitForFunction(() => document.getElementById('home') && !document.getElementById('home').hidden, null, { timeout: 20000 }).then(() => true).catch(() => false);
  if (!homeUp) {
    // Record what the page shows instead of Home (a boot failure at this size, an overlay, ...).
    errors.push(`home not shown: ${JSON.stringify(await page.evaluate(() => ({ visible: [...document.querySelectorAll('body > *, #app > *')].filter((e) => !e.hidden && e.getClientRects().length).map((e) => e.id || e.className).slice(0, 12), mode: (window.__S || {}).mode, text: document.body.innerText.slice(0, 300) })).catch((e) => String(e)))}`);
    await page.screenshot({ path: out(`home-missing-${date}-${width}.png`) });
  }
  await page.evaluate(async () => {
    const st = await import('/src/ui/state.ts');
    window.__S = st.state; window.__A = st.audio;
    window.__W = await import('/src/ui/winter.ts');
  });
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await page.waitForTimeout(700);
  return { context, page, errors };
}

const vis = (sel) => `(() => { const e = document.querySelector('${sel}'); return !!e && !e.hidden && e.getClientRects().length > 0; })()`;
const save = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const overflow = (page, sel) => page.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return null;
  const r = root.getBoundingClientRect();
  const bad = [...root.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 0.5 || b.left < -0.5 || (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible' && e.clientWidth > 0)); })
    .slice(0, 8).map((e) => `${e.tagName.toLowerCase()}#${e.id}.${[...e.classList].join('.')} r=${Math.round(e.getBoundingClientRect().right)} sw=${e.scrollWidth} cw=${e.clientWidth} "${(e.textContent || '').trim().slice(0, 40)}"`);
  return { docScrollW: document.documentElement.scrollWidth, innerW: innerWidth, rootRight: Math.round(r.right), bad };
}, sel);

async function homeFacts(page) {
  return page.evaluate(() => {
    const show = (id) => { const e = document.getElementById(id); return !!e && !e.hidden; };
    const tx = (id) => document.getElementById(id)?.textContent ?? null;
    return {
      playCard: show('btn-event'), title: tx('event-title'), sub: tx('event-sub'), days: tx('event-days'),
      todayCard: show('btn-today-event'), todayTitle: tx('today-event-title'), todaySub: tx('today-event-sub'), todayDays: tx('today-event-days'), todayBar: document.getElementById('today-event-bar')?.style.width,
      snowing: window.__W.winterSnowing(), snowCanvas: !!document.querySelector('canvas.winter-fx'),
      musicEvent: window.__A.event ?? null, musicRoot: window.__A.musicVariation?.().root,
      clock: window.__S.clock().toISOString(), docScrollW: document.documentElement.scrollWidth, innerW: innerWidth,
    };
  });
}

async function chooser(page, shot) {
  const viaCard = await page.evaluate(() => { const b = document.getElementById('btn-event'); if (b && !b.hidden) { b.click(); return true; } return false; });
  if (!viaCard) await page.evaluate(async () => (await import('/src/ui/screens/sheets/event.ts')).openEvent(null));
  const opened = await page.waitForSelector('#event:not([hidden])', { timeout: 3000 }).then(() => true).catch(() => false);
  if (!opened) return { opened: false, viaCard };
  await page.waitForTimeout(500);
  const f = await page.evaluate(() => ({
    title: document.getElementById('event-sheet-title').textContent,
    sub: document.getElementById('event-sheet-sub').textContent,
    prize: document.getElementById('event-prize').textContent,
    boards: [...document.querySelectorAll('#event-boards .event-board')].map((b) => ({ n: +b.dataset.board, state: [...b.classList].find((c) => c !== 'event-board'), status: b.querySelector('span').textContent, label: b.getAttribute('aria-label'), disabled: b.disabled })),
    focus: document.activeElement?.dataset?.board ?? null,
  }));
  if (shot) await page.screenshot({ path: out(shot) });
  return { opened: true, viaCard, ...f };
}

const idle = (page) => page.waitForFunction(() => !window.__S.busy && window.__S.returning.size === 0, null, { polling: 50, timeout: 20000 });
const tap = async (page, i) => {
  const box = await page.locator('#board .jar').nth(i).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
  await page.waitForTimeout(90);
};

/** From an open chooser: taps board n, solves it in page, plays it (all pours by taps, or only the last when `quick`), and reads the win card. */
async function playBoard(page, n, { quick = false, shot = null, beforeWin = null } = {}) {
  await page.click(`#event-boards .event-board[data-board="${n}"]`);
  await page.waitForFunction(() => window.__S.mode === 'event' && !!window.__S.session, null, { timeout: 30000 });
  await page.waitForSelector('#board .jar .unit', { state: 'attached', timeout: 30000 });
  await page.evaluate(() => document.querySelectorAll('#intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await page.waitForTimeout(900);
  const board = await page.evaluate(() => ({ label: document.getElementById('level-label').textContent, ev: [window.__S.eventId, window.__S.eventYear, window.__S.eventBoard], snowing: window.__W.winterSnowing(), jars: document.querySelectorAll('#board .jar').length }));
  const plan = await page.evaluate(async () => {
    const B = await import('/src/core/board.ts');
    const { solve } = await import('/src/core/solver.ts');
    const b0 = window.__S.session.board;
    const colors = new Set(b0.jars.flatMap((j) => j.units)).size;
    const sol = solve(b0, 3_000_000);
    const states = [b0]; let b = b0;
    for (const m of sol.path) { b = B.pour(b, m.from, m.to).board; states.push(b); }
    window.__P = { states, path: sol.path };
    return { solvable: sol.solvable, pours: sol.path.length, colors, capacity: b0.capacity, hidden: b0.jars.reduce((a, j) => a + (j.hidden || 0), 0), special: b0.jars.filter((j) => Object.keys(j).some((k) => !['units', 'hidden'].includes(k))).length };
  });
  board.plan = plan;
  if (!plan.solvable) return { board, failed: 'solver found no path' };
  let start = 0;
  if (quick) { start = plan.pours - 1; await page.evaluate(async (k) => { const { beginSession } = await import('/src/ui/screens/board.ts'); beginSession(window.__P.states[k], false); }, start); await page.waitForTimeout(600); }
  for (let k = start; k < plan.pours; k++) {
    if (beforeWin && k === plan.pours - 1) await beforeWin();
    const m = plan.pours && (await page.evaluate((k) => window.__P.path[k], k));
    const before = await page.evaluate(() => window.__S.session.moves);
    await idle(page).catch(() => {});
    await tap(page, m.from); await tap(page, m.to);
    const ok = await page.waitForFunction((b) => window.__S.session.moves > b, before, { polling: 30, timeout: 5000 }).then(() => true).catch(() => false);
    if (!ok) return { board, failed: `pour ${k} did not register` };
  }
  const won = await page.waitForSelector('#win:not([hidden])', { timeout: 20000 }).then(() => true).catch(() => false);
  if (!won) return { board, failed: 'no win card' };
  await page.waitForTimeout(2200);
  await page.evaluate(() => document.querySelectorAll('#win:not([hidden])').forEach((w) => w.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))));
  await page.waitForTimeout(600);
  const win = await page.evaluate(() => {
    const tx = (id) => document.getElementById(id)?.textContent?.trim() ?? null;
    const shown = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; };
    return { title: tx('win-title'), text: tx('win-text'), note: tx('win-note'), rewardShown: shown('win-reward'), coins: tx('win-coins'), rewardSr: tx('win-reward-sr'), shell: shown('win-shell') ? tx('win-shell') : null, unlocks: [...document.querySelectorAll('#win-unlocks > *')].map((e) => `${e.className}: ${e.textContent.trim()}`), next: tx('btn-next'), share: shown('btn-share'), moves: window.__S.session.moves };
  });
  if (shot) await page.screenshot({ path: out(shot) });
  return { board, win };
}

async function nextFromWin(page) {
  await page.click('#btn-next');
  await page.waitForTimeout(900);
  return page.evaluate(() => ({ homeShown: !document.getElementById('home').hidden, chooserShown: !document.getElementById('event').hidden, snowing: window.__W.winterSnowing(), sub: document.getElementById('event-sheet-sub')?.textContent }));
}

async function stylesFrost(page, shot) {
  await page.evaluate(async () => (await import('/src/ui/screens/sheets/styles.ts')).openStyles(null));
  await page.waitForSelector('#styles:not([hidden])', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(600);
  const f = await page.evaluate(() => { const b = document.querySelector('.style-piece[data-slot="glass"][data-id="frost"]'); if (b) b.scrollIntoView({ block: 'center' }); return { found: !!b, text: b?.textContent.trim(), stylesBtnHidden: document.getElementById('btn-styles').hidden }; });
  await page.waitForTimeout(300);
  if (shot) await page.screenshot({ path: out(shot) });
  return f;
}

const DATES = [
  { date: '2026-11-30', seed: {}, play: null },
  { date: '2026-12-01', seed: {}, play: 1, full: true },
  { date: '2026-12-06', seed: { events: progress(2026, range(1, 5)) }, play: 6 },
  { date: '2026-12-12', seed: { events: progress(2026, [1, 2, 3, 4, 5, 6, 8, 9, 10, 11, 12]) }, play: 7 },
  { date: '2026-12-24', seed: { events: progress(2026, range(1, 23)) }, play: 24, full: true, prize: true },
  { date: '2026-12-25', seed: { events: progress(2026, [1, 2, 4, 5, 6, 7, 8, 9, 10]) }, play: 3 },
  { date: '2026-12-31', seed: { events: progress(2026, range(1, 20)) }, play: 23 },
  { date: '2027-01-01', seed: { events: progress(2026, range(1, 20)) }, play: null },
  { date: '2027-12-01', seed: { events: progress(2026, range(1, 24)), badges: ['event-wintertide'], styles: { owned: ['glass:frost'], worn: { glass: 'frost', cork: 'plain', sand: 'classic' } } }, play: 1, full: true },
];

async function run() {
  const browser = await chromium.launch();
  const log = { dates: {}, extra: {} };
  for (const d of DATES) {
    const L = (log.dates[d.date] = {});
    const { context, page, errors } = await open(browser, { date: d.date, seed: d.seed, dsf: 2 });
    try {
      L.saveBefore = (await save(page)).events;
      L.coinsBefore = (await save(page)).wallet.coins;
      L.home = await homeFacts(page);
      await page.screenshot({ path: out(`home-${d.date}.png`) });
      await page.click('#home-tab-today').catch(() => {});
      await page.waitForTimeout(500);
      L.todayTab = await homeFacts(page);
      await page.screenshot({ path: out(`home-today-tab-${d.date}.png`) });
      await page.click('#home-tab-play').catch(() => {});
      await page.waitForTimeout(400);
      L.chooser = await chooser(page, `chooser-${d.date}.png`);
      if (d.play && L.chooser.opened) {
        const r = await playBoard(page, d.play, { quick: !d.full, shot: `win-${d.date}-board${d.play}.png` });
        Object.assign(L, r);
        const s = await save(page);
        L.saveAfter = { events: s.events, coins: s.wallet.coins, badges: s.badges, owned: s.styles?.owned, worn: s.styles?.worn, jarsSealed: s.stats?.jarsSealed, level: s.level };
        L.afterNext = await nextFromWin(page);
        await page.screenshot({ path: out(`after-next-${d.date}.png`) });
        // persistence across a reload
        await page.reload();
        await page.waitForFunction(() => !document.getElementById('home').hidden, null, { timeout: 30000 });
        L.afterReload = (await save(page)).events;
        if (d.prize || d.date === '2027-12-01') { await page.evaluate(async () => { const st = await import('/src/ui/state.ts'); window.__S = st.state; window.__A = st.audio; window.__W = await import('/src/ui/winter.ts'); }); L.styles = await stylesFrost(page, `styles-frost-${d.date}.png`); }
      }
    } catch (e) { L.failed = String(e).slice(0, 400); }
    L.errors = errors;
    await context.close();
    fs.writeFileSync(process.env.OUT || out('rehearsal-log.json'), JSON.stringify(log, null, 1));
  }

  // Second-year completion: 2027-12-24 with 23 cleared in 2027 and the 2026 prize owned.
  {
    const L = (log.extra.secondYearComplete = {});
    const { context, page, errors } = await open(browser, { date: '2027-12-24', dsf: 2, seed: { events: progress(2027, range(1, 23)), badges: ['event-wintertide'], styles: { owned: ['glass:frost'], worn: { glass: 'clear', cork: 'plain', sand: 'classic' } } } });
    try {
      L.chooser = await chooser(page, null);
      Object.assign(L, await playBoard(page, 24, { quick: true, shot: 'win-2027-12-24-second-year-complete.png' }));
      const s = await save(page);
      L.saveAfter = { events: s.events, coins: s.wallet.coins, badges: s.badges, owned: s.styles?.owned };
    } catch (e) { L.failed = String(e).slice(0, 400); }
    L.errors = errors; await context.close();
  }

  // A low-level player (level 8, Jar styles not open yet) completes: does the prize show anywhere?
  {
    const L = (log.extra.lowLevelPrize = {});
    const { context, page, errors } = await open(browser, { date: '2026-12-24', level: 8, seed: { events: progress(2026, range(1, 23)) } });
    try {
      L.home = await homeFacts(page);
      L.chooser = await chooser(page, null);
      Object.assign(L, await playBoard(page, 24, { quick: true }));
      const s = await save(page); L.saveAfter = { owned: s.styles?.owned, badges: s.badges, level: s.level };
      await nextFromWin(page);
      await page.evaluate(() => document.getElementById('btn-close-event')?.click());
      L.stylesButtonHidden = await page.evaluate(() => document.getElementById('btn-styles').hidden);
    } catch (e) { L.failed = String(e).slice(0, 400); }
    L.errors = errors; await context.close();
  }

  // The edge case: a board started 31 Dec 23:58 and won after midnight (1 Jan).
  {
    const L = (log.extra.wonAfterMidnight = {});
    const { context, page, errors } = await open(browser, { date: '2026-12-31', time: '23:58:00', seed: { events: progress(2026, range(1, 20)) } });
    try {
      L.chooser = (await chooser(page, null)).opened;
      Object.assign(L, await playBoard(page, 21, { quick: true, beforeWin: async () => { await context.clock.setFixedTime(new Date('2027-01-01T00:01:00Z')); await page.waitForTimeout(300); } }));
      L.clockAtWin = await page.evaluate(() => window.__S.clock().toISOString());
      L.saveAfter = (await save(page)).events;
      L.afterNext = await nextFromWin(page);
      L.homeAfter = await homeFacts(page);
      await page.screenshot({ path: out('after-midnight-win-next.png') });
    } catch (e) { L.failed = String(e).slice(0, 400); }
    L.errors = errors; await context.close();
  }

  // Reduced motion: Home and an event board on 12-12, no snow.
  {
    const L = (log.extra.reduced = {});
    const { context, page, errors } = await open(browser, { date: '2026-12-12', reduced: true });
    try {
      L.home = await homeFacts(page);
      await chooser(page, null);
      await page.click('#event-boards .event-board[data-board="12"]');
      await page.waitForFunction(() => window.__S.mode === 'event' && !!window.__S.session, null, { timeout: 30000 });
      await page.waitForTimeout(900);
      L.boardSnow = await page.evaluate(() => ({ snowing: window.__W.winterSnowing(), canvas: !!document.querySelector('canvas.winter-fx') }));
    } catch (e) { L.failed = String(e).slice(0, 400); }
    L.errors = errors; await context.close();
  }

  // Snow on a normal level board during the event (should be off), from Home's Play on 12-12.
  {
    const L = (log.extra.levelBoardSnow = {});
    const { context, page, errors } = await open(browser, { date: '2026-12-12', level: 1 });
    try {
      L.homeSnow = await page.evaluate(() => window.__W.winterSnowing());
      await page.evaluate(async () => (await import('/src/ui/screens/board.ts')).startLevel(1));
      await page.waitForFunction(() => window.__S.mode === 'level' && !!window.__S.session, null, { timeout: 30000 });
      await page.waitForTimeout(900);
      L.levelSnow = await page.evaluate(() => ({ snowing: window.__W.winterSnowing(), canvas: !!document.querySelector('canvas.winter-fx') }));
    } catch (e) { L.failed = String(e).slice(0, 400); }
    L.errors = errors; await context.close();
  }

  // 320px at 150% text: Home (Play and Today tabs), chooser and win card on 1, 12, 24 and 31 Dec.
  for (const d of [{ date: '2026-12-01', seed: {}, play: 1 }, { date: '2026-12-12', seed: { events: progress(2026, range(1, 11)) }, play: 12 }, { date: '2026-12-24', seed: { events: progress(2026, range(1, 23)) }, play: 24 }, { date: '2026-12-31', seed: { events: progress(2026, range(1, 20)) }, play: 21 }]) {
    const L = (log.extra[`w320-${d.date}`] = {});
    let o;
    try { o = await open(browser, { date: d.date, width: 320, height: 700, text: 150, dsf: 2, seed: d.seed }); } catch (e) { L.openFailed = String(e).slice(0, 300); continue; }
    const { context, page, errors } = o;
    try {
      L.homePlay = await overflow(page, '#btn-event');
      L.homeFacts = await homeFacts(page);
      await page.evaluate(() => document.getElementById('btn-event')?.scrollIntoView({ block: 'center' }));
      await page.screenshot({ path: out(`w320-home-${d.date}.png`) });
      await page.click('#home-tab-today').catch(() => {});
      await page.waitForTimeout(500);
      await page.evaluate(() => document.getElementById('btn-today-event')?.scrollIntoView({ block: 'center' }));
      L.homeToday = await overflow(page, '#btn-today-event');
      await page.screenshot({ path: out(`w320-today-${d.date}.png`) });
      await page.click('#home-tab-play').catch(() => {});
      await page.waitForTimeout(400);
      const c = await chooser(page, `w320-chooser-${d.date}.png`);
      L.chooserOpened = c.opened;
      L.chooser = await overflow(page, '#event');
      L.chooserScroll = await page.evaluate(() => { const ol = document.getElementById('event-boards'); const card = document.querySelector('#event .card'); return { olSW: ol.scrollWidth, olCW: ol.clientWidth, cardSH: card.scrollHeight, cardCH: card.clientHeight, cardOverflowY: getComputedStyle(card).overflowY }; });
      const r = await playBoard(page, d.play, { quick: true, shot: `w320-win-${d.date}.png` });
      L.win = r.win; L.winFailed = r.failed;
      L.winOverflow = await overflow(page, '#win');
    } catch (e) { L.failed = String(e).slice(0, 400); }
    L.errors = errors; await context.close();
    fs.writeFileSync(process.env.OUT || out('rehearsal-log.json'), JSON.stringify(log, null, 1));
  }

  await browser.close();
  fs.writeFileSync(process.env.OUT || out('rehearsal-log.json'), JSON.stringify(log, null, 1));
}
run().catch((e) => { console.error(e); process.exit(1); });
