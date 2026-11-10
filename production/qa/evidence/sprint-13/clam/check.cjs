// Sprint 13 M3: the clam jar in the browser (design/gdd/jar-mechanics.md 2.6, D96).
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5535 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base = 'http://localhost:5535/', out = __dirname] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const SMALL = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const OPEN_MS = 520; // CLAM_OPEN_MS in src/ui/logic/clam.ts
const w = (p, ms) => p.waitForTimeout(ms);
const R = {};

function seed(over = {}) {
  return {
    tutorialDone: true, level: 181, seenWhatsNew: VERSION, seenMechanics: ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve'],
    onboarding: { visits: 1, installShown: true, offlineNoticed: true },
    settings: { sound: false, music: false, haptics: false, patterns: false },
    wallet: { coins: 100, boosters: { hint: 99 } }, ...over,
  };
}
const seen = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam'];

/** A page on level 181's board, seeded once per context; the intro card is left open. */
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

/** The clam jar as the DOM shows it (the jar that is or was dealt closed: `index`). */
const clam = (p, index) => p.evaluate((index) => {
  const el = index === undefined ? document.querySelector('.jar.clam') : document.querySelector(`.jar[data-index="${index}"]`);
  if (!el) return null;
  const shell = el.querySelector('.clam-shell');
  const palette = [...document.querySelectorAll('.jar .unit')].length; // a sanity number only
  return {
    index: Number(el.dataset.index), closed: el.classList.contains('clam'), opening: el.classList.contains('clam-opening'),
    count: shell.querySelector('b').textContent, shellShown: getComputedStyle(shell).display !== 'none',
    label: el.getAttribute('aria-label'), units: el.querySelectorAll('.sand .unit').length, unitsOnBoard: palette,
  };
}, index);
/** Every jar's index, whether it can be lifted, and its top colour. */
const jars = (p) => p.evaluate(() => [...document.querySelectorAll('.jar')].map((el) => {
  const units = [...el.querySelectorAll('.sand .unit')];
  const top = units.at(-1);
  return {
    index: Number(el.dataset.index), units: units.length, top: top && !top.classList.contains('buried') ? top.style.getPropertyValue('--c') : null,
    liftable: units.length > 0 && !['sealed', 'frozen', 'locked', 'funnel', 'clam'].some((c) => el.classList.contains(c)),
  };
}));
const toast = (p) => p.evaluate(() => document.querySelector('.toast.show, #toast.show')?.textContent ?? null);
/** The colour names a closed clam's label must not list: every palette name in the game. */
const colourNames = (p) => p.evaluate(() => [...new Set([...document.querySelectorAll('.jar:not(.clam)')].flatMap((el) => (el.getAttribute('aria-label').split(': ')[1] || '').split(/[,()]/).map((s) => s.trim())))].filter((s) => /^[a-z]+$/.test(s) && !['empty', 'buried', 'sealed'].includes(s)));

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
const tap = async (p, i) => { await p.click(`.jar[data-index="${i}"]`, { force: true }); await w(p, 150); };
const deselect = async (p) => { for (const j of await p.$$eval('.jar.selected', (els) => els.map((e) => Number(e.dataset.index)))) await tap(p, j); };

/** The count pill against the shell, the other jars and the toolbar; its font size. */
const clearance = (p) => p.evaluate(() => {
  const el = document.querySelector('.jar.clam');
  const m = el.querySelector('.clam-shell b').getBoundingClientRect();
  const s = el.querySelector('.clam-shell').getBoundingClientRect();
  const hit = (r) => r.width > 0 && r.height > 0 && !(r.right <= m.left || r.left >= m.right || r.bottom <= m.top || r.top >= m.bottom);
  const others = [...document.querySelectorAll('.jar')].filter((j) => j !== el).map((j) => j.querySelector('.glass').getBoundingClientRect());
  const tb = document.querySelector('.toolbar')?.getBoundingClientRect();
  const g = el.querySelector('.glass').getBoundingClientRect();
  return {
    pill: { w: Math.round(m.width), h: Math.round(m.height) }, jarW: Math.round(el.getBoundingClientRect().width), fontPx: getComputedStyle(el.querySelector('.clam-shell b')).fontSize,
    pillInsideShell: m.left >= s.left - 1 && m.right <= s.right + 1 && m.top >= s.top && m.bottom <= s.bottom,
    shellCoversGlass: s.left <= g.left && s.right >= g.right && s.bottom >= g.bottom - 1 && s.top <= g.top,
    overlapsOtherJars: others.some(hit), overlapsToolbar: tb ? hit(tb) : false,
  };
});
/** A close-up box round jar `i`. */
const around = (p, i) => p.$eval(`.jar[data-index="${i}"]`, (el) => { const r = el.getBoundingClientRect(); return { x: Math.max(0, r.left - 30), y: Math.max(0, r.top - 30), width: r.width + 60, height: r.height + 60 }; });

