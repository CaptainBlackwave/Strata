// Sprint 25 UI audit capture (based on tools/qa/layout-guard.cjs): screenshots every screen at
// 390x844 and 320x700 with 150% root text, in a light scene (midday) and a dark one (moonlit),
// with board screens on both Classic (?board=dom) and Realistic. Then builds contact sheets.
//
// Usage: npm run build && node production/qa/evidence/sprint-25/audit/capture.cjs
// Env: OUT (output folder, default this one), SCENES (comma-separated scene ids, default midday,moonlit), PORT (default 5191), ONLY (comma-separated screen names), SHEETS=0 to skip contact sheets,
//      JOBS (parallel pages, default 4).
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 5191);
const OUT = process.env.OUT ? path.resolve(process.env.OUT) : __dirname; // sprint 25 U1: OUT for after-shots
const SHOTS = path.join(OUT, 'shots');
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()) : null;
const JOBS = Number(process.env.JOBS || 4);
const KEY = 'strata.save.v2';
const TODAY = '2026-11-20';
const EVENT_DAY = '2026-12-12';
const VIEWPORTS = [
  { tag: '390', width: 390, height: 844, text: 100 },
  { tag: '320t150', width: 320, height: 700, text: 150 },
];
// Sprint 26: SCENES=midday,moonlit,harvestmoon picks the scenes (night ones are tagged dark-<id> after the first).
const SCENES = process.env.SCENES
  ? process.env.SCENES.split(',').map((id, i, all) => ({ tag: ['midday', 'dawn', 'sunset', 'seafog', 'wintersnow', 'highsummer', 'springblossom', 'autumnshore', 'rainbowafterrain', 'softrain'].includes(id.trim()) ? (all.indexOf(id) === 0 ? 'light' : `light-${id.trim()}`) : (id.trim() === 'moonlit' ? 'dark' : `dark-${id.trim()}`), id: id.trim() }))
  : [{ tag: 'light', id: 'midday' }, { tag: 'dark', id: 'moonlit' }];
const IPHONE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/game-config.json'), 'utf8'));
const allShells = config.collection.sets.flatMap((s) => s.shells.map((x) => x.id));
const allBadges = config.badges.list.map((b) => b.id);
const allScenes = (config.themes?.list || []).map((t) => t.id);
const MECH = config.mechanics.list.map((m) => m.id);
const ONB = { visits: 40, installAsks: 2, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true, pendingShare: null };

function richSave(date, scene) {
  const yesterday = new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const owned = [...new Set([...allScenes.slice(0, 6), 'midday', 'moonlit', scene])];
  return {
    level: 250, tutorialDone: true, seenWhatsNew: '9.9.9', seenMechanics: MECH,
    best: Object.fromEntries(Array.from({ length: 249 }, (_, i) => [String(i + 1), 20 + (i % 17)])),
    perfect: Array.from({ length: 120 }, (_, i) => i * 2 + 1),
    wallet: { coins: 98765, boosters: { undo: 5, shuffle: 12, extraJar: 9, hint: 15 } },
    settings: { sound: false, music: false, haptics: false, realistic: true },
    daily: { last: yesterday, streak: 27, best: 41, passes: 2 },
    shells: allShells.slice(0, Math.max(0, allShells.length - 7)),
    seenShells: Math.max(0, allShells.length - 10),
    badges: allBadges.slice(0, Math.ceil(allBadges.length * 0.6)),
    themes: { owned, selected: scene, auto: false },
    scenesPlayed: allScenes.slice(0, 3),
    stats: { perfectClears: 120, dailiesSolved: 64, pours: 23456, coinsEarned: 54321, boostersUsed: 88, jarsSealed: 2400 },
    weekly: { week: '2026-W47', cleared: [1, 2, 3], pours: { 1: 31, 2: 42, 3: 38 } },
    goals: { date, progress: [2, 9, 0], done: [1], bonus: false },
    track: [3, 7, 14, 21],
    events: { wintertide: { year: 2026, cleared: [1, 2, 3, 5, 8], pours: { 1: 18, 2: 22, 3: 25, 5: 31, 8: 27 } } },
    onboarding: ONB,
  };
}

