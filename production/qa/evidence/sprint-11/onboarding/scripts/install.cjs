// Sprint 11 O1 (D78): the Add to Home Screen card on Android (a captured install prompt, faked
// because headless Chromium never offers one) and iPhone (the Share steps), plus its rules in the page.
// usage: node install.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5520 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const VERSION = require('../../../../../../package.json').version;
const w = (p, ms) => p.waitForTimeout(ms);
const seed = (o = {}) => JSON.stringify({ seenWhatsNew: VERSION, tutorialDone: true, level: 4, onboarding: { visits: 1 }, ...o });
const FAKE_PROMPT = () => {
  const e = new Event('beforeinstallprompt', { cancelable: true });
  e.prompt = async () => { window.__prompted = true; };
  e.userChoice = Promise.resolve({ outcome: 'accepted' });
  window.dispatchEvent(e);
};

(async () => {
  const b = await chromium.launch();
  const R = {};
  const errors = [];
  const open = async (device, save, init) => {
    const ctx = await b.newContext({ ...devices[device], reducedMotion: 'reduce' });
    if (init) await ctx.addInitScript(init);
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`${device}: ${e}`));
    await p.goto(base);
    if (save !== null) await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, save]);
    await p.reload();
    await w(p, 400);
    return { ctx, p };
  };
  const shown = (p) => p.locator('#install:not([hidden])').count().then((n) => n === 1);
  const saved = (p) => p.evaluate((k) => JSON.parse(localStorage.getItem(k)).onboarding, KEY);

  // Android: the prompt arrives after load; the card opens over Home and its button calls prompt().
  {
    const { ctx, p } = await open('Pixel 7', seed());
    await p.evaluate(FAKE_PROMPT);
    await w(p, 1000);
    R.androidShown = await shown(p);
    await p.screenshot({ path: path.join(out, 'o1-install-android-pixel7.png') });
    await p.click('#btn-install');
    await w(p, 300);
    R.androidPrompted = await p.evaluate(() => window.__prompted === true);
    R.androidClosed = !(await shown(p));
    R.androidSaved = await saved(p);
    await p.reload();
    await p.evaluate(FAKE_PROMPT);
    await w(p, 1000);
    R.androidOnce = !(await shown(p));
    await ctx.close();
  }
  // iPhone at 100% and 150% text: the Share steps, one button; Escape closes; remembered.
  for (const big of [false, true]) {
    const init = big ? () => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; }) : null;
    const { ctx, p } = await open('iPhone SE', seed(), init);
    await w(p, 1000);
    R[`ios${big ? 150 : 100}Shown`] = await shown(p);
    await p.screenshot({ path: path.join(out, `o1-install-iphone-se-${big ? 150 : 100}.png`) });
    R[`ios${big ? 150 : 100}Overflow`] = await p.evaluate(() => { const c = document.querySelector('#install .cabinet-card'); return c.scrollHeight > c.clientHeight || document.documentElement.scrollWidth > innerWidth; });
    await p.keyboard.press('Escape');
    await w(p, 300);
    R.iosEscapeClosed = !(await shown(p));
    await p.reload();
    await w(p, 1000);
    R.iosOnce = !(await shown(p));
    await ctx.close();
  }
  // Never on the first visit, never before N levels, never when installed.
  {
    const { ctx, p } = await open('iPhone SE', seed({ onboarding: { visits: 0 } }));
    await w(p, 1000);
    R.firstVisitHidden = !(await shown(p));
    await ctx.close();
  }
  {
    const { ctx, p } = await open('iPhone SE', seed({ level: 3 }));
    await w(p, 1000);
    R.twoClearedHidden = !(await shown(p));
    await ctx.close();
  }
  {
    const { ctx, p } = await open('iPhone SE', seed(), () => Object.defineProperty(navigator, 'standalone', { value: true }));
    await w(p, 1000);
    R.installedHidden = !(await shown(p));
    await ctx.close();
  }
  await b.close();
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
})();
