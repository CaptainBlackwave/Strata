// Sprint 30 E4 evidence: the Saturday daily era from 2026-12-19 and the weekly era from 2026-W52.
// Each shot fixes the browser clock (Playwright context.clock.setFixedTime) to the day or week, because
// `?daily=` always opens today's daily (UTC) and the weekly chooser always shows the current week.
// Save seeding, ?board=dom|gpu, the scenes and 320px/150% text follow sprint-29/jars.cjs.
// Usage (dev server running):  PORT=5230 node production/qa/evidence/sprint-30/capture.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const config = require('../../../../src/config/game-config.json');
const BASE = `http://localhost:${process.env.PORT || 5230}`;
const KEY = 'strata.save.v2';
const ALL = config.mechanics.list.map((m) => m.id);
const out = (f) => path.join(__dirname, f);

const SATURDAYS = [
  { date: '2026-12-19', tag: 'wet' },
  { date: '2026-12-26', tag: 'tide' },
  { date: '2027-01-02', tag: 'crab' },
  { date: '2027-01-09', tag: 'lighthouse' },
  { date: '2027-01-16', tag: 'sun' },
];
// A Wednesday noon inside each ISO week.
const WEEKS = [
  { week: '2026-W52', day: '2026-12-23', tag: 'rain-on-the-dunes' },
  { week: '2026-W53', day: '2026-12-30', tag: 'high-water' },
  { week: '2027-W01', day: '2027-01-06', tag: 'crab-walk' },
  { week: '2027-W02', day: '2027-01-13', tag: 'night-watch' },
  { week: '2027-W03', day: '2027-01-20', tag: 'dawn-to-dusk' },
];

