// Layout guard (sprint 22 G1, D185): opens every Home tab and every sheet reachable from Home, a
// level board and its win card, at 412px and at 320px with 150% root text, and fails when any
// visible element runs past the screen's left or right edge. Run before every release.
//
// Usage:
//   npm run build && npm run guard:layout            serves dist/ itself on PORT (default 5187)
//   BASE=http://localhost:5173 npm run guard:layout  checks a running dev server instead
// Environment:
//   OUT    report folder (default production/qa/layout-guard/): report.json, plus fail-*.png
//   SHOTS  'fail' (default) screenshots failing screens, 'all' every screen, '0' none
//   ONLY   comma-separated screen names to run (e.g. ONLY=tab-today,sheet-weekly)
//   PORT   port for the built-in dist/ server (default 5187)
// Exit code: 0 all screens fit, 1 overflow found (listed on stdout), 2 the guard itself broke.
//
// What counts: an element with a layout box, visibility not hidden, not inside [aria-hidden="true"],
// not a 1px sr-only box, and not inside a horizontal scroller (overflow-x auto/scroll, e.g. a
// carousel; the scroller itself is still checked, and any that actually scroll are listed as notes).
// Clipping by overflow-x: hidden does not excuse an element: cut-off content is the bug.
// Only the outermost offending element of each overflowing subtree is listed.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 5187);
const OUT = path.resolve(ROOT, process.env.OUT || 'production/qa/layout-guard');
const SHOTS = process.env.SHOTS || 'fail';
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map((s) => s.trim()) : null;
const KEY = 'strata.save.v2';
const TODAY = '2026-11-20'; // a Friday in ISO week 2026-W47, out of event season
const EVENT_DAY = '2026-12-12'; // inside Winter Tide (events.md), for the event card and chooser
const VIEWPORTS = [
  { tag: '412', width: 412, height: 900, text: 100 },
  { tag: '320-150', width: 320, height: 900, text: 150 },
];

// ---------------------------------------------------------------- the rich save

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/config/game-config.json'), 'utf8'));
const allShells = config.collection.sets.flatMap((s) => s.shells.map((x) => x.id));
const allBadges = config.badges.list.map((b) => b.id);
const allScenes = (config.themes?.list || []).map((t) => t.id);
const MECH = config.mechanics.list.map((m) => m.id);
const ONB = { visits: 40, installAsks: 2, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true, pendingShare: null };

