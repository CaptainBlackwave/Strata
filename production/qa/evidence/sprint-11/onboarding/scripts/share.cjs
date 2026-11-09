// Sprint 11 O3 (D78): the daily share link. Today's link opens the daily at once; a past day's link
// shows the "that daily is over" note; Share's text carries the link; ?level=N still works.
// usage: node share.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5520 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const VERSION = require('../../../../../../package.json').version;
const w = (p, ms) => p.waitForTimeout(ms);
const seed = (o = {}) => JSON.stringify({ seenWhatsNew: VERSION, tutorialDone: true, level: 5, onboarding: { visits: 1, installShown: true }, wallet: { coins: 500, boosters: { undo: 0, shuffle: 3, extraJar: 3, hint: 99 } }, ...o });
const today = new Date().toISOString().slice(0, 10);

(async () => {
  const b = await chromium.launch();
  const R = { today };
  const errors = [];
  const open = async (query, save = seed()) => {
    const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => { navigator.share = async (d) => { window.__shared = d.text; }; });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(String(e)));
    await p.goto(base);
    if (save !== null) await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, save]);
    await p.goto(base + query);
    await w(p, 900);
    return { ctx, p };
  };
  const where = (p) => p.evaluate(() => ({
    url: location.search,
    top: [...document.querySelectorAll('#app > *')].filter((e) => !e.hidden && !e.inert && e.style.zIndex).map((e) => e.id).join(',') || 'board',
    label: document.getElementById('level-label').textContent,
    tag: document.getElementById('challenge-tag').hidden ? '' : document.getElementById('challenge-tag').textContent,
  }));

  // 1. Today's link: straight onto today's daily; the address is cleaned.
  let link;
  {
    const { ctx, p } = await open(`?daily=${today}`);
    R.todayLink = await where(p);
    await p.screenshot({ path: path.join(out, 'o3-link-today-daily.png') });
    // Win it with hints, then Share: the text ends with a link to this daily.
    for (let i = 0; i < 80; i++) {
      if (await p.locator('#win:not([hidden])').count()) break;
      await p.keyboard.press('h');
      try { await p.waitForSelector('#board .hint-from', { timeout: 6000 }); } catch { continue; }
      await p.click('#board .hint-from', { force: true });
      await w(p, 150);
      await p.click('#board .hint-to', { force: true });
      await w(p, 600);
    }
    await w(p, 1200);
    await p.click('#btn-share');
    await w(p, 300);
    R.shareText = await p.evaluate(() => window.__shared);
    link = R.shareText.split('\n').at(-1);
    R.shareLinkKeys = [...new URL(link).searchParams.keys()];
    await p.screenshot({ path: path.join(out, 'o3-share-win-card.png') });
    await ctx.close();
  }
  // 2. The shared link itself, opened on another device.
  {
    const { ctx, p } = await open(link.slice(link.indexOf('?')));
    R.sharedLinkOpens = await where(p);
    await ctx.close();
  }
  // 3. A past day's link: the gentle note over Home, then today's daily from its button.
  {
    const { ctx, p } = await open('?daily=2026-11-02');
    R.pastLink = await where(p);
    R.pastText = await p.textContent('#daily-over-text');
    await p.screenshot({ path: path.join(out, 'o3-link-past-day.png') });
    await p.click('#btn-daily-over-play');
    await w(p, 700);
    R.pastThenPlay = await where(p);
    await ctx.close();
  }
  // 4. The past-day note at 150% text on the smallest phone.
  {
    const ctx = await b.newContext({ ...devices['iPhone SE'], reducedMotion: 'reduce' });
    await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; }));
    const p = await ctx.newPage();
    await p.goto(base);
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, seed()]);
    await p.goto(base + '?daily=2026-11-02');
    await w(p, 900);
    await p.screenshot({ path: path.join(out, 'o3-link-past-day-se-150.png') });
    await p.keyboard.press('Escape');
    await w(p, 300);
    R.pastEscape = await where(p);
    await ctx.close();
  }
  // 5. ?level=N still works; a new player's daily link opens Home; a weekly link opens Home for now.
  {
    const { ctx, p } = await open('?level=3');
    R.levelRoute = await where(p);
    await ctx.close();
  }
  {
    const { ctx, p } = await open(`?daily=${today}`, null);
    R.newPlayerDaily = await where(p);
    await ctx.close();
  }
  {
    const { ctx, p } = await open('?weekly=2026-W46');
    R.weeklyLink = await where(p);
    await ctx.close();
  }
  await b.close();
  R.errors = errors;
  console.log(JSON.stringify(R, null, 1));
})();