async function open(browser, { day, query, board = 'dom', scene = 'midday', width = 412, height = 900, text = 100, level = 400, seen = ALL }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.clock.setFixedTime(new Date(`${day}T12:00:00Z`));
  await context.addInitScript(([key, seen, board, text, level, scene]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level, seenMechanics: seen, seenWhatsNew: '9.9.9' });
    s.wallet = { coins: 5000, boosters: { hint: 3, shuffle: 3, extraJar: 1, undo: 5 } };
    s.themes = { owned: ['midday', scene], selected: scene, auto: false };
    s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false, patterns: false, realistic: board === 'gpu' };
    s.onboarding = { ...(s.onboarding || {}), visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
    localStorage.setItem(key, JSON.stringify(s));
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
  }, [KEY, seen, board, text, level, scene]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?${query}&board=${board}`);
  await page.waitForFunction(() => !!document.querySelector('#board'), null, { timeout: 30000 });
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; });
  return { context, page, errors };
}

const dismissWhatsNew = (page) => page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok').forEach((b) => b.click()));
const dismissIntro = (page) => page.evaluate(() => document.querySelectorAll('#intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));

/** Waits for the board of `mode` with a session and its jars. */
async function boardReady(page, mode) {
  await page.waitForFunction((m) => window.__S && window.__S.mode === m && !!window.__S.session, mode, { polling: 100, timeout: 30000 });
  await page.waitForSelector('#board .jar .unit', { state: 'attached', timeout: 30000 });
  await page.waitForTimeout(1400);
}

const facts = (page) => page.evaluate(() => ({
  mode: window.__S.mode,
  today: window.__S.clock().toISOString(),
  render: document.getElementById('board').dataset.render,
  label: document.getElementById('level-label')?.textContent ?? null,
  tag: [...document.querySelectorAll('.challenge-tag, #challenge-tag')].map((e) => e.textContent).join(' | '),
  jars: document.querySelectorAll('#board .jar').length,
  special: [...document.querySelectorAll('#board .jar')].map((j) => j.getAttribute('aria-label')).filter((l) => /wet|tide|crab|light|sun|dark/i.test(l || '')),
  scrollW: document.documentElement.scrollWidth,
  innerW: innerWidth,
  introOpen: !document.getElementById('intro').hidden,
}));

async function run() {
  const browser = await chromium.launch();
  const log = { saturdays: {}, pair320: {}, intro: {}, weekly: {}, weeklyBoard: {} };

  // 1. Each new Saturday, Classic light and Realistic dark. 2. The pair Saturday at 320px / 150% text.
  const runs = [];
  for (const s of SATURDAYS) for (const v of [{ board: 'dom', scene: 'midday', look: 'light' }, { board: 'gpu', scene: 'moonlit', look: 'dark' }]) runs.push({ ...s, ...v, file: `daily-${s.date}-${s.tag}-${v.board}-${v.look}.png`, bucket: 'saturdays' });
  for (const board of ['dom', 'gpu']) runs.push({ ...SATURDAYS[4], board, scene: 'midday', look: 'light', width: 320, text: 150, file: `daily-2027-01-16-sun-320-150-${board}.png`, bucket: 'pair320' });
  for (const r of runs) {
    const { context, page, errors } = await open(browser, { day: r.date, query: `daily=${r.date}`, board: r.board, scene: r.scene, width: r.width, text: r.text });
    try {
      await page.waitForFunction(() => window.__S.mode === 'daily' || !document.getElementById('home').hidden, null, { timeout: 30000 }).catch(() => {});
      await dismissWhatsNew(page);
      const mode = await page.evaluate(() => window.__S.mode);
      if (mode !== 'daily') await page.evaluate(async () => (await import('/src/ui/screens/board.ts')).startDaily());
      await boardReady(page, 'daily');
      await dismissIntro(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: out(r.file) });
      log[r.bucket][r.file] = { ...(await facts(page)), errors };
    } catch (e) { log[r.bucket][r.file] = { failed: String(e), errors }; }
    await context.close();
  }

  // 3. The intro card for a level-50 player on the crab Saturday (only what level 50 has met is seen).
  {
    const seen = config.mechanics.list.filter((m) => m.unlockAt <= 50).map((m) => m.id);
    const { context, page, errors } = await open(browser, { day: '2027-01-02', query: 'daily=2027-01-02', level: 50, seen });
    try {
      await page.waitForSelector('#intro:not([hidden])', { timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.screenshot({ path: out('intro-2027-01-02-crab-level50.png') });
      log.intro = { seen, text: await page.locator('#intro-list').innerText().catch(() => ''), title: await page.locator('#intro-title').innerText().catch(() => ''), ...(await facts(page)), errors };
    } catch (e) { log.intro = { failed: String(e), errors }; }
    await context.close();
  }

  // 4. The weekly chooser (opened by ?weekly=) and the Today card, for each new week; 412px, then 320px / 150%.
  for (const w of WEEKS) for (const v of [{ width: 412, text: 100, sfx: '' }, { width: 320, text: 150, sfx: '-320-150' }]) {
    const { context, page, errors } = await open(browser, { day: w.day, query: `weekly=${w.week}`, width: v.width, text: v.text });
    const key = `${w.week}${v.sfx}`;
    try {
      await dismissWhatsNew(page);
      await page.waitForSelector('#weekly:not([hidden])', { timeout: 30000 });
      await page.waitForTimeout(900);
      await page.screenshot({ path: out(`weekly-sheet-${w.week}-${w.tag}${v.sfx}.png`) });
      const sheet = await page.locator('#weekly-sheet-sub').innerText();
      await page.click('#btn-close-weekly');
      await page.waitForTimeout(700);
      await page.locator('#btn-weekly').scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({ path: out(`weekly-card-${w.week}-${w.tag}${v.sfx}.png`) });
      log.weekly[key] = { sheet, card: await page.locator('#btn-weekly').innerText(), scrollW: await page.evaluate(() => document.documentElement.scrollWidth), errors };
      // One board of Dawn to Dusk (412px only), Classic light and Realistic dark.
      if (w.week === '2027-W03' && v.width === 412) {
        await context.close();
        for (const b of [{ board: 'dom', scene: 'midday', look: 'light' }, { board: 'gpu', scene: 'moonlit', look: 'dark' }]) {
          const o = await open(browser, { day: w.day, query: `weekly=${w.week}`, board: b.board, scene: b.scene });
          const file = `weekly-board-2027-W03-dawn-to-dusk-${b.board}-${b.look}.png`;
          try {
            await dismissWhatsNew(o.page);
            await o.page.waitForSelector('#weekly:not([hidden]) .weekly-board[data-board="0"]', { timeout: 30000 });
            await o.page.waitForTimeout(600);
            await o.page.click('.weekly-board[data-board="0"]');
            await boardReady(o.page, 'weekly');
            await dismissIntro(o.page);
            await o.page.waitForTimeout(400);
            await o.page.screenshot({ path: out(file) });
            log.weeklyBoard[file] = { ...(await facts(o.page)), errors: o.errors };
          } catch (e) { log.weeklyBoard[file] = { failed: String(e), errors: o.errors }; }
          await o.context.close();
        }
        continue;
      }
    } catch (e) { log.weekly[key] = { failed: String(e), errors }; }
    await context.close();
  }

  await browser.close();
  fs.writeFileSync(out('capture-log.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
}
run().catch((e) => { console.error(e); process.exit(1); });
