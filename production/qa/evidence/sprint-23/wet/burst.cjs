// Sprint 23 W4: a timed burst after a drying pour on the Realistic board, to catch the shimmer.
// Usage: PORT=5188 node production/qa/evidence/sprint-23/wet/burst.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const BASE = `http://localhost:${process.env.PORT || 5188}`;
(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
  await context.addInitScript(() => {
    localStorage.setItem('strata.save.v2', JSON.stringify({ tutorialDone: true, level: 201, seenMechanics: ['wet'], seenWhatsNew: '9.9.9', settings: { sound: false, music: false, haptics: false, realistic: true },
      onboarding: { visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true } }));
  });
  const page = await context.newPage();
  await page.goto(`${BASE}/?level=201&board=gpu`);
  await page.waitForSelector('#board .jar .unit', { timeout: 30000 });
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; });
  await page.waitForTimeout(1500);
  await page.evaluate(async () => {
    const { beginSession } = await import('/src/ui/screens/board.ts');
    beginSession({ capacity: 4, jars: [
      { units: [0, 0, 0, 0], hidden: 0, wet: [0, 0, 0, 1] }, { units: [1, 1, 1, 1], hidden: 0 }, { units: [2, 3, 2], hidden: 0, wet: [0, 1, 4] },
      { units: [3, 2], hidden: 0 }, { units: [], hidden: 0 }, { units: [], hidden: 0 } ] }, false);
  });
  await page.waitForTimeout(800);
  const tap = async (i) => { const b = await page.locator('#board .jar').nth(i).boundingBox(); await page.mouse.click(b.x + b.width / 2, b.y + b.height * 0.6); await page.waitForTimeout(120); };
  await tap(2); await tap(3);
  await page.waitForFunction(() => window.__S.session.moves > 0, null, { polling: 20, timeout: 4000 });
  const seen = [];
  for (let n = 0; n < 8; n++) {
    seen.push(await page.evaluate(() => document.querySelectorAll('.dry-shimmer').length));
    await page.screenshot({ path: path.join(__dirname, `burst-gpu-${n}.png`), clip: { x: 60, y: 200, width: 270, height: 480 } });
    await page.waitForTimeout(90);
  }
  console.log('shimmer elements per frame', seen);
  await browser.close();
})();
