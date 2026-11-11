// Sprint 14 H2 (sharing §3.1): the share preview and picture in the production build.
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5541 --strictPort`)
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
const base0 = { wallet: { coins: 99999, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 999 } }, seenWhatsNew: VERSION, settings: QUIET, tutorialDone: true, level: 30, onboarding: SEEN, profile: { name: 'Saffron Gull 42', avatar: 'sand-jar', frame: 'sand', plate: '' } };

(async () => {
  const b = await chromium.launch();
  const px = devices['Pixel 7'];

  // 1. Daily, Midday, a phone that shares files: the sheet, the picture with and without the name, then Share.
  {
    const { ctx, p } = await page(b, base0, px, { share: 'files' });
    await p.click('#btn-daily', { force: true }); await w(p, 900);
    await winWithHints(p);
    await p.click('#btn-share', { force: true }); await w(p, 900);
    R.dailySheetOpen = await p.locator('#share-sheet:not([hidden])').count() === 1;
    R.nameStartsOff = !(await p.isChecked('#share-name'));
    R.dailyPicture = await savePicture(p, 'card-daily-midday');
    await shot(p, 'sheet-daily-pixel7');
    await p.click('#share-name', { force: true }); await w(p, 700);
    R.dailyPictureNamed = await savePicture(p, 'card-daily-midday-name-on');
    await p.click('#btn-share-send', { force: true }); await w(p, 500);
    R.filesShare = { status: await p.textContent('#share-sheet-status'), sent: await p.evaluate(() => window.__shared) };
    await p.keyboard.press('Escape'); await w(p, 300);
    R.escapeCloses = await p.locator('#share-sheet[hidden]').count() === 1;
    R.focusBackOnShare = await p.evaluate(() => document.activeElement && document.activeElement.id);
    R.dailyErrors = p.errors; await ctx.close();
  }
  // 2. Weekly from Home in Moonlit tide with Colour patterns on; a browser with no share sheet copies the text.
  {
    const save = { ...base0, settings: { ...QUIET, patterns: true }, themes: { owned: ['midday', 'moonlit'], selected: 'moonlit', auto: false }, weekly: { week: '2026-W46', cleared: [0, 1, 3], pours: { 0: 31, 1: 40, 3: 52 } } };
    const { ctx, p } = await page(b, save, px);
    await p.click('#btn-weekly', { force: true }); await w(p, 700);
    R.weeklyShareShown = await p.locator('#btn-weekly-share:not([hidden])').count() === 1;
    if (R.weeklyShareShown) {
      await p.click('#btn-weekly-share', { force: true }); await w(p, 900);
      R.weeklyPicture = await savePicture(p, 'card-weekly-moonlit-patterns');
      await shot(p, 'sheet-weekly-moonlit');
      await p.click('#btn-share-send', { force: true }); await w(p, 500);
      R.clipboardShare = { status: await p.textContent('#share-sheet-status'), copied: await p.evaluate(() => navigator.clipboard.readText()) };
    }
    R.weeklyErrors = p.errors; await ctx.close();
  }
  // 3. Small phone at 150% text: the sheet still fits and scrolls.
  {
    const { ctx, p } = await page(b, base0, { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, { share: 'text', big: true });
    await p.click('#btn-daily', { force: true }); await w(p, 900);
    await winWithHints(p);
    await p.click('#btn-share', { force: true }); await w(p, 900);
    await shot(p, 'sheet-320-150');
    await p.locator('#btn-share-send').scrollIntoViewIfNeeded(); await shot(p, 'sheet-320-150-scrolled');
    await p.click('#btn-share-send', { force: true }); await w(p, 500);
    R.textShare = { status: await p.textContent('#share-sheet-status'), sent: await p.evaluate(() => window.__shared) };
    R.smallErrors = p.errors; await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R, null, 1));
})();
