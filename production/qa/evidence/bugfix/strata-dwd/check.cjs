// strata-dwd: the win card's milestone Share must stay inside the card, at every size.
// usage: node check.cjs <baseUrl> <outDir> <label>   (after `npm run build` and `npx vite preview --port 5661 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base, out, label = 'run'] = process.argv.slice(2);
const SEEN = { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
// Level 40, four Tide Pool shells: winning the daily finds the fifth (set complete), reaches a 30-day streak, and earns badges.
const SAVE = { level: 40, boards: 3, tutorialDone: true, seenWhatsNew: VERSION, wallet: { coins: 500, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 999 } },
  daily: { last: '2026-11-11', streak: 29, best: 29, passes: 0 }, shells: ['periwinkle', 'limpet', 'cockle', 'mussel'],
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, onboarding: SEEN };
const SIZES = { small150: { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, big: true }, pixel7: { ...devices['Pixel 7'] } };
const w = (p, ms) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch();
  const R = {};
  for (const [name, opts] of Object.entries(SIZES)) {
    const { big, ...ctxOpts } = opts;
    const ctx = await b.newContext({ ...ctxOpts, reducedMotion: 'reduce' });
    await ctx.clock.setFixedTime(new Date('2026-11-12T12:00:00Z'));
    await ctx.addInitScript(([v, big]) => {
      if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
      if (big) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });
    }, [JSON.stringify(SAVE), big]);
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(base); await w(p, 1000);
    await p.click('#btn-daily', { force: true }); await w(p, 1000);
    for (let i = 0; i < 300 && !(await p.locator('#win:not([hidden])').count()); i++) {
      await p.keyboard.press('h'); await w(p, 60);
      const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
      if (await f.count()) { await f.first().click({ force: true }); await t.first().click({ force: true }); await w(p, 320); } else await w(p, 150);
    }
    await w(p, 900);
    R[name] = await p.evaluate(() => {
      const card = document.querySelector('#win .win-card').getBoundingClientRect();
      return [...document.querySelectorAll('#win .moment-share')].map((btn) => {
        const r = btn.getBoundingClientRect();
        const row = btn.closest('.win-shell').getBoundingClientRect();
        const inside = r.left >= row.left - 0.5 && r.right <= row.right + 0.5 && r.right <= card.right + 0.5;
        return { label: btn.getAttribute('aria-label'), inside, right: Math.round(r.right), rowRight: Math.round(row.right), cardRight: Math.round(card.right), width: Math.round(r.width) };
      });
    });
    R[name + 'Errors'] = errors;
    await p.locator('#win .moment-share').first().scrollIntoViewIfNeeded().catch(() => undefined);
    await p.screenshot({ path: path.join(out, `${label}-${name}.png`) });
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, `${label}.json`), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R, null, 1));
})();
