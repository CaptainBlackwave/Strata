// Sprint 22 L2-L4 look evidence: splash day/night, hero Realistic vs Classic, a mid-sparkle frame,
// the iPhone install card at 390 and 320/150%. Usage (dev server running): PORT=5186 node production/qa/evidence/sprint-22/look/look.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5186}`;
const shot = (p, name) => p.screenshot({ path: path.join(__dirname, name) });
const save = (extra) => ({ tutorialDone: true, level: 60, seenWhatsNew: '9.9.9', settings: { sound: false, music: false, ...(extra.settings || {}) },
  onboarding: { visits: 9, installAsks: 2, installShown: true }, ...extra, ...(extra.settings ? { settings: { sound: false, music: false, ...extra.settings } } : {}) });
async function ctxWith(browser, s, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block', ...opts });
  await ctx.addInitScript((s) => {
    if (sessionStorage.getItem('s')) return; sessionStorage.setItem('s', '1');
    if (s) localStorage.setItem('strata.save.v2', JSON.stringify(s));
  }, s);
  return ctx;
}
async function home(p, q = '') {
  await p.goto(BASE + '/' + q);
  await p.waitForFunction(() => !document.getElementById('splash') && !document.getElementById('home').hidden);
  await p.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await p.waitForTimeout(800);
}
(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const out = {};
  // L2: the splash, held by blocking the app's scripts.
  for (const [tag, s] of [['day', null], ['night', save({ themes: { owned: ['midday', 'moonlit'], selected: 'moonlit', auto: false } })]]) {
    const ctx = await ctxWith(browser, s);
    const p = await ctx.newPage();
    await p.route(/\/src\//, (r) => r.abort());
    await p.goto(BASE + '/');
    await p.waitForTimeout(400);
    out[`splash-${tag}`] = await p.evaluate(() => ({ bg: getComputedStyle(document.getElementById('splash')).backgroundImage.slice(-60), meta: document.querySelector('meta[name=theme-color]').content }));
    await shot(p, `splash-${tag}.png`);
    await ctx.close();
  }
  // L2 follow-up: the night Home right after, no light frame between.
  { const ctx = await ctxWith(browser, save({ themes: { owned: ['midday', 'moonlit'], selected: 'moonlit', auto: false } }));
    const p = await ctx.newPage(); await home(p); await shot(p, 'home-night.png'); await ctx.close(); }
  // L3: the hero, Realistic vs Classic.
  for (const [tag, q] of [['realistic', '?board=gpu'], ['classic', '?board=dom']]) {
    const ctx = await ctxWith(browser, save({}), { reducedMotion: 'no-preference' });
    const p = await ctx.newPage(); await home(p, q);
    out[`hero-${tag}`] = await p.evaluate(() => document.getElementById('home-hero').dataset.mode);
    await p.locator('#home-hero').screenshot({ path: path.join(__dirname, `hero-${tag}.png`) });
    if (tag === 'realistic') {
      await p.waitForSelector('.hero-sparkle', { timeout: 8000 });
      await p.evaluate(() => { for (const a of document.querySelector('.hero-sparkle').getAnimations()) { a.pause(); a.currentTime = 630; } });
      await p.locator('#home-hero').screenshot({ path: path.join(__dirname, 'hero-sparkle.png') });
      const r = await p.evaluate(() => document.querySelector('.hero-sparkle').getBoundingClientRect().toJSON());
      out.sparkle = r;
      await p.locator('#home-hero').screenshot({ path: path.join(__dirname, 'hero-sparkle.png'), clip: undefined });
    }
    await ctx.close();
  }
  // L4: the iPhone install card.
  const ios = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
  for (const [tag, vw, vh, pct] of [['390', 390, 844, 100], ['320-150', 320, 568, 150]]) {
    const ctx = await ctxWith(browser, save({}), { viewport: { width: vw, height: vh }, userAgent: ios, hasTouch: true, isMobile: true });
    const p = await ctx.newPage(); await home(p, '?board=dom');
    await p.evaluate((x) => { document.documentElement.style.fontSize = x + '%'; }, pct);
    await p.evaluate(async () => { const m = await import('/src/ui/screens/onboarding.ts'); m.openInstall('ios'); });
    await p.waitForTimeout(700);
    out[`install-${tag}`] = await p.evaluate(() => { const c = document.querySelector('#install .install-card') || document.getElementById('install');
      const r = c.getBoundingClientRect(); return { cardH: Math.round(r.height), bottom: Math.round(r.bottom), vh: innerHeight, scroll: c.scrollHeight > c.clientHeight + 1 }; });
    await shot(p, `install-ios-${tag}.png`);
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})();