// ---------------------------------------------------------------- screens
const tab = (t) => async (page) => { await page.click(`#home-tab-${t}`); await page.waitForTimeout(500); };
const sheet = (t, btn, shown) => async (page) => {
  await tab(t)(page);
  await page.click(btn);
  await page.waitForSelector(`${shown}:not([hidden])`, { timeout: 8000 });
  await page.waitForTimeout(700);
};
const boardReady = async (page) => {
  await page.waitForFunction(() => document.querySelectorAll('#board .jar').length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(1500);
};

const SCREENS = [
  { area: 'home', name: 'tab-play', open: tab('play') },
  { area: 'home', name: 'tab-today', open: tab('today') },
  { area: 'home', name: 'tab-collection', open: tab('collection') },
  { area: 'home', name: 'tab-profile', open: tab('profile') },
  { area: 'sheets1', name: 'settings', open: sheet('today', '#btn-home-settings', '#settings') },
  { area: 'sheets1', name: 'stats', open: sheet('profile', '#btn-me-stats', '#stats') },
  { area: 'sheets1', name: 'profile', open: sheet('profile', '#btn-me-more', '#profile') },
  { area: 'sheets1', name: 'edit-profile', open: sheet('profile', '#btn-edit-me', '#edit-profile') },
  { area: 'sheets1', name: 'whatsnew', open: sheet('profile', '#btn-me-whatsnew', '#whatsnew') },
  { area: 'sheets2', name: 'shells', open: sheet('collection', '#btn-shells', '#cabinet') },
  { area: 'sheets2', name: 'badges', open: sheet('collection', '#btn-badges', '#profile') },
  { area: 'sheets2', name: 'jar-styles', open: sheet('collection', '#btn-styles', '#styles') },
  { area: 'sheets2', name: 'scenes', open: sheet('collection', '#btn-scenes', '#scenes') },
  { area: 'sheets2', name: 'map', open: sheet('collection', '#btn-map-tile', '#map') },
  { area: 'sheets3', name: 'weekly', open: sheet('today', '#btn-weekly', '#weekly') },
  { area: 'sheets3', name: 'track', open: sheet('play', '#btn-track', '#track') },
  { area: 'sheets3', name: 'event-play', date: EVENT_DAY, open: tab('play') },
  { area: 'sheets3', name: 'event-chooser', date: EVENT_DAY, open: sheet('play', '#btn-event', '#event') },
  { area: 'sheets3', name: 'install', ios: true, open: async (page) => {
    // The card's 700ms timer only opens it when Home is the top layer; on a slow first paint it can miss, so reload and retry.
    for (let i = 0; i < 4; i++) {
      if (await page.waitForSelector('#install:not([hidden])', { timeout: 5000 }).then(() => true, () => false)) break;
      await page.reload(); await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
    }
    await page.waitForSelector('#install:not([hidden])', { timeout: 5000 }); await page.waitForTimeout(800);
  }, save: (s) => ({ ...s, onboarding: { ...s.onboarding, installAsks: 0, installShown: false, installLastAsk: null } }) },
  // board screens: both board modes
  { area: 'board', name: 'board-250', boards: true, query: '?level=250', home: false, open: boardReady },
  { area: 'board', name: 'board-toast', boards: true, query: '?level=250', home: false, open: async (page) => {
    // A refused pour (a full jar onto a full jar) shows the board's toast.
    await boardReady(page); await tapJar(page, 0); await page.waitForTimeout(250); await tapJar(page, 1);
    await page.waitForFunction(() => (document.getElementById('toast')?.textContent || '').trim().length > 0, null, { timeout: 4000 });
    await page.waitForTimeout(300);
  } },
  { area: 'board', name: 'booster-armed', boards: true, query: '?level=250', home: false,
    save: (s) => ({ ...s, wallet: { coins: 98765, boosters: { undo: 0, shuffle: 0, extraJar: 0, hint: 0 } } }),
    open: async (page) => { await boardReady(page); await page.click('#btn-jar'); await page.waitForTimeout(350); } },
  { area: 'board', name: 'mechanic-intro', boards: true, query: '?level=241', home: false, keepIntro: true,
    save: (s) => ({ ...s, level: 241, seenMechanics: MECH.filter((m) => m !== 'tide') }),
    open: async (page) => { await page.waitForSelector('#intro:not([hidden])', { timeout: 20000 }); await page.waitForTimeout(900); } },
  { area: 'board', name: 'jar-guide', boards: true, query: '?level=250', home: false, open: async (page) => {
    await boardReady(page); await page.click('#btn-settings');
    await page.waitForSelector('#settings:not([hidden])', { timeout: 8000 }); await page.waitForTimeout(400);
    await page.click('#btn-guide'); await page.waitForSelector('#intro:not([hidden])', { timeout: 8000 }); await page.waitForTimeout(800);
  } },
  { area: 'board', name: 'win-card', boards: true, query: '?level=1', home: false, open: (page) => winLevel(page) },
  { area: 'board', name: 'tutorial', boards: true, fresh: true, home: false, keepIntro: true, open: async (page) => {
    // The dark run's near-empty save still raises What's new; close it so both scenes show the first screen.
    await page.evaluate(() => document.querySelector('#whatsnew:not([hidden]) #btn-whatsnew-ok')?.click());
    await page.waitForTimeout(600);
    await page.waitForFunction(() => document.querySelectorAll('#board .jar').length > 0, null, { timeout: 20000 });
    await page.waitForTimeout(1800);
  } },
];

// ---------------------------------------------------------------- winning (from layout-guard.cjs)
const readBoard = (page) => page.evaluate(() => [...document.querySelectorAll('#board .jar')].map((j) =>
  [...j.querySelectorAll('.sand .unit')].map((u) => (u.classList.contains('buried') ? '?' : u.style.getPropertyValue('--c').trim()))));
function solveBoard(jars) {
  const counts = {};
  for (const j of jars) for (const c of j) counts[c] = (counts[c] || 0) + 1;
  const cap = Math.max(...Object.values(counts));
  const sealed = (j) => j.length === cap && j.every((c) => c === j[0]);
  const won = (b) => b.every((j) => j.length === 0 || sealed(j));
  const key = (b) => b.map((j) => j.join(',')).join('|');
  const seen = new Set([key(jars)]);
  let frontier = [{ b: jars, path: [] }];
  while (frontier.length && seen.size < 200000) {
    const next = [];
    for (const { b, path: p } of frontier) {
      if (won(b)) return p;
      for (let f = 0; f < b.length; f++) {
        const src = b[f];
        if (!src.length || sealed(src) || src[src.length - 1] === '?') continue;
        const col = src[src.length - 1];
        let run = 0;
        while (run < src.length && src[src.length - 1 - run] === col) run++;
        for (let t = 0; t < b.length; t++) {
          const dst = b[t];
          if (t === f || dst.length >= cap || (dst.length && dst[dst.length - 1] !== col)) continue;
          const n = Math.min(run, cap - dst.length);
          const nb = b.map((j, i) => (i === f ? j.slice(0, j.length - n) : i === t ? [...j, ...Array(n).fill(col)] : j));
          const k = key(nb);
          if (seen.has(k)) continue;
          seen.add(k);
          next.push({ b: nb, path: [...p, [f, t, nb]] });
        }
      }
    }
    frontier = next;
  }
  return null;
}
async function tapJar(page, i) {
  const box = await page.locator('#board .jar').nth(i).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height * 0.6);
}
async function settled(page) {
  const a = await readBoard(page);
  await page.waitForTimeout(200);
  const b = await readBoard(page);
  const sel = await page.evaluate(() => document.querySelectorAll('#board .jar[aria-pressed="true"]').length);
  return JSON.stringify(a) === JSON.stringify(b) && !sel ? b : null;
}
async function winLevel(page) {
  await page.waitForFunction(() => document.querySelectorAll('#board .jar .unit').length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(1200);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (let round = 0; round < 12; round++) {
    if (await page.locator('#win:not([hidden])').count()) break;
    let now = null;
    for (let i = 0; i < 30 && !(now = await settled(page)); i++) {
      const sel = await page.evaluate(() => [...document.querySelectorAll('#board .jar')].findIndex((j) => j.getAttribute('aria-pressed') === 'true'));
      if (sel >= 0) await tapJar(page, sel);
    }
    if (!now) throw new Error('win-card: the board never settled');
    const moves = solveBoard(now);
    if (!moves) throw new Error('win-card: no path');
    let ok = true;
    for (const [f, t, after] of moves) {
      await tapJar(page, f);
      const pressed = await page.waitForFunction((f) => document.querySelectorAll('#board .jar')[f]?.getAttribute('aria-pressed') === 'true', f, { timeout: 1500 }).then(() => true, () => false);
      if (!pressed) { ok = false; break; }
      await tapJar(page, t);
      const deadline = Date.now() + 4000;
      while (!same(await readBoard(page), after)) {
        if (Date.now() > deadline) { ok = false; break; }
        await page.waitForTimeout(80);
      }
      if (!ok) break;
      await page.waitForTimeout(300);
    }
    if (ok) break;
  }
  await page.waitForSelector('#win:not([hidden])', { timeout: 15000 });
  await page.waitForTimeout(1800);
}

// ---------------------------------------------------------------- server
function serveDist() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/index.html missing: npm run build');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wasm': 'application/wasm' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(DIST, url.endsWith('/') ? `${url}index.html` : url);
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => { server.once('error', reject); server.listen(PORT, '127.0.0.1', () => resolve(server)); });
}