/** A long-time player: every Home card has something to show (streak, weekly, goals, coins, shells, badges). */
function richSave(date) {
  const yesterday = new Date(Date.parse(`${date}T12:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return {
    level: 250,
    tutorialDone: true,
    seenWhatsNew: '9.9.9',
    seenMechanics: MECH,
    best: Object.fromEntries(Array.from({ length: 249 }, (_, i) => [String(i + 1), 20 + (i % 17)])),
    perfect: Array.from({ length: 120 }, (_, i) => i * 2 + 1),
    wallet: { coins: 98765, boosters: { undo: 5, shuffle: 12, extraJar: 9, hint: 15 } },
    settings: { sound: false, music: false, haptics: false, realistic: true },
    daily: { last: yesterday, streak: 27, best: 41, passes: 2 },
    shells: allShells.slice(0, Math.max(0, allShells.length - 7)),
    seenShells: Math.max(0, allShells.length - 10),
    badges: allBadges.slice(0, Math.ceil(allBadges.length * 0.6)),
    themes: { owned: allScenes.slice(0, 6), selected: allScenes[0] || 'midday', auto: true },
    scenesPlayed: allScenes.slice(0, 3),
    stats: { perfectClears: 120, dailiesSolved: 64, pours: 23456, coinsEarned: 54321, boostersUsed: 88, jarsSealed: 2400 },
    weekly: { week: '2026-W47', cleared: [1, 2, 3], pours: { 1: 31, 2: 42, 3: 38 } },
    goals: { date, progress: [2, 9, 0], done: [1], bonus: false },
    track: [3, 7, 14, 21],
    events: { wintertide: { year: 2026, cleared: [1, 2, 3, 5, 8], pours: { 1: 18, 2: 22, 3: 25, 5: 31, 8: 27 } } },
    onboarding: ONB,
  };
}

// ---------------------------------------------------------------- the screens

const tab = (t) => async (page) => { await page.click(`#home-tab-${t}`); await page.waitForTimeout(450); };
/** Opens Home tab `t`, clicks `btn` and waits for `sheet` to show. */
const sheet = (t, btn, shown) => async (page) => {
  await tab(t)(page);
  await page.click(btn);
  await page.waitForSelector(`${shown}:not([hidden])`, { timeout: 8000 });
  await page.waitForTimeout(600);
};

const SCREENS = [
  { name: 'tab-play', open: tab('play') },
  { name: 'tab-today', open: tab('today') },
  { name: 'tab-collection', open: tab('collection') },
  { name: 'tab-profile', open: tab('profile') },
  { name: 'sheet-settings', open: sheet('play', '#btn-home-settings', '#settings') },
  { name: 'sheet-all-settings', open: sheet('profile', '#btn-me-settings', '#settings') },
  { name: 'sheet-savecode', open: sheet('profile', '#btn-me-savecode', '#transfer') },
  { name: 'sheet-stats', open: sheet('profile', '#btn-me-stats', '#stats') },
  { name: 'sheet-profile', open: sheet('profile', '#btn-me-more', '#profile') },
  { name: 'sheet-edit-profile', open: sheet('profile', '#btn-edit-me', '#edit-profile') },
  { name: 'sheet-whatsnew', open: sheet('profile', '#btn-me-whatsnew', '#whatsnew') },
  { name: 'sheet-shells', open: sheet('collection', '#btn-shells', '#cabinet') },
  { name: 'sheet-badges', open: sheet('collection', '#btn-badges', '#profile') },
  { name: 'sheet-styles', open: sheet('collection', '#btn-styles', '#styles') },
  { name: 'sheet-scenes', open: sheet('collection', '#btn-scenes', '#scenes') },
  { name: 'map', open: sheet('collection', '#btn-map-tile', '#map') },
  {
    name: 'map-stone', open: async (page) => {
      await sheet('collection', '#btn-map-tile', '#map')(page);
      await page.evaluate(() => document.querySelector('#map .stone[data-level="1"]')?.click());
      await page.waitForSelector('#stone-card:not([hidden])', { timeout: 8000 });
      await page.waitForTimeout(500);
    },
  },
  { name: 'sheet-weekly', open: sheet('today', '#btn-weekly', '#weekly') },
  { name: 'sheet-track', open: sheet('play', '#btn-track', '#track') },
  { name: 'event-home', date: EVENT_DAY, open: tab('play') },
  { name: 'event-today', date: EVENT_DAY, open: tab('today') },
  { name: 'sheet-event', date: EVENT_DAY, open: sheet('play', '#btn-event', '#event') },
  {
    name: 'level-board', query: '?level=250', home: false, open: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll('#board .jar').length > 0, null, { timeout: 15000 });
      await page.waitForTimeout(1200);
    },
  },
  { name: 'win-card', query: '?level=1&board=dom', home: false, open: (page) => winLevel(page) },
];

// ---------------------------------------------------------------- winning a board through the DOM

/** Classic board state as the player sees it: each jar's units bottom-first by colour, '?' when buried. */
const readBoard = (page) => page.evaluate(() => [...document.querySelectorAll('#board .jar')].map((j) =>
  [...j.querySelectorAll('.sand .unit')].map((u) => (u.classList.contains('buried') ? '?' : u.style.getPropertyValue('--c').trim()))));

/** Breadth-first search over pours (rule R6: the top run, as much as fits). Fine for level 1's three colours. */
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

/** Wins the open board by taps along a searched path, then waits for the win card. */
async function winLevel(page) {
  await page.waitForFunction(() => document.querySelectorAll('#board .jar .unit').length > 0, null, { timeout: 15000 });
  await page.waitForTimeout(1200);
  const start = await readBoard(page);
  const moves = solveBoard(start);
  if (!moves) throw new Error(`win-card: no path found for the board ${JSON.stringify(start)}`);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  for (const [f, t, after] of moves) {
    await tapJar(page, f);
    await page.waitForFunction((f) => document.querySelectorAll('#board .jar')[f]?.getAttribute('aria-pressed') === 'true', f, { timeout: 3000 });
    await tapJar(page, t);
    const deadline = Date.now() + 6000;
    while (!same(await readBoard(page), after)) {
      if (Date.now() > deadline) throw new Error(`win-card: pour ${f}->${t} did not land`);
      await page.waitForTimeout(80);
    }
    await page.waitForTimeout(250);
  }
  await page.waitForSelector('#win:not([hidden])', { timeout: 15000 });
  await page.waitForTimeout(1500); // the card's entrance and coin count settle
}

// ---------------------------------------------------------------- the check

/** Runs in the page: the outermost visible elements past either edge of the viewport. */
function findOverflow() {
  const vw = document.documentElement.clientWidth;
  const TOL = 0.5;
  const scrollerCache = new Map();
  const inScroller = (el) => {
    for (let a = el.parentElement; a && a !== document.body && a !== document.documentElement; a = a.parentElement) {
      if (!scrollerCache.has(a)) { const o = getComputedStyle(a).overflowX; scrollerCache.set(a, o === 'auto' || o === 'scroll'); }
      if (scrollerCache.get(a)) return true;
    }
    return false;
  };
  const desc = (e) => {
    const cls = typeof e.className === 'string' ? e.className : e.getAttribute('class') || '';
    return `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ''}${cls.trim() ? `.${cls.trim().split(/\s+/).slice(0, 3).join('.')}` : ''}`;
  };
  const bad = new Map();
  for (const e of document.body.querySelectorAll('*')) {
    if (!e.getClientRects().length) continue;
    if (e.closest('[aria-hidden="true"]')) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse') continue;
    const r = e.getBoundingClientRect();
    if (r.width <= 1 && r.height <= 1) continue; // sr-only text
    if (r.width === 0 || r.height === 0) continue;
    const right = r.right - vw;
    const left = -r.left;
    if (right <= TOL && left <= TOL) continue;
    if (inScroller(e)) continue;
    bad.set(e, { el: desc(e), text: (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40), right: Math.round(Math.max(0, right) * 10) / 10, left: Math.round(Math.max(0, left) * 10) / 10, width: Math.round(r.width) });
  }
  const roots = [...bad.entries()].filter(([e]) => !bad.has(e.parentElement)).map(([, v]) => v);
  const scrollers = [...scrollerCache.entries()].filter(([a, s]) => s && a.getClientRects().length && a.scrollWidth > a.clientWidth + 1 && !a.closest('[aria-hidden="true"]'))
    .map(([a]) => `${desc(a)} (${a.scrollWidth}px in ${a.clientWidth}px)`);
  return { viewport: vw, total: bad.size, over: roots, scrollers };
}

// ---------------------------------------------------------------- serving dist/

function serveDist() {
  if (!fs.existsSync(path.join(DIST, 'index.html'))) throw new Error('dist/index.html is missing: run `npm run build` first, or set BASE to a running server');
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

// ---------------------------------------------------------------- the run

async function openScreen(browser, base, vp, screen) {
  const date = screen.date || TODAY;
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: 1, serviceWorkers: 'block' });
  await ctx.addInitScript(([key, save, text]) => {
    if (!sessionStorage.getItem('guard-seeded')) {
      sessionStorage.setItem('guard-seeded', '1');
      localStorage.setItem(key, JSON.stringify(save));
    }
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
  }, [KEY, richSave(date), vp.text]);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.clock.setFixedTime(new Date(`${date}T12:00:00`));
  await page.goto(`${base}/${screen.query || ''}`);
  await page.waitForFunction(() => !document.getElementById('splash'), null, { timeout: 30000 });
  if (screen.home !== false) await page.waitForFunction(() => !document.getElementById('home').hidden, null, { timeout: 30000 });
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));
  await page.waitForTimeout(500);
  return { ctx, page, errors };
}

