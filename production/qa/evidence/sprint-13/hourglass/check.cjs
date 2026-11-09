// Sprint 13 M1: the hourglass jar in the browser (design/gdd/jar-mechanics.md 2.4, D96).
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5533 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base = 'http://localhost:5533/', out = __dirname] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const SMALL = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const w = (p, ms) => p.waitForTimeout(ms);
const R = {};

function seed(over = {}) {
  return {
    tutorialDone: true, level: 101, seenWhatsNew: VERSION, seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'],
    onboarding: { visits: 1, installShown: true, offlineNoticed: true },
    settings: { sound: false, music: false, haptics: false, patterns: false },
    wallet: { coins: 100, boosters: { hint: 99 } }, ...over,
  };
}

/** A page on level 101's board, seeded once per context; the intro card is left open. */
async function open(b, opts, { save = seed(), big = false, reduced = false } = {}) {
  const ctx = await b.newContext({ ...opts, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.addInitScript(([k, v, big]) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); }
    if (big) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });
  }, [KEY, JSON.stringify(save), big]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base); await w(p, 900);
  await p.click('#btn-play', { force: true }); await w(p, 700);
  await p.click('#btn-map-play', { force: true }); await w(p, 1200);
  return { ctx, p };
}
const closeIntro = async (p) => { if (await p.locator('#intro').isVisible()) { await p.click('#btn-intro-ok'); await w(p, 400); } };

/** The hourglass jar as the player and a screen reader see it. */
const glass = (p) => p.evaluate(() => {
  const el = document.querySelector('.jar.hourglass');
  if (!el) return null;
  return { index: Number(el.dataset.index), badge: el.querySelector('.hourglass-mark b').textContent, label: el.getAttribute('aria-label'), units: [...el.querySelectorAll('.sand .unit')].map((u) => u.style.getPropertyValue('--c')) };
});

/** One hinted pour: H, then the two highlighted jars. */
async function hintPour(p) {
  await p.keyboard.press('h');
  await p.waitForSelector('.jar.hint-from', { timeout: 8000 });
  const from = await p.$eval('.jar.hint-from', (el) => Number(el.dataset.index));
  const to = await p.$eval('.jar.hint-to', (el) => Number(el.dataset.index));
  await p.click(`.jar[data-index="${from}"]`, { force: true }); await w(p, 120);
  await p.click(`.jar[data-index="${to}"]`, { force: true });
  return { from, to };
}
const settle = (p, ms = 1500) => w(p, ms);

/** The badge's box against every other mark and the neighbouring jars. */
const clearance = (p) => p.evaluate(() => {
  const el = document.querySelector('.jar.hourglass');
  const m = el.querySelector('.hourglass-mark').getBoundingClientRect();
  const hit = (r) => r.width > 0 && r.height > 0 && !(r.right <= m.left || r.left >= m.right || r.bottom <= m.top || r.top >= m.bottom);
  const marks = [...el.querySelectorAll('.cork, .padlock, .funnel-mark, .hint-badge')].filter((x) => getComputedStyle(x).display !== 'none' && getComputedStyle(x).opacity !== '0');
  const others = [...document.querySelectorAll('.jar')].filter((j) => j !== el).map((j) => j.querySelector('.glass').getBoundingClientRect());
  const tb = document.querySelector('.toolbar')?.getBoundingClientRect();
  return { badge: { w: Math.round(m.width), h: Math.round(m.height) }, jarW: Math.round(el.getBoundingClientRect().width), overlapsMarks: marks.some((x) => hit(x.getBoundingClientRect())), overlapsOtherJars: others.some(hit), overlapsToolbar: tb ? hit(tb) : false, fontPx: getComputedStyle(el.querySelector('.hourglass-mark')).fontSize };
});