// ---------------------------------------------------------------- run
async function shoot(browser, base, job) {
  const { vp, scene, screen, mode } = job;
  const date = screen.date || TODAY;
  let save = screen.fresh ? null : richSave(date, scene.id);
  if (save && screen.save) save = screen.save(save);
  if (screen.fresh) save = { seenWhatsNew: '9.9.9', themes: { owned: ['midday', 'moonlit'], selected: scene.id, auto: false } }; // dark only: picks the scene, nothing else
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, serviceWorkers: 'block', ...(screen.ios ? { userAgent: IPHONE_UA, hasTouch: true } : {}) });
  await ctx.addInitScript(([key, save, text, fresh]) => {
    if (!sessionStorage.getItem('cap-seeded')) {
      sessionStorage.setItem('cap-seeded', '1');
      if (!fresh) localStorage.setItem(key, JSON.stringify(save));
    }
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
  }, [KEY, save, vp.text, !!screen.fresh && scene.tag === 'light']); // dark tutorial: a near-empty save that only picks the scene
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  try {
    await page.clock.setFixedTime(new Date(`${date}T${scene.tag === 'dark' && screen.fresh ? '23' : '12'}:00:00`));
    const q = new URLSearchParams((screen.query || '').replace(/^\?/, ''));
    if (mode === 'classic') q.set('board', 'dom');
    const qs = q.toString();
    await page.goto(`${base}/${qs ? `?${qs}` : ''}`);
    await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
    if (screen.home !== false) await page.waitForFunction(() => !document.getElementById('home').hidden, null, { timeout: 30000 });
    if (!screen.keepIntro) await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
    await page.waitForTimeout(500);
    await screen.open(page);
    const file = `${screen.name}${mode ? `-${mode}` : ''}__${scene.tag}-${vp.tag}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) });
    const info = await page.evaluate(() => ({ theme: document.body.dataset.theme, render: document.getElementById('board')?.dataset.render || '' }));
    return { file, ok: true, errors, ...info };
  } catch (e) {
    const file = `BROKE-${screen.name}${mode ? `-${mode}` : ''}__${scene.tag}-${vp.tag}.png`;
    await page.screenshot({ path: path.join(SHOTS, file) }).catch(() => {});
    return { file, ok: false, error: String(e.message || e).split('\n')[0], errors };
  } finally { await ctx.close(); }
}

async function contactSheets(browser) {
  const groups = {};
  for (const s of SCREENS) {
    for (const mode of s.boards ? ['classic', 'real'] : [null]) {
      const row = `${s.name}${mode ? `-${mode}` : ''}`;
      const area = s.boards ? `board-${mode}` : s.area;
      (groups[area] ||= []).push(row);
    }
  }
  const cols = ['light-390', 'dark-390', 'light-320t150', 'dark-320t150'];
  const page = await browser.newPage({ viewport: { width: 1660, height: 800 }, deviceScaleFactor: 1 });
  const made = [];
  for (const [area, rows] of Object.entries(groups)) {
    const cells = rows.map((r) => `<tr><th>${r}</th>${cols.map((c) => {
      const f = path.join(SHOTS, `${r}__${c}.png`);
      return `<td>${fs.existsSync(f) ? `<img src="file://${f}" style="width:${c.includes('320') ? 320 : 390}px">` : '<i>missing</i>'}</td>`;
    }).join('')}</tr>`).join('');
    const html = `<html><body style="margin:0;background:#888;font:14px system-ui"><table style="border-spacing:8px"><tr><th></th>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>${cells}</table></body></html>`;
    const hf = path.join(OUT, `.sheet-${area}.html`);
    fs.writeFileSync(hf, html);
    await page.goto(`file://${hf}`);
    await page.waitForTimeout(300);
    const out = path.join(OUT, `contact-${area}.png`);
    await page.screenshot({ path: out, fullPage: true });
    fs.unlinkSync(hf);
    made.push(path.relative(ROOT, out));
  }
  await page.close();
  return made;
}

