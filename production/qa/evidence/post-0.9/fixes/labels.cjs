// Every visible band label, at several levels, sizes and text scales: none covered by the path or a stone.
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const VERSION = require('../../../../../package.json').version; // seen, so What's new doesn't cover Play
(async () => {
  const b = await chromium.launch(); const bad = []; let checked = 0;
  for (const [dev, big] of [['iPhone SE', true], ['iPhone SE', false], ['Pixel 7', true], ['Pixel 7', false]]) for (const level of [3, 21, 40, 41, 60, 61, 100, 201, 333]) {
    const ctx = await b.newContext({ ...devices[dev], reducedMotion: 'reduce' });
    if (big) await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; }));
    const p = await ctx.newPage(); await p.goto('http://localhost:5370/');
    await p.evaluate(([lv, v]) => localStorage.setItem('strata.save.v2', JSON.stringify({ level: lv, best: {}, wallet: { coins: 0, boosters: {} }, tutorialDone: true, daily: { last: null, streak: 0, best: 0, passes: 0 }, shells: [], themes: { owned: ['midday'], selected: 'midday', auto: false }, seenWhatsNew: v })), [level, VERSION]);
    await p.reload(); await p.waitForTimeout(400); await p.click('#btn-play', { force: true }); await p.waitForTimeout(500);
    for (const dy of [0, -300, 300]) {
      await p.evaluate((d) => document.getElementById('map-scroll').scrollBy(0, d), dy); await p.waitForTimeout(150);
      const res = await p.evaluate(() => {
        const hit = [...document.querySelectorAll('.band-name, .map-path, .map-path *')]; hit.forEach((e) => (e.style.pointerEvents = 'auto'));
        const sc = document.getElementById('map-scroll').getBoundingClientRect();
        const r2 = [...document.querySelectorAll('.band-name')].filter((e) => { const r = e.getBoundingClientRect(); return r.height && r.top >= sc.top && r.bottom <= sc.bottom; }).map((e) => { const r = e.getBoundingClientRect();
          const hits = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => document.elementFromPoint(r.left + r.width * f, r.top + r.height / 2));
          return { text: e.textContent, ok: hits.every((h) => h === e || e.contains(h)), by: hits.filter((h) => !(h === e || e.contains(h))).map((h) => h && h.getAttribute('class')) }; });
        hit.forEach((e) => (e.style.pointerEvents = '')); return r2;
      });
      for (const r of res) { checked++; if (!r.ok) bad.push({ dev, big, level, dy, ...r }); }
    }
    await ctx.close();
  }
  console.log('labels checked:', checked, '| covered:', bad.length); for (const x of bad) console.log(JSON.stringify(x));
  await b.close();
})();
