// Sprint 14 R1: a 0.13.1 save upgrades to 0.14.0: What's new once, everything kept, then a level
// win offers Challenge a friend and the share preview opens. Also the card at 320 px and 150% text.
// usage: node upgrade-0.13.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5544 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, out] = process.argv.slice(2);
const OLD = {
  level: 40, boards: 2, best: { 39: 37 }, perfect: [39], wallet: { coins: 2400, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 99 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false },
  daily: { last: null, streak: 0, best: 4, passes: 0 }, shells: ['periwinkle', 'limpet'],
  themes: { owned: ['midday', 'dawn'], selected: 'dawn', auto: false },
  onboarding: { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null },
  seenWhatsNew: '0.13.1',
};
const R = {};
async function open(b, ctxOpts, big) {
  const ctx = await b.newContext({ ...ctxOpts, reducedMotion: 'reduce' });
  await ctx.addInitScript(([v, big]) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
    if (big) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });
  }, [JSON.stringify(OLD), big]);
  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', (e) => p.errors.push(String(e))); p.on('console', (m) => m.type() === 'error' && p.errors.push(m.text()));
  await p.goto(base); await p.waitForTimeout(1000);
  return { ctx, p };
}
(async () => {
  const b = await chromium.launch();
  {
    const { ctx, p } = await open(b, devices['Pixel 7'], false);
    R.card = await p.evaluate(() => { const el = document.getElementById('whatsnew'); return el && !el.hidden ? el.innerText.replace(/\s+/g, ' ') : null; });
    await p.screenshot({ path: path.join(out, 'whats-new-0.14.0.png') });
    await p.getByRole('button', { name: 'Got it' }).click(); await p.waitForTimeout(300);
    const s = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
    R.kept = { seenWhatsNew: s.seenWhatsNew, level: s.level, best39: s.best['39'], perfect: s.perfect, coins: s.wallet.coins, shells: s.shells, scene: s.themes.selected };
    await p.reload(); await p.waitForTimeout(900);
    R.cardAgainAfterReload = await p.evaluate(() => !document.getElementById('whatsnew').hidden);
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(700);
    if (await p.locator('#btn-map-play:visible').count()) { await p.click('#btn-map-play', { force: true }); await p.waitForTimeout(1200); }
    for (let i = 0; i < 400; i++) {
      if (await p.locator('#win:not([hidden])').count()) break;
      await p.keyboard.press('h'); await p.waitForTimeout(60);
      const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
      if (!(await f.count())) { await p.waitForTimeout(200); continue; }
      await f.first().click({ force: true }); await t.first().click({ force: true }); await p.waitForTimeout(330);
    }
    await p.waitForTimeout(700);
    R.win = { title: await p.textContent('#win-title'), share: await p.textContent('#btn-share') };
    await p.click('#btn-share', { force: true }); await p.waitForTimeout(1000);
    R.sheetOpen = await p.locator('#share-sheet:not([hidden])').count() === 1;
    await p.screenshot({ path: path.join(out, 'level-40-challenge-sheet-dawn.png') });
    R.errors = p.errors; await ctx.close();
  }
  {
    const { ctx, p } = await open(b, { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true);
    await p.screenshot({ path: path.join(out, 'whats-new-320-150.png') });
    await p.evaluate(() => { const c = document.querySelector('#whatsnew .whatsnew-card') || document.querySelector('#whatsnew [role=dialog]'); if (c) c.scrollTop = c.scrollHeight; });
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(out, 'whats-new-320-150-end.png') });
    R.smallErrors = p.errors; await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R, null, 1));
})();
