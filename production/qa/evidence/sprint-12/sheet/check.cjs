// Sprint 12 S4: the Jar styles sheet in the browser. usage: node check.cjs <baseUrl> <outDir>
// (after `npm run build` and `npx vite preview --port 5531 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const QUIET = { sound: false, music: false, haptics: false, patterns: false, southern: false };
const SMALL = { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const w = (p, ms) => p.waitForTimeout(ms);
const R = {};
async function page(b, save, opts, big = false) {
  const ctx = await b.newContext({ ...opts, reducedMotion: 'reduce' });
  await ctx.addInitScript(([k, v, big]) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem(k, v); sessionStorage.setItem('s', '1'); }
    if (big) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; });
  }, [KEY, JSON.stringify(save), big]);
  const p = await ctx.newPage(); p.errors = []; p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base); await w(p, 900);
  return { ctx, p };
}
const saved = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)), KEY);
const seed = (o) => ({ seenWhatsNew: VERSION, tutorialDone: true, settings: QUIET, seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], onboarding: { visits: 1, installShown: true, offlineNoticed: true }, ...o });
(async () => {
  const b = await chromium.launch();
  const px = devices['Pixel 7'];
  // Closed below level 60.
  { const { ctx, p } = await page(b, seed({ level: 59, wallet: { coins: 5000 } }), px);
    R.closedAt59 = await p.locator('#btn-styles').isHidden(); await ctx.close(); }
  // Open at 60 with the New mark; buy, wear, keyboard.
  { const { ctx, p } = await page(b, seed({ level: 61, wallet: { coins: 2000 } }), px);
    R.openAt61 = !(await p.locator('#btn-styles').isHidden());
    R.newMark = !(await p.locator('#styles-new').isHidden());
    R.buttonName = await p.locator('#btn-styles').evaluate((el) => el.textContent.replace(/\s+/g, ' ').trim());
    await p.locator('#btn-styles').scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(out, 'home-styles-button.png') });
    await p.click('#btn-styles'); await w(p, 400);
    R.focusOnOpen = await p.evaluate(() => document.activeElement?.dataset?.id ?? document.activeElement?.id);
    await p.screenshot({ path: path.join(out, 'sheet-open.png') });
    await p.click('[data-slot="glass"][data-id="seaglass"]'); await w(p, 200);
    R.preview = { stage: await p.locator('#styles-preview').getAttribute('data-glass'), board: await p.locator('#board').getAttribute('data-glass'), button: await p.textContent('#btn-style-action'), live: await p.textContent('#styles-previewing') };
    await p.screenshot({ path: path.join(out, 'sheet-preview-seaglass.png') });
    await p.click('#btn-style-action'); await w(p, 300);
    const s1 = await saved(p);
    R.bought = { coins: s1.wallet.coins, styles: s1.styles, board: await p.locator('#board').getAttribute('data-glass'), home: await p.locator('#home').getAttribute('data-glass'), status: await p.locator('[data-slot="glass"][data-id="seaglass"] .scene-status').textContent() };
    await p.click('[data-slot="cork"][data-id="driftwood"]'); await w(p, 200);
    R.cannotAfford = { disabled: await p.locator('#btn-style-action').isDisabled(), text: await p.textContent('#btn-style-action') };
    await p.screenshot({ path: path.join(out, 'sheet-need-coins.png') });
    await p.click('[data-slot="glass"][data-id="clear"]'); await w(p, 200);
    await p.click('#btn-style-action'); await w(p, 300);
    R.woreDefault = (await saved(p)).styles.worn.glass;
    await p.keyboard.press('Escape'); await w(p, 300);
    R.escapeClosed = await p.locator('#styles').isHidden();
    R.focusAfterClose = await p.evaluate(() => document.activeElement?.id);
    R.newMarkAfter = !(await p.locator('#styles-new').isHidden());
    await p.reload(); await w(p, 900);
    R.afterReload = { newMark: !(await p.locator('#styles-new').isHidden()), board: await p.locator('#board').getAttribute('data-glass') };
    R.errors = p.errors; await ctx.close(); }
  // 150% text on 320 px.
  { const { ctx, p } = await page(b, seed({ level: 61, wallet: { coins: 4000 }, styles: { owned: ['glass:seaglass', 'sand:fine'], worn: { glass: 'seaglass', cork: 'cork', sand: 'fine' } } }), SMALL, true);
    await p.click('#btn-styles', { force: true }); await w(p, 400);
    R.overflow320 = await p.evaluate(() => [...document.querySelectorAll('#styles .sheet-card, #styles .style-piece')].some((el) => el.scrollWidth > el.clientWidth + 1) || document.documentElement.scrollWidth > innerWidth);
    await p.screenshot({ path: path.join(out, 'sheet-320-150.png') });
    await p.locator('#btn-close-styles').scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(out, 'sheet-320-150-end.png') });
    R.errors320 = p.errors; await ctx.close(); }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 2));
  console.log(JSON.stringify(R, null, 2));
})();
