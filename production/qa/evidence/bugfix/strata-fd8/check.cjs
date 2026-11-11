// strata-fd8: a friend's challenge target must not come back on a later replay of the same level.
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5660 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base, out] = process.argv.slice(2);
const SEEN = { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const SAVE = { level: 20, boards: 3, best: { 5: 30 }, tutorialDone: true, seenWhatsNew: VERSION, wallet: { coins: 500, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 999 } },
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, onboarding: SEEN };
const w = (p, ms) => p.waitForTimeout(ms);
async function win(p) {
  for (let i = 0; i < 300 && !(await p.locator('#win:not([hidden])').count()); i++) {
    await p.keyboard.press('h'); await w(p, 60);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (await f.count()) { await f.first().click({ force: true }); await t.first().click({ force: true }); await w(p, 320); } else await w(p, 150);
  }
  await w(p, 700);
}
const target = (p) => p.evaluate(() => (document.getElementById('versus').hidden ? null : document.getElementById('versus-text').textContent));
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(SAVE));
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base + '?challenge=5&pours=999'); await w(p, 1200);
  await p.click('#btn-friend-play', { force: true }); await w(p, 1200);
  const R = { challenge: { target: await target(p) } };
  await win(p);
  R.challenge.note = await p.textContent('#win-note'); R.challenge.share = await p.textContent('#btn-share');
  await p.click('#btn-win-home', { force: true }); await w(p, 800);
  await p.click('#btn-play', { force: true }); await w(p, 900);
  for (let i = 0; i < 40 && !(await p.locator('.stone[data-level="5"]').count()); i++) { // the map draws only nearby stones
    await p.evaluate(() => { const el = document.getElementById('map-scroll') || document.querySelector('.map-scroll'); if (el) el.scrollTop += 400; }); await w(p, 150);
  }
  await p.evaluate(() => document.querySelector('.stone[data-level="5"]')?.scrollIntoView({ block: 'center' })); await w(p, 400);
  await p.locator('.stone[data-level="5"]').click({ force: true }); await w(p, 500);
  await p.click('#btn-stone-replay', { force: true }); await w(p, 1200);
  R.replay = { level: await p.textContent('#level-label'), target: await target(p) };
  await p.screenshot({ path: path.join(out, 'replay-no-target.png') });
  await win(p);
  R.replay.note = await p.textContent('#win-note'); R.replay.share = await p.textContent('#btn-share');
  await p.screenshot({ path: path.join(out, 'replay-win-card.png') });
  R.errors = errors;
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R, null, 1));
})();