(async () => {
  const b = await chromium.launch();
  const px = devices['Pixel 7'];

  // 1. Midday, full motion: the intro card, the badge at 3, 2, 1, the flip, Undo and Restart.
  {
    const { ctx, p } = await open(b, px);
    R.introShown = await p.locator('#intro').isVisible();
    R.introText = (await p.textContent('#intro-list')).replace(/\s+/g, ' ').trim();
    await p.screenshot({ path: path.join(out, '01-intro-card-101.png') });
    await closeIntro(p);
    R.seenAfterIntro = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).seenMechanics, KEY);
    R.start = await glass(p);
    R.clearanceMidday = await clearance(p);
    await p.screenshot({ path: path.join(out, '02-board-badge-3.png') });
    R.pour1 = { move: await hintPour(p) }; await settle(p);
    R.pour1.glass = await glass(p);
    await p.screenshot({ path: path.join(out, '03-after-pour-1-badge-2.png') });
    R.pour2 = { move: await hintPour(p) }; await settle(p);
    R.pour2.glass = await glass(p);
    await p.screenshot({ path: path.join(out, '04-after-pour-2-badge-1.png') });
    // The third pour flips it: catch the turn-over half way, paused.
    R.pour3 = { move: await hintPour(p) };
    await p.waitForFunction(() => document.getAnimations().some((a) => a.effect && a.effect.getTiming().duration === 460 && a.currentTime > a.effect.getTiming().delay + 170), null, { polling: 'raf', timeout: 5000 });
    R.pour3.midFlipAnimations = await p.evaluate(() => { const as = document.getAnimations(); as.forEach((a) => a.pause()); return as.filter((a) => a.effect.getTiming().duration === 460).length; });
    await p.screenshot({ path: path.join(out, '05-flip-mid-paused.png') });
    await p.evaluate(() => document.getAnimations().forEach((a) => a.play()));
    await settle(p);
    R.pour3.glass = await glass(p);
    R.pour3.announce = await p.textContent('#announce');
    await p.screenshot({ path: path.join(out, '06-after-flip-badge-3.png') });
    // Undo (Z) puts the count and the order back; Restart (R, R) deals the count again.
    await p.keyboard.press('z'); await settle(p, 800);
    R.afterUndo = await glass(p);
    await p.screenshot({ path: path.join(out, '07-after-undo-badge-1.png') });
    await p.keyboard.press('r'); await w(p, 200); await p.keyboard.press('r'); await settle(p, 800);
    R.afterRestart = await glass(p);
    await w(p, 3200); // let the Restart toast fade before the guide shot
    R.errors = p.errors;
    // The Jar guide lists the hourglass.
    await p.click('#btn-settings', { force: true }); await w(p, 400);
    await p.click('#btn-guide', { force: true }); await w(p, 500);
    R.guideHasHourglass = (await p.textContent('#intro-list')).includes('Hourglass jar');
    await p.locator('#intro-list .mini-jar.hourglass').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(out, '08-jar-guide.png') });
    R.errorsGuide = p.errors;
    await ctx.close();
  }

  // 2. Moonlit (a dark scene).
  {
    const { ctx, p } = await open(b, px, { save: seed({ seenMechanics: ['narrow', 'frozen', 'locked', 'funnel', 'hourglass'], themes: { owned: ['midday', 'moonlit'], selected: 'moonlit', auto: false } }) });
    await closeIntro(p);
    R.clearanceMoonlit = await clearance(p);
    await p.screenshot({ path: path.join(out, '09-moonlit-badge-3.png') });
    await hintPour(p); await settle(p); await hintPour(p); await settle(p);
    R.moonlitBadge1 = await glass(p);
    await p.screenshot({ path: path.join(out, '10-moonlit-badge-1.png') });
    R.errorsMoonlit = p.errors;
    await ctx.close();
  }

  // 3. 150% text on 320 x 568.
  {
    const { ctx, p } = await open(b, SMALL, { big: true });
    await p.screenshot({ path: path.join(out, '11-320-150-intro.png') });
    await closeIntro(p);
    R.clearance320 = await clearance(p);
    R.pageOverflow320 = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await p.screenshot({ path: path.join(out, '12-320-150-board.png') });
    R.errors320 = p.errors;
    await ctx.close();
  }

  // 4. Reduced motion: the flip is the new order, drawn at once; no animation runs.
  {
    const { ctx, p } = await open(b, px, { reduced: true });
    await closeIntro(p);
    for (let i = 0; i < 2; i++) { await hintPour(p); await settle(p, 900); }
    R.reducedBefore = await glass(p);
    await hintPour(p); await w(p, 120);
    R.reducedRunningFlips = await p.evaluate(() => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().duration === 460).length);
    R.reducedAfter = await glass(p);
    R.reducedAnnounce = await p.textContent('#announce');
    await p.screenshot({ path: path.join(out, '13-reduced-motion-after-flip.png') });
    R.errorsReduced = p.errors;
    await ctx.close();
  }

  // 5. A win on level 101 with hints.
  {
    const { ctx, p } = await open(b, px);
    await closeIntro(p);
    let pours = 0;
    while (pours < 120 && !(await p.locator('#win').isVisible())) {
      try { await hintPour(p); } catch { break; }
      pours++;
      await settle(p, 1300);
    }
    R.win = { pours, shown: await p.locator('#win').isVisible(), errors: p.errors };
    await w(p, 800);
    await p.screenshot({ path: path.join(out, '14-win-101.png') });
    await ctx.close();
  }

  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
})();
