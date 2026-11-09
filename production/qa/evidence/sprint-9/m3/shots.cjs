// Sprint 9 M3 (level map) evidence. usage: node shots.cjs <baseUrl> <outDir>
// Serve a build first: npx vite preview --port 5310 --strictPort
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const PROFILE = { name: 'Tester', avatar: 'sand-jar', frame: 'plain', plate: 'plain' };
const bestUpTo = (n) => Object.fromEntries(Array.from({ length: n - 1 }, (_, i) => [String(i + 1), 18 + ((i * 7) % 23)]));
const mkSave = (o = {}) => ({
  level: 3, best: {}, perfect: [], wallet: { coins: 640, boosters: { undo: 3, shuffle: 2, extraJar: 2, hint: 500 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false, southern: false }, daily: { last: null, streak: 0, best: 0, passes: 0 },
  shells: [], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false },
  profile: PROFILE, stats: { perfectClears: 0, dailiesSolved: 0, pours: 0, coinsEarned: 0, boostersUsed: 0 }, dailyShare: null, seenWhatsNew: '0.8.0', ...o,
});
const errs = [];
const result = {};

async function open(b, save, { device = 'Pixel 7', reduced = 'no-preference', query = '', bigText = false, viewport } = {}) {
  const ctx = await b.newContext({ ...devices[device], ...(viewport ? { viewport } : {}), reducedMotion: reduced });
  await ctx.addInitScript(([v, big]) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
    if (big) document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = 'html{font-size:150% !important}'; document.head.append(st); });
  }, [JSON.stringify(save), bigText]);
  const p = await ctx.newPage();
  p.setDefaultTimeout(6000);
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + '/' + query);
  await p.waitForTimeout(900);
  return { ctx, p };
}
const mapInfo = (p) => p.evaluate(() => {
  const sc = document.getElementById('map-scroll');
  const next = document.querySelector('.stone-next');
  const r = next && next.getBoundingClientRect(), s = sc.getBoundingClientRect();
  const sizes = [...document.querySelectorAll('.stone')].map((e) => { const q = e.getBoundingClientRect(); return Math.min(q.width, q.height); });
  return {
    mapShown: !document.getElementById('map').hidden, stonesInDom: document.querySelectorAll('.stone').length, bandsInDom: document.querySelectorAll('.band').length,
    play: document.getElementById('btn-map-play').textContent,
    nextCentreOffset: r ? Math.round(r.top + r.height / 2 - (s.top + s.height / 2)) : null,
    minStonePx: Math.round(Math.min(...sizes)), labels: [...document.querySelectorAll('.stone')].slice(0, 4).map((e) => e.getAttribute('aria-label')),
    bands: [...document.querySelectorAll('.band-name')].map((e) => e.textContent), trackPx: Math.round(document.getElementById('map-track').getBoundingClientRect().height),
  };
});
const active = (p) => p.evaluate(() => document.activeElement && (document.activeElement.getAttribute('aria-label') || document.activeElement.id));
const boardSig = (p) => p.evaluate(() => ({
  level: document.getElementById('level-label').textContent, tag: document.getElementById('challenge-tag').hidden,
  jars: [...document.querySelectorAll('#board .jar')].map((j) => { const r = j.getBoundingClientRect(); return `${j.getAttribute('aria-label')}@${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)}x${Math.round(r.height)}`; }),
}));
async function solveWithHints(p, moves) {
  for (let i = 0; i < 400; i++) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.keyboard.press('h'); await p.waitForTimeout(80);
    const idx = await p.evaluate(() => {
      const kids = [...document.querySelectorAll('#board .jar')];
      const at = (sel) => { const e = document.querySelector(sel); return e ? kids.findIndex((k) => k === e || k.contains(e)) : -1; };
      return [at('#board .hint-from'), at('#board .hint-to')];
    });
    if (idx[0] < 0) { await p.waitForTimeout(300); continue; }
    moves.push(idx);
    await p.locator('#board .jar').nth(idx[0]).click(); await p.locator('#board .jar').nth(idx[1]).click(); await p.waitForTimeout(450);
  }
  await p.waitForTimeout(500);
}
async function replayMoves(p, moves) {
  for (const [a, c] of moves) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.locator('#board .jar').nth(a).click(); await p.locator('#board .jar').nth(c).click(); await p.waitForTimeout(450);
  }
  await p.waitForTimeout(1200);
}
const playClick = async (p) => { await p.locator('#btn-play').click({ force: true }); await p.waitForTimeout(500); };

