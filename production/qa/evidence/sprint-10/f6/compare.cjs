// F6 before/after: drives each confirm flow and every board key, recording toast, coins and charges.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const [url, out, shotDir, tag] = process.argv.slice(2);
const VERSION = '0.9.1';

function seed(level, coins) {
  return { level, best: {}, tutorialDone: true, seenWhatsNew: VERSION, seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], wallet: { coins, boosters: { undo: 0, shuffle: 0, extraJar: 0, hint: 0 } } };
}

async function open(browser, level = 5, coins = 500) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('strata.save.v2', JSON.stringify(s)); sessionStorage.setItem('seeded', '1'); } }, seed(level, coins));
  const page = await ctx.newPage();
  await page.goto(url);
  await page.click('#btn-play');
  await page.waitForSelector('#map:not([hidden])');
  await page.click('#btn-map-play', { force: true });
  await page.waitForFunction(() => document.querySelectorAll('#board .jar').length > 0 && document.getElementById('home').hidden && document.getElementById('map').hidden);
  await page.waitForTimeout(800);
  await clearToast(page);
  return { ctx, page };
}

const clearToast = (page) => page.evaluate(() => { document.getElementById('toast').textContent = ''; });

async function snap(page, step) {
  const s = await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('strata.save.v2') || '{}');
    const tools = [...document.querySelectorAll('.tool[data-booster]')];
    return {
      toast: document.getElementById('toast').textContent,
      coins: document.getElementById('coins').textContent,
      savedCoins: save.wallet && save.wallet.coins,
      charges: save.wallet && save.wallet.boosters,
      badges: Object.fromEntries(tools.map((b) => [b.dataset.booster, b.querySelector('.badge').textContent])),
      armed: tools.filter((b) => b.classList.contains('armed')).map((b) => b.dataset.booster),
      restartArmed: document.getElementById('btn-restart').classList.contains('armed'),
      restartLabel: document.getElementById('btn-restart').getAttribute('aria-label'),
      moves: document.getElementById('moves').textContent,
      leaveOpen: !document.getElementById('leave').hidden,
      homeOpen: !document.getElementById('home').hidden,
      jarClasses: [...document.querySelectorAll('#board .jar')].map((j, i) => [i, j.className]).filter(([, c]) => c !== 'jar'),
    };
  });
  return { step, ...s };
}

async function pour(page, [a, b]) {
  const jars = page.locator('#board .jar');
  await jars.nth(a).click();
  await jars.nth(b).click();
  await page.waitForTimeout(700);
}

async function findPour(browser, level) {
  const { ctx, page } = await open(browser, level);
  const n = await page.locator('#board .jar').count();
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    if (a === b) continue;
    const before = await page.textContent('#moves');
    await pour(page, [a, b]);
    if ((await page.textContent('#moves')) !== before) { await ctx.close(); return [a, b]; }
    await page.keyboard.press('Escape');
  }
  throw new Error('no pour found');
}

(async () => {
  const browser = await chromium.launch();
  const result = {};
  const mv = await findPour(browser, 5);
  result.firstPour = mv;
  const flow = async (name, fn, opts = {}) => {
    const { ctx, page } = await open(browser, opts.level, opts.coins);
    const steps = [];
    const step = async (label, act, shot) => { await clearToast(page); await act(page); await page.waitForTimeout(250); steps.push(await snap(page, label)); if (shot) await page.screenshot({ path: `${shotDir}/${tag}-${shot}.png` }); };
    steps.push(await snap(page, 'start'));
    await fn(step, page);
    result[name] = steps;
    await ctx.close();
  };
  const hint = (p) => p.click('.tool[data-booster="hint"]');
  await flow('boosterArmThenBuy', async (step) => {
    await step('tap Hint (arms)', hint, 'booster-armed');
    await step('tap Hint again (buys)', async (p) => { await hint(p); await p.waitForTimeout(1500); });
  });
  await flow('boosterArmThenPour', async (step) => {
    await step('tap Hint (arms)', hint);
    await step('pour (disarms)', (p) => pour(p, mv));
  });
  await flow('boosterArmThenWait', async (step) => {
    await step('tap Shuffle (arms)', (p) => p.click('.tool[data-booster="shuffle"]'));
    await step('wait 3500 ms (expires)', (p) => p.waitForTimeout(3500));
    await step('tap Shuffle (arms again)', (p) => p.click('.tool[data-booster="shuffle"]'));
  });
  await flow('boosterNotEnoughCoins', async (step) => {
    await step('tap Hint with 10 coins (refused)', hint);
  }, { coins: 10 });
  await flow('freeUndo', async (step) => {
    await step('Z with nothing to undo (button is disabled)', (p) => p.keyboard.press('z'));
    await step('pour', (p) => pour(p, mv));
    await step('tap Undo (free, at once)', (p) => p.click('.tool[data-booster="undo"]'));
  });
  await flow('restart', async (step) => {
    await step('tap Restart with no pours (acts at once)', (p) => p.click('#btn-restart'));
    await step('pour', (p) => pour(p, mv));
    await step('tap Restart once (arms)', (p) => p.click('#btn-restart'), 'restart-armed');
    await step('tap Restart twice (restarts)', (p) => p.click('#btn-restart'));
    await step('pour', (p) => pour(p, mv));
    await step('tap Restart once (arms)', (p) => p.click('#btn-restart'));
    await step('wait 3500 ms (expires)', (p) => p.waitForTimeout(3500));
    await step('tap Restart (arms again)', (p) => p.click('#btn-restart'));
  });
  await flow('leaveWithMoves', async (step) => {
    await step('pour', (p) => pour(p, mv));
    await step('Settings, Home (asks)', async (p) => { await p.click('#btn-settings'); await p.click('#btn-home'); }, 'leave-asks');
    await step('Leave', (p) => p.click('#btn-leave'));
  });
  await flow('leaveWithNone', async (step) => {
    await step('Settings, Home (goes at once)', async (p) => { await p.click('#btn-settings'); await p.click('#btn-home'); });
  });
  await flow('keysLevel141', async (step, page) => {
    result.level141Jars = await page.locator('#board .jar').count();
    const keys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5', 'Digit6', 'Digit7', 'Digit8', 'Digit9', 'Digit0'];
    for (const k of keys) await step(k, async (p) => { await p.keyboard.press(k); await p.waitForTimeout(450); });
    for (const k of keys) await step(`Shift+${k}`, async (p) => { await p.keyboard.press(`Shift+${k}`); await p.waitForTimeout(450); });
    await step('Control+Digit1 (ignored)', (p) => p.keyboard.press('Control+Digit1'));
    for (const k of ['z', 's', 'j', 'h', 'r', 'r', 'Escape']) await step(k, async (p) => { await p.keyboard.press(k); await p.waitForTimeout(450); });
    await page.screenshot({ path: `${shotDir}/${tag}-keys-level141.png` });
  }, { level: 141 });
  fs.writeFileSync(out, JSON.stringify(result, null, 2));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
