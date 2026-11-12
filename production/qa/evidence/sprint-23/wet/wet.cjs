// Sprint 23 W4/W5 evidence: wet sand on the Classic (dom) and Realistic (gpu) boards.
// Level 201's intro card, a wet jar, the 'wet' refusal toast, the drying shimmer mid-way, a complete
// but wet jar beside a sealed one, colour-blind patterns, 320px at 150% text, and level 201 played to
// a win on both boards. Usage (dev server running):  PORT=5188 node production/qa/evidence/sprint-23/wet/wet.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5188}`;
const KEY = 'strata.save.v2';
const SEEN = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam'];
const out = (f) => path.join(__dirname, f);

async function open(browser, { board, width = 390, height = 844, text = 100, patterns = false, seen = SEEN }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript(([key, seen, board, patterns, text]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level: 201, seenMechanics: seen, seenWhatsNew: '9.9.9' });
    s.wallet = { coins: 5000, boosters: { hint: 3, shuffle: 3, extraJar: 1, undo: 5 } };
    s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false, patterns, realistic: board === 'gpu' };
    s.onboarding = { ...(s.onboarding || {}), visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
    localStorage.setItem(key, JSON.stringify(s));
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
  }, [KEY, seen, board, patterns, text]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?level=201&board=${board}`);
  await page.waitForSelector('#board .jar .unit', { timeout: 30000 });
  // Playwright counts a Promise as truthy, so waits read a state handle synchronously (window.__S).
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; });
  await page.waitForFunction(() => window.__S.mode === 'level' && window.__S.level === 201 && !!window.__S.session, null, { polling: 100, timeout: 30000 });
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
const labels = (page) => page.evaluate(() => [...document.querySelectorAll('#board .jar')].map((j) => j.getAttribute('aria-label')));

/** A crafted board: a complete wet jar, a sealed jar, a wet run, mixed sand and two empties. */
const crafted = (page) =>
  page.evaluate(async () => {
    const { beginSession } = await import('/src/ui/screens/board.ts');
    beginSession({ capacity: 4, jars: [
      { units: [0, 0, 0, 0], hidden: 0, wet: [0, 0, 2, 3] },
      { units: [1, 1, 1, 1], hidden: 0 },
      { units: [2, 3, 2], hidden: 0, wet: [0, 0, 4] },
      { units: [3, 2, 3], hidden: 0, wet: [0, 0, 1] },
      { units: [], hidden: 0 },
      { units: [], hidden: 0 },
    ] }, false);
  });

async function pourAndWait(page, f, t) {
  const before = await page.evaluate(() => window.__S.session.moves);
  await tap(page, f);
  await tap(page, t);
  await page.waitForFunction((b) => window.__S.session.moves > b, before, { polling: 50, timeout: 4000 });
}

async function run() {
  const browser = await chromium.launch();
  const log = {};
  for (const board of ['dom', 'gpu']) {
    const L = (log[board] = {});
    // 1. Level 201's intro card (wet sand not seen yet), then the board with its wet units.
    {
      const { context, page, errors } = await open(browser, { board });
      L.render = await page.evaluate(() => document.getElementById('board').dataset.render);
      L.introShown = await page.locator('#intro:not([hidden])').count();
      L.introText = await page.locator('#intro-list').innerText().catch(() => '');
      if (board === 'dom') await page.screenshot({ path: out('intro-201.png') });
      await dismiss(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: out(`level-201-${board}.png`) });
      L.labels201 = await labels(page);
      // 2. Play level 201 to a win by the solver's path.
      const pathMoves = await page.evaluate(async () => {
        const { solve } = await import('/src/core/solver.ts');
        return solve(window.__S.session.board, 400000).path.map((m) => [m.from, m.to]);
      });
      let n = 0;
      for (const [f, t] of pathMoves) {
        await idle(page);
        await page.waitForTimeout(board === 'gpu' ? 500 : 150);
        await pourAndWait(page, f, t);
        if (n++ === 1) await page.screenshot({ path: out(`level-201-${board}-move2.png`) });
      }
      await page.waitForTimeout(3000);
      L.won = await page.evaluate(() => window.__S.session.status === 'won');
      L.winCard = await page.locator('#win:not([hidden])').count();
      await page.screenshot({ path: out(`level-201-${board}-win.png`) });
      L.errors = errors;
      await context.close();
    }
    // 3. The crafted board: complete-but-wet vs sealed, the refusal toast, drying mid-shimmer.
    {
      const { context, page, errors } = await open(browser, { board });
      await dismiss(page);
      await crafted(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: out(`wet-vs-sealed-${board}.png`) });
      L.craftedLabels = await labels(page);
      L.sealedClass = await page.evaluate(() => [...document.querySelectorAll('#board .jar')].map((j) => j.classList.contains('sealed')));
      // Wet run (jar 2's top) into an empty jar: refused with the toast.
      await tap(page, 2);
      await tap(page, 4);
      await page.waitForTimeout(250);
      L.toast = await page.locator('#toast').innerText().catch(() => '');
      await page.screenshot({ path: out(`refusal-toast-${board}.png`) });
      await page.waitForTimeout(2600);
      if (await page.evaluate(() => window.__S.selected !== null)) await tap(page, await page.evaluate(() => window.__S.selected));
      // A board where one pour dries sand in three jars and seals jar 0 by drying (sealedDry).
      await page.evaluate(async () => {
        const { beginSession } = await import('/src/ui/screens/board.ts');
        beginSession({ capacity: 4, jars: [
          { units: [0, 0, 0, 0], hidden: 0, wet: [0, 0, 0, 1] },
          { units: [1, 1, 1, 1], hidden: 0 },
          { units: [2, 3, 2], hidden: 0, wet: [0, 1, 4] },
          { units: [3, 2], hidden: 0 },
          { units: [], hidden: 0 },
          { units: [], hidden: 0 },
        ] }, false);
      });
      await page.waitForTimeout(600);
      await page.screenshot({ path: out(`before-dry-${board}.png`) });
      // Pour jar 2's wet top onto jar 3's same-coloured top: every count ticks down; jar 0 and jar 2's middle unit dry.
      await pourAndWait(page, 2, 3);
      await page.waitForTimeout(board === 'gpu' ? 520 : 330);
      await page.screenshot({ path: out(`mid-dry-${board}.png`) });
      await idle(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: out(`after-dry-${board}.png`) });
      L.afterDrySealed = await page.evaluate(() => [...document.querySelectorAll('#board .jar')].map((j) => j.classList.contains('sealed')));
      L.afterDryLabels = await labels(page);
      L.errors2 = errors;
      await context.close();
    }
    // 4. Colour-blind patterns, and 320px with 150% text, on the crafted board.
    for (const v of [{ tag: 'patterns', patterns: true }, { tag: '320-150', width: 320, height: 900, text: 150, patterns: false }, { tag: '320-150-patterns', width: 320, height: 900, text: 150, patterns: true }]) {
      const { context, page } = await open(browser, { board, ...v });
      await dismiss(page);
      await crafted(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: out(`${v.tag}-${board}.png`) });
      await context.close();
    }
  }
  // 5. The Jar guide lists wet sand last (Classic only: it is a sheet).
  {
    const { context, page } = await open(browser, { board: 'dom', width: 390, height: 844 });
    await dismiss(page);
    await page.evaluate(async () => {
      const { showMechanicCards, MECHANICS } = await import('/src/ui/screens/sheets/guide.ts');
      showMechanicCards(MECHANICS, 'Jar guide');
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const c = document.querySelector('#intro .cabinet-card'); if (c) c.scrollTop = c.scrollHeight; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: out('jar-guide-wet.png') });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(out('wet-log.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
}
run().catch((e) => { console.error(e); process.exit(1); });