(async () => {
  const b = await chromium.launch();
  try {
    // 1. the map at levels 3, 60 and 201 (Pixel 7)
    for (const lv of [3, 60, 201]) {
      const perfect = Array.from({ length: lv - 1 }, (_, i) => i + 1).filter((n) => n % 3 === 0 || n === 41);
      const { ctx, p } = await open(b, mkSave({ level: lv, best: bestUpTo(lv), perfect }));
      await playClick(p);
      result[`map${lv}`] = { ...(await mapInfo(p)), focus: await active(p) };
      await p.screenshot({ path: `${out}/map-level-${lv}.png` });
      if (lv === 60) {
        // keyboard: ArrowDown from Play lands on the next stone, then walks down to 41; Enter opens its card
        await p.keyboard.press('ArrowDown');
        result.keysFirst = await active(p);
        for (let i = 0; i < 19; i++) { await p.keyboard.press('ArrowDown'); await p.waitForTimeout(30); }
        await p.waitForTimeout(700);
        result.keysAt41 = await active(p);
        await p.keyboard.press('Enter'); await p.waitForTimeout(300);
        result.card41 = await p.evaluate(() => ({ shown: !document.getElementById('stone-card').hidden, title: document.getElementById('stone-title').textContent, text: document.getElementById('stone-text').innerText, specials: document.getElementById('stone-specials').innerText, replay: !document.getElementById('btn-stone-replay').hidden, focus: document.activeElement.id }));
        await p.screenshot({ path: `${out}/tap-card-cleared-41.png` });
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        result.afterCardEscape = await active(p);
        for (let i = 0; i < 20; i++) { await p.keyboard.press('ArrowUp'); await p.waitForTimeout(30); }
        await p.waitForTimeout(700);
        result.keysAt61 = await active(p);
        await p.keyboard.press('Enter'); await p.waitForTimeout(300);
        result.card61 = await p.evaluate(() => ({ title: document.getElementById('stone-title').textContent, text: document.getElementById('stone-text').innerText, specials: document.getElementById('stone-specials').innerText, replayHidden: document.getElementById('btn-stone-replay').hidden }));
        await p.screenshot({ path: `${out}/tap-card-locked-61.png` });
        await p.keyboard.press('Escape'); await p.waitForTimeout(200);
        await p.keyboard.press('Escape'); await p.waitForTimeout(300);
        result.escapeToHome = await p.evaluate(() => ({ map: !document.getElementById('map').hidden, home: !document.getElementById('home').hidden, focus: document.activeElement.id }));
      }
      await ctx.close();
    }
    // 2. level 500+ (endless, virtualised)
    {
      const { ctx, p } = await open(b, mkSave({ level: 1234, best: bestUpTo(1234) }));
      await playClick(p);
      result.map1234 = await mapInfo(p);
      await p.locator('#map-scroll').evaluate((e) => (e.scrollTop = 0)); await p.waitForTimeout(300);
      result.map1234Top = await mapInfo(p);
      await ctx.close();
    }
    // 3. 150% text on an iPhone SE-sized screen (320 x 568)
    {
      const { ctx, p } = await open(b, mkSave({ level: 60, best: bestUpTo(60), perfect: [41, 57] }), { device: 'iPhone SE', viewport: { width: 320, height: 568 }, bigText: true });
      await playClick(p);
      result.se150 = await mapInfo(p);
      await p.screenshot({ path: `${out}/map-se-320-text-150.png` });
      await p.keyboard.press('ArrowDown'); await p.keyboard.press('ArrowDown'); await p.waitForTimeout(500);
      await p.keyboard.press('Enter'); await p.waitForTimeout(300);
      await p.screenshot({ path: `${out}/tap-card-se-320-text-150.png` });
      result.se150card = await p.evaluate(() => { const c = document.querySelector('.stone-card').getBoundingClientRect(); return { w: Math.round(c.width), h: Math.round(c.height), vw: innerWidth, vh: innerHeight, scrollable: document.querySelector('.stone-card').scrollHeight }; });
      await ctx.close();
    }
    // 4. reduced motion: no pulse, the map jumps to the next level
    {
      const { ctx, p } = await open(b, mkSave({ level: 60, best: bestUpTo(60), perfect: [41] }), { reduced: 'reduce' });
      await playClick(p);
      result.reduced = { ...(await mapInfo(p)), pulse: await p.evaluate(() => getComputedStyle(document.querySelector('.stone-next'), '::after').content) };
      await p.screenshot({ path: `${out}/map-reduced-motion.png` });
      await ctx.close();
      const { ctx: c2, p: p2 } = await open(b, mkSave({ level: 60 }));
      await playClick(p2);
      result.normalPulse = await p2.evaluate(() => getComputedStyle(document.querySelector('.stone-next'), '::after').animationName);
      await c2.close();
    }
    // 5. starting from the map gives the same board as ?level=N
    {
      const s = mkSave({ level: 60, best: bestUpTo(60) });
      const a = await open(b, s, { reduced: 'reduce' });
      await playClick(a.p);
      await a.p.locator('#btn-map-play').click(); await a.p.waitForTimeout(900);
      result.boardFromMap = await boardSig(a.p);
      await a.p.screenshot({ path: `${out}/board-level-60-from-map.png` });
      await a.ctx.close();
      const q = await open(b, s, { reduced: 'reduce', query: '?level=60' });
      await q.p.waitForTimeout(500);
      result.boardFromQuery = await boardSig(q.p);
      await q.ctx.close();
      result.boardSame = JSON.stringify(result.boardFromMap) === JSON.stringify(result.boardFromQuery);
    }
    // 6. the tutorial player is unchanged; level 1 plays directly
    {
      const { ctx, p } = await open(b, mkSave({ level: 1, tutorialDone: false }));
      await playClick(p);
      result.tutorial = await p.evaluate(() => ({ map: !document.getElementById('map').hidden, home: !document.getElementById('home').hidden, label: document.getElementById('level-label').textContent, coach: !document.getElementById('coach').hidden }));
      await ctx.close();
      const l1 = await open(b, mkSave({ level: 1 }));
      await playClick(l1.p);
      result.level1 = await l1.p.evaluate(() => ({ map: !document.getElementById('map').hidden, home: !document.getElementById('home').hidden, label: document.getElementById('level-label').textContent }));
      await l1.ctx.close();
    }
    // 7. a replay from the map: Perfect earned, no coins, Continue goes back to the map
    {
      const moves = [];
      const first = await open(b, mkSave({ level: 5 }), { reduced: 'reduce', query: '?level=3' });
      await solveWithHints(first.p, moves);
      await first.ctx.close();
      const s = mkSave({ level: 5, best: { '1': 20, '2': 22, '3': moves.length, '4': 25 }, perfect: [], stats: { perfectClears: 9, dailiesSolved: 0, pours: 0, coinsEarned: 0, boostersUsed: 0 } });
      const { ctx, p } = await open(b, s, { reduced: 'reduce' });
      await playClick(p);
      await p.locator('.stone[data-level="3"]').click(); await p.waitForTimeout(300);
      await p.locator('#btn-stone-replay').click(); await p.waitForTimeout(900);
      await replayMoves(p, moves);
      result.replayWin = await p.evaluate(() => ({ title: document.getElementById('win-title').textContent, text: document.getElementById('win-text').textContent, note: document.getElementById('win-note').textContent, rewardHidden: document.getElementById('win-reward').hidden, next: document.getElementById('btn-next').textContent, unlocks: document.getElementById('win-unlocks').innerText }));
      result.replaySave = await p.evaluate(() => { const v = JSON.parse(localStorage.getItem('strata.save.v2')); return { level: v.level, coins: v.wallet.coins, perfect: v.perfect, perfectClears: v.stats.perfectClears, best3: v.best['3'] }; });
      await p.screenshot({ path: `${out}/replay-win-perfect-earned.png` });
      await p.locator('#btn-next').click(); await p.waitForTimeout(500);
      result.afterReplayContinue = { ...(await mapInfo(p)), stone3: await p.locator('.stone[data-level="3"]').getAttribute('aria-label') };
      await p.screenshot({ path: `${out}/map-after-replay.png` });
      await ctx.close();
    }
  } finally {
    await b.close();
  }
  result.errors = errs;
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 1));
})();
