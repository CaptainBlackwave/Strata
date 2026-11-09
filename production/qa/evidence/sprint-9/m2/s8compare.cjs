// usage: node s8compare.cjs <baseUrl> <out.json> [shotDir]
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const [base, out, shotDir] = process.argv.slice(2);
const PROFILE = { name: 'Tester', avatar: 'sand-jar', frame: 'plain', plate: 'plain' };
const mkSave = (o = {}) => ({
  level: 3, best: {}, wallet: { coins: 5000, boosters: { undo: 3, shuffle: 2, extraJar: 2, hint: 500 } }, tutorialDone: true,
  settings: { sound: false, music: false, haptics: false, patterns: false }, daily: { last: null, streak: 0, best: 0, passes: 0 },
  shells: [], seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], themes: { owned: ['midday'], selected: 'midday', auto: false },
  profile: PROFILE, stats: { perfectClears: 0, dailiesSolved: 0, pours: 0, coinsEarned: 0, boostersUsed: 0 }, dailyShare: null, seenWhatsNew: '0.8.0', ...o,
});
const result = {};
const errs = [];

async function open(b, save, query = '') {
  const ctx = await b.newContext({ ...devices['Pixel 7'], reducedMotion: 'reduce' });
  await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save));
  const p = await ctx.newPage();
  p.setDefaultTimeout(5000);
  p.on('pageerror', (e) => errs.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
  await p.goto(base + '/' + query);
  await p.waitForTimeout(900);
  return { ctx, p };
}

const domDump = (p) => p.evaluate(() => {
  const rows = [];
  for (const el of document.querySelectorAll('#app *, #announce')) {
    if (el.closest('svg') && el.tagName !== 'svg') continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).filter(Boolean).join('|');
    const t = el.getAttribute('title'), a = el.getAttribute('aria-label');
    if (own || t || a) rows.push(`${el.id || el.className || el.tagName}\t${own}\t${t ?? ''}\t${a ?? ''}`);
  }
  return rows;
});

const winCard = (p) => p.evaluate(() => {
  const g = (id) => document.getElementById(id);
  return {
    shown: !g('win').hidden, title: g('win-title').textContent, text: g('win-text').textContent,
    rewardHidden: g('win-reward').hidden, coins: g('win-coins').textContent, rewardSr: g('win-reward-sr').textContent,
    note: g('win-note').textContent, shellHidden: g('win-shell').hidden, shellText: g('win-shell-text').textContent, shellArt: g('win-shell-art').innerHTML.length > 0,
    unlocks: g('win-unlocks').innerText, shareHidden: g('btn-share').hidden, homeBtnHidden: g('btn-win-home').hidden,
    next: g('btn-next').textContent, described: document.querySelector('.win-card').getAttribute('aria-describedby'), avatarHidden: g('win-avatar').hidden, hudCoins: g('coins').textContent,
  };
});
const saveOf = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('strata.save.v2')));

