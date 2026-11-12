// Sprint 21 A1, A3, A4 (D179): the install card (Android, iPhone, 320px/150%), Settings with
// "Works offline" and Vibration, the update bar after a real worker update, and an offline play-through.
// DEV serves `vite` (no service worker); BUILT serves a copy of `dist/` (the worker runs). SITE is that copy's folder.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const OUT = __dirname;
const DEV = process.env.DEV || 'http://localhost:5183/';
const BUILT = process.env.BUILT || 'http://localhost:5184/';
const SITE = process.env.SITE;
const KEY = 'strata.save.v2';
const NOW = new Date('2026-11-12T10:00:00Z');
const ONB = { visits: 3, installAsks: 0, installLastAsk: null, installed: false, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = (o = {}) => ({ boards: 3, level: 6, tutorialDone: true, seenWhatsNew: '9.9.9', wallet: { coins: 300, boosters: { hint: 99, shuffle: 1, extraJar: 1 } }, settings: { sound: false, music: false, haptics: true, patterns: false, southern: false, realistic: false }, onboarding: { ...ONB, ...(o.onboarding || {}) }, ...o.top });
const r = {};

async function open(browser, url, device, { size, font, saveData, reduced } = {}) {
  const ctx = await browser.newContext({ ...devices[device], ...(size ? { viewport: size } : {}), reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await ctx.clock.setFixedTime(NOW);
  if (saveData) await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, v); sessionStorage.setItem('seeded', '1'); } }, [KEY, JSON.stringify(saveData)]);
  const p = await ctx.newPage();
  await p.goto(url);
  if (font) await p.evaluate((f) => (document.documentElement.style.fontSize = f), font);
  await p.waitForTimeout(600);
  await p.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok').forEach((b) => b.click()));
  return { ctx, p };
}
const fakePrompt = (p) => p.evaluate(() => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = async () => undefined;
  e.userChoice = Promise.resolve({ outcome: 'dismissed' });
  window.dispatchEvent(e);
});
const saved = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)).onboarding, KEY);

