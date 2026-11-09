// TD-8 check: node production/qa/evidence/post-0.9/td8/td8-check.cjs  (run from the repo root)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execSync, spawn } = require('node:child_process');
const fs = require('node:fs');
const OUT = 'production/qa/evidence/post-0.9/td8';
const URL = 'http://localhost:5340/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, extra = '') => { results.push({ name, ok, extra }); console.log(ok ? 'PASS' : 'FAIL', name, extra); };
const SAVE = { level: 3, tutorialDone: true, seenWhatsNew: require('../../../../../package.json').version };

async function cacheList(page) {
  return page.evaluate(async () => {
    const out = {};
    for (const k of await caches.keys()) out[k] = (await (await caches.open(k)).keys()).map((r) => new URL(r.url).pathname.replace(/^\/+/, ''));
    return out;
  });
}
async function waitCached(page, n) { // until the page's worker chunk and assets are cached
  for (let i = 0; i < 40; i++) {
    const l = Object.values(await cacheList(page)).flat();
    if (l.some((u) => u.includes('gen-worker')) && l.filter((u) => u.startsWith('assets/')).length >= n) return;
    await sleep(250);
  }
}
async function play(page, shot) {
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.click('#btn-play', { force: true });
  await page.waitForSelector('#btn-map-play', { state: 'attached' });
  await page.click('#btn-map-play', { force: true });
  await sleep(1500);
  if (shot) await page.screenshot({ path: `${OUT}/${shot}` });
  return errors;
}

(async () => {
  execSync('npm run build', { stdio: 'ignore' });
  const srv = spawn('npx', ['vite', 'preview', '--port', '5340', '--strictPort'], { stdio: 'ignore' });
  await sleep(3000);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 780 } });
  const page = await ctx.newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  try {
    await page.goto(URL);
    await page.evaluate((s) => localStorage.setItem('strata.save.v2', JSON.stringify(s)), SAVE);
    await page.reload();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await sleep(500);
    await page.reload(); // now controlled; the navigation fetch caches the page's assets
    await waitCached(page, 3);
    const first = await cacheList(page);
    console.log(JSON.stringify(first));

    // (a) offline reload
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('#btn-play');
    const ea = await play(page, 'a-offline-level.png');
    const jars = await page.evaluate(() => document.querySelectorAll('[class*="jar"]').length);
    check('(a) offline boot, level starts, no errors', ea.length === 0 && errs.length === 0 && jars > 0, `jars=${jars} errors=${errs.length + ea.length}`);
    await ctx.setOffline(false);

    // (c) changed manifest and icon served fresh online
    fs.appendFileSync('dist/icon-192.png', Buffer.from([0, 0, 0, 0]));
    const man = JSON.parse(fs.readFileSync('dist/manifest.webmanifest', 'utf8'));
    man.name = man.name + ' CHANGED';
    fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify(man));
    const got = await page.evaluate(async () => ({
      name: (await (await fetch('./manifest.webmanifest')).json()).name,
      icon: (await (await fetch('./icon-192.png')).arrayBuffer()).byteLength,
    }));
    check('(c) changed manifest and icon served fresh online', got.name === man.name && got.icon === fs.statSync('dist/icon-192.png').size, JSON.stringify(got));
    await ctx.setOffline(true);
    const off = await page.evaluate(async () => (await (await fetch('./manifest.webmanifest')).json()).name);
    check('(c) offline falls back to the last cached manifest', off === man.name, off);
    await ctx.setOffline(false);

    // (b) new deploy: change a source string, rebuild into the same dist/
    const f = 'src/ui/strings.ts';
    const orig = fs.readFileSync(f, 'utf8');
    fs.writeFileSync(f, orig.replace("playTutorial: 'Play',", "playTutorial: 'Play now',"));
    try { execSync('npm run build', { stdio: 'ignore' }); } finally { fs.writeFileSync(f, orig); }
    const newFiles = fs.readdirSync('dist/assets');
    const oldFiles = Object.values(first).flat().filter((u) => u.startsWith('assets/')).map((u) => u.slice(7));
    await page.goto(URL);
    await sleep(1500); await page.reload(); // second load: the new worker may take over
    await waitCached(page, 3); await sleep(1500);
    const second = await cacheList(page);
    const all = Object.values(second).flat().filter((u) => u.startsWith('assets/')).map((u) => u.slice(7));
    const gone = oldFiles.filter((o) => !newFiles.includes(o));
    const stale = all.filter((u) => !newFiles.includes(u));
    const src = await page.evaluate(() => document.querySelector('script[src*="assets/"]').getAttribute('src'));
    check('(b) new page loads (its script is the new build)', newFiles.some((n) => src.endsWith(n)) && !oldFiles.some((o) => o.startsWith('index-') && src.endsWith(o)), src);
    check('(b) old hashed files gone from every cache', gone.length > 0 && stale.length === 0, `replaced=${gone.length} stale=${stale.length} cacheKeys=${Object.keys(second)}`);
    check('(b) new assets cached', newFiles.every((n) => all.includes(n)), `${all.length}/${newFiles.length}`);
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('#btn-play');
    const eb = await play(page, 'b-offline-after-deploy.png');
    check('(b) offline still works after the deploy', eb.length === 0, `errors=${eb.length}`);
    await ctx.setOffline(false);

    // (d) a deploy whose download fails part-way: the new main script never arrives (review of PR #6).
    // The previous version must stay the offline copy: its page and its files.
    fs.writeFileSync(f, orig.replace("playTutorial: 'Play',", "playTutorial: 'Play again',"));
    try { execSync('npm run build', { stdio: 'ignore' }); } finally { fs.writeFileSync(f, orig); }
    const brokenJs = fs.readdirSync('dist/assets').find((n) => n.startsWith('index-') && n.endsWith('.js'));
    await ctx.route(`**/assets/${brokenJs}`, (r) => r.abort());
    await page.goto(URL).catch(() => undefined);
    await sleep(3000); // the new worker's install and the navigation's caching both try, and fail
    const third = await cacheList(page);
    const pageHtml = await page.evaluate(async () => { for (const k of await caches.keys()) { const r = await (await caches.open(k)).match('./'); if (r) return r.text(); } return ''; });
    check('(d) failed download: the cached page is still the previous version', !pageHtml.includes(brokenJs), `caches=${Object.keys(third)}`);
    await ctx.setOffline(true);
    await page.reload().catch(() => undefined);
    const okBoot = await page.waitForSelector('#btn-play', { timeout: 5000 }).then(() => true, () => false);
    const ed = okBoot ? await play(page, 'd-offline-after-failed-update.png') : ['no #btn-play'];
    check('(d) offline still boots and plays after a failed update', okBoot && ed.length === 0, `errors=${ed.length}`);
    await ctx.unroute(`**/assets/${brokenJs}`);
    await ctx.setOffline(false);
    fs.writeFileSync(`${OUT}/cache-before.json`, JSON.stringify(first, null, 1));
    fs.writeFileSync(`${OUT}/cache-after.json`, JSON.stringify(second, null, 1));
  } finally {
    await browser.close(); srv.kill();
    fs.writeFileSync(`${OUT}/results.txt`, results.map((r) => `${r.ok ? 'PASS' : 'FAIL'} ${r.name} ${r.extra}`).join('\n') + '\n');
  }
})().catch((e) => { console.error(e); process.exit(1); });
