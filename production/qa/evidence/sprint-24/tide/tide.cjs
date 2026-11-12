// Sprint 24 T4/T5 evidence: the tide jar on the Classic (dom) and Realistic (gpu) boards.
// Level 241's intro card, the tide jar on level 241, a crafted board with the count at 1, a sealed
// (still) tide jar and wet sand on the tide jar, the rise mid-way, colour-blind patterns, 320px at
// 150% text, and the Jar guide entry. The win play-through is play.cjs (sprint-21/perf) with LEVEL=241.
// Usage (dev server running):  PORT=5189 node production/qa/evidence/sprint-24/tide/tide.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5189}`;
const KEY = 'strata.save.v2';
const SEEN = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam', 'wet'];
const out = (f) => path.join(__dirname, f);

async function open(browser, { board, width = 390, height = 844, text = 100, patterns = false, seen = SEEN }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript(([key, seen, board, patterns, text]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level: 241, seenMechanics: seen, seenWhatsNew: '9.9.9' });
    s.wallet = { coins: 5000, boosters: { hint: 3, shuffle: 3, extraJar: 1, undo: 5 } };
    s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false, patterns, realistic: board === 'gpu' };
    s.onboarding = { ...(s.onboarding || {}), visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
    localStorage.setItem(key, JSON.stringify(s));
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
  }, [KEY, seen, board, patterns, text]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?level=241&board=${board}`);
  await page.waitForSelector('#board .jar .unit', { timeout: 30000 });
  // Playwright counts a Promise as truthy, so waits read a state handle synchronously (window.__S).
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; });
  await page.waitForFunction(() => window.__S.mode === 'level' && window.__S.level === 241 && !!window.__S.session, null, { polling: 100, timeout: 30000 });
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

/**
 * A crafted board: jar 0 a tide jar one pour from turning, with wet sand on top; jar 1 a sealed tide
 * jar (still); a pour of jar 2 onto jar 3 turns jar 0.
 */
const crafted = (page) =>
  page.evaluate(async () => {
    const { beginSession } = await import('/src/ui/screens/board.ts');
    beginSession({ capacity: 4, jars: [
      { units: [0, 1, 2], hidden: 0, wet: [0, 0, 3], tide: { every: 4, left: 1 } },
      { units: [3, 3, 3, 3], hidden: 0, tide: { every: 4, left: 2 } },
      { units: [1, 2], hidden: 0 },
      { units: [2], hidden: 0 },
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
    // 1. Level 241's intro card (tide jar not seen yet), then the board with its tide jar.
    {
      const { context, page, errors } = await open(browser, { board });
      L.render = await page.evaluate(() => document.getElementById('board').dataset.render);
      L.introShown = await page.locator('#intro:not([hidden])').count();
      L.introText = await page.locator('#intro-list').innerText().catch(() => '');
      if (board === 'dom') await page.screenshot({ path: out('intro-241.png') });
      await dismiss(page);
      await page.waitForTimeout(400);
      await page.screenshot({ path: out(`level-241-${board}.png`) });
      L.labels241 = await labels(page);
      L.errors = errors;
      await context.close();
    }
    // 2. The crafted board: count at 1 (accent), a still sealed tide jar, wet sand on the tide jar; then the rise.
    {
      const { context, page, errors } = await open(browser, { board });
      await dismiss(page);
      await crafted(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: out(`count-1-and-sealed-${board}.png`) });
      L.craftedLabels = await labels(page);
      L.marks = await page.evaluate(() => [...document.querySelectorAll('#board .jar')].map((j) => ({ tide: j.classList.contains('tide'), still: j.classList.contains('tide-still'), count: j.querySelector('.tide-mark b')?.textContent ?? '' })));
      await pourAndWait(page, 2, 3);
      if (board === 'dom') {
        // Freeze the rise half-way (deterministic): every animation of the tide jar's units.
        await page.waitForTimeout(30);
        L.riseAnims = await page.evaluate(() => {
          const el = document.querySelectorAll('#board .jar')[0];
          const as = el.getAnimations({ subtree: true });
          for (const a of as) { const d = a.effect.getTiming().delay || 0; a.pause(); a.currentTime = d + 240; }
          return as.length;
        });
        await page.waitForTimeout(100);
        await page.screenshot({ path: out(`mid-rise-${board}.png`) });
        await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
      } else {
        await page.waitForTimeout(60); // the canvas pour hands back late: the rise is under way by now
        await page.screenshot({ path: out(`mid-rise-${board}.png`) });
      }
      await idle(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: out(`after-rise-${board}.png`) });
      L.afterLabels = await labels(page);
      L.announce = await page.evaluate(() => [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent).filter(Boolean));
      L.afterUnits = await page.evaluate(() => window.__S.session.board.jars[0]);
      L.errors2 = errors;
      await context.close();
    }
    // 3. Colour-blind patterns, and 320px with 150% text, on the crafted board.
    for (const v of [{ tag: 'patterns', patterns: true }, { tag: '320-150', width: 320, height: 900, text: 150, patterns: false }, { tag: '320-150-patterns', width: 320, height: 900, text: 150, patterns: true }]) {
      const { context, page } = await open(browser, { board, ...v });
      await dismiss(page);
      await crafted(page);
      await page.waitForTimeout(800);
      await page.screenshot({ path: out(`${v.tag}-${board}.png`) });
      await context.close();
    }
  }
  // 4. The Jar guide lists the tide jar last (Classic only: it is a sheet).
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
    await page.screenshot({ path: out('jar-guide-tide.png') });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(out('tide-log.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
}
run().catch((e) => { console.error(e); process.exit(1); });
