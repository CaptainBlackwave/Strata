// Runs the loudness harness in headless Chromium and prints the rows as JSON.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const bundle = fs.readFileSync(process.argv[2], 'utf8');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ content: bundle });
  const rows = await page.evaluate(() => window.run());
  await browser.close();
  console.log(JSON.stringify({ rows, errors, chromium: browser.version ? browser.version() : '' }, null, 1));
})();
