// Sprint 29 N4/N5 evidence: the sunrise and sunset jars on level 361 (the debut, the pair alone, two
// spares), on the Classic (dom) and Realistic (gpu) boards, light (midday) and dark (moonlit), at 412px.
// The moves come from the solver (src/core/solver.ts) run in the page on 361's own board: every
// mid-level shot starts a session on a board the solver's path really reaches (beginSession), then
// taps the next pour live, so the sunrise moment, the dusk win, the refusals and the sunset dead end
// are the real app on the real level. The sunrise dead end can't happen on 361 (it needs a funnel, a
// frozen jar or a lock holding the band, §2.11 Dead ends), so it is shown on a small crafted board.
// Usage (dev server running):  PORT=5229 node production/qa/evidence/sprint-29/jars.cjs
//   ONLY=teach  the intro card, the Jar guide and the map alone (they don't depend on 361's board)
//   ONLY=board  the board shots alone (sections 2-5 and 7 of the brief)
// Sprint 29 change of plan: the pair is now dealt EMPTY as two extra jars, so the board shots of the
// first run were deleted; re-run with ONLY=board once the new deal is in. The refusal and dead-end
// searches below look along the solver's path, so they adapt to the new board; the crafted sunrise
// dead end is independent of 361.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5229}`;
const KEY = 'strata.save.v2';
const LEVEL = 361;
const SEEN = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam', 'wet', 'tide', 'crab', 'lighthouse'];
const out = (f) => path.join(__dirname, f);
const ONLY = process.env.ONLY || 'all';
const does = (part) => ONLY === 'all' || ONLY === part;

