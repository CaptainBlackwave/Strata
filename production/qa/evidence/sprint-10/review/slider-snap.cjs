// PR #8 review finding 5: a saved volume off the slider's step is spoken as the value the slider shows.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const VERSION = require('../../../../../package.json').version;
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } },
    JSON.stringify({ level: 5, best: {}, wallet: { coins: 100, boosters: {} }, tutorialDone: true, settings: { sound: true, music: true, haptics: false, patterns: false, southern: false, soundVolume: 0.33, musicVolume: 0.71 }, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], themes: { owned: ['midday'], selected: 'midday', auto: false }, seenWhatsNew: VERSION }));
  const p = await ctx.newPage(); await p.goto(process.argv[2]); await p.waitForTimeout(800);
  await p.click('#btn-home-settings, #btn-settings', { force: true }).catch(() => undefined); await p.waitForTimeout(400);
  const r = await p.evaluate(() => [...document.querySelectorAll('input[type=range]')].map((e) => ({ id: e.id, shown: e.value, spoken: e.getAttribute('aria-valuetext') })));
  console.log(JSON.stringify({ sliders: r, ok: r.length === 2 && r.every((s) => s.spoken === s.shown + '%') }));
  await b.close();
})();