/** The Jar guide from Settings: opens at the top, Got it pinned in view and focused; then its end. */
async function guide(p, tag) {
  await p.click('#btn-settings', { force: true }); await w(p, 400);
  await p.click('#btn-guide', { force: true }); await w(p, 600);
  const g = await p.evaluate(() => {
    const card = document.querySelector('#intro .cabinet-card');
    const title = document.querySelector('#intro-title').getBoundingClientRect();
    const ok = document.querySelector('#btn-intro-ok').getBoundingClientRect();
    return {
      entries: [...document.querySelectorAll('#intro-list h2')].map((h) => h.textContent), scrollTop: card.scrollTop, scrollable: card.scrollHeight > card.clientHeight,
      titleInView: title.top >= 0 && title.bottom <= innerHeight, okInView: ok.top >= 0 && ok.bottom <= innerHeight, okFocused: document.activeElement?.id === 'btn-intro-ok',
    };
  });
  await p.screenshot({ path: path.join(out, `09-jar-guide-top-${tag}.png`) });
  await p.locator('#intro-list .mini-jar.clam').scrollIntoViewIfNeeded(); await w(p, 300);
  g.okInViewAtEnd = await p.evaluate(() => { const ok = document.querySelector('#btn-intro-ok').getBoundingClientRect(); return ok.top >= 0 && ok.bottom <= innerHeight; });
  await p.screenshot({ path: path.join(out, `10-jar-guide-end-${tag}.png`) });
  return g;
}

