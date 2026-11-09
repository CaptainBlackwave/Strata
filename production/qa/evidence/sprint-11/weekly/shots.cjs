// Sprint 11 W2 (D77): the weekly set in the browser. usage: node shots.cjs <baseUrl> <outDir>
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const VERSION = require('../../../../../package.json').version;
const [base, out] = process.argv.slice(2);
/** Thursday of 2026-W46 (Lock and Key), noon UTC: "4 days left". */
const NOW = new Date('2026-11-12T12:00:00Z');
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const SEED = { level: 8, wallet: { coins: 100, boosters: { hint: 99 } }, tutorialDone: true, settings: QUIET, seenWhatsNew: VERSION, badges: ['first-seal'] };
const MID = { ...SEED, weekly: { week: '2026-W46', cleared: [0, 3], pours: { 0: 22, 3: 38 } } };
const FOUR = { ...SEED, weekly: { week: '2026-W46', cleared: [0, 1, 2, 3], pours: { 0: 22, 1: 27, 2: 31, 3: 38 } } };
const SMALL = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function page(b, save, ctxOpts, big) {
  const ctx = await b.newContext({ ...ctxOpts, reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(NOW);
  await ctx.addInitScript(([v]) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
    navigator.share = async (d) => { window.__shared = d.text; }; // capture Share's text instead of a native sheet
  }, [JSON.stringify(save)]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base); await p.waitForTimeout(700);
  if (big) { await p.evaluate(() => (document.documentElement.style.fontSize = '150%')); await p.waitForTimeout(300); }
  return { ctx, p };
}
const overflow = (p) => p.evaluate(() => [...document.querySelectorAll('.cabinet-card, .win-card, .home-inner, body')].some((el) => el.scrollWidth > el.clientWidth + 1) || document.documentElement.scrollWidth > document.documentElement.clientWidth);
const save = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
async function aria(loc) { try { return await loc.ariaSnapshot(); } catch (e) { return `ariaSnapshot unavailable: ${e.message}`; } }
async function openBoard(p, i) {
  await p.click('#btn-weekly'); await p.waitForTimeout(300);
  await p.click(`#weekly-boards [data-board="${i}"]`); await p.waitForTimeout(700);
  const intro = await p.locator('#intro:not([hidden])').count();
  return intro > 0;
}
async function winWithHints(p) {
  for (let i = 0; i < 300; i++) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.keyboard.press('h'); await p.waitForTimeout(70);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await p.waitForTimeout(250); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await p.waitForTimeout(380);
  }
  await p.waitForSelector('#win:not([hidden])'); await p.waitForTimeout(500);
}
const winInfo = (p) => p.evaluate(() => ({
  title: document.getElementById('win-title').textContent,
  text: document.getElementById('win-text').textContent,
  note: document.getElementById('win-note').textContent,
  rewardHidden: document.getElementById('win-reward').hidden,
  badgeRow: document.querySelector('#win-unlocks .win-badge')?.textContent ?? null,
  share: !document.getElementById('btn-share').hidden,
  next: document.getElementById('btn-next').textContent,
}));

(async () => {
  const b = await chromium.launch(); const res = {};
  // 1. Home card and chooser mid-week (boards 1 and 4 cleared).
  let { ctx, p } = await page(b, MID, devices['Pixel 7']);
  await p.screenshot({ path: `${out}/01-home-card-412.png` });
  res.homeCard = { text: await p.locator('#btn-weekly').innerText(), aria: await aria(p.locator('#btn-weekly')) };
  await p.click('#btn-weekly'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/02-chooser-412.png` });
  res.chooser = { aria: await aria(p.locator('#weekly .cabinet-card')), focused: await p.evaluate(() => document.activeElement?.textContent) };
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  res.chooser.focusAfterEscape = await p.evaluate(() => document.activeElement?.id);
  // 2. A weekly board (board 2): the locked jar's intro card first (level 8 has not met it, D2), then the board.
  res.board = { introShown: await openBoard(p, 1) };
  if (res.board.introShown) { await p.screenshot({ path: `${out}/03a-intro-card-412.png` }); await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.screenshot({ path: `${out}/03-weekly-board-412.png` });
  res.board.label = await p.evaluate(() => `${document.getElementById('level-label')?.textContent ?? ''} | ${document.querySelector('.challenge-tag, #challenge-tag')?.textContent ?? ''}`);
  // 3. The win card mid-week, then Share.
  const coinsBefore = (await save(p)).wallet.coins;
  await winWithHints(p);
  await p.screenshot({ path: `${out}/04-win-mid-week-412.png` });
  res.winMid = await winInfo(p);
  await p.click('#btn-share'); await p.waitForTimeout(300);
  await p.screenshot({ path: `${out}/06-share-status-412.png` });
  res.share = { text: await p.evaluate(() => window.__shared), status: await p.locator('#share-status').textContent() };
  const s1 = await save(p); res.winMid.saved = s1.weekly; res.winMid.coinsChanged = s1.wallet.coins !== coinsBefore;
  await p.click('#btn-next'); await p.waitForTimeout(500);
  res.afterContinue = { chooserOpen: await p.locator('#weekly:not([hidden])').count() > 0 };
  await p.screenshot({ path: `${out}/04b-chooser-after-win-412.png` });
  res.errorsMid = p.errors; await ctx.close();
  // 4. Clearing all five: four cleared, win board 5; the badge on the card, then on the shelf.
  ({ ctx, p } = await page(b, FOUR, devices['Pixel 7']));
  const intro5 = await openBoard(p, 4); if (intro5) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await winWithHints(p);
  await p.screenshot({ path: `${out}/05-win-set-complete-badge-412.png` });
  res.winComplete = await winInfo(p);
  await p.click('#btn-share'); await p.waitForTimeout(300);
  res.shareComplete = await p.evaluate(() => window.__shared);
  const s2 = await save(p); res.winComplete.badges = s2.badges; res.winComplete.weekly = s2.weekly;
  await p.click('#btn-next'); await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}/05b-chooser-complete-412.png` });
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.click('#btn-profile'); await p.waitForTimeout(400);
  await p.locator('#badge-shelf li').last().scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  await p.screenshot({ path: `${out}/05c-shelf-weekly-badge-412.png` });
  res.shelfLast = await p.locator('#badge-shelf li').last().textContent();
  res.errorsComplete = p.errors; await ctx.close();
  // 5. 150% text on 320 px: Home card, chooser, the board and the win card.
  ({ ctx, p } = await page(b, MID, SMALL, true));
  await p.locator('#btn-weekly').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `${out}/07-home-card-320-150.png` });
  res.big = { home: await overflow(p) };
  await p.click('#btn-weekly'); await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}/07-chooser-320-150.png` });
  res.big.chooser = await overflow(p);
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  const introBig = await openBoard(p, 2); if (introBig) { await p.keyboard.press('Escape'); await p.waitForTimeout(300); }
  await p.screenshot({ path: `${out}/07-weekly-board-320-150.png` });
  res.big.board = await overflow(p);
  await winWithHints(p);
  await p.screenshot({ path: `${out}/07-win-320-150.png` });
  res.big.win = await overflow(p); res.big.winInfo = await winInfo(p);
  res.errorsBig = p.errors; await ctx.close();
  fs.writeFileSync(`${out}/share-text.txt`, `Mid-week (boards 1, 2 and 4 cleared):\n${res.share.text}\n\nSet complete:\n${res.shareComplete}\n`);
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(res, null, 1) + '\n');
  console.log(JSON.stringify(res, null, 1)); await b.close();
})();
