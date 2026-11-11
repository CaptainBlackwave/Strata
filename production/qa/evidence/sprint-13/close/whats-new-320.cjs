// Sprint 13 close (R1): the 0.13.0 What's new card at 320 px with 150% text: no sideways scroll, Got it reachable.
// usage: node whats-new-320.cjs <baseUrl> <outDir>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [base, out] = process.argv.slice(2);
const SAVE = { level: 30, tutorialDone: true, seenWhatsNew: '0.12.0', onboarding: { visits: 5, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(SAVE));
  const p = await ctx.newPage(); const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base); await p.addStyleTag({ content: 'html{font-size:150% !important}' }); await p.waitForTimeout(900);
  const m = await p.evaluate(() => ({ scrollW: document.documentElement.scrollWidth, innerW: innerWidth }));
  await p.screenshot({ path: path.join(out, 'whats-new-320-150.png') });
  const ok = p.getByRole('button', { name: 'Got it' });
  await ok.scrollIntoViewIfNeeded();
  const box = await ok.boundingBox();
  await p.screenshot({ path: path.join(out, 'whats-new-320-150-end.png') });
  await ok.click();
  const seen = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')).seenWhatsNew);
  console.log('scrollWidth', m.scrollW, 'innerWidth', m.innerW, m.scrollW <= m.innerW ? 'OK no sideways scroll' : 'SIDEWAYS SCROLL', '| Got it in view:', box && box.y + box.height <= 568, '| seen', seen, '| errors', JSON.stringify(errors));
  await b.close();
})();
