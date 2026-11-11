// No stale releases (owner request after 0.14.1). A local server sends GitHub Pages' header
// (Cache-Control: max-age=600) and swaps release A for release B under a running game.
// usage: node check.cjs <releasesDir> <outDir>
//   <releasesDir> holds a-new, b-new (this build; B has <meta name="strata-release" content="B"> and
//   a new worker stamp) and a-old, b-old (the same with the 0.14.1 worker's plain fetch(req)).
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const [dir, out] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.wav': 'audio/wav' };
let served = 'a-new';
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(dir, served, p);
  if (!file.startsWith(path.join(dir, served)) || !fs.existsSync(file)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'max-age=600' }); // as GitHub Pages
  res.end(fs.readFileSync(file));
});
const KEY = 'strata.save.v2';
const SAVE = { level: 40, boards: 3, tutorialDone: true, seenWhatsNew: require('../../../../package.json').version,
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false },
  onboarding: { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null } };
/** Which release the page shows; retries while the page reloads itself into a new version. */
async function release(p) {
  for (let i = 0; i < 20; i++) {
    try {
      await p.waitForLoadState('load');
      return await p.evaluate(() => (document.querySelector('meta[name="strata-release"]') ? 'B' : 'A'));
    } catch { await p.waitForTimeout(300); }
  }
  return '?';
}
const w = (p, ms) => p.waitForTimeout(ms);

async function controlled(b, base) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v); }, [KEY, JSON.stringify(SAVE)]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base); await p.waitForFunction(() => navigator.serviceWorker.ready.then(() => true));
  await p.reload(); await w(p, 1200); // now controlled by release A's worker
  return { ctx, p };
}

(async () => {
  await new Promise((r) => server.listen(5546, r));
  const base = 'http://localhost:5546/';
  const b = await chromium.launch();
  const R = {};
  // 1. Reopening the game after a deploy, within the 10 minutes: the 0.14.1 worker against this one.
  for (const kind of ['old', 'new']) {
    served = `a-${kind}`;
    const { ctx, p } = await controlled(b, base);
    const before = await release(p);
    await p.close();
    served = `b-${kind}`;
    const again = await ctx.newPage(); // the player opens the game again
    const loads = []; // each page load's release, in order: the first is what reopening gave
    again.on('response', async (r) => {
      if (r.request().isNavigationRequest() && r.request().frame() === again.mainFrame()) loads.push((await r.text().catch(() => '')).includes('strata-release') ? 'B' : 'A');
    });
    await again.goto(base); await w(again, 2500);
    R[`reopen-${kind}-worker`] = { before, firstLoad: loads[0], loads, settled: await release(again) };
    await again.screenshot({ path: path.join(out, `reopen-${kind}-worker.png`) });
    await ctx.close();
  }
  // 2. A game left open on Home: back in the foreground, it picks up B by itself.
  {
    served = 'a-new';
    const { ctx, p } = await controlled(b, base);
    served = 'b-new';
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange'))); // back to the foreground
    await p.waitForFunction(() => !!document.querySelector('meta[name="strata-release"]'), null, { timeout: 15000 }).catch(() => undefined);
    await w(p, 800);
    R.openOnHome = { after: await release(p), onHome: await p.evaluate(() => !document.getElementById('home').hidden), errors: p.errors };
    await p.screenshot({ path: path.join(out, 'open-on-home-updated.png') });
    await ctx.close();
  }
  // 3. A game left open mid-board: it does not reload under the player, and updates once they go Home.
  {
    served = 'a-new';
    const { ctx, p } = await controlled(b, base);
    await p.click('#btn-play', { force: true }); await w(p, 700);
    if (await p.locator('#btn-map-play:visible').count()) { await p.click('#btn-map-play', { force: true }); await w(p, 1000); }
    await p.keyboard.press('h'); await w(p, 300);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (await f.count()) { await f.first().click({ force: true }); await t.first().click({ force: true }); await w(p, 500); }
    const moves = await p.textContent('#moves');
    served = 'b-new';
    await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await w(p, 6000);
    R.midBoard = { moves, stillA: (await release(p)) === 'A', movesKept: (await p.textContent('#moves')) === moves };
    await p.screenshot({ path: path.join(out, 'mid-board-not-interrupted.png') });
    await p.click('#btn-settings', { force: true }); await w(p, 400);
    await p.click('#btn-home', { force: true }); await w(p, 400);
    if (await p.locator('#btn-leave:visible').count()) await p.click('#btn-leave', { force: true });
    await p.waitForFunction(() => !!document.querySelector('meta[name="strata-release"]'), null, { timeout: 15000 }).catch(() => undefined);
    await w(p, 800);
    R.midBoard.afterHome = await release(p);
    R.midBoard.errors = p.errors;
    await p.screenshot({ path: path.join(out, 'mid-board-then-home-updated.png') });
    await ctx.close();
  }
  await b.close(); server.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R, null, 1));
})();
