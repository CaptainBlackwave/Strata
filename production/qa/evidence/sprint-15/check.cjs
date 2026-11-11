// Sprint 15 (0.14.1): a 0.14.0 save upgrades (What's new, best pours from 30 reset once, the rest kept),
// and boards along the new curve. usage: node check.cjs <baseUrl> <outDir>
// (after `npm run build` and `npx vite preview --port 5545 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const SEEN = { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const OLD = {
  level: 320, boards: 2, best: { 12: 20, 29: 30, 30: 40, 120: 50 }, perfect: [12, 120], wallet: { coins: 3100, boosters: { undo: 0, shuffle: 2, extraJar: 1, hint: 4 } },
  tutorialDone: true, settings: { sound: false, music: false, haptics: false, patterns: false, southern: false },
  shells: ['periwinkle'], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel', 'hourglass', 'sieve', 'clam'], onboarding: SEEN, seenWhatsNew: '0.14.0',
};
const R = { levels: {} };
async function open(b, query, save) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.addInitScript(([k, v]) => { if (!sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); } }, [KEY, JSON.stringify(save)]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base + query); await p.waitForTimeout(1200);
  return { ctx, p };
}
(async () => {
  const b = await chromium.launch();
  {
    const { ctx, p } = await open(b, '', OLD);
    R.card = await p.evaluate(() => { const el = document.getElementById('whatsnew'); return el && !el.hidden ? el.innerText.replace(/\s+/g, ' ') : null; });
    await p.screenshot({ path: path.join(out, 'whats-new-0.14.1.png') });
    const s = await p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
    R.saveAfter = { level: s.level, boards: s.boards, best: s.best, perfect: s.perfect, coins: s.wallet.coins, boosters: s.wallet.boosters, shells: s.shells };
    R.upgradeErrors = p.errors; await ctx.close();
  }
  for (const level of [45, 100, 149, 151, 250, 300]) {
    const { ctx, p } = await open(b, `?level=${level}`, { ...OLD, boards: 3, seenWhatsNew: require('../../../../package.json').version });
    for (const sel of ['#btn-intro-ok']) if (await p.locator(`${sel}:visible`).count()) { await p.click(sel, { force: true }); await p.waitForTimeout(300); }
    R.levels[level] = await p.evaluate(() => ({ label: document.getElementById('level-label').textContent, jars: document.querySelectorAll('#board .jar').length, hiddenUnits: document.querySelectorAll('#board .unit.hidden, #board .unit.buried, #board .buried').length, errors: 0 }));
    R.levels[level].errors = p.errors.length;
    await p.screenshot({ path: path.join(out, `level-${level}.png`) });
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R, null, 1));
})();
