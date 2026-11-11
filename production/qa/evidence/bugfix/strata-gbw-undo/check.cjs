// strata-gbw.1/.2: level 7, three poor pours -> stuck; Shuffle; Undo. The pour count must stay 3
// and the stuck banner must come back. Serve the build on PORT (default 4321).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = `http://localhost:${process.env.PORT ?? 4321}/?level=7`;
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const SEEN = { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = { boards: 3, level: 20, wallet: { coins: 500, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 3 } }, seenWhatsNew: '0.14.1', settings: QUIET, tutorialDone: true, onboarding: SEEN, seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'] };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(new Date('2026-11-11T12:00:00Z'));
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save));
  const p = await ctx.newPage();
  for (let i = 0; i < 20; i++) { try { await p.goto(URL); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(1500);
  if (await p.locator('#intro:not([hidden])').count()) await p.click('#btn-intro-ok', { force: true });
  for (const [f, t] of [[0, 5], [0, 6], [2, 5]]) {
    await p.click(`#board .jar[data-index="${f}"]`, { force: true }); await p.waitForTimeout(60);
    await p.click(`#board .jar[data-index="${t}"]`, { force: true }); await p.waitForTimeout(450);
  }
  const tx = (s) => p.evaluate((s) => document.querySelector(s)?.textContent?.trim().replace(/\s+/g, ' ') ?? null, s);
  const banner = () => p.locator('#stuck:not([hidden])').count().then((n) => n > 0);
  const r = { stuck: { moves: await tx('#moves'), banner: await banner() } };
  await p.click('#btn-shuffle', { force: true }); await p.waitForTimeout(2500);
  r.shuffled = { moves: await tx('#moves'), banner: await banner() };
  await p.click('#btn-undo', { force: true }); await p.waitForTimeout(800);
  r.undone = { moves: await tx('#moves'), banner: await banner(), text: await tx('#stuck-text') };
  await p.screenshot({ path: __dirname + '/undo-shuffle.png' });
  console.log(JSON.stringify(r));
  require('fs').writeFileSync(__dirname + '/results.json', JSON.stringify(r, null, 2));
  await b.close();
})();
