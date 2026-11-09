// 0.11.1 (D81-D83): the first-run fixes and the weekly set bonus in the browser.
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5520 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../package.json').version;
const SOL = require('../sprint-11/onboarding/scripts/solutions.json');
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const NOW = new Date('2026-11-12T12:00:00Z'); // Thursday of 2026-W46
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const SMALL = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const IPHONE_UA = devices['iPhone SE'].userAgent;
const w = (p, ms) => p.waitForTimeout(ms);
const R = {};

async function page(b, save, ctxOpts, { big = false, url = base } = {}) {
  const ctx = await b.newContext({ ...ctxOpts, reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(NOW);
  await ctx.addInitScript(([k, v, big]) => {
    if (v && !sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); }
    if (big) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });
    navigator.share = async (d) => { window.__shared = d.text; };
  }, [KEY, save ? JSON.stringify(save) : null, big]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(url); await w(p, 900);
  return { ctx, p };
}
const saved = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const shot = (p, name) => p.screenshot({ path: path.join(out, `${name}.png`) });
async function pour(p, moves) {
  for (const [from, to] of moves) {
    await p.locator('#board .jar').nth(from).click({ force: true }); await w(p, 60);
    await p.locator('#board .jar').nth(to).click({ force: true }); await w(p, 420);
  }
  await p.waitForSelector('#win:not([hidden])', { timeout: 10000 }); await w(p, 500);
}
async function winWithHints(p) {
  for (let i = 0; i < 300; i++) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.keyboard.press('h'); await w(p, 70);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await w(p, 250); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await w(p, 380);
  }
  await p.waitForSelector('#win:not([hidden])'); await w(p, 500);
}
const card = (p) => p.evaluate(() => ({
  title: document.getElementById('win-title').textContent,
  note: document.getElementById('win-note').textContent,
  reward: document.getElementById('win-reward').hidden ? null : document.getElementById('win-coins').textContent,
  shared: document.getElementById('btn-win-shared').hidden ? null : document.getElementById('btn-win-shared').textContent,
  describedBy: document.querySelector('#win .win-card').getAttribute('aria-describedby'),
}));
async function playTutorial(p) {
  await p.click('#btn-play', { force: true }); await w(p, 700);
  await p.locator('#board .jar').nth(0).click({ force: true }); await w(p, 300);
  await p.locator('#board .jar').nth(1).click({ force: true });
  await p.waitForSelector('#win:not([hidden])', { timeout: 8000 }); await w(p, 500);
}

