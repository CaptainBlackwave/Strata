// 0.10.1 Q2 (D73): the win glow and its motes take each scene's tint. usage: node glow.cjs <baseUrl> <outDir> <tag>
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const VERSION = require('../../../../package.json').version;
const [base, out, tag] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const scene of ['midday', 'moonlit', 'springblossom', 'auroranight']) {
    const ctx = await b.newContext({ ...devices['Pixel 7'] });
    await ctx.addInitScript(([v]) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } },
      [JSON.stringify({ level: 5, best: { 5: 10 }, wallet: { coins: 100, boosters: { hint: 99 } }, tutorialDone: true, settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], themes: { owned: ['midday', scene], selected: scene, auto: false }, seenWhatsNew: VERSION })]);
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(base); await p.waitForTimeout(800);
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(500); await p.click('#btn-map-play', { force: true }); await p.waitForTimeout(900);
    for (let i = 0; i < 200; i++) {
      if (await p.locator('#win:not([hidden])').count()) break;
      await p.keyboard.press('h'); await p.waitForTimeout(70);
      const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
      if (!(await f.count())) { await p.waitForTimeout(250); continue; }
      await f.first().click({ force: true }); await t.first().click({ force: true }); await p.waitForTimeout(380);
    }
    await p.waitForSelector('#win:not([hidden])'); await p.waitForTimeout(450);
    await p.screenshot({ path: `${out}/glow-${scene}-${tag}.png` });
    res[scene] = await p.evaluate(() => ({ glow: getComputedStyle(document.documentElement).getPropertyValue('--glow').trim() || '(unset)', bloom: !!document.querySelector('.win-bloom .bloom-glow'), moteBg: [...document.querySelectorAll('.win-bloom i.mote')].map((m) => getComputedStyle(m).backgroundColor).slice(-1)[0] || null }));
    res[scene].errors = errors;
    await ctx.close();
  }
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
