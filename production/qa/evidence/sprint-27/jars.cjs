// Sprint 27 K4/K5 evidence: the crab and the lighthouse jar on the Classic (dom) and Realistic (gpu)
// boards, in a light (midday) and a dark (moonlit) scene. Intro cards on 281 and 321, a crafted board
// with the crab at 1 and a dark lighthouse jar at 1; the refusal toast; a pour that moves the crab
// and lights the lighthouse jar, frozen mid-scuttle and mid-sweep (DOM), then lit; 320px at 150%; the
// Jar guide. Win play-throughs are play.cjs (sprint-21/perf) with LEVEL=281 and LEVEL=321.
// Usage (dev server running):  PORT=5197 node production/qa/evidence/sprint-27/jars.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5197}`;
const KEY = 'strata.save.v2';
const SEEN = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam', 'wet', 'tide'];
const out = (f) => path.join(__dirname, f);

async function open(browser, { board, level = 281, width = 390, height = 844, text = 100, patterns = false, seen = [...SEEN, 'crab', 'lighthouse'], scene = 'midday', reduced = false }) {
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
  }, [KEY, seen, board, patterns, text, level, scene]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?level=${level}&board=${board}`);
  await page.waitForSelector('#board .jar .unit', { timeout: 30000 });
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; });
  await page.waitForFunction((n) => window.__S.mode === 'level' && window.__S.level === n && !!window.__S.session, level, { polling: 100, timeout: 30000 });
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
 * A crafted board: jar 0 holds the crab, one pour from moving; jar 1 is the lighthouse jar, dark,
 * one pour from the beam; jar 2 is a sealed lighthouse-free jar; a pour of jar 3 onto jar 4 moves the
 * crab to jar 1 (the next non-empty unsealed jar) and lights jar 1.
 */
const crafted = (page) =>
  page.evaluate(async () => {
    const { beginSession } = await import('/src/ui/screens/board.ts');
    beginSession({ capacity: 4, jars: [
      { units: [0, 1, 2], hidden: 0, crab: { every: 3, left: 1 } },
      { units: [2, 0, 1], hidden: 0, lighthouse: { every: 4, left: 1, lit: false } },
      { units: [3, 3, 3, 3], hidden: 0 },
      { units: [1, 2], hidden: 0 },
      { units: [0, 2], hidden: 0 },
      { units: [], hidden: 0 },
    ] }, false);
  });

async function pourAndWait(page, f, t) {
  const before = await page.evaluate(() => window.__S.session.moves);
  await tap(page, f);
  await tap(page, t);
  await page.waitForFunction((b) => window.__S.session.moves > b, before, { polling: 50, timeout: 4000 });
}

/** Pauses every animation on the board at `ms` past its own delay. */
const freeze = (page, ms) => page.evaluate((ms) => {
  const as = document.querySelector('#board').getAnimations({ subtree: true });
  for (const a of as) { const d = a.effect.getTiming().delay || 0; a.pause(); a.currentTime = d + ms; }
  return as.length;
}, ms);

async function run() {
  const browser = await chromium.launch();
  const log = {};
  // 1. Intro cards on 281 and 321 (not seen yet).
  for (const [level, id] of [[281, 'crab'], [321, 'lighthouse']]) {
    const { context, page, errors } = await open(browser, { board: 'dom', level, seen: [...SEEN, ...(id === 'lighthouse' ? ['crab'] : [])] });
    log[`intro${level}`] = { shown: await page.locator('#intro:not([hidden])').count(), text: await page.locator('#intro-list').innerText().catch(() => ''), errors };
    await page.screenshot({ path: out(`intro-${level}.png`) });
    await dismiss(page);
    await page.waitForTimeout(400);
    await page.screenshot({ path: out(`level-${level}-dom.png`) });
    log[`labels${level}`] = await labels(page);
    await context.close();
  }
  for (const board of ['dom', 'gpu']) {
    for (const scene of ['midday', 'moonlit']) {
      const tag = `${board}-${scene === 'midday' ? 'light' : 'dark'}`;
      const L = (log[tag] = {});
      const { context, page, errors } = await open(browser, { board, scene });
      L.render = await page.evaluate(() => document.getElementById('board').dataset.render);
      await dismiss(page);
      await crafted(page);
      await page.waitForTimeout(900);
      await page.screenshot({ path: out(`crab-lighthouse-${tag}.png`) });
      L.labels = await labels(page);
      // The refusal: lift the crab's jar.
      await tap(page, 0);
      await page.waitForTimeout(250);
      L.toast = await page.evaluate(() => [...document.querySelectorAll('.toast, #toast')].map((n) => n.textContent).filter(Boolean));
      L.selectedAfterCrabTap = await page.evaluate(() => window.__S.selected);
      if (scene === 'midday') await page.screenshot({ path: out(`refusal-toast-${board}.png`) });
      await page.waitForTimeout(1800);
      // The pour that moves the crab and sweeps the beam.
      await pourAndWait(page, 3, 4);
      if (board === 'dom') {
        await page.waitForTimeout(30);
        L.animsMid = await freeze(page, 280);
        await page.waitForTimeout(100);
        await page.screenshot({ path: out(`mid-scuttle-sweep-${tag}.png`) });
        await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
      } else {
        // The canvas pour hands back late; freeze the DOM crab and beam (they are DOM over the canvas).
        await page.waitForFunction(() => document.querySelector('#board .lh-sweep'), null, { timeout: 4000 }).catch(() => {});
        L.animsMid = await page.evaluate(() => {
          const as = [...document.querySelectorAll('#board .crab-mark, #board .lh-sweep > span')].flatMap((e) => e.getAnimations());
          for (const a of as) { const d = a.effect.getTiming().delay || 0; a.pause(); a.currentTime = d + 280; }
          return as.length;
        });
        await page.waitForTimeout(150);
        await page.screenshot({ path: out(`mid-scuttle-sweep-${tag}.png`) });
        await page.evaluate(() => document.getAnimations().forEach((a) => a.play()));
      }
      await idle(page);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: out(`after-lit-${tag}.png`) });
      L.afterLabels = await labels(page);
      L.announce = await page.evaluate(() => [...document.querySelectorAll('[aria-live]')].map((n) => n.textContent).filter(Boolean));
      L.board = await page.evaluate(() => window.__S.session.board.jars.slice(0, 2));
      L.errors = errors;
      await context.close();
    }
    // 320px at 150% text, and colour patterns (dark sand shows none).
    for (const v of [{ tag: '320-150', width: 320, height: 900, text: 150 }, { tag: 'patterns', patterns: true }]) {
      const { context, page } = await open(browser, { board, ...v });
      await dismiss(page);
      await crafted(page);
      await page.waitForTimeout(900);
      await page.screenshot({ path: out(`${v.tag}-${board}.png`) });
      await context.close();
    }
  }
  // Reduced motion: the pour moves the crab and lights the jar at once (no scuttle, no sweep).
  {
    const { context, page } = await open(browser, { board: 'dom', reduced: true });
    await dismiss(page);
    await crafted(page);
    await page.waitForTimeout(600);
    await pourAndWait(page, 3, 4);
    await page.waitForTimeout(60);
    log.reduced = { anims: await page.evaluate(() => document.querySelector('#board').getAnimations({ subtree: true }).length), sweep: await page.locator('#board .lh-sweep').count(), crabOn: await page.evaluate(() => [...document.querySelectorAll('#board .jar')].findIndex((j) => j.classList.contains('crab'))) };
    await page.screenshot({ path: out('reduced-motion-dom.png') });
    // Undo restores the crab and dark sand.
    await page.click('[data-booster="undo"]');
    await page.waitForTimeout(500);
    log.reduced.afterUndo = await labels(page);
    await context.close();
  }
  // The Jar guide ends with the crab and the lighthouse jar.
  {
    const { context, page } = await open(browser, { board: 'dom' });
    await dismiss(page);
    await page.evaluate(async () => {
      const { showMechanicCards, MECHANICS } = await import('/src/ui/screens/sheets/guide.ts');
      showMechanicCards(MECHANICS, 'Jar guide');
    });
    await page.waitForTimeout(500);
    await page.evaluate(() => { const c = document.querySelector('#intro .cabinet-card'); if (c) c.scrollTop = c.scrollHeight; });
    await page.waitForTimeout(300);
    await page.screenshot({ path: out('jar-guide.png') });
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(out('jars-log.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 2));
}
run().catch((e) => { console.error(e); process.exit(1); });
