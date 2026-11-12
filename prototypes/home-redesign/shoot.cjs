// PROTOTYPE - NOT FOR PRODUCTION. Screenshots of the mock-up (and today's Home) with Playwright.
// Usage: node shoot.cjs [baseUrl]   (the dev server must be running)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const base = process.argv[2] || 'http://localhost:4560/';
const out = (n) => path.join(__dirname, 'shots', n);
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const shot = async (name, query, w, h, opts = {}) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, reducedMotion: opts.still ? 'reduce' : 'no-preference' });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
    page.on('console', (m) => m.type() === 'error' && errors.push(`${name}: ${m.text()}`));
    await page.goto(base + query);
    if (opts.text) await page.addStyleTag({ content: `html{font-size:${opts.text}% !important}` });
    await page.waitForTimeout(opts.wait ?? 6000);
    if (opts.scroll) await page.evaluate(() => (document.querySelector('.views').scrollTop = 9999));
    await page.screenshot({ path: out(name) });
    await ctx.close();
  };
  await shot('play-412.png', '?tab=play', 412, 915);
  await shot('today-412.png', '?tab=today', 412, 915, { wait: 800 });
  await shot('collection-412.png', '?tab=collection', 412, 915, { wait: 800 });
  await shot('profile-412.png', '?tab=profile', 412, 915, { wait: 800 });
  await shot('play-320-text150.png', '?tab=play', 320, 568, { text: 150 });
  await shot('play-320-text150-scrolled.png', '?tab=play', 320, 568, { text: 150, scroll: true });
  await shot('play-moonlit-412.png', '?tab=play&theme=moonlit', 412, 915);
  await shot('today-moonlit-412.png', '?tab=today&theme=moonlit', 412, 915, { wait: 800 });
  await shot('play-reduced-motion-412.png', '?tab=play', 412, 915, { still: true, wait: 1500 });
  await browser.close();
  console.log(errors.length ? errors.join('\n') : 'no page errors');
})();
