// 0.18.0: a 0.17.0 save (no board choice) opens on Realistic with What's new once (level 80, a 20-day streak solved yesterday, 2400 coins) opens 0.15.1.
// Expected: What's new 0.15.0 shows once; progress kept; Home shows goals and the next reward.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = `http://localhost:${process.env.PORT ?? 4540}/`;
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const ONB = { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = { boards: 3, level: 80, wallet: { coins: 2400, boosters: { hint: 2, shuffle: 1, extraJar: 1 } }, tutorialDone: true, settings: QUIET, onboarding: ONB, seenWhatsNew: '0.17.0', daily: { last: '2026-12-02', streak: 20, best: 20, passes: 1 } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(new Date('2026-12-03T10:00:00Z'));
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save));
  const p = await ctx.newPage();
  for (let i = 0; i < 20; i++) { try { await p.goto(URL); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(1500);
  const r = { first: { whatsNew: await p.locator('#whatsnew:not([hidden])').count(), text: (await p.textContent('#whatsnew-log'))?.slice(0, 120) } };
  await p.screenshot({ path: __dirname + '/whatsnew.png' });
  if (r.first.whatsNew) await p.click('#btn-whatsnew-ok');
  await p.waitForTimeout(400);
  await p.screenshot({ path: __dirname + '/home-after.png', fullPage: true });
  await p.reload(); await p.waitForTimeout(1500);
  const s = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
  r.second = { whatsNew: await p.locator('#whatsnew:not([hidden])').count(), level: s.level, coins: s.wallet.coins, streak: s.daily.streak, track: s.track, next: await p.textContent('#btn-track'), goals: await p.textContent('#goals-card'), eventCard: await p.textContent('#btn-event'), events: s.events, board: await p.evaluate(() => document.getElementById('board').dataset.render ?? 'dom'), realistic: s.settings.realistic };
  console.log(JSON.stringify(r, null, 1));
  require('fs').writeFileSync(__dirname + '/results.json', JSON.stringify(r, null, 2));
  await b.close();
})();
