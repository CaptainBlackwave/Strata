// Sprint 11 A2 (D76): the badge shelf and the win-card badge row. usage: node shots.cjs <baseUrl> <outDir>
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const VERSION = require('../../../../../package.json').version;
const [base, out] = process.argv.slice(2);
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const tidepool = ['periwinkle', 'limpet', 'cockle', 'mussel', 'sea-star'];
/** A new player past the tutorial, on level 5 (the brief's seed). */
const FRESH = { level: 5, wallet: { coins: 100, boosters: { hint: 99 } }, tutorialDone: true, settings: QUIET, seenWhatsNew: VERSION };
/** An older save (no badges field yet): level 60, a set, a 9-day best streak, 30 Perfect clears, two scenes. */
const OLD = { ...FRESH, level: 60, perfect: [10, 20, 33], shells: tidepool, daily: { last: null, streak: 0, best: 9, passes: 0 }, themes: { owned: ['midday', 'dawn'], selected: 'midday', auto: false }, stats: { perfectClears: 30, dailiesSolved: 4, pours: 1400, coinsEarned: 2100, boostersUsed: 6, jarsSealed: 34 }, scenesPlayed: ['midday'] };

async function page(b, save, ctxOpts, big) {
  const ctx = await b.newContext({ ...ctxOpts, reducedMotion: 'reduce' });
  await ctx.addInitScript(([v]) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, [JSON.stringify(save)]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base); await p.waitForTimeout(700);
  if (big) await p.evaluate(() => (document.documentElement.style.fontSize = '150%'));
  return { ctx, p };
}
async function shelf(p, name) {
  await p.click('#btn-profile'); await p.waitForTimeout(400);
  await p.locator('#badges-title').scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/${name}-top.png` });
  await p.locator('#badge-shelf li').last().scrollIntoViewIfNeeded(); await p.waitForTimeout(150);
  await p.screenshot({ path: `${out}/${name}-end.png` });
  return p.evaluate(() => {
    const card = document.querySelector('#profile .cabinet-card');
    const tiles = [...document.querySelectorAll('#badge-shelf li')];
    const cols = new Set(tiles.map((li) => Math.round(li.getBoundingClientRect().left))).size;
    return {
      count: document.getElementById('badges-count').textContent,
      earned: tiles.filter((li) => li.classList.contains('earned')).map((li) => li.querySelector('.badge-name').textContent),
      sample: tiles.filter((li) => li.classList.contains('locked')).slice(0, 3).map((li) => li.textContent),
      columns: cols,
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth || card.scrollWidth > card.clientWidth,
      saved: JSON.parse(localStorage.getItem('strata.save.v2')).badges,
    };
  });
}
(async () => {
  const b = await chromium.launch(); const res = {};
  // 1. Empty shelf: the level-5 player has earned nothing yet.
  let { ctx, p } = await page(b, FRESH, devices['Pixel 7']);
  res.empty = await shelf(p, 'shelf-empty-412'); res.empty.errors = p.errors; await ctx.close();
  // 2. A badge on the win card: win level 5 with hints (first seal + first shell).
  ({ ctx, p } = await page(b, FRESH, devices['Pixel 7']));
  await p.click('#btn-play', { force: true }); await p.waitForTimeout(500); await p.click('#btn-map-play', { force: true }); await p.waitForTimeout(900);
  for (let i = 0; i < 200; i++) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.keyboard.press('h'); await p.waitForTimeout(70);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await p.waitForTimeout(250); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await p.waitForTimeout(380);
  }
  await p.waitForSelector('#win:not([hidden])'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/win-card-badge-412.png` });
  res.win = await p.evaluate(() => ({
    row: document.querySelector('#win-unlocks .win-badge')?.textContent ?? null,
    describedBy: document.querySelector('#win .win-card').getAttribute('aria-describedby'),
    saved: JSON.parse(localStorage.getItem('strata.save.v2')).badges,
    jarsSealed: JSON.parse(localStorage.getItem('strata.save.v2')).stats.jarsSealed,
    scenesPlayed: JSON.parse(localStorage.getItem('strata.save.v2')).scenesPlayed,
  }));
  res.win.errors = p.errors; await ctx.close();
  // 3. Part-earned shelf: an old save back-filled quietly at load.
  ({ ctx, p } = await page(b, OLD, devices['Pixel 7']));
  res.toastAtLoad = await p.evaluate(() => document.getElementById('toast').classList.contains('show'));
  res.partial = await shelf(p, 'shelf-part-412'); res.partial.errors = p.errors; await ctx.close();
  // 4. The same at 150% text on 320 px.
  ({ ctx, p } = await page(b, OLD, { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, true));
  res.big = await shelf(p, 'shelf-part-320-150'); res.big.errors = p.errors; await ctx.close();
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
