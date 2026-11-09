// 0.10.1 Q1 (D72): the volume sliders drawn from each scene's tokens. usage: node sliders.cjs <baseUrl> <outDir> <tag>
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const VERSION = require('../../../../package.json').version;
const [base, out, tag] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch(); const res = {};
  for (const scene of ['midday', 'moonlit', 'auroranight', 'winterlights']) {
    const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    await ctx.addInitScript(([v]) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } },
      [JSON.stringify({ level: 5, best: {}, wallet: { coins: 100, boosters: {} }, tutorialDone: true, settings: { sound: true, music: true, haptics: false, patterns: false, southern: false, soundVolume: 0.6, musicVolume: 0.35 }, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], themes: { owned: ['midday', scene], selected: scene, auto: false }, seenWhatsNew: VERSION })]);
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(base); await p.waitForTimeout(800);
    await p.click('#btn-home-settings, #btn-settings', { force: true }).catch(() => undefined); await p.waitForTimeout(500);
    const box = await p.locator('.volume').first().boundingBox();
    const last = await p.locator('.volume').last().boundingBox();
    await p.screenshot({ path: `${out}/sliders-${scene}-${tag}.png`, clip: { x: 0, y: Math.max(0, box.y - 70), width: 412, height: last.y + last.height - box.y + 90 } });
    res[scene] = { fill: await p.evaluate(() => [...document.querySelectorAll('.volume input')].map((e) => e.style.getPropertyValue('--fill') || '(none)')), errors };
    await ctx.close();
  }
  console.log(JSON.stringify(res)); await b.close();
})();
