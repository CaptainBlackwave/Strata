// Sprint 13 W1 (D98): the new jars in the daily and the weekly, in the browser, with the clock set
// past the start dates. usage: node shots.cjs <baseUrl> <outDir>
// (after `npm run build` and `npx vite preview --port 5532 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const w = (p, ms) => p.waitForTimeout(ms);
const R = {};
const save = { seenWhatsNew: VERSION, tutorialDone: true, level: 60, settings: QUIET, seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], onboarding: { visits: 3, installShown: true, offlineNoticed: true } };
async function page(b, iso) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); }
  }, [KEY, JSON.stringify(save)]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.clock.setFixedTime(new Date(iso));
  await p.goto(base); await w(p, 900);
  return { ctx, p };
}
const intro = (p) => p.evaluate(() => ({ hidden: document.getElementById('intro').hidden, title: document.getElementById('intro-title').textContent, list: document.getElementById('intro-list').textContent.replace(/\s+/g, ' ').trim() }));
(async () => {
  const b = await chromium.launch();
  // Dailies: the first three Saturdays from 2026-11-28 feature the hourglass, the sieve, the clam.
  for (const [n, day, id] of [[1, '2026-11-28', 'hourglass'], [2, '2026-12-05', 'sieve'], [3, '2026-12-12', 'clam']]) {
    const { ctx, p } = await page(b, `${day}T10:00:00Z`);
    R[`daily-${id}`] = { sub: await p.textContent('#daily-sub') };
    await p.click('#btn-daily'); await w(p, 900);
    R[`daily-${id}`].intro = await intro(p);
    await p.screenshot({ path: path.join(out, `0${n}a-daily-${day}-intro-${id}.png`) });
    if (!(await p.locator('#intro').isHidden())) { await p.keyboard.press('Escape'); await w(p, 500); }
    await p.screenshot({ path: path.join(out, `0${n}b-daily-${day}-board-${id}.png`) });
    R[`daily-${id}`].errors = p.errors; await ctx.close();
  }
  // Weeklies: 2026-W49, W50, W51 are Turning Tides, Fine Sieve, Clam Bay.
  for (const [n, monday, id] of [[4, '2026-11-30', 'hourglass'], [5, '2026-12-07', 'sieve'], [6, '2026-12-14', 'clam']]) {
    const { ctx, p } = await page(b, `${monday}T10:00:00Z`);
    R[`weekly-${id}`] = { card: (await p.textContent('#weekly-sub')).trim() };
    await p.locator('#btn-weekly').scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(out, `0${n}a-weekly-${monday}-home-card-${id}.png`) });
    await p.click('#btn-weekly'); await w(p, 500);
    R[`weekly-${id}`].sheet = await p.textContent('#weekly-sheet-sub');
    await p.screenshot({ path: path.join(out, `0${n}b-weekly-${monday}-chooser-${id}.png`) });
    await p.click('#weekly-boards [data-board="0"]'); await w(p, 900);
    R[`weekly-${id}`].intro = await intro(p);
    await p.screenshot({ path: path.join(out, `0${n}c-weekly-${monday}-board1-intro-${id}.png`) });
    if (!(await p.locator('#intro').isHidden())) { await p.keyboard.press('Escape'); await w(p, 500); }
    await p.screenshot({ path: path.join(out, `0${n}d-weekly-${monday}-board1-${id}.png`) });
    R[`weekly-${id}`].errors = p.errors; await ctx.close();
  }
  // Before the start: Saturday 2026-11-21 is still narrow (met already, so no card) and W47 is Funnel Week.
  { const { ctx, p } = await page(b, '2026-11-21T10:00:00Z');
    R.before = { weeklyCard: (await p.textContent('#weekly-sub')).trim() };
    await p.click('#btn-daily'); await w(p, 900);
    R.before.intro = await intro(p);
    await p.screenshot({ path: path.join(out, '07-before-start-daily-2026-11-21.png') });
    R.before.errors = p.errors; await ctx.close(); }
  await b.close();
  console.log(JSON.stringify(R, null, 1));
})();
