// Sprint 14 H3 (sharing §3.2): challenge links in the production build.
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5542 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const NOW = new Date('2026-11-12T12:00:00Z');
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const SEEN = { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const WALLET = { coins: 99999, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 999 } };
const w = (p, ms) => p.waitForTimeout(ms);
const R = {};

async function page(b, save, query, opts = {}) {
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(NOW);
  await ctx.addInitScript(([k, v]) => {
    if (v && !sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); }
    navigator.share = async (d) => { window.__shared = { text: d.text, files: (d.files || []).map((f) => f.type) }; };
    navigator.canShare = (d) => !!d.files;
  }, [KEY, save ? JSON.stringify(save) : null]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base + query); await w(p, 1100);
  return { ctx, p };
}
async function winWithHints(p) {
  for (let i = 0; i < 500; i++) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.keyboard.press('h'); await w(p, 60);
    const f = p.locator('#board .hint-from'), t = p.locator('#board .hint-to');
    if (!(await f.count())) { await w(p, 200); continue; }
    await f.first().click({ force: true }); await t.first().click({ force: true }); await w(p, 330);
  }
  await p.waitForSelector('#win:not([hidden])', { timeout: 15000 }); await w(p, 700);
}
const shot = (p, name) => p.screenshot({ path: path.join(out, `${name}.png`) });
const text = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
const visible = (p, sel) => p.locator(`${sel}:not([hidden])`).count().then((n) => n > 0);
const base0 = { boards: 2, wallet: WALLET, seenWhatsNew: VERSION, settings: QUIET, tutorialDone: true, onboarding: SEEN };

(async () => {
  const b = await chromium.launch();

  // 1. A player on level 90 opens a challenge on level 80: beat it, play it, the target, the verdict, Send it back.
  {
    const { ctx, p } = await page(b, { ...base0, level: 90, best: { 80: 40 } }, '?challenge=80&pours=34');
    R.beat = { card: await visible(p, '#friend'), text: await text(p, '#friend-text'), play: await text(p, '#btn-friend-play'), addressAfter: await p.evaluate(() => location.search) };
    await shot(p, '1-friend-card-beat');
    await p.click('#btn-friend-play', { force: true }); await w(p, 1200);
    R.beat.level = await text(p, '#level-label');
    R.beat.target = { shown: await visible(p, '#versus'), text: await text(p, '#versus-text'), sr: await text(p, '#versus-sr') };
    await shot(p, '2-board-beat-34');
    await winWithHints(p);
    R.beat.win = { note: await text(p, '#win-note'), share: await text(p, '#btn-share'), reward: await visible(p, '#win-reward') };
    await shot(p, '3-win-verdict-send-back');
    await p.click('#btn-share', { force: true }); await w(p, 1000);
    await shot(p, '4-share-level-challenge');
    await p.click('#btn-share-send', { force: true }); await w(p, 500);
    R.beat.sent = await p.evaluate(() => window.__shared);
    R.beat.errors = p.errors; await ctx.close();
  }
  // 2. A player on level 12 opens the same link: an invitation to play on; their own level, no target.
  {
    const { ctx, p } = await page(b, { ...base0, level: 12 }, '?challenge=80&pours=34');
    R.ahead = { text: await text(p, '#friend-text'), play: await text(p, '#btn-friend-play') };
    await shot(p, '5-friend-card-ahead');
    await p.click('#btn-friend-play', { force: true }); await w(p, 1200);
    R.ahead.level = await text(p, '#level-label');
    R.ahead.target = await visible(p, '#versus');
    await winWithHints(p);
    R.ahead.winShare = await text(p, '#btn-share');
    await shot(p, '6-win-challenge-a-friend');
    R.ahead.errors = p.errors; await ctx.close();
  }
  // 3. A brand-new player: the tutorial first, then its win card offers the challenge.
  {
    const { ctx, p } = await page(b, null, '?challenge=80&pours=34');
    R.fresh = { cardAtBoot: await visible(p, '#friend') };
    await p.click('#btn-play', { force: true }); await w(p, 800);
    await p.locator('#board .jar').nth(0).click({ force: true }); await w(p, 300);
    await p.locator('#board .jar').nth(1).click({ force: true });
    await p.waitForSelector('#win:not([hidden])', { timeout: 8000 }); await w(p, 600);
    R.fresh.note = await text(p, '#win-note');
    R.fresh.offer = await visible(p, '#btn-win-shared') ? await text(p, '#btn-win-shared') : null;
    await shot(p, '7-tutorial-win-offers-challenge');
    if (R.fresh.offer) { await p.click('#btn-win-shared', { force: true }); await w(p, 700); R.fresh.after = await text(p, '#friend-text'); }
    R.fresh.errors = p.errors; await ctx.close();
  }
  // 4. The map: a cleared stone's card has Challenge a friend.
  {
    const { ctx, p } = await page(b, { ...base0, level: 30, best: { 25: 31 }, perfect: [25] }, '');
    await p.click('#btn-play', { force: true }); await w(p, 1200);
    await p.evaluate(() => document.querySelector('.stone[data-level="25"]')?.scrollIntoView({ block: 'center' })); await w(p, 500);
    await p.locator('.stone[data-level="25"]').click({ force: true }); await w(p, 600);
    R.map = { button: await visible(p, '#btn-stone-challenge'), label: await text(p, '#btn-stone-challenge') };
    await shot(p, '8-map-card-challenge');
    await p.click('#btn-stone-challenge', { force: true }); await w(p, 1000);
    await p.click('#btn-share-send', { force: true }); await w(p, 500);
    R.map.sent = await p.evaluate(() => window.__shared);
    await shot(p, '9-map-share-sheet');
    R.map.errors = p.errors; await ctx.close();
  }
  // 5. Broken links never break the launch.
  R.hostile = {};
  for (const q of ['?challenge=abc&pours=3', '?challenge=0&pours=3', '?challenge=99999999&pours=3', '?challenge=80&pours=x', '?challenge=80&pours=-5', '?challenge=%3Cscript%3E']) {
    const { ctx, p } = await page(b, { ...base0, level: 12 }, q);
    R.hostile[q] = { home: await visible(p, '#home'), friendCard: await visible(p, '#friend'), level: await text(p, '#level-label'), errors: p.errors };
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R, null, 1));
})();
