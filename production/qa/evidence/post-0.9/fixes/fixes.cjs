// Post-0.9 fixes: the late write between tabs (D57), the "New" shell mark after a reload (UX-cab-4),
// the booster price badge at 150% text, and the map title at 150% text on 320 px.
// usage: node fixes.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const save = (o = {}) => ({ level: 3, best: { 1: 9, 2: 10 }, wallet: { coins: 500, boosters: { undo: 0, shuffle: 0, extraJar: 0, hint: 0 } }, tutorialDone: true, settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: ['periwinkle'], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false }, seenWhatsNew: '0.9.0', ...o });
const w = (p, ms) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch(); const errors = []; const R = {};
  const watch = (p, tag) => { p.on('pageerror', (e) => errors.push(tag + ': ' + e)); p.on('console', (m) => m.type() === 'error' && errors.push(tag + ': ' + m.text())); };
  // 1. Late write: A is open on level 3; B opens; A's write lands just after B's claim.
  {
    const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    const A = await ctx.newPage(); watch(A, 'A');
    await A.goto(base); await A.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(save())]); await A.reload(); await w(A, 600);
    const B = await ctx.newPage(); watch(B, 'B');
    await B.goto(base); await w(B, 300);
    // The write A's win would have made had it not heard B's claim yet (level 3 cleared, now on 4).
    await A.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); s.level = 4; s.best['3'] = 12; s.wallet.coins += 25; localStorage.setItem(k, JSON.stringify(s)); }, KEY);
    await w(B, 600);
    R.lateWrite = { bPlay: (await B.textContent('#btn-play')).trim(), aOverlay: await A.locator('#other-tab:not([hidden])').count() === 1 };
    await B.click('#btn-play', { force: true }); await w(B, 500); await B.click('#btn-map-play', { force: true }); await w(B, 800);
    const stored = await B.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
    R.lateWrite.afterBStarts = { level: stored.level, best3: stored.best['3'], coins: stored.wallet.coins, hud: (await B.textContent('.hud')).replace(/\s+/g, ' ').trim().slice(0, 30) };
    R.lateWrite.ok = stored.level === 4 && stored.best['3'] === 12 && /Level 4/.test(R.lateWrite.afterBStarts.hud);
    await ctx.close();
  }
  // 2. "New" shell mark survives a reload: a save that has seen 1 of 2 shells.
  {
    const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    const p = await ctx.newPage(); watch(p, 'new');
    await p.goto(base); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(save({ level: 6, shells: ['periwinkle', 'limpet'], seenShells: 1 }))]); await p.reload(); await w(p, 600);
    await p.click('#btn-shells', { force: true }); await w(p, 400);
    const marks = await p.$$eval('#cabinet .shell-new', (els) => els.map((e) => e.closest('[aria-label],li,div')?.getAttribute('aria-label') || e.parentElement.textContent.trim()));
    await p.screenshot({ path: path.join(out, 'cabinet-new-after-reload.png') });
    await p.keyboard.press('Escape'); await w(p, 200); await p.reload(); await w(p, 600);
    await p.click('#btn-shells', { force: true }); await w(p, 400);
    R.newMark = { firstOpen: marks.length, afterReopenAndReload: await p.locator('#cabinet .shell-new').count(), seenShells: await p.evaluate((k) => JSON.parse(localStorage.getItem(k)).seenShells, KEY) };
    await ctx.close();
  }
  // 3. Price badges and the map title at 150% text on a 320 px screen.
  {
    const ctx = await b.newContext({ ...devices['iPhone SE'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; }));
    const p = await ctx.newPage(); watch(p, 'big');
    await p.goto(base); await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, JSON.stringify(save({ level: 60, best: Object.fromEntries(Array.from({ length: 59 }, (_, i) => [i + 1, 30])) }))]); await p.reload(); await w(p, 600);
    await p.click('#btn-play', { force: true }); await w(p, 600);
    const title = await p.$eval('#map-title', (e) => ({ text: e.textContent, lines: Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)), px: getComputedStyle(e).fontSize }));
    await p.screenshot({ path: path.join(out, 'map-title-se-150.png') });
    // The scenery label must be the top element at its centre, not the path drawn over it.
    // Both ignore pointer events, so hit-testing skips them; turn that off while measuring.
    const labelOnTop = await p.evaluate(() => {
      const hit = [...document.querySelectorAll('.band-name, .map-path, .map-path *')];
      hit.forEach((e) => (e.style.pointerEvents = 'auto'));
      const res = [...document.querySelectorAll('.band-name')].filter((e) => { const r = e.getBoundingClientRect(); return e.textContent && r.height && r.bottom > 0 && r.top < innerHeight; }).map((e) => {
        const r = e.getBoundingClientRect(); const hits = [0.15, 0.3, 0.5, 0.7, 0.85].map((f) => document.elementFromPoint(r.left + r.width * f, r.top + r.height / 2));
        return { text: e.textContent, onTop: hits.every((h) => h === e || e.contains(h)) };
      });
      hit.forEach((e) => (e.style.pointerEvents = ''));
      return res;
    });
    await p.click('#btn-map-play', { force: true }); await w(p, 900);
    // The badge box keeps its height when its content wraps, so measure the text itself: its lines and its lowest pixel.
    const badges = await p.$$eval('.tool .badge.price', (els) => els.filter((e) => e.offsetParent).map((e) => {
      const range = document.createRange(); range.selectNodeContents(e);
      const rects = [...range.getClientRects()].filter((r) => r.width > 0);
      const lines = new Set(rects.map((r) => Math.round(r.top))).size;
      const textBottom = Math.max(...rects.map((r) => r.bottom));
      const name = e.parentElement.querySelector('.tool-name').getBoundingClientRect();
      return { text: e.textContent, lines, textOverName: textBottom > name.top };
    }));
    await p.screenshot({ path: path.join(out, 'price-badges-se-150.png') });
    R.big = { title, badges, labelOnTop };
    await ctx.close();
  }
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
  await b.close();
})();
