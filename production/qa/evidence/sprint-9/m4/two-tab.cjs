// Sprint 9 M4 (D57, TD-14): two tabs in one browser context share one save; the newest tab takes over.
// usage: node two-tab.cjs <baseUrl> <outDir>    (after `npm run build` and `npx vite preview --port 5320 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, outDir] = process.argv.slice(2);
const SAVE = {
  level: 1, best: {}, wallet: { coins: 100, boosters: { undo: 0, shuffle: 0, extraJar: 0, hint: 60 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, daily: { last: null, streak: 0, best: 0, passes: 0 },
  shells: [], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false },
  profile: { name: 'Tab Tester', avatar: 'sand-jar', frame: 'plain', plate: 'plain' }, stats: { perfectClears: 0, dailiesSolved: 0, pours: 0, coinsEarned: 0, boostersUsed: 0 }, dailyShare: null, seenWhatsNew: '0.8.0',
};
const log = []; const errs = [];
const note = (k, v) => { log.push([k, v]); console.log(k, JSON.stringify(v)); };
const w = (p, ms = 300) => p.waitForTimeout(ms);
const saveOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
const brief = (s) => ({ level: s.level, coins: s.wallet.coins, hints: s.wallet.boosters.hint, best: s.best, pours: s.stats.pours, sound: s.settings.sound });
const view = (p) => p.evaluate(() => ({
  shown: [...document.querySelectorAll('#app > *')].filter((e) => !e.hidden && e.id).map((e) => e.id + (e.inert ? '(inert)' : '')).join(','),
  overlay: !document.getElementById('other-tab').hidden,
  focus: document.activeElement?.id || document.activeElement?.tagName,
  play: document.getElementById('btn-play').textContent,
}));
async function newTab(ctx, name) {
  const p = await ctx.newPage(); p.setDefaultTimeout(5000);
  p.on('pageerror', (e) => errs.push(`${name}: ${e}`)); p.on('console', (m) => m.type() === 'error' && errs.push(`${name}: ${m.text()}`));
  await p.goto(base + '/'); await w(p, 900);
  return p;
}
/** Plays the open board to a win with hints: press H, follow the ring, repeat. */
async function solve(p) {
  await p.click('#btn-play', { force: true }); await w(p, 700); if (await p.locator('#map:not([hidden])').count()) { await p.click('#btn-map-play', { force: true }); await w(p, 700); } // M3: Play opens the map
  for (let i = 0; i < 120; i++) {
    if (await p.evaluate(() => !document.getElementById('win').hidden)) return true;
    await p.keyboard.press('h'); await w(p, 200);
    const hv = await p.evaluate(() => { const j = [...document.querySelectorAll('#board .jar')]; return [j.findIndex((e) => e.classList.contains('hint-from')), j.findIndex((e) => e.classList.contains('hint-to'))]; });
    if (hv[0] >= 0 && hv[1] >= 0) { await p.locator('#board .jar').nth(hv[0]).click(); await p.locator('#board .jar').nth(hv[1]).click(); }
    await w(p, 450);
  }
  return false;
}
/** Every write path a covered tab could still reach by script: toggle Sound (writes the save). */
const tryWrite = (p) => p.evaluate(() => { document.getElementById('set-sound').click(); document.getElementById('btn-next').click(); });

async function scenario(b, fallback) {
  const tag = fallback ? 'fallback' : 'bc';
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.addInitScript(([v, fb]) => {
    if (fb) delete window.BroadcastChannel; // force the storage-event channel
    if (!localStorage.getItem('strata.save.v2')) localStorage.setItem('strata.save.v2', v);
  }, [JSON.stringify(SAVE), fallback]);
  const A = await newTab(ctx, `A-${tag}`);
  note(`${tag}: A opened`, await view(A));
  note(`${tag}: A wins level 1`, await solve(A));
  const afterA = await saveOf(A); note(`${tag}: save after A's win`, brief(afterA));
  const B = await newTab(ctx, `B-${tag}`);
  await w(A, 400);
  const aView = await view(A); note(`${tag}: B opened; A shows`, aView); note(`${tag}: B shows`, await view(B));
  if (!fallback) { await A.bringToFront(); await A.screenshot({ path: path.join(outDir, 'm4-a-overlay.png') }); }
  else await A.screenshot({ path: path.join(outDir, 'm4-a-overlay-fallback.png') });
  // Escape and a tap on the board must not get past the overlay.
  await A.keyboard.press('Escape'); await A.mouse.click(200, 700); await w(A); note(`${tag}: A after Escape and a tap`, await view(A));
  // B plays on; A tries to write; B's save must survive.
  await B.bringToFront(); note(`${tag}: B wins level 2`, await solve(B));
  const afterB = await saveOf(B); note(`${tag}: save after B's win`, brief(afterB));
  await tryWrite(A); await w(A, 400);
  const afterAWrite = await saveOf(B); note(`${tag}: save after A tried to write`, brief(afterAWrite));
  note(`${tag}: A did not overwrite B`, JSON.stringify(afterAWrite) === JSON.stringify(afterB));
  // A takes over.
  await A.bringToFront(); await A.click('#btn-play-here'); await w(A, 700); await w(B, 300);
  note(`${tag}: A after Play here`, await view(A)); note(`${tag}: B after A's Play here`, await view(B));
  if (!fallback) { await B.bringToFront(); await B.screenshot({ path: path.join(outDir, 'm4-b-overlay-after-play-here.png') }); await A.bringToFront(); await A.screenshot({ path: path.join(outDir, 'm4-a-home-after-play-here.png') }); }
  note(`${tag}: A wins level 3`, await solve(A));
  await tryWrite(B); await w(B, 400);
  const end = await saveOf(A); note(`${tag}: final save`, brief(end));
  note(`${tag}: no save lost (level 4, best has 1-3)`, end.level === 4 && ['1', '2', '3'].every((k) => k in end.best));
  await ctx.close();
}
(async () => {
  const b = await chromium.launch();
  try { await scenario(b, false); await scenario(b, true); } catch (e) { note('FAILED', String(e).slice(0, 600)); }
  note('errors', errs);
  await b.close();
  fs.writeFileSync(path.join(outDir, 'two-tab-result.json'), JSON.stringify(log, null, 1));
})();
