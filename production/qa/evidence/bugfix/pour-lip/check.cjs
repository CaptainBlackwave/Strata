// Bug 2026-11-11 ("the sand doesn't fall out of the jar right"): on level 52 at a 412-wide phone,
// pour jar 2 -> 9 and capture frames mid-pour. Expected: the stream starts at the tilted jar's lip
// and the poured layer drains from the jar while it falls. Slowed 4x so the frames show it.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = `http://localhost:${process.env.PORT ?? 4400}/?level=52`;
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const ONB = { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = { boards: 3, level: 60, wallet: { coins: 200, boosters: {} }, tutorialDone: true, settings: QUIET, onboarding: ONB, seenWhatsNew: require('../../../../../package.json').version, seenMechanics: ['narrow', 'frozen', 'locked'] };
const [FROM, TO] = (process.env.MOVE ?? '2,9').split(',').map(Number);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save));
  const p = await ctx.newPage();
  for (let i = 0; i < 20; i++) { try { await p.goto(URL); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(1500);
  if (await p.locator('#intro:not([hidden])').count()) await p.click('#btn-intro-ok', { force: true });
  await p.waitForTimeout(300);
  // Slow every animation started from now on by 4x, so the frames land mid-pour.
  await p.evaluate(() => {
    const orig = Element.prototype.animate;
    Element.prototype.animate = function (k, o) { const a = orig.call(this, k, o); a.playbackRate = 0.25; return a; };
  });
  await p.click(`#board .jar[data-index="${FROM}"]`, { force: true });
  await p.waitForTimeout(120);
  await p.click(`#board .jar[data-index="${TO}"]`, { force: true });
  const frames = [];
  for (const [n, ms] of [[1, 700], [2, 900], [3, 1100], [4, 1400]]) {
    await p.waitForTimeout(ms - (frames.at(-1) ?? 0));
    frames.push(ms);
    const info = await p.evaluate(() => {
      const st = document.querySelector('.stream');
      const jar = document.querySelector('.jar.pouring .glass');
      const s = st?.getBoundingClientRect(); const j = jar?.getBoundingClientRect();
      return { stream: s ? { left: Math.round(s.left), top: Math.round(s.top), bottom: Math.round(s.bottom) } : null, glass: j ? { left: Math.round(j.left), right: Math.round(j.right), top: Math.round(j.top), bottom: Math.round(j.bottom) } : null };
    });
    console.log(n, JSON.stringify(info));
    await p.screenshot({ path: `${__dirname}/frame-${n}.png`, clip: { x: 0, y: 200, width: 412, height: 600 } });
  }
  await b.close();
})();