(async () => {
  let server = null;
  let base = process.env.BASE ? process.env.BASE.replace(/\/$/, '') : null;
  if (!base) { server = await serveDist(); base = `http://127.0.0.1:${PORT}`; }
  fs.mkdirSync(OUT, { recursive: true });
  for (const f of fs.readdirSync(OUT)) if (/^(fail|screen)-.*\.png$/.test(f)) fs.unlinkSync(path.join(OUT, f));
  const browser = await chromium.launch();
  const report = { base: server ? 'dist/' : base, date: new Date().toISOString(), viewports: VIEWPORTS, screens: [], failures: 0, broken: 0 };
  try {
    for (const vp of VIEWPORTS) {
      for (const screen of SCREENS) {
        if (ONLY && !ONLY.includes(screen.name)) continue;
        const id = `${screen.name}@${vp.tag}`;
        const row = { screen: screen.name, viewport: vp.tag };
        let ctx = null;
        try {
          const o = await openScreen(browser, base, vp, screen);
          ctx = o.ctx;
          await screen.open(o.page);
          Object.assign(row, await o.page.evaluate(findOverflow));
          row.pageErrors = o.errors;
          const failed = row.over.length > 0;
          if (failed) report.failures++;
          if (SHOTS === 'all' || (SHOTS !== '0' && failed)) {
            row.screenshot = path.relative(ROOT, path.join(OUT, `${failed ? 'fail' : 'screen'}-${screen.name}-${vp.tag}.png`));
            await o.page.screenshot({ path: path.join(ROOT, row.screenshot) });
          }
          console.log(`${failed ? 'FAIL' : 'ok  '} ${id}${failed ? '' : row.scrollers.length ? `  (scrolls sideways: ${row.scrollers.join('; ')})` : ''}`);
          for (const b of row.over) console.log(`       ${b.el}${b.text ? ` "${b.text}"` : ''}: ${b.right ? `${b.right}px past the right edge` : ''}${b.right && b.left ? ', ' : ''}${b.left ? `${b.left}px past the left edge` : ''} (width ${b.width}px)`);
        } catch (e) {
          row.error = String(e && e.message ? e.message : e).split('\n')[0];
          report.broken++;
          console.log(`BROKE ${id}: ${row.error}`);
        } finally {
          if (ctx) await ctx.close();
        }
        report.screens.push(row);
      }
    }
  } finally {
    await browser.close();
    if (server) server.close();
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  const checked = report.screens.length - report.broken;
  console.log(`\nlayout guard: ${checked} screens checked, ${report.failures} with overflow, ${report.broken} could not be opened. Report: ${path.relative(ROOT, path.join(OUT, 'report.json'))}`);
  process.exit(report.failures ? 1 : report.broken ? 2 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
