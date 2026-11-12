// Sprint 21 P2 regression play-through (strata-8j3): the Classic and Realistic boards still draw every
// change now that a redraw touches only the jars that changed. Level 12 at 390x844: two pours, Undo,
// Shuffle, then the solver's path to the win. After every action the DOM jars are checked against the
// rules' board (unit count and colours per jar, sealed, selected), and screenshots are kept.
// Usage (dev server running):  PORT=5182 node production/qa/evidence/sprint-21/perf/play.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5182}`;
const LEVEL = Number(process.env.LEVEL || 12);
const KEY = 'strata.save.v2';
const MECHANICS = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam', 'wet'];

/** Mismatches between the DOM jars and the session's board (empty when they agree). */
const domVsBoard = (page) =>
  page.evaluate(async () => {
    const { state, config } = await import('/src/ui/state.ts');
    const { isSealed } = await import('/src/core/board.ts');
    const { wetHex } = await import('/src/ui/logic/wet.ts');
    const b = state.session.board;
    const bad = [];
    b.jars.forEach((jar, i) => {
      const el = state.jarEls[i];
      const units = [...el.querySelectorAll('.sand .unit')];
      if (units.length !== jar.units.length) bad.push(`jar ${i}: ${units.length} units drawn, ${jar.units.length} on the board`);
      units.forEach((u, k) => {
        // Wet sand (D189) draws its damp tone while its count is above 0.
        const hex = config.palette[jar.units[k]].hex;
        const want = k < jar.hidden ? '' : (jar.wet?.[k] ?? 0) > 0 ? wetHex(hex) : hex;
        if (u.style.getPropertyValue('--c') !== want) bad.push(`jar ${i} unit ${k}: colour ${u.style.getPropertyValue('--c')} not ${want}`);
      });
      if (el.classList.contains('sealed') !== isSealed(jar, b.capacity)) bad.push(`jar ${i}: sealed class wrong`);
      if (el.classList.contains('selected') !== (state.selected === i)) bad.push(`jar ${i}: selected class wrong`);
    });
    return bad;
  });

async function play(browser, board) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript(([key, level, mech, board]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level, seenMechanics: mech, seenWhatsNew: '9.9.9' });
    s.wallet = { coins: 5000, boosters: { hint: 3, shuffle: 3, extraJar: 1, undo: 5 } };
    s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false, realistic: board === 'gpu' };
    s.onboarding = { ...(s.onboarding || {}), visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
    localStorage.setItem(key, JSON.stringify(s));
  }, [KEY, LEVEL, MECHANICS, board]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?level=${LEVEL}&board=${board}`);
  await page.waitForFunction(async (n) => {
    const { state } = await import('/src/ui/state.ts');
    return state.mode === 'level' && state.level === n && !!state.session && state.session.board.jars.length === document.querySelectorAll('#board .jar').length;
  }, LEVEL, { polling: 100, timeout: 30000 });
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await page.waitForTimeout(1200);
  const log = { board, render: await page.evaluate(() => document.getElementById('board').dataset.render), steps: [], errors };
  // Playwright counts a Promise as truthy, so these waits read a state handle synchronously (window.__S).
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; });
  const idle = () => page.waitForFunction(() => !window.__S.busy && window.__S.returning.size === 0, null, { polling: 50, timeout: 20000 });
  const check = async (what) => {
    await idle();
    await page.waitForTimeout(900); // the Realistic pour's tail settles after input comes back
    log.steps.push({ what, mismatches: await domVsBoard(page) });
  };
  const tap = async (i) => {
    const box = await page.locator('#board .jar').nth(i).boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
    await page.waitForTimeout(120);
  };
  const solve = () => page.evaluate(async () => {
    const { state } = await import('/src/ui/state.ts');
    const { solve } = await import('/src/core/solver.ts');
    return solve(state.session.board, 400000).path.map((m) => [m.from, m.to]);
  });
  const moves = () => page.evaluate(async () => (await import('/src/ui/state.ts')).state.session.moves);
  log.ignored = [];
  // A pour must add one move; a tap the game ignored (e.g. during the last pour's tail) is logged and retried once.
  const pour = async ([f, t]) => {
    const before = await moves();
    await tap(f); await tap(t);
    // The Realistic pour counts its move when the first grain lands, a moment after the tap: wait up to 3 s for it.
    await page.waitForFunction((b) => window.__S.session.moves > b, before, { polling: 50, timeout: 3000 }).catch(() => {});
    if ((await moves()) === before) {
      const why = await page.evaluate(async ([t, box]) => {
        const { state } = await import('/src/ui/state.ts');
        const el = document.elementFromPoint(box.x + box.width / 2, box.y + box.height * 0.6);
        return { selected: state.selected, busy: state.busy, returning: [...state.returning], hitIs: el?.closest('.jar')?.dataset.index ?? el?.className ?? null, status: state.session.status };
      }, [t, await page.locator('#board .jar').nth(t).boundingBox()]);
      log.ignored.push(`${f}->${t} at move ${before} ${JSON.stringify(why)}`);
      await page.evaluate(async () => { const { state } = await import('/src/ui/state.ts'); if (state.selected !== null) document.querySelectorAll('#board .jar')[state.selected].click(); });
      await page.waitForTimeout(300);
      await tap(f); await tap(t);
    }
    await check(`pour ${f}->${t}`);
  };
  let path0 = await solve();
  await pour(path0[0]);
  await pour(path0[1]);
  await page.click('[data-booster="undo"]');
  await check('undo');
  await page.screenshot({ path: path.join(__dirname, `play-${board}-after-undo.png`) });
  await page.click('[data-booster="shuffle"]');
  await page.waitForTimeout(1500);
  await check('shuffle');
  await page.screenshot({ path: path.join(__dirname, `play-${board}-after-shuffle.png`) });
  path0 = await solve();
  let sealedShot = false;
  for (const m of path0) {
    await pour(m);
    const sealed = await page.locator('#board .jar.sealed').count();
    if (sealed && !sealedShot) {
      sealedShot = true;
      await page.screenshot({ path: path.join(__dirname, `play-${board}-sealed.png`) });
    }
  }
  await page.waitForTimeout(2500);
  log.won = await page.evaluate(async () => (await import('/src/ui/state.ts')).state.session.status === 'won');
  log.winCard = await page.locator('#win:not([hidden])').count();
  await page.screenshot({ path: path.join(__dirname, `play-${board}-win.png`) });
  log.allMatched = log.steps.every((s) => s.mismatches.length === 0);
  await context.close();
  return log;
}

(async () => {
  const browser = await chromium.launch();
  const out = {};
  for (const board of ['dom', 'gpu']) out[board] = await play(browser, board);
  fs.writeFileSync(path.join(__dirname, 'play-results.json'), JSON.stringify(out, null, 2) + '\n');
  for (const [b, l] of Object.entries(out)) console.log(b, 'render', l.render, 'steps', l.steps.length, 'allMatched', l.allMatched, 'won', l.won, 'winCard', l.winCard, 'errors', l.errors.length, 'ignored', JSON.stringify(l.ignored), JSON.stringify(l.steps.filter((s) => s.mismatches.length).slice(0, 3)));
  await browser.close();
})();