async function open(browser, { board = 'dom', width = 412, height = 900, text = 100, patterns = false, seen = [...SEEN, 'sun'], scene = 'midday', reduced = false, intro = false }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.addInitScript(([key, seen, board, patterns, text, level, scene]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level, seenMechanics: seen, seenWhatsNew: '9.9.9' });
    s.wallet = { coins: 5000, boosters: { hint: 3, shuffle: 3, extraJar: 1, undo: 5 } };
    s.themes = { owned: ['midday', scene], selected: scene, auto: false };
    s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false, patterns, realistic: board === 'gpu' };
    s.onboarding = { ...(s.onboarding || {}), visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
    localStorage.setItem(key, JSON.stringify(s));
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
  }, [KEY, seen, board, patterns, text, LEVEL, scene]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?level=${LEVEL}&board=${board}`);
  if (intro) { await page.waitForSelector('#intro:not([hidden])', { timeout: 30000 }); await page.waitForTimeout(1200); return { context, page, errors }; }
  // The Realistic board draws the sand on a canvas, so its DOM units may be hidden: wait for them to exist.
  await page.waitForSelector('#board .jar .unit', { state: 'attached', timeout: 30000 });
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; });
  await page.waitForFunction((n) => window.__S && window.__S.mode === 'level' && window.__S.level === n && !!window.__S.session, LEVEL, { polling: 100, timeout: 30000 });
  await page.waitForTimeout(1200);
  return { context, page, errors };
}

const dismiss = (page) => page.evaluate(() => document.querySelectorAll('#intro:not([hidden]) #btn-intro-ok, #whatsnew:not([hidden]) #btn-whatsnew-ok').forEach((b) => b.click()));
const idle = (page) => page.waitForFunction(() => !window.__S.busy && window.__S.returning.size === 0, null, { polling: 50, timeout: 20000 });
const tap = async (page, i) => {
  const box = await page.locator('#board .jar').nth(i).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
  await page.waitForTimeout(120);
};
const labels = (page) => page.evaluate(() => [...document.querySelectorAll('#board .jar')].map((j) => j.getAttribute('aria-label')).filter((l) => /sun/.test(l || '')));
const toast = (page) => page.evaluate(() => document.getElementById('toast').textContent);

/**
 * Solves 361's starting board in the page and keeps every board along the path on `window.__P`:
 * `states[k]` is the board before pour `k`. Returns the path and where the sunrise falls.
 */
const plan = (page) =>
  page.evaluate(async () => {
    const B = await import('/src/core/board.ts');
    const { solve } = await import('/src/core/solver.ts');
    const b0 = window.__S.session.board;
    const sol = solve(b0, 2_000_000);
    const states = [b0];
    let b = b0;
    let sunrise = -1;
    sol.path.forEach((m, k) => { const r = B.pour(b, m.from, m.to); if (r.sunrise) sunrise = k; b = r.board; states.push(b); });
    const rise = b0.jars.findIndex((j) => j.sun?.at === 'rise');
    const set = b0.jars.findIndex((j) => j.sun?.at === 'set');
    // A refusal of each kind on a board the path reaches; a pour into the sunset jar that leaves it lost.
    const find = (pred) => { for (let k = 0; k < states.length; k++) for (let f = 0; f < b0.jars.length; f++) for (let t = 0; t < b0.jars.length; t++) if (f !== t && pred(states[k], f, t)) return { k, f, t }; return null; };
    const refuse = (want, to) => find((s, f, t) => (to === undefined || t === to) && B.pourRefusal(s, f, t) === want);
    const refusals = { sunRise: refuse('sun', rise), sunSet: refuse('sun', set), sunrise: refuse('sunrise'), sunset: refuse('sunset') };
    const lostSunset = find((s, f, t) => B.canPour(s, f, t) && B.lostReason(B.pour(s, f, t).board) === 'sunset');
    window.__P = { states, path: sol.path, sunrise };
    return { solvable: sol.solvable, pours: sol.path.length, sunrise, rise, set, bands: [b0.jars[rise].sun.band, b0.jars[set].sun.band], refusals, lostSunset };
  });

/** Starts a session on the solver's board `k` (as a mid-level save would). */
const at = async (page, k) => {
  await page.evaluate(async (k) => { const { beginSession } = await import('/src/ui/screens/board.ts'); beginSession(window.__P.states[k], false); }, k);
  await page.waitForTimeout(700);
};
/** Plays pour `k` of the solver's path by tapping, as a player would. */
const play = async (page, k) => {
  const m = await page.evaluate((k) => window.__P.path[k], k);
  const before = await page.evaluate(() => window.__S.session.moves);
  await tap(page, m.from);
  await tap(page, m.to);
  await page.waitForFunction((b) => window.__S.session.moves > b, before, { polling: 30, timeout: 4000 });
};

/** A crafted board one pour from the sunrise dead end: jar 4 tops a rose unit into the empty funnel. */
const craftedSunriseLost = (page) =>
  page.evaluate(async () => {
    const { beginSession } = await import('/src/ui/screens/board.ts');
    beginSession({ capacity: 4, jars: [
      { units: [3, 3], hidden: 0, sun: { band: 10, at: 'rise' } },
      { units: [10, 10, 5], hidden: 0 },
      { units: [5, 10], hidden: 0 },
      { units: [5, 3, 5], hidden: 0, sun: { band: 5, at: 'set' } },
      { units: [3, 10], hidden: 0 },
      { units: [], hidden: 0, funnel: true },
    ] }, false);
  });

async function run() {
  const browser = await chromium.launch();
  const log = {};
  // 1. The intro card on 361 ('sun' not seen yet), and the board under it (needs 361 to build).
  if (ONLY === 'all' || process.env.INTRO === '1') {
    const { context, page, errors } = await open(browser, { seen: SEEN, intro: true });
    log.intro = { shown: await page.locator('#intro:not([hidden])').count(), text: await page.locator('#intro-list').innerText().catch(() => ''), errors };
    await page.screenshot({ path: out('intro-361.png') });
    await context.close();
  }
  // BOARDS=gpu SCENES=moonlit re-runs one part of the set.
  for (const board of does('board') ? (process.env.BOARDS || 'dom,gpu').split(',') : []) {
    for (const scene of (process.env.SCENES || 'midday,moonlit').split(',')) {
      const tag = `${board}-${scene === 'midday' ? 'light' : 'dark'}`;
      const L = (log[tag] = {});
      const { context, page, errors } = await open(browser, { board, scene });
      await dismiss(page);
      L.render = await page.evaluate(() => document.getElementById('board').dataset.render);
      const P = await plan(page);
      if (!log.plan) log.plan = P;
      await page.screenshot({ path: out(`start-${tag}.png`) });
      L.startLabels = await labels(page);
      // 2/3. The sunrise: the pour that fills the sunrise jar, frozen near the light's peak, then filled.
      await at(page, P.sunrise);
      await play(page, P.sunrise);
      L.dawn = await page.waitForSelector('.sun-dawn', { state: 'attached', timeout: 4000 }).then(() => true).catch(() => false);
      L.dawnAnims = await page.evaluate(() => { const as = document.querySelector('.sun-dawn')?.getAnimations() ?? []; for (const a of as) { a.pause(); a.currentTime = 420; } return as.length; });
      await page.waitForTimeout(120);
      await page.screenshot({ path: out(`sunrise-moment-${tag}.png`) });
      await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
      await idle(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: out(`sunrise-filled-${tag}.png`) });
      L.filledLabels = await labels(page);
      L.announce = await page.evaluate(() => [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent).filter(Boolean));
      // 2/3. The winning pour fills the sunset jar: the dusk over the board, then the win card at dusk.
      const last = P.pours - 1;
      await at(page, last);
      await play(page, last);
      L.dusk = await page.waitForSelector('.sun-dusk', { state: 'attached', timeout: 4000 }).then(() => true).catch(() => false);
      await page.waitForTimeout(650);
      L.winOpenAtDuskShot = await page.evaluate(() => !document.getElementById('win').hidden);
      await page.screenshot({ path: out(`dusk-board-${tag}.png`) });
      await page.waitForFunction(() => !document.getElementById('win').hidden, null, { timeout: 10000 });
      await page.waitForTimeout(1600);
      L.winDusk = await page.evaluate(() => document.getElementById('win').classList.contains('dusk'));
      await page.screenshot({ path: out(`win-dusk-${tag}.png`) });
      L.errors = errors;
      await context.close();
    }
    // 4/5. The refusal toasts and the dead ends (light).
    {
      const R = (log[`words-${board}`] = {});
      const { context, page, errors } = await open(browser, { board });
      await dismiss(page);
      const P = await plan(page);
      for (const [name, r] of Object.entries(P.refusals)) {
        if (!r) { R[name] = 'not found on the path'; continue; }
        await at(page, r.k);
        await tap(page, r.f);
        await tap(page, r.t);
        await page.waitForTimeout(300);
        R[name] = await toast(page);
        await page.screenshot({ path: out(`refusal-${name}-${board}.png`) });
        await page.waitForTimeout(2600); // let the toast go
      }
      if (P.lostSunset) {
        await at(page, P.lostSunset.k);
        await tap(page, P.lostSunset.f);
        await tap(page, P.lostSunset.t);
        await page.waitForSelector('#stuck:not([hidden])', { timeout: 5000 }).catch(() => {});
        await idle(page);
        await page.waitForTimeout(900);
        R.lostSunset = { reason: await page.evaluate(() => window.__S.session.lostReason), text: await page.locator('#stuck-text').innerText().catch(() => '') };
        await page.screenshot({ path: out(`lost-sunset-${board}.png`) });
      }
      await craftedSunriseLost(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: out(`lost-sunrise-before-${board}.png`) });
      await tap(page, 4);
      await tap(page, 5);
      await page.waitForSelector('#stuck:not([hidden])', { timeout: 5000 }).catch(() => {});
      await idle(page);
      await page.waitForTimeout(900);
      R.lostSunrise = { reason: await page.evaluate(() => window.__S.session.lostReason), text: await page.locator('#stuck-text').innerText().catch(() => ''), crafted: true };
      await page.screenshot({ path: out(`lost-sunrise-${board}.png`) });
      R.errors = errors;
      await context.close();
    }
    // 7. 320px at 150% text, and colour patterns: at the start and once the sunrise jar is filled.
    for (const v of [{ tag: '320-150', width: 320, height: 900, text: 150 }, { tag: 'patterns', patterns: true }]) {
      const { context, page } = await open(browser, { board, ...v });
      await dismiss(page);
      const P = await plan(page);
      await page.screenshot({ path: out(`${v.tag}-start-${board}.png`) });
      log[`${v.tag}-${board}`] = await page.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth, marks: [...document.querySelectorAll('#board .sun-mark')].map((m) => { const r = m.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.right), Math.round(r.bottom)]; }) }));
      await at(page, P.sunrise + 1);
      await page.screenshot({ path: out(`${v.tag}-filled-${board}.png`) });
      await context.close();
    }
    // 3. Reduced motion: the sunrise is just the filled mark, the dusk is simply there.
    {
      const { context, page } = await open(browser, { board, reduced: true });
      await dismiss(page);
      const P = await plan(page);
      await at(page, P.sunrise);
      await play(page, P.sunrise);
      await page.waitForTimeout(80);
      const dawn = await page.locator('.sun-dawn').count();
      await idle(page);
      await page.waitForTimeout(300);
      await page.screenshot({ path: out(`reduced-sunrise-${board}.png`) });
      await at(page, P.pours - 1);
      await play(page, P.pours - 1);
      await page.waitForFunction(() => !document.getElementById('win').hidden, null, { timeout: 10000 });
      await page.waitForTimeout(500);
      log[`reduced-${board}`] = { dawnLayers: dawn, winDusk: await page.evaluate(() => document.getElementById('win').classList.contains('dusk')) };
      await page.screenshot({ path: out(`reduced-win-dusk-${board}.png`) });
      await context.close();
    }
  }
  // 6. The Jar guide's sun entry (opened over Home), and the map from Home with the new-jar badge at 361.
  if (does('teach')) {
    const context = await browser.newContext({ viewport: { width: 412, height: 900 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    await context.addInitScript(([key, seen, level]) => {
      localStorage.setItem(key, JSON.stringify({ tutorialDone: true, level, seenMechanics: seen, seenWhatsNew: '9.9.9',
        settings: { sound: false, music: false, haptics: false },
        onboarding: { visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true } }));
    }, [KEY, [...SEEN, 'sun'], LEVEL]);
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(`${BASE}/`);
    await page.waitForSelector('#home-tab-play', { state: 'visible', timeout: 30000 });
    await page.waitForTimeout(800);
    await dismiss(page);
    await page.waitForTimeout(400);
    await page.evaluate(async () => {
      const { showMechanicCards, MECHANICS } = await import('/src/ui/screens/sheets/guide.ts');
      showMechanicCards(MECHANICS, 'Jar guide');
    });
    await page.waitForTimeout(500);
    log.guide = await page.evaluate(() => { const j = document.querySelector('#intro .mini-jar.sun'); const card = j?.closest('li') ?? j?.parentElement; card?.scrollIntoView({ block: 'center' }); return card?.textContent ?? null; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: out('jar-guide-sun.png') });
    await page.evaluate(() => document.querySelector('#intro:not([hidden]) #btn-intro-ok')?.click());
    await page.waitForTimeout(500);
    await dismiss(page);
    await page.waitForTimeout(400);
    await page.click('#home-tab-collection');
    await page.waitForSelector('#btn-map-tile', { state: 'visible', timeout: 10000 });
    await page.waitForTimeout(400);
    await page.click('#btn-map-tile');
    await page.waitForSelector('.stone[data-level="361"]', { timeout: 10000 });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: out('map-361.png') });
    log.mapStone = await page.locator('.stone[data-level="361"]').getAttribute('aria-label');
    // 361 is the next level, so tapping its stone plays it (no stone card); the label carries the badge.
    log.mapErrors = errors;
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(out(ONLY === 'all' ? 'jars-log.json' : `jars-log-${ONLY}.json`), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
}
run().catch((e) => { console.error(e); process.exit(1); });
