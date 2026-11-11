// strata-gtl: when storage is blocked outright, the player is told once that progress isn't saved.
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5662 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, out] = process.argv.slice(2);
const MODES = {
  blocked: () => { Object.defineProperty(window, 'localStorage', { configurable: true, get() { throw new DOMException('denied', 'SecurityError'); } }); },
  full: () => { const s = window.localStorage; const orig = s.setItem.bind(s); s.setItem = (k, v) => { if (k === 'strata.save.v2') throw new DOMException('full', 'QuotaExceededError'); return orig(k, v); }; },
  normal: () => {},
};
(async () => {
  const b = await chromium.launch();
  const R = {};
  for (const [name, fn] of Object.entries(MODES)) {
    const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    await ctx.addInitScript(fn);
    const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(String(e)));
    const toasts = [];
    await p.exposeFunction('__toast', (txt) => toasts.push(txt));
    await p.addInitScript(() => {
      // Start watching once the page is parsed: before the game's module script runs (readyState 'interactive').
      const watch = () => new MutationObserver(() => { const el = document.getElementById('toast'); if (el && el.classList.contains('show')) window.__toast(el.textContent); })
        .observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['class'] });
      document.addEventListener('readystatechange', () => { if (document.readyState === 'interactive') watch(); }, { once: true });
    });
    await p.goto(base); await p.waitForTimeout(1500);
    await p.screenshot({ path: path.join(out, `${name}-boot.png`) });
    // A few more writes: open Settings and toggle Sound twice.
    await p.click('#btn-home-settings', { force: true }).catch(() => undefined); await p.waitForTimeout(400);
    for (let i = 0; i < 2; i++) { await p.click('#set-sound', { force: true }).catch(() => undefined); await p.waitForTimeout(400); }
    R[name] = { toasts: [...new Set(toasts)], errors };
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(R, null, 1) + '\n');
  console.log(JSON.stringify(R, null, 1));
})();
