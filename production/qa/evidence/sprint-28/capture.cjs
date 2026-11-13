// Sprint 28 S2, S3 evidence (D215, D216): the sieve's goal mark, open and sealed, its words (intro card
// at 141, Jar guide) and the "sealed outside its sieve" dead end, on Classic (dom) and Realistic (gpu),
// at 412x915 (100% text) and 320x700 (150% text). Level 145 by default.
// Usage (dev server running):  PORT=5182 node production/qa/evidence/sprint-28/capture.cjs
// Env: LEVEL (default 145), OUT (default this folder), ONLY (dom or gpu).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5182}`;
const LEVEL = Number(process.env.LEVEL || 145);
const OUT = process.env.OUT ? path.resolve(process.env.OUT) : __dirname;
const KEY = 'strata.save.v2';
const MECH = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam', 'wet', 'tide', 'crab', 'lighthouse'];
const VIEWPORTS = [
  { tag: '412', width: 412, height: 915, text: 100 },
  { tag: '320t150', width: 320, height: 700, text: 150 },
];

async function open(browser, board, vp, level, seen) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript(([key, level, seen, board, text]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level, seenMechanics: seen, seenWhatsNew: '9.9.9' });
    s.wallet = { coins: 5000, boosters: { hint: 3, shuffle: 3, extraJar: 1, undo: 5 } };
    s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false, realistic: board === 'gpu' };
    s.onboarding = { ...(s.onboarding || {}), visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
    localStorage.setItem(key, JSON.stringify(s));
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
  }, [KEY, level, seen, board, vp.text]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?level=${level}&board=${board}`);
  await page.waitForFunction(async (n) => {
    const { state } = await import('/src/ui/state.ts');
    return state.mode === 'level' && state.level === n && !!state.session && state.session.board.jars.length === document.querySelectorAll('#board .jar').length;
  }, level, { polling: 100, timeout: 30000 });
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; });
  return { context, page, errors };
}

const closeCards = (page) => page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
const idle = (page) => page.waitForFunction(() => !window.__S.busy && window.__S.returning.size === 0, null, { polling: 50, timeout: 20000 });

/** Taps jar f then jar t, and waits for the move to count (retrying once if a tap was ignored). */
async function pour(page, [f, t]) {
  const tap = async (i) => {
    const box = await page.locator('#board .jar').nth(i).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
    await page.waitForTimeout(120);
  };
  const before = await page.evaluate(() => window.__S.session.moves);
  await tap(f); await tap(t);
  await page.waitForFunction((b) => window.__S.session.moves > b, before, { polling: 50, timeout: 3000 }).catch(() => {});
  if ((await page.evaluate(() => window.__S.session.moves)) === before) {
    await page.evaluate(() => { if (window.__S.selected !== null) document.querySelectorAll('#board .jar')[window.__S.selected].click(); });
    await page.waitForTimeout(300);
    await tap(f); await tap(t);
    await page.waitForFunction((b) => window.__S.session.moves > b, before, { polling: 50, timeout: 3000 });
  }
  await idle(page);
}

/** The solver's path from the current board, cut after the pour that seals the sieve. */
const pathToSealed = (page) => page.evaluate(async () => {
  const { solve } = await import('/src/core/solver.ts');
  const { pour, isSealed } = await import('/src/core/board.ts');
  let b = window.__S.session.board;
  const at = b.jars.findIndex((j) => j.sieve !== undefined);
  const out = [];
  for (const m of solve(b, 400000).path) {
    out.push([m.from, m.to]);
    b = pour(b, m.from, m.to).board;
    if (isSealed(b.jars[at], b.capacity)) break;
  }
  return out;
});

/** A path to the D215 dead end: a search that never pours into the sieve, until its band is sealed in another jar. */
const pathToDeadEnd = (page) => page.evaluate(async () => {
  const { pour, usefulMoves, boardKey, lostReason, topRun } = await import('/src/core/board.ts');
  const start = window.__S.session.board;
  const at = start.jars.findIndex((j) => j.sieve !== undefined);
  const band = start.jars[at].sieve;
  const seen = new Set();
  const path = [];
  let nodes = 0;
  const dfs = (b) => {
    if (lostReason(b) === 'sieve') return true;
    const k = boardKey(b);
    if (seen.has(k) || ++nodes > 300000) return false;
    seen.add(k);
    const moves = usefulMoves(b).filter((m) => m.to !== at);
    // Pours that stack the band first, then pours onto a match, then the rest.
    const score = (m) => (topRun(b.jars[m.from]).color === band ? 4 : 0) + (b.jars[m.to].units.length ? 2 : 0);
    moves.sort((x, y) => score(y) - score(x));
    for (const m of moves) {
      path.push([m.from, m.to]);
      if (dfs(pour(b, m.from, m.to).board)) return true;
      path.pop();
    }
    return false;
  };
  return dfs(start) ? path : null;
});

async function run(browser, board, vp, log) {
  const name = (s) => path.join(OUT, `sieve-${LEVEL}-${board}-${vp.tag}-${s}.png`);
  // 1. Open, then the solver's pours until the sieve is sealed.
  {
    const { context, page, errors } = await open(browser, board, vp, LEVEL, MECH);
    await closeCards(page);
    await page.waitForTimeout(1500);
    await page.screenshot({ path: name('open') });
    for (const m of await pathToSealed(page)) await pour(page, m);
    await page.waitForTimeout(1200);
    const r = await page.evaluate(() => ({ status: window.__S.session.status, sealedClass: document.querySelector('#board .jar.sieve')?.classList.contains('sealed') ?? false }));
    await page.screenshot({ path: name('sealed') });
    log.push({ board, vp: vp.tag, shot: 'open+sealed', ...r, errors });
    await context.close();
  }
  // 2. The dead end: the band sealed outside the sieve.
  {
    const { context, page, errors } = await open(browser, board, vp, LEVEL, MECH);
    await closeCards(page);
    await page.waitForTimeout(1200);
    const p = await pathToDeadEnd(page);
    if (p) for (const m of p) await pour(page, m);
    await page.waitForFunction(() => !document.getElementById('stuck').hidden && document.getElementById('stuck-text').textContent.length > 0, null, { polling: 100, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(900);
    const r = await page.evaluate(() => ({ lost: window.__S.session.lostReason, text: document.getElementById('stuck-text').textContent }));
    await page.screenshot({ path: name('dead-end') });
    log.push({ board, vp: vp.tag, shot: 'dead-end', pours: p ? p.length : null, ...r, errors });
    await context.close();
  }
  // 3. The words: the intro card at 141 and the Jar guide's sieve entry.
  {
    const { context, page, errors } = await open(browser, board, vp, 141, MECH.filter((m) => m !== 'sieve'));
    await page.waitForSelector('#intro:not([hidden])', { timeout: 20000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUT, `sieve-141-${board}-${vp.tag}-intro.png`) });
    await closeCards(page);
    await page.waitForTimeout(600);
    await page.click('#btn-settings');
    await page.waitForSelector('#settings:not([hidden])', { timeout: 8000 });
    await page.waitForTimeout(400);
    await page.click('#btn-guide');
    await page.waitForSelector('#intro:not([hidden])', { timeout: 8000 });
    await page.evaluate(() => document.querySelector('#intro-list .mini-jar.sieve')?.closest('.intro-row')?.scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `sieve-guide-${board}-${vp.tag}.png`) });
    log.push({ board, vp: vp.tag, shot: 'intro+guide', errors });
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  const log = [];
  for (const board of process.env.ONLY ? [process.env.ONLY] : ['dom', 'gpu']) for (const vp of VIEWPORTS) await run(browser, board, vp, log);
  fs.writeFileSync(path.join(OUT, `capture-results${process.env.ONLY ? `-${process.env.ONLY}` : ''}.json`), JSON.stringify(log, null, 2) + '\n');
  for (const l of log) console.log(JSON.stringify(l));
  await browser.close();
})();
