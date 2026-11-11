// Sprint 16 UI evidence (T3, G3, T2): Home goals card + next streak reward, daily win cards on day 14 and 30,
// the Jar styles sheet (Sea Lantern locked / owned) and Scenes (Lighthouse Night locked / in use).
// Usage: PREVIEW=http://localhost:4330 DEV=http://localhost:4331 node production/qa/evidence/sprint-16/check.cjs
// PREVIEW serves the built dist; DEV is `vite` (dev), used only for the win cards, which need the app's
// modules (a daily win is driven by calling showWin() on a started daily board, not by solving it).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const OUT = __dirname;
const PREVIEW = process.env.PREVIEW || 'http://localhost:4330';
const DEV = process.env.DEV || 'http://localhost:4331';
const NOW = new Date('2026-11-15T12:00:00Z'); // goals that day: clear 2, seal 25, solve the daily
const KEY = 'strata.save.v2';
const SIZES = [
  { tag: '390', viewport: { width: 390, height: 844 }, font: null },
  { tag: '320-150', viewport: { width: 320, height: 568 }, font: '150%' },
];

/** Boots once to get a real save, then applies `patch` to it and reloads. */
async function seeded(browser, base, size, patch) {
  const context = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await context.clock.setFixedTime(NOW);
  const page = await context.newPage();
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.evaluate(([key, patchSrc]) => {
    const save = JSON.parse(localStorage.getItem(key) || '{}');
    const patch = new Function('s', patchSrc);
    patch(save);
    localStorage.setItem(key, JSON.stringify(save));
  }, [KEY, `(${patch})(s)`]);
  await page.reload();
  await page.waitForTimeout(900);
  if (size.font) await page.evaluate((f) => (document.documentElement.style.fontSize = f), size.font);
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok').forEach((b) => b.click()));
  await page.waitForTimeout(300);
  return { context, page };
}

/** A returning player: tutorial done, level 80, a 13-day streak solved yesterday, today's goals part done. */
const base = (streak, track, goals, extra) => `(s) => {
  s.tutorialDone = true; s.level = 80; s.seenWhatsNew = s.seenWhatsNew;
  s.wallet = { ...(s.wallet || {}), coins: 2400 };
  s.daily = { last: '2026-11-14', streak: ${streak}, best: ${streak}, passes: 0 };
  s.track = ${JSON.stringify(track)};
  s.goals = ${JSON.stringify(goals)};
  s.onboarding = { ...(s.onboarding || {}), visits: 1, installShown: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
  ${extra || ''}
}`;
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`), fullPage: false });

(async () => {
  const browser = await chromium.launch();
  for (const size of SIZES) {
    // 1. Home: goals card and the next streak reward line.
    {
      const { context, page } = await seeded(browser, PREVIEW, size, base(13, [3, 7], { date: '2026-11-15', progress: [1, 12, 0], done: [], bonus: false }));
      await page.evaluate(() => document.getElementById('btn-daily').scrollIntoView({ block: 'start' }));
      await shot(page, `home-goals-${size.tag}`);
      await context.close();
    }
    // 2. Daily win cards: day 14 (Tide Line frame + goals) and day 30 (Sea Lantern + goals + bonus).
    for (const [streak, track] of [[13, [3, 7]], [29, [3, 7, 14]]]) {
      const { context, page } = await seeded(browser, DEV, size, base(streak, track, { date: '2026-11-15', progress: [2, 25, 0], done: [0, 1], bonus: false }));
      await page.click('#btn-daily');
      await page.waitForTimeout(800);
      await page.evaluate(async () => {
        const win = await import('/src/ui/screens/win.ts');
        win.showWin();
      });
      await page.waitForTimeout(1500);
      await shot(page, `win-daily-day${streak + 1}-${size.tag}`);
      await context.close();
    }
    // 3. Jar styles: Sea Lantern locked, then owned and worn.
    for (const [tag, extra] of [['locked', ''], ['owned', "s.styles = { owned: ['glass:sealantern'], worn: { glass: 'sealantern', cork: 'cork', sand: 'plain' } };"]]) {
      const { context, page } = await seeded(browser, PREVIEW, size, base(13, [3, 7], { date: '', progress: [], done: [], bonus: false }, extra));
      await page.click('#btn-styles');
      await page.waitForTimeout(500);
      await page.click('[data-slot="glass"][data-id="sealantern"]');
      await page.waitForTimeout(400);
      await page.evaluate(() => document.querySelector('[data-slot="glass"][data-id="sealantern"]').scrollIntoView({ block: 'center' }));
      await shot(page, `styles-sealantern-${tag}-${size.tag}`);
      if (tag === 'locked') {
        await page.evaluate(() => document.getElementById('btn-style-action').scrollIntoView({ block: 'center' }));
        await shot(page, `styles-sealantern-${tag}-button-${size.tag}`);
      }
      await context.close();
    }
    // 4. Scenes: Lighthouse Night locked (previewed), then owned and in use (Home behind).
    for (const [tag, extra] of [['locked', ''], ['active', "s.themes = { owned: ['midday', 'lighthousenight'], selected: 'lighthousenight', auto: false };"]]) {
      const { context, page } = await seeded(browser, PREVIEW, size, base(13, [3, 7], { date: '', progress: [], done: [], bonus: false }, extra));
      if (tag === 'active') await shot(page, `home-lighthousenight-${size.tag}`);
      await page.click('#btn-scenes');
      await page.waitForTimeout(500);
      if (tag === 'locked') await page.click('.scene-card[data-id="lighthousenight"]');
      await page.waitForTimeout(400);
      await page.evaluate(() => document.querySelector('.scene-card[data-id="lighthousenight"]').scrollIntoView({ block: 'center' }));
      await shot(page, `scenes-lighthousenight-${tag}-${size.tag}`);
      if (tag === 'locked') {
        await page.evaluate(() => document.getElementById('btn-scene-buy').scrollIntoView({ block: 'center' }));
        await shot(page, `scenes-lighthousenight-${tag}-button-${size.tag}`);
      }
      await context.close();
    }
  }
  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
