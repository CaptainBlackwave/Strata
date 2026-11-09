// usage: node extra.cjs <baseUrl> <out.json>
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const [base, out] = process.argv.slice(2);
const mkSave = (o = {}) => ({
  level: 3, best: {}, wallet: { coins: 5000, boosters: { undo: 3, shuffle: 0, extraJar: 2, hint: 0 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false }, daily: { last: null, streak: 0, best: 0, passes: 0 },
  shells: ['periwinkle'], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false },
  profile: { name: 'Tester', avatar: 'sand-jar', frame: 'plain', plate: 'plain' }, stats: { perfectClears: 0, dailiesSolved: 0, pours: 0, coinsEarned: 0, boostersUsed: 0 }, dailyShare: null, seenWhatsNew: '0.8.0', ...o,
});
const result = {}; const errs = [];
async function open(b, save, query = '', reduce = 'reduce') {
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: reduce, permissions: ['clipboard-read', 'clipboard-write'] });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } Math.random = (() => { let x = 7; return () => ((x = (x * 16807) % 2147483647) / 2147483647); })(); }, JSON.stringify(save));
  const p = await ctx.newPage(); p.setDefaultTimeout(4000);
  p.on('pageerror', (e) => errs.push(String(e))); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + '/' + query); await p.waitForTimeout(900);
  return { ctx, p };
}
const saveOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));
const txt = (p, sel) => p.evaluate((s) => document.querySelector(s)?.textContent ?? null, sel);
const active = (p) => p.evaluate(() => document.activeElement?.id || document.activeElement?.className || document.activeElement?.tagName);
const vis = (p) => p.evaluate(() => [...document.querySelectorAll('#app > *')].filter((e) => !e.hidden && e.id).map((e) => e.id + (e.inert ? '(inert)' : '')).join(','));
const hud = (p) => p.evaluate(() => ({ moves: document.getElementById('moves').textContent, coins: document.getElementById('coins').textContent, tools: [...document.querySelectorAll('.tool[data-booster]')].map((b) => `${b.dataset.booster}:${b.getAttribute('aria-label')}:${b.disabled}:${b.classList.contains('armed')}`), toast: document.getElementById('toast').textContent, jars: [...document.querySelectorAll('#board .jar')].map((j) => j.getAttribute('aria-label')) }));
const click = (p, sel) => p.click(sel, { force: true });
const w = (p, ms = 300) => p.waitForTimeout(ms);
(async () => {
  const b = await chromium.launch();
  try {
    // boosters
    {
      const { ctx, p } = await open(b, mkSave({ wallet: { coins: 5000, boosters: { undo: 3, shuffle: 0, extraJar: 1, hint: 0 } } }));
      await click(p, '#btn-play'); await w(p, 600);
      result.b0 = await hud(p);
      await p.keyboard.press('h'); await w(p); result.bHint1 = await hud(p);           // first tap arms (no charges)
      await p.keyboard.press('h'); await w(p, 500); result.bHint2 = await hud(p); result.bHintSave = (await saveOf(p)).wallet; // second buys
      await p.locator('#board .jar').nth(0).click(); await p.locator('#board .jar').nth(1).click(); await w(p, 500);
      result.bPour = await hud(p);
      await p.keyboard.press('z'); await w(p); result.bUndo = await hud(p);
      await p.keyboard.press('j'); await w(p); result.bJar = await hud(p);
      await p.keyboard.press('j'); await w(p); result.bJar2 = await hud(p);
      await p.keyboard.press('s'); await w(p); await p.keyboard.press('s'); await w(p, 500); result.bShuffle = await hud(p); result.bShuffle.jars = result.bShuffle.jars.join(',').replace(/Jar \d+: /g,'').split(/, |,/).sort().join(','); // shuffle is seeded by Date.now(): compare the colour multiset
      await p.keyboard.press('r'); await w(p); result.bRestart1 = await hud(p); await p.keyboard.press('r'); await w(p); result.bRestart2 = await hud(p);
      result.bSave = await saveOf(p);
      await p.keyboard.press('Shift+Digit1'); await w(p); result.shift1 = await p.evaluate(() => document.querySelectorAll('#board .jar.selected').length);
      await ctx.close();
    }
    // Shift+1 on a board with 11+ jars: use ?level=60 style
    {
      const { ctx, p } = await open(b, mkSave({ level: 200 }), '?level=200');
      result.jars200 = await p.locator('#board .jar').count();
      await p.keyboard.press('Shift+Digit1'); await w(p); result.shift1b = await p.evaluate(() => [...document.querySelectorAll('#board .jar')].findIndex((j) => j.classList.contains('selected')));
      await p.keyboard.press('Shift+Digit2'); await w(p, 400); result.shift2b = await hud(p);
      await p.keyboard.press('Escape'); await w(p);
      await ctx.close();
    }
    // settings, scenes, cabinet, profile, edit, save code, whats new, keyboard
    {
      const { ctx, p } = await open(b, mkSave({ seenWhatsNew: '' }));
      result.k0 = await vis(p); await p.keyboard.press('Tab'); result.k0tab = await active(p); await p.keyboard.press('Escape'); await w(p); result.k0esc = await vis(p) + '|' + (await saveOf(p)).seenWhatsNew;
      await click(p, '#btn-home-settings'); await w(p); result.set0 = await vis(p);
      for (const k of ['sound', 'music', 'haptics', 'patterns', 'southern']) { await click(p, `#set-${k}`); await w(p, 100); }
      result.setSave = (await saveOf(p)).settings;
      const tabs = []; for (let i = 0; i < 14; i++) { await p.keyboard.press('Tab'); tabs.push(await active(p)); } result.setTabs = tabs;
      const stabs = []; for (let i = 0; i < 4; i++) { await p.keyboard.press('Shift+Tab'); stabs.push(await active(p)); } result.setShiftTabs = stabs;
      // scenes via settings
      await click(p, '#btn-scenes-2'); await w(p); result.sc0 = [await vis(p), await txt(p, '#scenes-coins'), await txt(p, '#btn-scene-buy')];
      const cards = await p.locator('.scene-card').evaluateAll((e) => e.map((x) => x.dataset.id));
      result.sceneIds = cards;
      await p.locator('.scene-card').nth(1).click(); await w(p); result.scPrev = [await txt(p, '#scene-previewing'), await txt(p, '#btn-scene-buy'), await p.evaluate(() => document.body.dataset.theme), await active(p)];
      await click(p, '#btn-scene-buy'); await w(p); result.scBuy = [await txt(p, '#btn-scene-buy'), await txt(p, '#scenes-coins'), (await saveOf(p)).themes, await p.evaluate(() => document.body.dataset.theme)];
      await p.locator('.scene-card').nth(0).click(); await w(p); result.scPrev2 = await p.evaluate(() => document.body.dataset.theme);
      await click(p, '#set-auto'); await w(p); result.scAuto = [(await saveOf(p)).themes, await p.evaluate(() => document.body.dataset.theme)];
      await p.keyboard.press('Escape'); await w(p); result.scClosed = [await vis(p), await p.evaluate(() => document.body.dataset.theme), await active(p)];
      // save code
      await click(p, '#btn-savecode'); await w(p); result.tr0 = [await p.inputValue('#transfer-code'), await txt(p, '#transfer-status')];
      await click(p, '#btn-copy-code'); await w(p); result.trCopy = [await txt(p, '#copy-status'), await p.evaluate(() => navigator.clipboard.readText())];
      await p.fill('#transfer-paste', 'garbage'); await click(p, '#btn-restore-code'); await w(p); result.trBad = await txt(p, '#transfer-status');
      await p.fill('#transfer-paste', result.tr0[0].replace(/x/, 'x')); await click(p, '#btn-restore-code'); await w(p); result.trArm = [await txt(p, '#btn-restore-code'), await txt(p, '#transfer-status')];
      await click(p, '#btn-restore-code'); await w(p, 500); result.trDone = [await vis(p), await txt(p, '#toast'), JSON.stringify(await saveOf(p))];
      // whats new from settings
      await click(p, '#btn-home-settings'); await w(p); await click(p, '#btn-whatsnew'); await w(p); result.wn = [await txt(p, '#whatsnew-list'), await vis(p), await active(p)];
      await p.keyboard.press('Escape'); await w(p); await p.keyboard.press('Escape'); await w(p); result.wnEsc = await vis(p);
      // guide
      await click(p, '#btn-home-settings'); await w(p); await click(p, '#btn-guide'); await w(p); result.guide = [await txt(p, '#intro-title'), await txt(p, '#intro-list'), await vis(p)];
      await p.keyboard.press('Escape'); await w(p); await p.keyboard.press('Escape'); await w(p);
      // cabinet
      await click(p, '#btn-shells'); await w(p); result.cab = [await txt(p, '#cabinet-next'), await p.locator('.shell-set').count(), await txt(p, '#cabinet-sets').then((s) => s.length), await active(p)];
      await p.locator('.shell-set-head').first().click(); await w(p); result.cabToggle = await p.locator('.shell-set-head').first().getAttribute('aria-expanded');
      const ct = []; for (let i = 0; i < 6; i++) { await p.keyboard.press('Tab'); ct.push(await active(p)); } result.cabTabs = ct;
      await p.keyboard.press('Escape'); await w(p); result.cabEsc = await vis(p);
      // profile + edit
      await click(p, '#btn-profile'); await w(p); result.prof = [await txt(p, '#profile-level'), await txt(p, '#stats-grid'), await vis(p)];
      await click(p, '#btn-edit-profile'); await w(p); result.edit0 = [await vis(p), await active(p)];
      await p.keyboard.press('ArrowRight'); await w(p); result.editArrow = await active(p);
      await p.locator('#tab-frame').click(); await w(p);
      await p.locator('#grid-frame .pick').nth(1).click({ force: true }); await w(p); result.editPick = [await txt(p, '#pick-note'), await p.locator('#grid-frame .pick[aria-checked=true]').getAttribute('data-id')];
      await p.locator('#tab-plate').click(); await w(p); await p.fill('#name-input', 'Z'); await w(p); result.editBad = [await txt(p, '#name-error'), await txt(p, '#save-error'), await p.locator('#btn-save-profile').isDisabled()];
      await p.fill('#name-input', 'Brisk Dune'); await click(p, '#btn-reroll'); await w(p); result.reroll = await p.inputValue('#name-input');
      await p.keyboard.press('Escape'); await w(p); result.discard = [await vis(p), await active(p)];
      await p.keyboard.press('Escape'); await w(p); result.keep = [await vis(p), await active(p)];
      await p.fill('#name-input', 'Brisk Dune'); await p.press('#name-input', 'Enter'); await w(p); result.editSaved = [JSON.stringify((await saveOf(p)).profile), await vis(p), await txt(p, '#profile-plate')];
      await p.keyboard.press('Escape'); await w(p); await p.keyboard.press('Escape'); await w(p); result.profClosed = await vis(p);
      // leave board dialog
      await click(p, '#btn-play'); await w(p, 600); result.afterPlay = await vis(p); await p.keyboard.press('h'); await w(p, 200); await p.keyboard.press('h'); await w(p, 300); const hv = await p.evaluate(() => [...document.querySelectorAll('#board .jar')].map((e, k) => (e.classList.contains('hint-from') ? 'f' + k : e.classList.contains('hint-to') ? 't' + k : '')).filter(Boolean)); result.hv = hv; if (hv.length === 2) { await p.locator('#board .jar').nth(Number(hv.find((x) => x[0] === 'f').slice(1))).click(); await p.locator('#board .jar').nth(Number(hv.find((x) => x[0] === 't').slice(1))).click(); await w(p, 400); } result.movesNow = await txt(p, '#moves');
      await click(p, '#btn-settings'); await w(p); await click(p, '#btn-home'); await w(p); result.leave = await vis(p);
      await p.keyboard.press('Escape'); await w(p); result.leaveEsc = await vis(p);
      await click(p, '#btn-home'); await w(p); await click(p, '#btn-leave'); await w(p); result.leaveDone = [await vis(p), await txt(p, '#btn-play')];
      await ctx.close();
    }
    // mechanics intro + level with mechanics, pattern colours
    {
      const { ctx, p } = await open(b, mkSave({ level: 40, seenMechanics: [], settings: { sound: false, music: false, haptics: false, patterns: true } }), '?level=40', 'no-preference');
      result.mech = [await vis(p), await txt(p, '#intro-list'), await p.locator('#board .jar.narrow,#board .jar.frozen,#board .jar.locked,#board .jar.funnel').count()];
      await p.keyboard.press('Escape'); await w(p);
      await p.keyboard.press('Digit1'); await p.keyboard.press('Digit2'); await w(p, 800); result.mechPour = await hud(p);
      await ctx.close();
    }
  } catch (e) { result.FAILED = String(e).slice(0, 800); }
  result.errors = errs;
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(Object.keys(result).length, 'keys', result.FAILED || '');
  await b.close();
})();