(async () => {
  fs.mkdirSync(SHOTS, { recursive: true });
  const server = await serveDist();
  const base = `http://127.0.0.1:${PORT}`;
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const jobs = [];
  for (const scene of SCENES) for (const vp of VIEWPORTS) for (const screen of SCREENS) {
    if (ONLY && !ONLY.includes(screen.name)) continue;
    for (const mode of screen.boards ? ['classic', 'real'] : [null]) jobs.push({ scene, vp, screen, mode });
  }
  const results = [];
  let next = 0;
  await Promise.all(Array.from({ length: JOBS }, async () => {
    while (next < jobs.length) {
      const job = jobs[next++];
      const r = await shoot(browser, base, job);
      results.push(r);
      console.log(`${r.ok ? 'ok   ' : 'BROKE'} ${r.file}${r.ok ? `  theme=${r.theme} render=${r.render}` : `  ${r.error}`}${r.errors.length ? `  pageErrors=${r.errors.length}` : ''}`);
    }
  }));
  // With ONLY, merge into the earlier report instead of replacing it.
  const rp = path.join(OUT, 'capture-report.json');
  const prev = ONLY && fs.existsSync(rp) ? JSON.parse(fs.readFileSync(rp, 'utf8')).filter((r) => !results.some((n) => n.file === r.file)) : [];
  fs.writeFileSync(rp, JSON.stringify([...prev, ...results].sort((a, b) => a.file.localeCompare(b.file)), null, 2) + '\n');
  if (process.env.SHEETS !== '0') console.log('contact sheets:', (await contactSheets(browser)).join(', '));
  await browser.close();
  server.close();
  console.log(`${results.filter((r) => r.ok).length}/${results.length} captured`);
})().catch((e) => { console.error(e); process.exit(2); });