async function solve(p, moves) {
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
async function replay(p, moves) {
  for (const [a, b] of moves) {
    if (await p.locator('#win:not([hidden])').count()) break;
    await p.locator('#board .jar').nth(a).click(); await p.locator('#board .jar').nth(b).click(); await p.waitForTimeout(450);
  }
  await p.waitForTimeout(500);
}

(async () => {
  const b = await chromium.launch();
  try {
  // static labels at boot and after opening every screen
  {
    const { ctx, p } = await open(b, mkSave({ seenWhatsNew: '' }));
    result.staticBootWhatsNew = await domDump(p);
    await p.keyboard.press('Escape'); await p.waitForTimeout(200);
    result.staticHome = await domDump(p);
    const steps = [['profile', '#btn-profile'], ['cabinet', '#btn-shells'], ['scenes', '#btn-scenes'], ['settings', '#btn-home-settings']];
    for (const [name, sel] of steps) {
      await p.click(sel, { force: true }); await p.waitForTimeout(350);
      result['static_' + name] = await domDump(p);
      if (shotDir) await p.screenshot({ path: `${shotDir}/${name}.png` });
      if (name === 'profile') { await p.click('#btn-edit-profile', { force: true }); await p.waitForTimeout(350); result.static_edit = await domDump(p); if (shotDir) await p.screenshot({ path: `${shotDir}/edit.png` }); await p.keyboard.press('Escape'); await p.waitForTimeout(250); }
      if (name === 'settings') {
        await p.click('#btn-savecode', { force: true }); await p.waitForTimeout(350); result.static_savecode = await domDump(p); if (shotDir) await p.screenshot({ path: `${shotDir}/savecode.png` }); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
        await p.click('#btn-whatsnew', { force: true }).catch(() => {}); await p.waitForTimeout(350); result.static_whatsnew = await domDump(p); if (shotDir) await p.screenshot({ path: `${shotDir}/whatsnew.png` }); await p.keyboard.press('Escape'); await p.waitForTimeout(250);
      }
      await p.keyboard.press('Escape'); await p.waitForTimeout(250);
    }
    // in-game HUD
    await p.click('#btn-play', { force: true }).catch(() => {}); await p.waitForTimeout(600);
    result.staticGame = await domDump(p);
    await ctx.close();
  }
  // level first clear, then Continue
  const lvMoves = [];
  {
    const { ctx, p } = await open(b, mkSave());
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(600);
    await solve(p, lvMoves);
    result.levelFirst = await winCard(p); result.levelFirstSave = await saveOf(p);
    if (shotDir) await p.screenshot({ path: `${shotDir}/win-level-first.png` });
    await ctx.close();
  }
  // level 5 first clear: shell milestone
  {
    const { ctx, p } = await open(b, mkSave({ level: 5 }));
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(600);
    await solve(p, []);
    result.levelShell = await winCard(p); result.levelShellSave = await saveOf(p);
    if (shotDir) await p.screenshot({ path: `${shotDir}/win-level-shell.png` });
    await ctx.close();
  }
  // level 5 with 4 tidepool shells owned: set completion
  {
    const { ctx, p } = await open(b, mkSave({ level: 5, shells: ['periwinkle', 'limpet', 'cockle', 'mussel'] }));
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(600);
    await solve(p, []);
    result.levelSet = await winCard(p); result.levelSetSave = await saveOf(p);
    if (shotDir) await p.screenshot({ path: `${shotDir}/win-level-set.png` });
    await ctx.close();
  }
  // replay: level 3 again while save is at level 8
  {
    const { ctx, p } = await open(b, mkSave({ level: 8, best: { 3: 999 } }), '?level=3');
    await solve(p, []);
    result.levelReplay = await winCard(p); result.levelReplaySave = await saveOf(p);
    if (shotDir) await p.screenshot({ path: `${shotDir}/win-level-replay.png` });
    await ctx.close();
  }
  // Perfect: replay the hint moves recorded on level 3 with no boosters
  {
    const { ctx, p } = await open(b, mkSave());
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(600);
    await replay(p, lvMoves);
    result.levelPerfect = await winCard(p); result.levelPerfectSave = await saveOf(p);
    if (shotDir) await p.screenshot({ path: `${shotDir}/win-level-perfect.png` });
    await ctx.close();
  }
  // daily: counted, then replay the same day
  {
    const { ctx, p } = await open(b, mkSave());
    await p.click('#btn-daily', { force: true }); await p.waitForTimeout(700); await p.locator('#intro:not([hidden]) #btn-intro-ok').click({ timeout: 800 }).catch(() => {}); await p.waitForTimeout(300);
    await solve(p, []);
    result.dailyFirst = await winCard(p); result.dailyFirstSave = await saveOf(p);
    if (shotDir) await p.screenshot({ path: `${shotDir}/win-daily-first.png` });
    await p.click('#btn-next'); await p.waitForTimeout(500);
    await p.click('#btn-daily', { force: true }); await p.waitForTimeout(700); await p.locator('#intro:not([hidden]) #btn-intro-ok').click({ timeout: 800 }).catch(() => {}); await p.waitForTimeout(300);
    await solve(p, []);
    result.dailyReplay = await winCard(p); result.dailyReplaySave = await saveOf(p);
    if (shotDir) await p.screenshot({ path: `${shotDir}/win-daily-replay.png` });
    await ctx.close();
  }
  // daily out of order (device date earlier than the last solve)
  {
    const { ctx, p } = await open(b, mkSave({ daily: { last: '2099-01-01', streak: 3, best: 3, passes: 0 } }));
    await p.click('#btn-daily', { force: true }); await p.waitForTimeout(700); await p.locator('#intro:not([hidden]) #btn-intro-ok').click({ timeout: 800 }).catch(() => {}); await p.waitForTimeout(300);
    await solve(p, []);
    result.dailyOutOfOrder = await winCard(p); result.dailyOutOfOrderSave = await saveOf(p);
    await ctx.close();
  }
  // tutorial
  {
    const { ctx, p } = await open(b, mkSave({ tutorialDone: false, level: 1 }));
    await p.click('#btn-play', { force: true }); await p.waitForTimeout(700);
    for (let pass = 0; pass < 12 && !(await p.locator('#win:not([hidden])').count()); pass++) {
      const n = await p.locator('#board .jar').count();
      for (let i = 0; i < n && !(await p.locator('#win:not([hidden])').count()); i++) for (let j = 0; j < n; j++) {
        if (i === j) continue;
        await p.locator('#board .jar').nth(i).click({ force: true }); await p.locator('#board .jar').nth(j).click({ force: true }); await p.waitForTimeout(120);
        if (await p.locator('#win:not([hidden])').count()) break;
      }
    }
    await p.waitForTimeout(600);
    result.tutorial = await winCard(p); result.tutorialSave = await saveOf(p);
    if (shotDir) await p.screenshot({ path: `${shotDir}/win-tutorial.png` });
    await ctx.close();
  }
  } catch (e) { result.FAILED = String(e).slice(0, 600); }
  result.errors = errs;
  fs.writeFileSync(out, JSON.stringify(result, null, 1));
  console.log(Object.keys(result).join(' '), result.FAILED || '');
  await b.close();
})();
