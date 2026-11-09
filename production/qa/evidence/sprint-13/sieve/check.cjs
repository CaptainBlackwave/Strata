// Sprint 13 M2: the sieve jar in the browser (design/gdd/jar-mechanics.md 2.5, D96).
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5534 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base = 'http://localhost:5534/', out = __dirname] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const SMALL = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const w = (p, ms) => p.waitForTimeout(ms);
const R = {};

function seed(over = {}) {
  return {
    tutorialDone: true, level: 141, seenWhatsNew: VERSION, seenMechanics: ['narrow', 'frozen', 'locked', 'funnel', 'hourglass'],
    onboarding: { visits: 1, installShown: true, offlineNoticed: true },
    settings: { sound: false, music: false, haptics: false, patterns: false },
    wallet: { coins: 100, boosters: { hint: 99 } }, ...over,
  };
}
const seen = ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve'];

/** A page on level 141's board, seeded once per context; the intro card is left open. */
async function open(b, opts, { save = seed(), big = false } = {}) {
  const ctx = await b.newContext({ ...opts, reducedMotion: 'no-preference' });
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

/** Every jar as the DOM shows it: top colour (null when buried or empty), units, marks; and the sieve. */
const jars = (p) => p.evaluate(() => [...document.querySelectorAll('.jar')].map((el) => {
  const units = [...el.querySelectorAll('.sand .unit')];
  const top = units.at(-1);
  const band = el.querySelector('.sieve-band');
  return {
    index: Number(el.dataset.index), units: units.length,
    top: top && !top.classList.contains('buried') ? top.style.getPropertyValue('--c') : null,
    sieve: el.classList.contains('sieve'), band: el.classList.contains('sieve') ? band.style.getPropertyValue('--band') : null,
    bandClass: band.className, label: el.getAttribute('aria-label'),
    liftable: units.length > 0 && !['sealed', 'frozen', 'locked', 'funnel'].some((c) => el.classList.contains(c)),
  };
}));
const toast = (p) => p.evaluate(() => document.querySelector('.toast.show, #toast.show')?.textContent ?? null);

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

/** The band's box against the other marks of its jar and the neighbouring jars. */
const clearance = (p) => p.evaluate(() => {
  const el = document.querySelector('.jar.sieve');
  const m = el.querySelector('.sieve-band').getBoundingClientRect();
  const hit = (r) => r.width > 0 && r.height > 0 && !(r.right <= m.left || r.left >= m.right || r.bottom <= m.top || r.top >= m.bottom);
  const marks = [...el.querySelectorAll('.padlock, .funnel-mark, .hint-badge, .hourglass-mark')].filter((x) => getComputedStyle(x).display !== 'none');
  const others = [...document.querySelectorAll('.jar')].filter((j) => j !== el).map((j) => j.getBoundingClientRect());
  return { band: { w: Math.round(m.width), h: Math.round(m.height) }, jarW: Math.round(el.getBoundingClientRect().width), overlapsMarks: marks.some((x) => hit(x.getBoundingClientRect())), overlapsOtherJars: others.some(hit) };
});

(async () => {
  const b = await chromium.launch();
  const px = devices['Pixel 7'];

  // 1. Midday: the intro card, the board, a refused pour, a correct pour in, the Jar guide.
  {
    const { ctx, p } = await open(b, px);
    R.introShown = await p.locator('#intro').isVisible();
    R.introText = (await p.textContent('#intro-list')).replace(/\s+/g, ' ').trim();
    await p.screenshot({ path: path.join(out, '01-intro-card-141.png') });
    await closeIntro(p);
    R.seenAfterIntro = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).seenMechanics, KEY);
    let js = await jars(p);
    const s = js.find((j) => j.sieve);
    R.sieve = s;
    R.clearanceMidday = await clearance(p);
    await p.screenshot({ path: path.join(out, '02-board-sieve.png') });
    // A wrong colour into the sieve: refused, with its message.
    const wrong = js.find((j) => !j.sieve && j.liftable && j.top && j.top !== s.band);
    await tap(p, wrong.index); await tap(p, s.index);
    R.refused = { from: wrong.index, to: s.index, toast: await toast(p), unitsAfter: (await jars(p)).find((j) => j.sieve).units };
    await w(p, 150);
    await p.screenshot({ path: path.join(out, '03-refused-wrong-colour.png') });
    // Clear the selection the refusal left, then wait for the toast to go.
    for (const j of await p.$$eval('.jar.selected', (els) => els.map((e) => Number(e.dataset.index)))) await tap(p, j);
    await w(p, 2800);
    // A correct colour in: hint pours until one jar's top is the band and the sieve can take it.
    let right = null;
    for (let k = 0; k < 30 && !right; k++) {
      js = await jars(p);
      const sv = js.find((j) => j.sieve);
      if (sv.units < 4 && (sv.top === null ? sv.units === 0 : sv.top === sv.band)) right = js.find((j) => !j.sieve && j.liftable && j.top === sv.band);
      if (!right) { await hintPour(p); await settle(p, 1300); }
    }
    if (right) {
      const before = (await jars(p)).find((j) => j.sieve).units;
      await tap(p, right.index); await tap(p, s.index); await settle(p, 1400);
      const after = (await jars(p)).find((j) => j.sieve);
      R.pouredIn = { from: right.index, before, after: after.units, label: after.label, announce: await p.textContent('#announce') };
      await p.screenshot({ path: path.join(out, '04-correct-pour-in.png') });
    } else R.pouredIn = null;
    // An empty sieve tapped with nothing selected explains itself too (checked only if it is empty).
    R.errors = p.errors;
    await w(p, 2800);
    await p.click('#btn-settings', { force: true }); await w(p, 400);
    await p.click('#btn-guide', { force: true }); await w(p, 500);
    R.guideHasSieve = (await p.textContent('#intro-list')).includes('Sieve jar');
    await p.locator('#intro-list .mini-jar.sieve').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(out, '05-jar-guide.png') });
    R.errorsGuide = p.errors;
    await ctx.close();
  }

  // 2. Moonlit (a dark scene).
  {
    const { ctx, p } = await open(b, px, { save: seed({ seenMechanics: seen, themes: { owned: ['midday', 'moonlit'], selected: 'moonlit', auto: false } }) });
    await closeIntro(p);
    R.clearanceMoonlit = await clearance(p);
    await p.screenshot({ path: path.join(out, '06-moonlit.png') });
    R.errorsMoonlit = p.errors;
    await ctx.close();
  }

  // 3. Colour patterns on.
  {
    const { ctx, p } = await open(b, px, { save: seed({ seenMechanics: seen, settings: { sound: false, music: false, haptics: false, patterns: true } }) });
    await closeIntro(p);
    R.patternBand = (await jars(p)).find((j) => j.sieve).bandClass;
    await p.screenshot({ path: path.join(out, '07-patterns-on.png') });
    const box = await p.$eval('.jar.sieve', (el) => { const r = el.getBoundingClientRect(); return { x: r.left - 30, y: r.top - 30, width: r.width + 60, height: r.width + 40 }; });
    await p.screenshot({ path: path.join(out, '08-patterns-on-closeup.png'), clip: box });
    R.errorsPatterns = p.errors;
    await ctx.close();
  }

  // 3b. Jar styles worn (amber glass, brass cork, glint sand): the band keeps its colour and place.
  {
    const styles = { owned: ['glass:amber', 'cork:brass', 'sand:glint'], worn: { glass: 'amber', cork: 'brass', sand: 'glint' } };
    const { ctx, p } = await open(b, px, { save: seed({ seenMechanics: seen, styles }) });
    await closeIntro(p);
    R.stylesWorn = await p.evaluate(() => { const bd = document.querySelector('#board'); return { glass: bd?.dataset.glass, cork: bd?.dataset.cork, sand: bd?.dataset.sand }; });
    R.clearanceStyles = await clearance(p);
    await p.screenshot({ path: path.join(out, '09-styles-amber-brass-glint.png') });
    R.errorsStyles = p.errors;
    await ctx.close();
  }

  // 4. 150% text on 320 x 568.
  {
    const { ctx, p } = await open(b, SMALL, { big: true });
    await p.screenshot({ path: path.join(out, '10-320-150-intro.png') });
    await closeIntro(p);
    R.clearance320 = await clearance(p);
    R.pageOverflow320 = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await p.screenshot({ path: path.join(out, '11-320-150-board.png') });
    R.errors320 = p.errors;
    await ctx.close();
  }

  // 5. A win on level 141 with hints.
  {
    const { ctx, p } = await open(b, px, { save: seed({ seenMechanics: seen }) });
    await closeIntro(p);
    let pours = 0;
    let sealedSieve = false;
    while (pours < 120 && !(await p.locator('#win').isVisible())) {
      try { await hintPour(p); } catch { break; }
      pours++;
      await settle(p, 1300);
      // An empty sieve, tapped with nothing lifted, explains its band too.
      if (!R.emptyTap && (await jars(p)).some((j) => j.sieve && j.units === 0) && !(await p.$('.jar.selected'))) {
        await w(p, 2700);
        await tap(p, (await jars(p)).find((j) => j.sieve).index);
        R.emptyTap = await toast(p);
      }
      if (!sealedSieve && (await p.$('.jar.sieve.sealed'))) {
        sealedSieve = true;
        await p.screenshot({ path: path.join(out, '12-sieve-sealed.png') });
      }
    }
    R.win = { pours, shown: await p.locator('#win').isVisible(), sealedSieve, errors: p.errors };
    await w(p, 800);
    await p.screenshot({ path: path.join(out, '13-win-141.png') });
    await ctx.close();
  }

  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
})();
