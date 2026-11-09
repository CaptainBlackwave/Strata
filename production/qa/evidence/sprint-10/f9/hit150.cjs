const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
(async () => {
  const b = await chromium.launch(); const out = {};
  for (const [dev, level, text] of [['iPhone SE', 120, 150], ['iPhone SE', 141, 150], ['iPhone SE', 141, 200], ['Pixel 7', 141, 200]]) {
    const ctx = await b.newContext({ ...devices[dev] });
    await ctx.addInitScript(([v, t]) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = t + '%'; }); },
      [JSON.stringify({ level, best: {}, wallet: { coins: 500, boosters: { shuffle: 0, extraJar: 0, hint: 0 } }, tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false }, seenWhatsNew: require('/home/user/Strata/package.json').version }), text]);
    const p = await ctx.newPage(); await p.goto('http://localhost:5173/'); await p.waitForTimeout(800);
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(500); await p.click('#btn-map-play', { force: true }); await p.waitForTimeout(1500);
    out[`${dev} L${level} ${text}%`] = await p.evaluate(() => {
      const tb = document.querySelector('.toolbar').getBoundingClientRect().top;
      const jars = [...document.querySelectorAll('#board .jar')];
      const hit = jars.map((j) => j.getBoundingClientRect());
      const draw = jars.map((j) => (j.querySelector('.glass, .tube, .jar-body') || j).getBoundingClientRect());
      return { jars: jars.length, minHitW: Math.min(...hit.map((r) => r.width)).toFixed(1), minHitH: Math.min(...hit.map((r) => r.height)).toFixed(1), aboveToolbar: hit.every((r) => r.bottom <= tb + 1), sideways: document.documentElement.scrollWidth > innerWidth + 1 };
    });
    await ctx.close();
  }
  console.log(JSON.stringify(out, null, 1)); await b.close();
})();
