// 0.15.1 UI evidence (strata-dll, strata-r20): Home's streak-reward link, the streak track sheet at
// streak 13 (track [3,7]) and 40 (track [3,7,14,30]), the Jar styles sheet's end (a locked earned piece,
// "Needs N coins" and Close) and the Scenes sheet with a locked button. 390x844 and 320x568 at 150% text.
// Usage: BASE=http://localhost:4350 node production/qa/evidence/0.15.1/check.cjs (serving the built dist).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const OUT = __dirname;
const BASE = process.env.BASE || 'http://localhost:4350';
const NOW = new Date('2026-11-15T12:00:00Z');
const KEY = 'strata.save.v2';
const SIZES = [
  { tag: '390', viewport: { width: 390, height: 844 }, font: null },
  { tag: '320-150', viewport: { width: 320, height: 568 }, font: '150%' },
];

/** Boots once for a real save, applies `patch`, reloads. */
async function seeded(browser, size, patch) {
  const context = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await context.clock.setFixedTime(NOW);
  const page = await context.newPage();
  await page.goto(BASE);
  await page.waitForTimeout(800);
  await page.evaluate(([key, src]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    new Function('s', src)(s);
    localStorage.setItem(key, JSON.stringify(s));
  }, [KEY, `(${patch})(s)`]);
  await page.reload();
  await page.waitForTimeout(900);
  if (size.font) await page.evaluate((f) => (document.documentElement.style.fontSize = f), size.font);
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok').forEach((b) => b.click()));
  await page.waitForTimeout(300);
  return { context, page };
}

/** A returning player at level 80 with `coins`, a streak solved yesterday and some track days collected. */
const save = (streak, track, coins, extra = '') => `(s) => {
  s.tutorialDone = true; s.level = 80;
  s.wallet = { ...(s.wallet || {}), coins: ${coins} };
  s.daily = { last: '2026-11-14', streak: ${streak}, best: ${streak}, passes: 0 };
  s.track = ${JSON.stringify(track)};
  s.onboarding = { ...(s.onboarding || {}), visits: 1, installShown: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
  ${extra}
}`;
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

(async () => {
  const browser = await chromium.launch();
  for (const size of SIZES) {
    // Home with the link; then the sheet opened from it by keyboard (Tab focus + Enter).
    for (const [streak, track] of [[13, [3, 7]], [40, [3, 7, 14, 30]]]) {
      const { context, page } = await seeded(browser, size, save(streak, track, 2400));
      if (streak === 13) {
        await page.evaluate(() => document.getElementById('btn-daily').scrollIntoView({ block: 'start' }));
        await page.focus('#btn-track');
        await shot(page, `home-track-link-${size.tag}`);
      } else await page.focus('#btn-track');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      const ok = await page.evaluate(() => ({ sheet: !document.getElementById('track').hidden, board: document.getElementById('home').hidden }));
      if (!ok.sheet || ok.board) throw new Error(`track sheet did not open cleanly: ${JSON.stringify(ok)}`);
      await shot(page, `track-sheet-streak${streak}-${size.tag}`);
      await page.evaluate(() => document.querySelector('.track-sheet').scrollTo(0, 1e6));
      await shot(page, `track-sheet-streak${streak}-end-${size.tag}`);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      const back = await page.evaluate(() => document.activeElement && document.activeElement.id);
      if (back !== 'btn-track') throw new Error(`focus did not return to the link: ${back}`);
      await context.close();
    }
    // Jar styles: preview Cobalt rim with too few coins ("Needs N coins"), Sea Lantern locked above, Close below.
    {
      const { context, page } = await seeded(browser, size, save(13, [3, 7], 400));
      await page.click('#btn-styles');
      await page.waitForTimeout(500);
      await page.click('[data-slot="glass"][data-id="cobalt"]');
      await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector('.styles-card').scrollTo(0, 1e6));
      await shot(page, `styles-end-needs-${size.tag}`);
      await page.click('[data-slot="glass"][data-id="sealantern"]');
      await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector('.styles-card').scrollTo(0, 1e6));
      await shot(page, `styles-end-earned-${size.tag}`);
      await page.evaluate(() => document.querySelector('[data-slot="glass"][data-id="sealantern"]').scrollIntoView({ block: 'center' }));
      await shot(page, `styles-sealantern-locked-${size.tag}`);
      await context.close();
    }
    // Scenes: Lighthouse Night previewed (locked), and Aurora night with too few coins.
    for (const id of ['lighthousenight', 'auroranight']) {
      const { context, page } = await seeded(browser, size, save(13, [3, 7], 400));
      await page.click('#btn-scenes');
      await page.waitForTimeout(500);
      await page.click(`.scene-card[data-id="${id}"]`);
      await page.waitForTimeout(400);
      await page.evaluate(() => document.getElementById('btn-scene-buy').scrollIntoView({ block: 'center' }));
      await shot(page, `scenes-locked-${id}-${size.tag}`);
      await context.close();
    }
  }
  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