(async () => {
  const b = await chromium.launch();
  const px = devices['Pixel 7'];

  // 1. Midday, full motion: the intro card, the shell at 6, a few pours, refusals, the opening, Undo, the guide.
  {
    const { ctx, p } = await open(b, px);
    R.introShown = await p.locator('#intro').isVisible();
    R.introText = (await p.textContent('#intro-list')).replace(/\s+/g, ' ').trim();
    await p.screenshot({ path: path.join(out, '01-intro-card-181.png') });
    await closeIntro(p);
    R.seenAfterIntro = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).seenMechanics, KEY);
    const c0 = await clam(p);
    const ci = c0.index;
    R.start = c0;
    R.colourNames = await colourNames(p);
    R.startLabelHidesSand = R.colourNames.every((n) => !c0.label.includes(n)) && !c0.label.includes('buried');
    R.clearanceMidday = await clearance(p);
    await p.screenshot({ path: path.join(out, '02-board-clam-6.png') });
    await p.screenshot({ path: path.join(out, '02b-clam-6-closeup.png'), clip: await around(p, ci) });
    // A tap on the closed clam, nothing lifted: refused, with its message.
    await tap(p, ci);
    R.tapRefused = { toast: await toast(p), selected: await p.$$eval('.jar.selected', (els) => els.length) };
    await p.screenshot({ path: path.join(out, '04-tap-refused.png') });
    await w(p, 2800);
    // Three hinted pours count it down to 3.
    R.pours = [];
    for (let k = 0; k < 3; k++) { const m = await hintPour(p); await settle(p, 1300); R.pours.push({ move: m, clam: await clam(p, ci) }); }
    await p.screenshot({ path: path.join(out, '03-after-3-pours-clam-3.png') });
    // A pour into it, from a jar that could take one elsewhere: refused, with its message.
    const from = (await jars(p)).find((j) => j.liftable && j.index !== ci);
    await tap(p, from.index); await tap(p, ci);
    R.pourRefused = { from: from.index, toast: await toast(p), clamAfter: await clam(p, ci) };
    await w(p, 150);
    await p.screenshot({ path: path.join(out, '05-pour-in-refused.png') });
    await deselect(p); await w(p, 2800);
    // Two more pours to 1 (the pill takes the accent), then the opening pour: caught half way, paused.
    for (let k = 0; k < 2; k++) { await hintPour(p); await settle(p, 1300); }
    R.atOne = await clam(p, ci);
    await p.screenshot({ path: path.join(out, '06-clam-1-accent.png'), clip: await around(p, ci) });
    R.openingMove = await hintPour(p);
    await p.waitForFunction((ms) => document.getAnimations().some((a) => a.effect && a.effect.getTiming().duration === ms && a.currentTime > a.effect.getTiming().delay + ms * 0.42), OPEN_MS, { polling: 'raf', timeout: 5000 });
    R.midOpening = await p.evaluate((ms) => { const as = document.getAnimations(); as.forEach((a) => a.pause()); return as.filter((a) => a.effect.getTiming().duration === ms).length; }, OPEN_MS);
    R.midOpeningJar = await clam(p, ci);
    await p.screenshot({ path: path.join(out, '07-opening-mid-paused.png') });
    await p.screenshot({ path: path.join(out, '07b-opening-mid-closeup.png'), clip: await around(p, ci) });
    await p.evaluate(() => document.getAnimations().forEach((a) => a.play()));
    await settle(p, 1400);
    R.opened = await clam(p, ci);
    R.openedAnnounce = await p.textContent('#announce');
    await p.screenshot({ path: path.join(out, '08-opened.png') });
    await p.screenshot({ path: path.join(out, '08b-opened-closeup.png'), clip: await around(p, ci) });
    // Undo (Z) closes it again, at 1, its sand hidden again.
    await p.keyboard.press('z'); await settle(p, 900);
    R.afterUndo = await clam(p, ci);
    R.afterUndoHidesSand = R.colourNames.every((n) => !R.afterUndo.label.includes(n));
    await p.screenshot({ path: path.join(out, '08c-after-undo-closed-1.png') });
    await w(p, 3000);
    R.errors = p.errors;
    R.guidePixel7 = await guide(p, 'pixel7');
    R.errorsGuide = p.errors;
    await ctx.close();
  }

  // 2. Moonlit tide (a dark scene).
  {
    const { ctx, p } = await open(b, px, { save: seed({ seenMechanics: seen, themes: { owned: ['midday', 'moonlit'], selected: 'moonlit', auto: false } }) });
    await closeIntro(p);
    R.clearanceMoonlit = await clearance(p);
    await p.screenshot({ path: path.join(out, '11-moonlit.png') });
    await p.screenshot({ path: path.join(out, '11b-moonlit-closeup.png'), clip: await around(p, (await clam(p)).index) });
    R.errorsMoonlit = p.errors;
    await ctx.close();
  }

  // 3. 150% text on 320 x 568: the intro card, the board, the Jar guide.
  {
    const { ctx, p } = await open(b, SMALL, { big: true });
    await p.screenshot({ path: path.join(out, '12-320-150-intro.png') });
    await closeIntro(p);
    R.clearance320 = await clearance(p);
    R.pageOverflow320 = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await p.screenshot({ path: path.join(out, '13-320-150-board.png') });
    await p.screenshot({ path: path.join(out, '13b-320-150-closeup.png'), clip: await around(p, (await clam(p)).index) });
    R.guide320 = await guide(p, '320-150');
    R.errors320 = p.errors;
    await ctx.close();
  }

  // 4. Reduced motion: the clam opens with no motion (the open jar is simply drawn).
  {
    const { ctx, p } = await open(b, px, { save: seed({ seenMechanics: seen }), reduced: true });
    await closeIntro(p);
    const ci = (await clam(p)).index;
    for (let k = 0; k < 5; k++) { await hintPour(p); await settle(p, 900); }
    await hintPour(p);
    let maxOpening = 0;
    for (let k = 0; k < 20; k++) { maxOpening = Math.max(maxOpening, await p.evaluate((ms) => document.getAnimations().filter((a) => a.effect && a.effect.getTiming().duration === ms).length, OPEN_MS)); await w(p, 50); }
    await settle(p, 600);
    R.reduced = { openingAnimations: maxOpening, jar: await clam(p, ci), announce: await p.textContent('#announce') };
    await p.screenshot({ path: path.join(out, '14-reduced-motion-opened.png') });
    R.errorsReduced = p.errors;
    await ctx.close();
  }

  // 5. A win on level 181 with hints.
  {
    const { ctx, p } = await open(b, px, { save: seed({ seenMechanics: seen }) });
    await closeIntro(p);
    let pours = 0;
    while (pours < 150 && !(await p.locator('#win').isVisible())) {
      try { await hintPour(p); } catch { break; }
      pours++;
      await settle(p, 1300);
    }
    R.win = { pours, shown: await p.locator('#win').isVisible(), errors: p.errors };
    await w(p, 800);
    await p.screenshot({ path: path.join(out, '15-win-181.png') });
    await ctx.close();
  }

  await b.close();
  R.pageErrors = [R.errors, R.errorsGuide, R.errorsMoonlit, R.errors320, R.errorsReduced, R.win.errors].flat().length;
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
})();
