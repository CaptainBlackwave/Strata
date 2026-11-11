// Sprint 14 H4 (sharing §3.4): Share at milestones on the win card, in the production build.
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5543 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const NOW = new Date('2026-11-12T12:00:00Z'); // Thursday of 2026-W46
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const SEEN = { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const w = (p, ms) => p.waitForTimeout(ms);
const R = {};

/** A page with `save`; `share` fakes a phone share sheet ('files', 'text' or none). */
async function page(b, save, ctxOpts, { share = null, big = false } = {}) {
  const ctx = await b.newContext({ ...ctxOpts, reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(NOW);
  if (!share) await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: new URL(base).origin });
  await ctx.addInitScript(([k, v, share, big]) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); }
    if (big) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });
    if (share) {
      navigator.share = async (d) => { window.__shared = { text: d.text, files: (d.files || []).map((f) => ({ name: f.name, type: f.type, size: f.size })) }; };
      navigator.canShare = (d) => share === 'files' && !!d.files;
    } else { delete Navigator.prototype.share; delete Navigator.prototype.canShare; }
  }, [KEY, JSON.stringify(save), share, big]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base); await w(p, 900);
  return { ctx, p };
}
async function winWithHints(p) {
  for (let i = 0; i < 400; i++) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.keyboard.press('h'); await w(p, 60);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await w(p, 200); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await w(p, 340);
  }
  if (!(await p.locator('#win:not([hidden])').count())) await p.screenshot({ path: path.join(out, 'debug-no-win.png') });
  await p.waitForSelector('#win:not([hidden])'); await w(p, 600);
}
/** Saves the preview picture as a PNG and returns its size. */
async function savePicture(p, name) {
  const data = await p.evaluate(async () => {
    const img = document.getElementById('share-card-img');
    for (let i = 0; i < 40 && !img.src.startsWith('blob:'); i++) await new Promise((r) => setTimeout(r, 50));
    await img.decode();
    const blob = await (await fetch(img.src)).blob();
    return new Promise((r) => { const f = new FileReader(); f.onload = () => r({ url: f.result, w: img.naturalWidth, h: img.naturalHeight, alt: img.alt }); f.readAsDataURL(blob); });
  });
  fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(data.url.split(',')[1], 'base64'));
  return { width: data.w, height: data.h, alt: data.alt };
}
const shot = (p, name) => p.screenshot({ path: path.join(out, `${name}.png`) });
// Plenty of hints, so the run can follow them to a win.
const base0 = { boards: 2, wallet: { coins: 99999, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 999 } }, seenWhatsNew: VERSION, settings: QUIET, tutorialDone: true, level: 30, onboarding: SEEN };

(async () => {
  const b = await chromium.launch();
  const px = devices['Pixel 7'];
  // 1. A daily that reaches a 30-day streak and finds the last Tide Pool shell: two moments.
  {
    const save = { ...base0, daily: { last: '2026-11-11', streak: 29, best: 29, passes: 0 }, shells: ['periwinkle', 'limpet', 'cockle', 'mussel'] };
    const { ctx, p } = await page(b, save, px, { share: 'files' });
    await p.click('#btn-daily', { force: true }); await w(p, 900);
    await winWithHints(p);
    R.daily = await p.evaluate(() => ({
      rows: [...document.querySelectorAll('#win .win-shell:not([hidden])')].map((r) => ({ text: r.textContent.trim(), share: r.querySelector('.moment-share')?.getAttribute('aria-label') ?? null })),
    }));
    await shot(p, '1-daily-win-streak-and-set');
    const btns = p.locator('#win .moment-share');
    R.daily.buttons = await btns.count();
    if (R.daily.buttons) {
      await btns.first().click({ force: true }); await w(p, 900);
      R.daily.firstPicture = await savePicture(p, 'card-moment-first');
      await shot(p, '2-moment-share-sheet');
      await p.click('#btn-share-send', { force: true }); await w(p, 500);
      R.daily.firstSent = await p.evaluate(() => window.__shared);
      await p.keyboard.press('Escape'); await w(p, 300);
      if (R.daily.buttons > 1) {
        await btns.nth(1).click({ force: true }); await w(p, 900);
        R.daily.secondPicture = await savePicture(p, 'card-moment-second');
        await p.click('#btn-share-send', { force: true }); await w(p, 500);
        R.daily.secondSent = await p.evaluate(() => window.__shared);
      }
    }
    R.daily.errors = p.errors; await ctx.close();
  }
  // 2. A level win: only what it earned (here two badges) gets a Share; no streak row off the daily.
  {
    const { ctx, p } = await page(b, { ...base0, badges: ['firstSeal', 'jarStacker'] }, px, { share: 'files' });
    await p.click('#btn-play', { force: true }); await w(p, 900);
    if (await p.locator('#btn-map-play:visible').count()) { await p.click('#btn-map-play', { force: true }); await w(p, 900); }
    await winWithHints(p);
    R.level = { buttons: await p.locator('#win .moment-share').count() };
    await shot(p, '3-level-win-badge-share');
    R.level.errors = p.errors; await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R, null, 1));
})();
