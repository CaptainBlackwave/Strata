const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const out = {};
  // A returning 0.9.1 player: the 0.10.0 card once, then Home -> map -> level, music on, settings sliders.
  const ctx = await b.newContext({ ...devices['Pixel 7'] });
  await ctx.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', JSON.stringify({ level: 7, best: {}, wallet: { coins: 200, boosters: { hint: 20 } }, tutorialDone: true, settings: { sound: true, music: true, haptics: false, patterns: false, southern: false }, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], themes: { owned: ['midday'], selected: 'midday', auto: false }, seenWhatsNew: '0.9.1' })); sessionStorage.setItem('s', '1'); } });
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto('https://captainblackwave.github.io/Strata/'); await p.waitForTimeout(1500);
  out.card = await p.evaluate(() => [...document.querySelectorAll('[role=dialog]')].filter((d) => d.offsetParent).map((d) => d.innerText.replace(/\s+/g, ' ').slice(0, 90)));
  await p.screenshot({ path: process.argv[2] + '/live-0.10.0-whatsnew.png' });
  await p.getByRole('button', { name: 'Got it' }).click().catch(() => undefined);
  await p.click('#btn-play', { force: true }); await p.waitForTimeout(700); await p.click('#btn-map-play', { force: true }); await p.waitForTimeout(1200);
  out.board = (await p.textContent('.hud')).replace(/\s+/g, ' ').trim().slice(0, 30);
  out.sliders = await p.evaluate(() => document.querySelectorAll('input[type=range]').length);
  out.sw = await p.evaluate(async () => (await navigator.serviceWorker.getRegistration())?.active?.scriptURL ?? null);
  out.errors = errors; console.log(JSON.stringify(out)); await b.close();
})();