(async () => {
  const b = await chromium.launch();
  // ---- A1: the install card ----
  for (const [tag, device, size, font] of [['android', 'Pixel 7'], ['iphone', 'iPhone 13'], ['android-320-150', 'Pixel 7', { width: 320, height: 568 }, '150%'], ['iphone-320-150', 'iPhone 13', { width: 320, height: 568 }, '150%']]) {
    const { ctx, p } = await open(b, DEV, device, { size, font, saveData: save() });
    if (device === 'Pixel 7') await fakePrompt(p);
    await p.waitForTimeout(1300);
    const shown = await p.locator('#install:not([hidden])').count();
    await p.screenshot({ path: `${OUT}/install-${tag}.png` });
    r[`install-${tag}`] = { shown, title: await p.textContent('#install-title'), asks: (await saved(p)).installAsks };
    if (tag === 'iphone') {
      await p.click('#btn-install'); // Got it
      await p.reload(); await p.waitForTimeout(1400);
      r['install-iphone'].again_same_day = await p.locator('#install:not([hidden])').count();
    }
    await ctx.close();
  }
  // Fewer than 5 clears: no card. Standalone: no card. Two asks already: no card.
  for (const [tag, data, init] of [['four-clears', save({ top: { level: 5 } })], ['asked-twice', save({ onboarding: { installAsks: 2, installLastAsk: 0 } })], ['standalone', save(), () => { window.matchMedia = ((m) => (q) => (q.includes('standalone') ? { matches: true, addEventListener() {}, removeEventListener() {} } : m(q)))(window.matchMedia.bind(window)); }]]) {
    const ctx = await b.newContext({ ...devices['iPhone 13'] });
    if (init) await ctx.addInitScript(init);
    await ctx.addInitScript(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(data)]);
    const p = await ctx.newPage();
    await p.goto(DEV); await p.waitForTimeout(1500);
    r[`no-card-${tag}`] = await p.locator('#install:not([hidden])').count();
    await ctx.close();
  }

  // ---- A4 on a phone: zoom and selection rules as computed ----
  {
    const { ctx, p } = await open(b, DEV, 'Pixel 7', { saveData: save({ onboarding: { installAsks: 2 } }) });
    await p.click('#btn-play'); await p.waitForTimeout(900);
    r.nativeFeel = await p.evaluate(() => {
      const cs = (sel) => { const el = document.querySelector(sel); const s = el && getComputedStyle(el); return s && { touchAction: s.touchAction, userSelect: s.userSelect || s.webkitUserSelect, callout: s.webkitTouchCallout ?? 'n/a' }; };
      return { viewport: document.querySelector('meta[name=viewport]').content, themeColor: document.querySelector('meta[name=theme-color]').content, bgTop: getComputedStyle(document.documentElement).getPropertyValue('--bg-top').trim(), board: cs('#board'), jar: cs('.jar'), button: cs('#btn-hint'), body: cs('body') };
    });
    await p.screenshot({ path: `${OUT}/board-pixel7.png` });
    await ctx.close();
  }

  // ---- A3: built game with its service worker ----
  const ready = async (p) => {
    await p.evaluate(() => navigator.serviceWorker.ready);
    if (!(await p.evaluate(() => !!navigator.serviceWorker.controller))) { await p.reload(); await p.waitForTimeout(1200); }
    return p.evaluate(() => !!navigator.serviceWorker.controller);
  };
  for (const [tag, device, reduced, size, font] of [['pixel7', 'Pixel 7', false], ['pixel7-reduced-motion', 'Pixel 7', true], ['320-150', 'Pixel 7', false, { width: 320, height: 568 }, '150%']]) {
    const { ctx, p } = await open(b, BUILT, device, { reduced, size, saveData: save({ onboarding: { installAsks: 2 } }) });
    r[`sw-${tag}`] = await ready(p);
    if (font) await p.evaluate((f) => (document.documentElement.style.fontSize = f), font);
    await p.evaluate(() => document.getElementById('btn-home-settings').click()); await p.waitForTimeout(500);
    await p.evaluate(() => document.querySelector('#settings .sheet-card').scrollTo(0, 9999));
    r[`settings-${tag}`] = await p.evaluate(() => ({ offline: !document.getElementById('offline-status').hidden, vibrationRow: !document.getElementById('set-haptics-row').hidden, checked: document.getElementById('set-haptics').checked, disabled: document.getElementById('set-haptics').disabled, note: !document.getElementById('haptics-help').hidden }));
    await p.screenshot({ path: `${OUT}/settings-${tag}.png` });
    await ctx.close();
  }

  // The update bar: a byte-different worker on the server, then the page returns to the foreground.
  for (const [tag, device, size, font] of [['pixel7', 'Pixel 7'], ['iphone-320-150', 'iPhone 13', { width: 320, height: 568 }, '150%']]) {
    const { ctx, p } = await open(b, BUILT, device, { size, saveData: save({ onboarding: { installAsks: 2 } }) });
    await ready(p);
    if (font) await p.evaluate((f) => (document.documentElement.style.fontSize = f), font);
    const sw = fs.readFileSync(`${SITE}/sw.js`, 'utf8');
    fs.writeFileSync(`${SITE}/sw.js`, sw.replace(/const BUILD_ID = '([^']*)'/, (m, id) => `const BUILD_ID = '${id}-${tag}'`));
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await p.waitForSelector('#update-bar:not([hidden])', { timeout: 20000 }).catch(() => undefined);
    const bar = await p.locator('#update-bar:not([hidden])').count();
    await p.screenshot({ path: `${OUT}/update-bar-${tag}.png` });
    r[`update-${tag}`] = { bar, text: (await p.textContent('#update-bar'))?.trim() };
    if (bar) {
      const nav = p.waitForEvent('load', { timeout: 10000 }).then(() => true, () => false);
      await p.click('#btn-update');
      r[`update-${tag}`].reloaded = await nav;
      await p.waitForTimeout(800);
      r[`update-${tag}`].barAfter = await p.locator('#update-bar:not([hidden])').count();
    }
    await ctx.close();
  }

  // Offline play-through: first load online, cut the network, reload, play level 6 with hints to the win.
  {
    const { ctx, p } = await open(b, BUILT, 'Pixel 7', { saveData: save({ onboarding: { installAsks: 2 } }) });
    await ready(p);
    await ctx.setOffline(true);
    await p.reload(); await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/offline-home.png` });
    await p.click('#btn-play'); await p.waitForTimeout(1000);
    await p.screenshot({ path: `${OUT}/offline-board.png` });
    let pours = 0;
    for (let i = 0; i < 80 && !(await p.locator('#win:not([hidden])').count()); i++) {
      await p.click('#btn-hint'); await p.waitForTimeout(350);
      const from = p.locator('.jar.hint-from'), to = p.locator('.jar.hint-to');
      if (!(await from.count()) || !(await to.count())) { await p.waitForTimeout(400); continue; }
      await from.first().click(); await p.waitForTimeout(120);
      await to.first().click(); await p.waitForTimeout(700);
      pours++;
    }
    await p.waitForTimeout(1200);
    r.offline = { pours, won: await p.locator('#win:not([hidden])').count(), online: await p.evaluate(() => navigator.onLine), level: await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).level, KEY) };
    await p.screenshot({ path: `${OUT}/offline-win.png` });
    await ctx.close();
  }
  console.log(JSON.stringify(r, null, 1));
  fs.writeFileSync(`${OUT}/results.json`, JSON.stringify(r, null, 2));
  await b.close();
})();