(async () => {
  const b = await chromium.launch();
  const px = devices['Pixel 7'];
  const base0 = { seenWhatsNew: VERSION, settings: QUIET };

  // R1 (D81): the level 3 first clear adds the Home line, once.
  {
    const { ctx, p } = await page(b, { ...base0, tutorialDone: true, level: 3 }, px);
    await p.click('#btn-play', { force: true }); await w(p, 700);
    if (await p.locator('#btn-map-play:visible').count()) { await p.click('#btn-map-play', { force: true }); await w(p, 900); }
    await pour(p, SOL[3].moves);
    R.r1Level3 = await card(p); await shot(p, 'r1-level3-win-home-hint');
    R.r1Saved = (await saved(p)).onboarding.homeHintSeen;
    await p.click('#btn-next', { force: true }); await w(p, 900);
    await pour(p, SOL[4].moves);
    R.r1Level4 = await card(p);
    R.r1Errors = p.errors; await ctx.close();
  }
  // R2 (D82): a new player's daily link waits for the tutorial and is offered on its card.
  for (const kind of ['daily', 'weekly']) {
    const url = kind === 'daily' ? `${base}?daily=2026-11-12` : `${base}?weekly=2026-W46`;
    const { ctx, p } = await page(b, null, px, { url });
    R[`r2${kind}Home`] = { play: (await p.textContent('#btn-play')).trim(), kept: (await saved(p)).onboarding.pendingShare, url: p.url() };
    await playTutorial(p);
    R[`r2${kind}Card`] = await card(p); await shot(p, `r2-${kind}-tutorial-win-offer`);
    await p.click('#btn-win-shared', { force: true }); await w(p, 1000);
    R[`r2${kind}After`] = await p.evaluate(() => ({
      label: document.getElementById('level-label')?.textContent ?? null,
      weeklyOpen: !document.getElementById('weekly').hidden,
      homeOpen: !document.getElementById('home').hidden,
    }));
    await shot(p, `r2-${kind}-opened`);
    R[`r2${kind}Cleared`] = (await saved(p)).onboarding.pendingShare;
    R[`r2${kind}Errors`] = p.errors; await ctx.close();
  }
  // R2: a returning player's weekly link opens the chooser at once; weekly Share carries the weekly link.
  {
    const { ctx, p } = await page(b, { ...base0, tutorialDone: true, level: 8, weekly: { week: '2026-W46', cleared: [0], pours: { 0: 22 } } }, px, { url: `${base}?weekly=2026-W46` });
    R.r2ReturningWeekly = !(await p.locator('#weekly').isHidden());
    await p.click('#btn-weekly-share', { force: true }); await w(p, 300);
    R.r2WeeklyShareText = await p.evaluate(() => window.__shared);
    R.r2ReturningErrors = p.errors; await ctx.close();
  }
  // R4 (D82): the Scenes mark at 300 coins, cleared by opening Scenes; not shown below the price.
  {
    let { ctx, p } = await page(b, { ...base0, tutorialDone: true, level: 12, wallet: { coins: 299 } }, px);
    R.r4Below = !(await p.locator('#scenes-new').isHidden()); await ctx.close();
    ({ ctx, p } = await page(b, { ...base0, tutorialDone: true, level: 12, wallet: { coins: 320 } }, px));
    R.r4Shown = !(await p.locator('#scenes-new').isHidden());
    R.r4Name = await p.locator('#btn-scenes').evaluate((el) => el.textContent.replace(/\s+/g, ' ').trim());
    await p.locator('#btn-scenes').scrollIntoViewIfNeeded(); await shot(p, 'r4-home-scenes-new');
    await p.click('#btn-scenes'); await w(p, 400);
    await p.keyboard.press('Escape'); await w(p, 400);
    R.r4AfterOpen = !(await p.locator('#scenes-new').isHidden());
    await p.reload(); await w(p, 900);
    R.r4AfterReload = !(await p.locator('#scenes-new').isHidden());
    R.r4Errors = p.errors; await ctx.close();
    ({ ctx, p } = await page(b, { ...base0, tutorialDone: true, level: 12, wallet: { coins: 320 } }, { ...SMALL }, { big: true }));
    await p.locator('#btn-scenes').scrollIntoViewIfNeeded(); await shot(p, 'r4-home-scenes-new-320-150');
    R.r4Overflow320 = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    await ctx.close();
  }
  // R5 (D82): the iPhone install card at 150% text on 320 px fits without scrolling.
  for (const [name, opts] of [['320', { ...SMALL, userAgent: IPHONE_UA }], ['se', devices['iPhone SE']]]) {
    const { ctx, p } = await page(b, { ...base0, tutorialDone: true, level: 4, onboarding: { visits: 1 } }, opts, { big: true });
    await w(p, 800);
    R[`r5${name}`] = await p.evaluate(() => {
      const c = document.querySelector('#install .cabinet-card');
      if (!c || document.getElementById('install').hidden) return { shown: false };
      return { shown: true, scroll: c.scrollHeight, client: c.clientHeight, scrolls: c.scrollHeight > c.clientHeight + 1, wide: document.documentElement.scrollWidth > innerWidth };
    });
    await shot(p, `r5-install-${name}-150`);
    await ctx.close();
  }
  // D83: the fifth board pays the set bonus on its win card.
  {
    const FOUR = { ...base0, tutorialDone: true, level: 8, wallet: { coins: 100, boosters: { hint: 99 } }, weekly: { week: '2026-W46', cleared: [0, 1, 2, 3], pours: { 0: 22, 1: 27, 2: 31, 3: 38 } } };
    const { ctx, p } = await page(b, FOUR, px);
    await p.click('#btn-weekly'); await w(p, 300);
    await p.click('#weekly-boards [data-board="4"]'); await w(p, 700);
    if (await p.locator('#intro:not([hidden])').count()) { await p.keyboard.press('Escape'); await w(p, 300); }
    const coinsBefore = (await saved(p)).wallet.coins;
    await winWithHints(p);
    await w(p, 1500);
    R.d83Card = await card(p); await shot(p, 'd83-weekly-set-complete-bonus');
    const s = await saved(p);
    R.d83Coins = { before: coinsBefore, after: s.wallet.coins, hud: (await p.textContent('#coins')).trim?.() ?? null };
    R.d83Errors = p.errors; await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
})();
