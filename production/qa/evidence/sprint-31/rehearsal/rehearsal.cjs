// Sprint 31 C6: FINAL dress rehearsal of "Christmas at the seaside" on the finished build (c84f1e5).
// Usage: PORT=5243 node rehearsal.cjs   (Vite dev server on the repo root; Playwright's preinstalled Chromium)
// Each context fixes its clock (context.clock.setFixedTime) to the date under test and seeds a save once
// (guarded by sessionStorage so a reload keeps what the game wrote). Helpers come from ../rehearsal-first/rehearsal.cjs.
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium } = pw;
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '../../../../..');
const config = require(path.join(ROOT, 'src/config/game-config.json'));
const BASE = `http://localhost:${process.env.PORT || 5243}`;
const KEY = 'strata.save.v2';
const ALL = config.mechanics.list.map((m) => m.id);
const out = (f) => path.join(__dirname, f);
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const prog = (year, cleared) => ({ year, cleared, pours: Object.fromEntries(cleared.map((n) => [String(n), 30 + n])) });
const LOGF = out('rehearsal-log.json');

async function open(browser, { date, time = '09:00:00', width = 412, height = 860, text = 100, dsf = 2, level = 120, seed = {} }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dsf, serviceWorkers: 'block', reducedMotion: 'no-preference' });
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
  const errors = []; const warnings = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); else if (m.type() === 'warning') warnings.push(m.text()); });
  await page.goto(`${BASE}/?board=dom`);
  await boot(page, errors);
  return { context, page, errors, warnings };
}

async function boot(page, errors) {
  const up = await page.waitForFunction(() => document.getElementById('home') && !document.getElementById('home').hidden, null, { timeout: 30000 }).then(() => true).catch(() => false);
  if (!up) errors.push(`home not shown: ${await page.evaluate(() => document.body.innerText.slice(0, 200)).catch((e) => String(e))}`);
  await page.evaluate(async () => {
    const st = await import('/src/ui/state.ts');
    window.__S = st.state; window.__A = st.audio;
    window.__W = await import('/src/ui/winter.ts');
  });
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await page.waitForTimeout(1200);
}

const save = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const brief = (s) => ({ coins: s.wallet.coins, hint: s.wallet.boosters.hint, events: s.events, gifts: s.gifts, startCards: s.startCards, badges: s.badges, owned: s.styles?.owned, worn: s.styles?.worn });

const overflow = (page, sel) => page.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return null;
  const bad = [...root.querySelectorAll('*')].filter((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 0.5 || b.left < -0.5 || (e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible' && e.clientWidth > 0)); })
    .slice(0, 8).map((e) => `${e.tagName.toLowerCase()}#${e.id}.${[...e.classList].join('.')} r=${Math.round(e.getBoundingClientRect().right)} sw=${e.scrollWidth} cw=${e.clientWidth} "${(e.textContent || '').trim().slice(0, 40)}"`);
  return { docScrollW: document.documentElement.scrollWidth, bodyScrollW: document.body.scrollWidth, innerW: innerWidth, bad };
}, sel);

/** The Home notice (gift or start card), waiting up to `ms` for it to open. */
async function notice(page, ms = 2500) {
  await page.waitForSelector('#home-notice:not([hidden])', { timeout: ms }).catch(() => {});
  return page.evaluate(() => {
    const e = document.getElementById('home-notice');
    const shown = !!e && !e.hidden && e.getClientRects().length > 0;
    const tx = (id) => document.getElementById(id)?.textContent?.trim() ?? null;
    return { shown, title: shown ? tx('notice-title') : null, text: shown ? tx('notice-text') : null, ok: shown ? tx('btn-notice-ok') : null, later: shown ? tx('btn-notice-later') : null, art: shown ? { hidden: document.getElementById('notice-art').hidden, html: document.getElementById('notice-art').innerHTML.slice(0, 120) } : null, focus: document.activeElement?.id ?? null };
  });
}

async function homeFacts(page) {
  return page.evaluate(() => {
    const show = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.getClientRects().length > 0; };
    const tx = (id) => document.getElementById(id)?.textContent ?? null;
    const sp = document.querySelector('canvas.sparkle-fx');
    return {
      eventCard: show('btn-event'), title: tx('event-title'), sub: tx('event-sub'), days: tx('event-days'),
      garland: show('home-garland'),
      sparkleCanvas: !!sp && sp.isConnected && getComputedStyle(sp).display !== 'none',
      snowing: window.__W.winterSnowing(), musicEvent: window.__A.event ?? null,
      clock: window.__S.clock().toISOString(), docScrollW: document.documentElement.scrollWidth, innerW: innerWidth,
    };
  });
}

