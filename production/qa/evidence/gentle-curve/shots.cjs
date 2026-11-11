// Gentler curve (D104-D109): the changed boards in the browser, and the one-time best-pours reset.
// usage: node shots.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5530 --strictPort`)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const PHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
// A returning player from before the change: level 60, best pours on old boards, no `boards` field.
const OLD_SAVE = {
  level: 60, best: { 5: 14, 11: 27, 12: 30, 23: 36, 30: 48, 40: 56, 50: 45 }, perfect: [5, 23, 30],
  wallet: { coins: 900, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 3 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false },
  seenMechanics: ['narrow', 'frozen'], seenWhatsNew: require('../../../../package.json').version,
  onboarding: { home: true, map: true, daily: true, weekly: true, scenes: true },
};
(async () => {
  const b = await chromium.launch();
  const result = { errors: [], levels: {} };
  for (const level of [21, 23, 30, 33, 40, 45]) {
    const ctx = await b.newContext({ ...PHONE, reducedMotion: 'reduce' });
    await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); } }, [KEY, JSON.stringify(OLD_SAVE)]);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => result.errors.push(`${level}: ${e}`));
    await p.goto(`${base}?level=${level}`);
    await p.waitForSelector('#board .jar', { timeout: 10000 });
    await p.waitForTimeout(700);
    for (const sel of ['#intro:not([hidden]) button', '.intro-card button', 'dialog[open] button']) {
      const btn = p.locator(sel).first();
      if (await btn.count() && await btn.isVisible().catch(() => false)) { await btn.click().catch(() => {}); await p.waitForTimeout(300); }
    }
    result.levels[level] = { jars: await p.locator('#board .jar').count() };
    await p.screenshot({ path: path.join(out, `level-${level}.png`) });
    if (level === 21) result.saveAfterLoad = await p.evaluate((k) => { const s = JSON.parse(localStorage.getItem(k)); return { level: s.level, best: s.best, perfect: s.perfect, boards: s.boards, coins: s.wallet.coins }; }, KEY);
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  console.log(JSON.stringify(result));
})();
