// Settings > What's new lists every posting as a changelog; the once-per-update card shows only the newest.
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5531 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../package.json').version;
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const SMALL = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const w = (p, ms) => p.waitForTimeout(ms);
const R = {};

async function open(b, ctxOpts, save, { big = false, theme = null } = {}) {
  const ctx = await b.newContext({ ...ctxOpts, reducedMotion: 'reduce' });
  await ctx.addInitScript(([k, v, big]) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); }
    if (big) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });
  }, [KEY, JSON.stringify(save), big]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base); await w(p, 900);
  return { ctx, p };
}
const save = (extra = {}) => ({ level: 30, tutorialDone: true, settings: QUIET, seenWhatsNew: VERSION, onboarding: { visits: 9, installShown: true, offlineNoticed: true, mapHintSeen: true, boosterHintSeen: true, homeHintSeen: true, scenesNewSeen: true, pendingShare: null }, ...extra });
const view = (p) => p.evaluate(() => {
  const log = document.getElementById('whatsnew-log');
  const card = document.querySelector('#whatsnew .whatsnew-card');
  const ok = document.getElementById('btn-whatsnew-ok').getBoundingClientRect();
  return {
    open: !document.getElementById('whatsnew').hidden,
    versions: [...log.querySelectorAll('.whatsnew-version')].map((h) => h.textContent),
    names: [...log.querySelectorAll('.whatsnew-name')].map((n) => n.textContent),
    lines: log.querySelectorAll('li').length,
    logScrolls: log.scrollHeight > log.clientHeight,
    cardScrolls: card.scrollHeight > card.clientHeight + 1,
    okVisible: ok.top >= 0 && ok.bottom <= innerHeight,
    sideScroll: document.documentElement.scrollWidth > innerWidth,
    focus: document.activeElement.id,
  };
});
async function fromSettings(p) {
  await p.click('#btn-home-settings', { force: true }); await w(p, 300);
  await p.click('#btn-whatsnew'); await w(p, 300);
}

(async () => {
  const b = await chromium.launch();
  const shot = (p, name) => p.screenshot({ path: path.join(out, `${name}.png`) });

  // Settings > What's new on Pixel 7: the whole changelog, newest first and marked.
  let { ctx, p } = await open(b, devices['Pixel 7'], save());
  await fromSettings(p);
  R.settingsPixel7 = await view(p);
  await shot(p, 'settings-changelog-pixel7');
  await p.locator('#whatsnew-log').evaluate((el) => { el.scrollTop = el.scrollHeight; }); await w(p, 150);
  await shot(p, 'settings-changelog-pixel7-scrolled');
  await p.keyboard.press('Escape'); await w(p, 200);
  R.settingsPixel7.afterClose = { closed: await p.locator('#whatsnew').isHidden(), focus: await p.evaluate(() => document.activeElement.id) };
  R.settingsPixel7.errors = p.errors; await ctx.close();

  // 320 x 568 at 150% text: the log scrolls inside the card, "Got it" stays on screen, no sideways scroll.
  ({ ctx, p } = await open(b, SMALL, save(), { big: true }));
  await fromSettings(p);
  R.small150 = await view(p);
  await shot(p, 'settings-changelog-320-150');
  R.small150.errors = p.errors; await ctx.close();

  // A night scene: the panels and the Latest mark in the scene's tokens.
  ({ ctx, p } = await open(b, devices['Pixel 7'], save({ wallet: { coins: 0, boosters: {} }, themes: { owned: ['midday', 'moonlit'], selected: 'moonlit', auto: false } })));
  await fromSettings(p);
  R.moonlit = await view(p);
  await shot(p, 'settings-changelog-moonlit');
  R.moonlit.errors = p.errors; await ctx.close();

  // A player updating from 0.11.0: the card shown once on Home lists only this version.
  ({ ctx, p } = await open(b, devices['Pixel 7'], save({ seenWhatsNew: '0.11.0' })));
  R.updateCard = await view(p);
  await shot(p, 'update-card-latest-only');
  R.updateCard.errors = p.errors; await ctx.close();

  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 2) + '\n');
  console.log(JSON.stringify(R, null, 2));
})();