async function mapLights(page, shot) {
  await page.evaluate(async () => (await import('/src/ui/screens/map.ts')).openMap());
  await page.waitForSelector('#map:not([hidden])', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(900);
  const f = await page.evaluate(() => { const s = document.querySelector('svg.map-lights'); return { mapShown: !document.getElementById('map').hidden, svg: !!s, children: s ? s.children.length : 0, bulbs: s ? s.querySelectorAll(':scope > :not(.light-wire)').length : 0 }; });
  if (shot) await page.screenshot({ path: out(shot) });
  await page.evaluate(async () => (await import('/src/ui/screens/map.ts')).closeMap());
  await page.waitForTimeout(600);
  return f;
}

async function scenes(page, shot) {
  await page.evaluate(async () => (await import('/src/ui/screens/sheets/scenes.ts')).openScenes(null));
  await page.waitForSelector('#scenes:not([hidden])', { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(600);
  const f = await page.evaluate(() => [...document.querySelectorAll('#scene-grid .scene-card')].slice(0, 4).map((c) => ({ id: c.dataset.id, name: c.querySelector('.scene-name')?.textContent, badges: [...c.querySelectorAll('.scene-badge')].map((b) => b.textContent) })));
  const festiveAnywhere = await page.evaluate(() => document.querySelectorAll('#scene-grid .scene-badge.festive').length);
  if (shot) await page.screenshot({ path: out(shot) });
  await page.evaluate(async () => (await import('/src/ui/screens/sheets/scenes.ts')).closeScenes());
  await page.waitForTimeout(500);
  return { first: f, festiveTags: festiveAnywhere };
}

async function chooser(page, shot) {
  const viaCard = await page.evaluate(() => { const b = document.getElementById('btn-event'); if (b && !b.hidden) { b.click(); return true; } return false; });
  if (!viaCard) await page.evaluate(async () => (await import('/src/ui/screens/sheets/event.ts')).openEvent(null));
  const opened = await page.waitForSelector('#event:not([hidden])', { timeout: 3000 }).then(() => true).catch(() => false);
  if (!opened) return { opened: false, viaCard };
  await page.waitForTimeout(500);
  const f = await chooserFacts(page);
  if (shot) await page.screenshot({ path: out(shot) });
  return { opened: true, viaCard, ...f };
}
const chooserFacts = (page) => page.evaluate(() => ({
  title: document.getElementById('event-sheet-title').textContent,
  sub: document.getElementById('event-sheet-sub').textContent,
  prize: document.getElementById('event-prize').textContent,
  tiles: document.querySelectorAll('#event-boards .event-board').length,
  boards: [...document.querySelectorAll('#event-boards .event-board')].filter((b, i, a) => i < 2 || i >= a.length - 2).map((b) => ({ n: +b.dataset.board, cls: b.className, text: b.textContent.trim(), label: b.getAttribute('aria-label'), disabled: b.disabled })),
}));

const idle = (page) => page.waitForFunction(() => !window.__S.busy && window.__S.returning.size === 0, null, { polling: 50, timeout: 20000 });
const tap = async (page, i) => {
  const box = await page.locator('#board .jar').nth(i).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
  await page.waitForTimeout(90);
};

/** From an open chooser: taps board n, solves it in page, plays it (all pours, or only the last when `quick`), reads the win card. */
async function playBoard(page, n, { quick = true, shot = null, boardShot = null } = {}) {
  await page.click(`#event-boards .event-board[data-board="${n}"]`);
  await page.waitForFunction(() => window.__S.mode === 'event' && !!window.__S.session, null, { timeout: 30000 });
  await page.waitForSelector('#board .jar .unit', { state: 'attached', timeout: 30000 });
  await page.evaluate(() => document.querySelectorAll('#intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await page.waitForTimeout(1000);
  const board = await page.evaluate(() => ({ label: document.getElementById('level-label').textContent, tag: document.getElementById('challenge-tag').hidden ? null : document.getElementById('challenge-tag').textContent, ev: [window.__S.eventId, window.__S.eventYear, window.__S.eventBoard], festiveBoard: document.getElementById('board').classList.contains('festive-board'), corkVar: getComputedStyle(document.querySelector('#board .jar')).getPropertyValue('--cork-sprig').trim().slice(0, 60), snowing: window.__W.winterSnowing(), sparkleCanvas: !!document.querySelector('canvas.sparkle-fx'), jars: document.querySelectorAll('#board .jar').length, labelOverflow: (() => { const e = document.getElementById('level-label'); return e.scrollWidth > e.clientWidth + 1; })() }));
  if (boardShot) await page.screenshot({ path: out(boardShot) });
  const plan = await page.evaluate(async () => {
    const B = await import('/src/core/board.ts');
    const { solve } = await import('/src/core/solver.ts');
    const b0 = window.__S.session.board;
    const sol = solve(b0, 3_000_000);
    const states = [b0]; let b = b0;
    for (const m of sol.path) { b = B.pour(b, m.from, m.to).board; states.push(b); }
    window.__P = { states, path: sol.path };
    return { solvable: sol.solvable, pours: sol.path.length, colors: new Set(b0.jars.flatMap((j) => j.units)).size };
  });
  board.plan = plan;
  if (!plan.solvable) return { board, failed: 'solver found no path' };
  let start = 0;
  if (quick) { start = plan.pours - 1; await page.evaluate(async (k) => { const { beginSession } = await import('/src/ui/screens/board.ts'); beginSession(window.__P.states[k], false); }, start); await page.waitForTimeout(600); }
  for (let k = start; k < plan.pours; k++) {
    const m = await page.evaluate((k) => window.__P.path[k], k);
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
  await page.waitForTimeout(700);
  const win = await page.evaluate(() => {
    const tx = (id) => document.getElementById(id)?.textContent?.trim() ?? null;
    const shown = (id) => { const e = document.getElementById(id); return !!e && !e.hidden && getComputedStyle(e).display !== 'none' && e.getClientRects().length > 0; };
    return { title: tx('win-title'), text: tx('win-text'), note: tx('win-note'), rewardShown: shown('win-reward'), coins: shown('win-reward') ? tx('win-coins') : null, unlocks: [...document.querySelectorAll('#win-unlocks > *')].map((e) => `${e.className}: ${e.textContent.trim()}`), next: tx('btn-next') };
  });
  if (shot) await page.screenshot({ path: out(shot) });
  return { board, win };
}

async function nextFromWin(page) {
  await page.click('#btn-next');
  await page.waitForTimeout(900);
  return page.evaluate(() => ({ homeShown: !document.getElementById('home').hidden, chooserShown: !document.getElementById('event').hidden, sub: document.getElementById('event-sheet-sub')?.textContent }));
}
const closeChooser = async (page) => { await page.evaluate(() => document.getElementById('btn-close-event')?.click()); await page.waitForTimeout(500); };
const closeNotice = async (page) => { await page.evaluate(() => document.querySelector('#home-notice:not([hidden]) #btn-notice-later')?.click()); await page.waitForTimeout(500); };

async function reload(page, errors) {
  await page.reload();
  await boot(page, errors);
}

const log = { dates: {}, layout: {} };
const flush = () => fs.writeFileSync(LOGF, JSON.stringify(log, null, 1));

async function step(browser, name, opts, fn) {
  const L = (log.dates[name] = {});
  const o = await open(browser, opts);
  try { await fn(o, L); } catch (e) { L.failed = String(e).slice(0, 500); await o.page.screenshot({ path: out(`FAILED-${name}.png`) }).catch(() => {}); }
  L.errors = o.errors; L.warnings = [...new Set(o.warnings)].slice(0, 10);
  await o.context.close();
  flush();
}

async function run() {
  const browser = await chromium.launch();
  const SEEN26 = { wintertide: 2026 };

  await step(browser, '2026-11-30', { date: '2026-11-30' }, async ({ page }, L) => {
    L.notice = await notice(page);
    L.home = await homeFacts(page);
    await page.screenshot({ path: out('home-2026-11-30.png') });
    L.map = await mapLights(page, null);
    L.scenes = await scenes(page, null);
    L.save = brief(await save(page));
  });

  await step(browser, '2026-12-01', { date: '2026-12-01' }, async ({ page, errors }, L) => {
    L.notice = await notice(page);
    await page.screenshot({ path: out('start-card-2026-12-01.png') });
    L.saveAtCard = brief(await save(page)).startCards;
    await page.click('#btn-notice-ok');
    await page.waitForTimeout(800);
    L.playOpened = await page.evaluate(() => ({ chooser: !document.getElementById('event').hidden, notice: !document.getElementById('home-notice').hidden }));
    L.chooserFromCard = await chooserFacts(page);
    await page.screenshot({ path: out('start-card-play-chooser-2026-12-01.png') });
    await closeChooser(page);
    L.home = await homeFacts(page);
    await page.screenshot({ path: out('home-garland-2026-12-01.png') });
    await reload(page, errors);
    L.noticeAfterReload = await notice(page);
    L.map = await mapLights(page, 'map-lights-2026-12-01.png');
    L.scenes = await scenes(page, 'scenes-festive-2026-12-01.png');
    L.coinsBefore = (await save(page)).wallet.coins;
    L.chooser = await chooser(page, 'chooser-2026-12-01.png');
    Object.assign(L, await playBoard(page, 1, { quick: false, shot: 'win-2026-12-01-board1.png', boardShot: 'board-2026-12-01-board1.png' }));
    L.saveAfter = brief(await save(page));
    L.afterNext = await nextFromWin(page);
  });

  await step(browser, '2026-12-12', { date: '2026-12-12', seed: { events: { wintertide: prog(2026, range(1, 11)) }, startCards: SEEN26 } }, async ({ page }, L) => {
    L.notice = await notice(page, 1200);
    L.home = await homeFacts(page);
    L.coinsBefore = (await save(page)).wallet.coins;
    L.chooser = await chooser(page, 'chooser-2026-12-12.png');
    Object.assign(L, await playBoard(page, 12, { shot: 'win-2026-12-12-board12.png' }));
    L.saveAfter = brief(await save(page));
    L.afterNext = await nextFromWin(page);
    L.chooserAfter = await chooserFacts(page);
  });

  await step(browser, '2026-12-24', { date: '2026-12-24', seed: { events: { wintertide: prog(2026, range(1, 23)) }, startCards: SEEN26 } }, async ({ page }, L) => {
    L.notice = await notice(page, 1200);
    L.coinsBefore = (await save(page)).wallet.coins;
    L.chooser = await chooser(page, 'chooser-2026-12-24.png');
    Object.assign(L, await playBoard(page, 24, { shot: 'win-2026-12-24-board24-prize.png' }));
    L.saveAfter = brief(await save(page));
  });

  // 25 Dec: the Winter Tide start card still unseen (startCards empty), the 2026 set complete.
  await step(browser, '2026-12-25', { date: '2026-12-25', seed: { events: { wintertide: prog(2026, range(1, 24)) }, badges: ['event-wintertide'], styles: { owned: ['glass:frost'], worn: { glass: 'clear', cork: 'plain', sand: 'classic' } } } }, async ({ page, errors }, L) => {
    L.notice = await notice(page);
    await page.screenshot({ path: out('gift-card-2026-12-25.png') });
    L.saveAtCard = brief(await save(page));
    await page.click('#btn-notice-ok').catch((e) => { L.claimFailed = String(e).slice(0, 200); });
    await page.waitForTimeout(700);
    L.afterClaim = await page.evaluate(() => ({ notice: !document.getElementById('home-notice').hidden, chooser: !document.getElementById('event').hidden }));
    L.home = await homeFacts(page);
    await reload(page, errors);
    L.noticeAfterReload = await notice(page);
    L.saveAfterReload = brief(await save(page));
    L.chooser = await chooser(page, 'chooser-2026-12-25.png');
    L.coinsBefore25 = (await save(page)).wallet.coins;
    Object.assign(L, await playBoard(page, 25, { shot: 'win-2026-12-25-board25.png', boardShot: 'board-2026-12-25-board25-holly.png' }));
    L.saveAfter = brief(await save(page));
    L.afterNext = await nextFromWin(page);
    L.chooserAfter = await chooserFacts(page);
    await closeChooser(page);
    L.homeAfter = await homeFacts(page);
    await page.evaluate(async () => (await import('/src/ui/screens/sheets/styles.ts')).openStyles(null));
    await page.waitForSelector('#styles:not([hidden])', { timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(600);
    L.holly = await page.evaluate(() => { const b = document.querySelector('.style-piece[data-slot="cork"][data-id="holly"]'); if (b) { b.scrollIntoView({ block: 'center' }); b.click(); } return { found: !!b, text: b?.textContent.trim() }; });
    await page.waitForTimeout(500);
    L.hollyAction = await page.evaluate(() => { const b = document.getElementById('btn-style-action'); return { hidden: b.hidden, text: b.textContent, disabled: b.disabled }; });
    await page.screenshot({ path: out('styles-holly-2026-12-25.png') });
    await page.evaluate(() => { const b = document.getElementById('btn-style-action'); if (!b.hidden && !b.disabled) b.click(); });
    await page.waitForTimeout(500);
    L.wornAfterWear = (await save(page)).styles.worn;
  });

  await step(browser, '2026-12-26', { date: '2026-12-26', seed: { events: { wintertide: prog(2026, range(1, 24)) }, startCards: SEEN26, gifts: { christmas: 2026 } } }, async ({ page }, L) => {
    L.notice = await notice(page);
    await page.screenshot({ path: out('start-card-newtide-2026-12-26.png') });
    await closeNotice(page);
    await page.waitForTimeout(1500); // let the sparkles draw
    L.home = await homeFacts(page);
    await page.screenshot({ path: out('home-newtide-2026-12-26.png') });
    L.map = await mapLights(page, 'map-lights-2026-12-26.png');
    L.scenes = await scenes(page, null);
    L.coinsBefore = (await save(page)).wallet.coins;
    L.chooser = await chooser(page, 'chooser-newtide-2026-12-26.png');
    Object.assign(L, await playBoard(page, 1, { shot: 'win-newtide-2026-12-26-board1.png', boardShot: 'board-newtide-2026-12-26-board1.png' }));
    L.saveAfter = brief(await save(page));
  });

  const NT = (cleared) => ({ events: { wintertide: prog(2026, range(1, 24)), newtide: prog(2026, cleared) }, startCards: { wintertide: 2026, newtide: 2026 }, gifts: { christmas: 2026 } });
  await step(browser, '2027-01-01', { date: '2027-01-01', seed: NT(range(1, 6)) }, async ({ page }, L) => {
    L.notice = await notice(page, 1200);
    L.home = await homeFacts(page);
    await page.screenshot({ path: out('home-newtide-2027-01-01.png') });
    L.map = await mapLights(page, null);
    L.scenes = await scenes(page, null);
    L.coinsBefore = (await save(page)).wallet.coins;
    L.chooser = await chooser(page, 'chooser-newtide-2027-01-01.png');
    Object.assign(L, await playBoard(page, 7, { shot: 'win-newtide-2027-01-01-board7.png' }));
    L.saveAfter = brief(await save(page));
  });

  await step(browser, '2027-01-06', { date: '2027-01-06', seed: NT(range(1, 11)) }, async ({ page }, L) => {
    L.notice = await notice(page, 1200);
    L.coinsBefore = (await save(page)).wallet.coins;
    L.chooser = await chooser(page, 'chooser-newtide-2027-01-06.png');
    Object.assign(L, await playBoard(page, 12, { shot: 'win-newtide-2027-01-06-board12-prize.png' }));
    L.saveAfter = brief(await save(page));
  });

  await step(browser, '2027-01-07', { date: '2027-01-07', seed: NT(range(1, 12)) }, async ({ page }, L) => {
    L.notice = await notice(page, 1500);
    L.home = await homeFacts(page);
    await page.screenshot({ path: out('home-2027-01-07.png') });
    L.map = await mapLights(page, null);
    L.scenes = await scenes(page, null);
  });

  const Y2 = (events, startCards) => ({ events, badges: ['event-wintertide'], styles: { owned: ['glass:frost', 'cork:holly'], worn: { glass: 'clear', cork: 'plain', sand: 'classic' } }, gifts: { christmas: 2026 }, startCards });
  await step(browser, '2027-12-25', { date: '2027-12-25', seed: Y2({ wintertide: prog(2026, range(1, 24)) }, { wintertide: 2026, newtide: 2026 }) }, async ({ page, errors }, L) => {
    L.notice = await notice(page);
    await page.screenshot({ path: out('gift-card-second-year-2027-12-25.png') });
    L.saveAtCard = brief(await save(page));
    await closeNotice(page);
    await reload(page, errors);
    L.noticeAfterReload = await notice(page, 1500);
    L.chooser = await chooser(page, 'chooser-second-year-2027-12-25.png');
  });

  await step(browser, '2027-12-24-second-year-complete', { date: '2027-12-24', seed: Y2({ wintertide: prog(2027, range(1, 23)) }, { wintertide: 2027 }) }, async ({ page }, L) => {
    L.notice = await notice(page, 1200);
    L.coinsBefore = (await save(page)).wallet.coins;
    L.chooser = await chooser(page, 'chooser-second-year-2027-12-24.png');
    Object.assign(L, await playBoard(page, 24, { shot: 'win-second-year-2027-12-24-board24.png' }));
    L.saveAfter = brief(await save(page));
  });

  // Layout: 320px, 150% text: Home and the cards.
  const LAY = [
    { date: '2026-12-01', seed: {}, tag: 'start-card' },
    { date: '2026-12-25', seed: { events: { wintertide: prog(2026, range(1, 10)) } }, tag: 'gift-card' },
    { date: '2026-12-26', seed: { startCards: SEEN26, gifts: { christmas: 2026 } }, tag: 'newtide-start-card' },
  ];
  for (const d of LAY) {
    const L = (log.layout[d.date] = {});
    const o = await open(browser, { date: d.date, width: 320, height: 640, text: 150, seed: d.seed });
    const { page } = o;
    try {
      L.notice = await notice(page);
      L.noticeOverflow = await overflow(page, '#home-notice');
      L.noticeCard = await page.evaluate(() => { const c = document.querySelector('#home-notice .card') || document.getElementById('home-notice'); const r = c.getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), sh: c.scrollHeight, ch: c.clientHeight, innerH: innerHeight }; });
      await page.screenshot({ path: out(`w320-${d.tag}-${d.date}.png`) });
      await closeNotice(page);
      L.homeOverflow = await overflow(page, '#home');
      L.eventCardOverflow = await overflow(page, '#btn-event');
      await page.evaluate(() => document.getElementById('btn-event')?.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(300);
      await page.screenshot({ path: out(`w320-home-${d.date}.png`) });
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.evaluate(() => document.getElementById('home-garland')?.scrollIntoView({ block: 'start' }));
      await page.waitForTimeout(200);
      await page.screenshot({ path: out(`w320-home-top-${d.date}.png`) });
    } catch (e) { L.failed = String(e).slice(0, 400); }
    L.errors = o.errors; L.warnings = [...new Set(o.warnings)].slice(0, 10);
    await o.context.close();
    flush();
  }

  await browser.close();
  flush();
}
run().catch((e) => { console.error(e); flush(); process.exit(1); });
