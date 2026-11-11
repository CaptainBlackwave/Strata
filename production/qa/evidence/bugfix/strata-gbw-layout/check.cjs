// strata-gbw.3/.4/.5 at 320x568 with 150% text: the Home gear stays on screen with a long name,
// switches keep 46x28, and the Jar styles action sits clear of Close. Serve the build on PORT (4322).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const URL = `http://localhost:${process.env.PORT ?? 4322}/`;
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const SEEN = { visits: 5, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, pendingShare: null };
const save = { boards: 3, level: 61, wallet: { coins: 100, boosters: {} }, seenWhatsNew: require('../../../../../package.json').version, settings: QUIET, tutorialDone: true, onboarding: SEEN, profile: { name: 'Breezy Cove 88', avatar: '', frame: '', plate: '' } };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await ctx.addInitScript((v) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
    document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });
  }, JSON.stringify(save));
  const p = await ctx.newPage();
  for (let i = 0; i < 20; i++) { try { await p.goto(URL); break; } catch { await p.waitForTimeout(500); } }
  await p.waitForTimeout(1500);
  const box = (s) => p.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { left: Math.round(r.left), right: Math.round(r.right), top: Math.round(r.top), bottom: Math.round(r.bottom), w: Math.round(r.width), h: Math.round(r.height) }; }, s);
  const r = { viewport: 320, home: { chip: await box('#btn-profile'), gear: await box('#btn-home-settings') } };
  await p.screenshot({ path: __dirname + '/home-320-150.png' });
  await p.click('#btn-home-settings', { force: true }); await p.waitForTimeout(600);
  r.switches = await p.evaluate(() => [...document.querySelectorAll('#settings .toggle input, .sheet:not([hidden]) .toggle input')].filter((e) => e.getBoundingClientRect().width).map((e) => ({ id: e.id, w: Math.round(e.getBoundingClientRect().width), h: Math.round(e.getBoundingClientRect().height) })));
  await p.evaluate(() => { const el = document.querySelector('#set-patterns'); el && el.scrollIntoView({ block: 'center' }); });
  await p.waitForTimeout(200);
  await p.screenshot({ path: __dirname + '/settings-320-150.png' });
  await p.keyboard.press('Escape'); await p.waitForTimeout(500);
  await p.click('#btn-styles', { force: true }); await p.waitForTimeout(600);
  await p.evaluate(() => { const s = document.querySelector('#styles .styles-slots button:not([aria-pressed="true"])'); s && s.click(); });
  await p.waitForTimeout(300);
  await p.locator('#btn-close-styles').scrollIntoViewIfNeeded();
  const a = await box('#btn-style-action'), c = await box('#btn-close-styles');
  r.styles = { action: a, close: c, gap: c.top - a.bottom, actionText: await p.textContent('#btn-style-action'), disabled: await p.isDisabled('#btn-style-action'), opacity: await p.evaluate(() => getComputedStyle(document.querySelector('#btn-style-action')).opacity) };
  await p.screenshot({ path: __dirname + '/styles-320-150-end.png' });
  console.log(JSON.stringify(r));
  require('fs').writeFileSync(__dirname + '/results.json', JSON.stringify(r, null, 2));
  await b.close();
})();
