// Sprint 9 M5: browser checks for the 9 open player-facing backlog findings.
// usage: node m5.cjs <baseUrl> <outDir>    (after `npm run build` and `npx vite preview --port 5320 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, outDir] = process.argv.slice(2);
const mkSave = (o = {}) => ({
  level: 3, best: {}, wallet: { coins: 500, boosters: { undo: 0, shuffle: 0, extraJar: 0, hint: 60 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, daily: { last: null, streak: 0, best: 0, passes: 0 },
  shells: ['periwinkle'], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false },
  profile: { name: 'Shore Tester', avatar: 'sand-jar', frame: 'plain', plate: 'plain' }, stats: { perfectClears: 2, dailiesSolved: 1, pours: 340, coinsEarned: 900, boostersUsed: 4 }, dailyShare: null, seenWhatsNew: '0.8.0', ...o,
});
const out = []; const errs = [];
const note = (k, v) => { out.push([k, v]); console.log(k, JSON.stringify(v)); };
const w = (p, ms = 350) => p.waitForTimeout(ms);
const shot = (p, name) => p.screenshot({ path: path.join(outDir, name) });
async function open(b, save, { device = 'Pixel 7', big = false, query = '' } = {}) {
  const ctx = await b.newContext({ ...devices[device], reducedMotion: 'reduce' });
  await ctx.addInitScript(([v, big]) => {
    if (!localStorage.getItem('strata.save.v2')) localStorage.setItem('strata.save.v2', v);
    if (big) document.addEventListener('DOMContentLoaded', () => (document.documentElement.style.fontSize = '150%'));
  }, [JSON.stringify(save), big]);
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + '/' + query); await w(p, 900);
  return { ctx, p };
}
async function solve(p) {
  await p.click('#btn-play', { force: true }); await w(p, 700);
  for (let i = 0; i < 120; i++) {
    if (await p.evaluate(() => !document.getElementById('win').hidden)) return true;
    await p.keyboard.press('h'); await w(p, 200);
    const hv = await p.evaluate(() => { const j = [...document.querySelectorAll('#board .jar')]; return [j.findIndex((e) => e.classList.contains('hint-from')), j.findIndex((e) => e.classList.contains('hint-to'))]; });
    if (hv[0] >= 0 && hv[1] >= 0) { await p.locator('#board .jar').nth(hv[0]).click(); await p.locator('#board .jar').nth(hv[1]).click(); }
    await w(p, 450);
  }
  return false;
}
(async () => {
  const b = await chromium.launch();
  try {
    // UX-home-3, AX-17
    {
      const { ctx, p } = await open(b, mkSave());
      note('UX-home-3 daily card aria snapshot', await p.locator('#btn-daily').ariaSnapshot());
      note('AX-17 viewport meta', await p.getAttribute('meta[name=viewport]', 'content'));
      await shot(p, 'm5-ux-home-3-home.png');
      // UX-profile-2
      await p.click('#btn-profile', { force: true }); await w(p);
      note('UX-profile-2 stat labels (as read)', await p.locator('#stats-grid').evaluate((g) => [...g.querySelectorAll('dt')].map((d) => d.textContent)));
      note('UX-profile-2 footnote', await p.textContent('#stats-note'));
      await p.locator('#stats-note').scrollIntoViewIfNeeded(); await shot(p, 'm5-ux-profile-2-stats.png');
      await p.keyboard.press('Escape'); await w(p);
      // UX-cab-2
      await p.click('#btn-shells', { force: true }); await w(p);
      note('UX-cab-2 headings in cabinet', await p.locator('#cabinet-sets').evaluate((s) => [...s.querySelectorAll('h3')].map((h) => `${h.tagName}>${h.firstElementChild?.tagName}.${h.firstElementChild?.className}:${h.textContent}`)));
      note('UX-cab-2 heading roles', (await p.locator('#cabinet-sets').ariaSnapshot()).split('\n').filter((l) => l.includes('heading')).slice(0, 3));
      note('UX-cab-2 header heights', await p.locator('.shell-set-head').evaluateAll((e) => e.map((x) => Math.round(x.getBoundingClientRect().height))));
      await shot(p, 'm5-ux-cab-2-cabinet.png');
      await p.keyboard.press('Escape'); await w(p);
      // AX-14
      await p.click('#btn-home-settings', { force: true }); await w(p); await p.click('#btn-guide', { force: true }); await w(p);
      note('AX-14 jar guide dialog name', await p.locator('#intro [role=dialog]').evaluate((d) => document.getElementById(d.getAttribute('aria-labelledby'))?.textContent ?? null));
      note('AX-14 by role', await p.getByRole('dialog', { name: await p.textContent('#intro-title') }).count());
      await shot(p, 'm5-ax-14-jar-guide.png');
      await ctx.close();
    }
    // UX-cab-4: win level 5 (a shell level), then open the cabinet
    {
      const { ctx, p } = await open(b, mkSave({ level: 5 }));
      note('UX-cab-4 win level 5', await solve(p));
      note('UX-cab-4 shells after win', (await p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')))).shells);
      await p.click('#btn-win-home', { force: true }); await w(p, 600);
      await p.click('#btn-shells', { force: true }); await w(p);
      note('UX-cab-4 New marks (first open)', await p.locator('.shell-new').evaluateAll((e) => e.map((x) => x.parentElement.querySelector('figcaption').textContent)));
      await p.locator('.shell-new').first().scrollIntoViewIfNeeded(); await shot(p, 'm5-ux-cab-4-new-shell.png');
      await p.keyboard.press('Escape'); await w(p); await p.click('#btn-shells', { force: true }); await w(p);
      note('UX-cab-4 New marks (reopened)', await p.locator('.shell-new').count());
      await ctx.close();
    }
    // UX-board-9 and UX-board-10: the tutorial on iPhone SE at 150% text
    for (const [label, big, device] of [['pixel7', false, 'Pixel 7'], ['se-150', true, 'iPhone SE']]) {
      const { ctx, p } = await open(b, mkSave({ level: 1, tutorialDone: false, shells: [] }), { device, big });
      await p.click('#btn-play', { force: true }); await w(p, 800);
      const r = await p.evaluate(() => {
        const note = document.getElementById('tools-note'); const cap = document.getElementById('coach-text').getBoundingClientRect();
        return { note: note.hidden ? null : note.textContent, described: [...document.querySelectorAll('.tool, #btn-restart')].map((b) => `${b.disabled}:${b.getAttribute('aria-describedby')}`), caption: { left: Math.round(cap.left), right: Math.round(cap.right), height: Math.round(cap.height), vw: innerWidth }, coachShown: !document.getElementById('coach').hidden };
      });
      note(`UX-board-9/10 tutorial ${label}`, r);
      await shot(p, `m5-ux-board-9-10-tutorial-${label}.png`);
      // the second step's caption ("pour") on the other jar
      await p.locator('#board .jar').nth(0).click(); await w(p, 400);
      note(`UX-board-10 second caption ${label}`, await p.evaluate(() => { const c = document.getElementById('coach-text'); const r = c.getBoundingClientRect(); return { text: c.textContent, left: Math.round(r.left), right: Math.round(r.right), height: Math.round(r.height) }; }));
      await shot(p, `m5-ux-board-10-tutorial-step2-${label}.png`);
      await ctx.close();
    }
    // AX-19: level 120 on iPhone SE at 150% text
    {
      const { ctx, p } = await open(b, mkSave({ level: 121 }), { device: 'iPhone SE', big: true, query: '?level=120' });
      note('AX-19 jar draw width / hit width (px)', await p.locator('#board .jar').evaluateAll((js) => js.map((j) => { const w = j.getBoundingClientRect().width; const pad = -parseFloat(getComputedStyle(j, '::before').left); return `${w.toFixed(1)}/${(w + 2 * pad).toFixed(1)}`; })));
      await shot(p, 'm5-ax-19-level120-se-150.png');
      await ctx.close();
    }
  } catch (e) { note('FAILED', String(e).slice(0, 800)); }
  note('errors', errs);
  await b.close();
  fs.writeFileSync(path.join(outDir, 'm5-result.json'), JSON.stringify(out, null, 1));
})();
