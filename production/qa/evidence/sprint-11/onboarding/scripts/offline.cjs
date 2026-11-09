// Sprint 11 O4 (D78): the one-time "ready to play offline" toast after sw.js has cached everything;
// not again on the next visit; never when storage is blocked.
// usage: node offline.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5520 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [base, out] = process.argv.slice(2);
const TEXT = 'Strata is ready to play offline';
const w = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const b = await chromium.launch();
  const R = {};
  const errors = [];
  const toastSeen = (p, ms) => p.waitForFunction((t) => { const e = document.getElementById('toast'); return e.classList.contains('show') && e.textContent === t; }, TEXT, { timeout: ms }).then(() => true, () => false);
  {
    const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    const msgs = [];
    await p.exposeFunction('__msg', (m) => msgs.push(m));
    await p.addInitScript(() => navigator.serviceWorker?.addEventListener('message', (e) => window.__msg(JSON.stringify(e.data))));
    await p.goto(base);
    R.firstVisitToast = await toastSeen(p, 20000);
    R.controlledWhenShown = await p.evaluate(() => !!navigator.serviceWorker.controller);
    await p.screenshot({ path: path.join(out, 'o4-offline-ready-toast.png') });
    R.messages = msgs;
    R.saved = await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')).onboarding.offlineNoticed);
    await p.reload();
    R.secondVisitToast = await toastSeen(p, 4000);
    // Offline now: the page still loads from the cache.
    await ctx.setOffline(true);
    await p.reload();
    await w(p, 800);
    R.offlineLoads = (await p.textContent('#btn-play'))?.trim();
    await ctx.close();
  }
  {
    const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { Storage.prototype.setItem = () => { throw new DOMException('blocked', 'SecurityError'); }; });
    const p = await ctx.newPage();
    await p.goto(base);
    R.blockedToast = await toastSeen(p, 12000);
    R.blockedToastText = await p.textContent('#toast');
    R.blockedWorkerActive = await p.evaluate(async () => !!(await navigator.serviceWorker.ready).active);
    await ctx.close();
  }
  await b.close();
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
})();
