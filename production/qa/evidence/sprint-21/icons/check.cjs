// Sprint 21 A2 (D179): every icon, a maskable preview (circle and squircle crops, the 80% safe zone
// drawn), and the splash (the app's script held back so the splash stays up, then released).
// Run with the dev server up: PORT=5181 node production/qa/evidence/sprint-21/icons/check.cjs
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = `http://localhost:${process.env.PORT ?? 5181}/`;
const PUB = path.join(__dirname, '..', '..', '..', '..', '..', 'public');
const out = (f) => path.join(__dirname, f);
const b64 = (f) => 'data:image/png;base64,' + fs.readFileSync(path.join(PUB, f)).toString('base64');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 900, height: 420 }, deviceScaleFactor: 2 });
  const tile = (src, size, label, style = '') => `<figure style="margin:0 12px;text-align:center;font:12px system-ui"><img src="${src}" width="${size}" height="${size}" style="display:block;image-rendering:auto;${style}"><figcaption>${label}</figcaption></figure>`;
  await p.setContent(`<body style="margin:16px;background:#ddd;display:flex;align-items:flex-end;flex-wrap:wrap;gap:12px">
    ${tile(b64('icon-512.png'), 256, 'icon-512')}${tile(b64('icon-192.png'), 192, 'icon-192')}${tile(b64('apple-touch-icon.png'), 180, 'apple-touch-icon 180', 'border-radius:40px')}
    ${tile(b64('favicon-32.png'), 32, 'favicon 32')}${tile('data:image/svg+xml;base64,' + fs.readFileSync(path.join(PUB, 'icon.svg')).toString('base64'), 64, 'icon.svg')}</body>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out('icons-all.png'), fullPage: true });
  const m = b64('icon-maskable-512.png');
  const safe = '<div style="position:absolute;inset:10%;border:2px dashed #e0245e;border-radius:50%"></div>';
  const crop = (r, label) => `<figure style="margin:0 12px;text-align:center;font:12px system-ui"><div style="position:relative;width:256px;height:256px;border-radius:${r};overflow:hidden"><img src="${m}" width="256" height="256" style="display:block">${safe}</div><figcaption>${label}</figcaption></figure>`;
  await p.setContent(`<body style="margin:16px;background:#333;color:#eee;display:flex;gap:12px">
    <figure style="margin:0 12px;text-align:center;font:12px system-ui"><div style="position:relative;width:256px;height:256px"><img src="${m}" width="256" height="256" style="display:block">${safe}</div><figcaption>maskable full (dashed: 80% safe zone)</figcaption></figure>
    ${crop('50%', 'circle')}${crop('28%', 'squircle')}</body>`);
  await p.waitForTimeout(300);
  await p.screenshot({ path: out('maskable-preview.png'), fullPage: true });
  // The splash: hold the app's module so the page stays at its first paint.
  for (const reduced of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    const s = await ctx.newPage();
    let release;
    const held = new Promise((r) => (release = r));
    await s.route(/src\/ui\/main\.ts/, async (route) => { await held; await route.continue(); });
    await s.goto(URL, { waitUntil: 'commit' });
    await s.waitForSelector('#splash', { state: 'attached' }); await s.waitForTimeout(800);
    await s.screenshot({ path: out(reduced ? 'splash-reduced-motion.png' : 'splash.png') });
    release();
    await s.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 15000 });
    await s.waitForTimeout(600);
    if (!reduced) await s.screenshot({ path: out('after-splash.png') });
    await ctx.close();
  }
  await b.close();
  console.log('ok');
})();
