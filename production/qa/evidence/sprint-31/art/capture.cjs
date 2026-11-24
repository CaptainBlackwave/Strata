// Sprint 31 visual check of the Christmas art: the Holly cap, Sparkle glass, Winter Tide board 25, the
// map's December lights, the Home garland, New Tide's sparkles, the gift / start card and the scene
// picker's Festive tags. Each shot fixes the browser clock (context.clock.setFixedTime, noon UTC).
// Save seeding follows sprint-30/capture.cjs; sealed jars come from a crafted board started with
// beginSession (as sprint-29/jars.cjs does), board 25 from startEvent('wintertide', 2026, 25).
// Usage (dev server running):  PORT=5244 node production/qa/evidence/sprint-31/art/capture.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const config = require('../../../../../src/config/game-config.json');
const BASE = `http://localhost:${process.env.PORT || 5244}`;
const KEY = 'strata.save.v2';
const ALL = config.mechanics.list.map((m) => m.id);
const out = (f) => path.join(__dirname, f);
const LOOKS = [{ board: 'dom', scene: 'midday', look: 'light' }, { board: 'gpu', scene: 'moonlit', look: 'dark' }];
// Items 1, 2 and 4: every board in both themes.
const LOOKS4 = [...LOOKS, { board: 'dom', scene: 'moonlit', look: 'dark' }, { board: 'gpu', scene: 'midday', look: 'light' }];
const QUIET = { gifts: { christmas: 2026 }, startCards: { wintertide: 2026, newtide: 2026 } };

async function open(browser, { day, query = '', board = 'dom', scene = 'midday', width = 412, height = 900, text = 100, reduced = false, styles = null, extra = QUIET }) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, serviceWorkers: 'block', reducedMotion: reduced ? 'reduce' : 'no-preference' });
  await context.clock.setFixedTime(new Date(`${day}T12:00:00Z`));
  await context.addInitScript(([key, seen, board, text, scene, styles, extra]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    Object.assign(s, { tutorialDone: true, level: 400, seenMechanics: seen, seenWhatsNew: '9.9.9' }, extra);
    s.wallet = { coins: 5000, boosters: { hint: 3, shuffle: 3, extraJar: 1, undo: 5 } };
    s.themes = { owned: ['midday', scene, 'wintersnow', 'winterlights'], selected: scene, auto: false };
    if (styles) s.styles = styles;
    s.settings = { ...(s.settings || {}), sound: false, music: false, haptics: false, patterns: false, realistic: board === 'gpu' };
    s.onboarding = { ...(s.onboarding || {}), visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
    localStorage.setItem(key, JSON.stringify(s));
    if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
  }, [KEY, ALL, board, text, scene, styles, extra]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/?board=${board}${query}`);
  await page.waitForFunction(() => !!document.querySelector('#board'), null, { timeout: 30000 });
  await page.evaluate(async () => { window.__S = (await import('/src/ui/state.ts')).state; });
  await page.waitForTimeout(1500);
  return { context, page, errors };
}

const closeOverlays = (page) => page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok, #intro:not([hidden]) #btn-intro-ok').forEach((b) => b.click()));

/** A board with four sealed jars, two mixed and a spare, so the cork shows on the sealed ones. */
const CRAFT = { capacity: 4, jars: [
  { units: [0, 0, 0, 0], hidden: 0 }, { units: [1, 1, 1, 1], hidden: 0 }, { units: [2, 2, 2, 2], hidden: 0 },
  { units: [3, 4, 3], hidden: 0 }, { units: [4, 3, 4], hidden: 0 }, { units: [5, 5, 5, 5], hidden: 0 }, { units: [3, 4], hidden: 0 }, { units: [], hidden: 0 },
] };
const crafted = async (page, festive = false) => {
  await page.evaluate(async ([b, f]) => { const { beginSession } = await import('/src/ui/screens/board.ts'); window.__S.mode = 'level'; beginSession(b, false, f); }, [CRAFT, festive]);
  await page.waitForFunction(() => document.querySelectorAll('#board .jar.sealed').length >= 4, null, { timeout: 15000 });
  await page.waitForTimeout(1500);
};
/** A close-up of jar `i`'s top (the cork) and the full first jar. */
const zoom = async (page, i, file) => {
  const b = await page.locator('#board .jar').nth(i).boundingBox();
  await page.screenshot({ path: out(file), clip: { x: Math.max(0, b.x - 14), y: Math.max(0, b.y - 30), width: b.width + 28, height: Math.min(b.height * 0.55, 120) + 30 } });
};
const boardFacts = (page) => page.evaluate(() => ({
  render: document.getElementById('board').dataset.render, cork: document.getElementById('board').dataset.cork ?? document.documentElement.dataset.cork,
  festive: document.getElementById('board').classList.contains('festive-board'), sealed: document.querySelectorAll('#board .jar.sealed').length,
  label: document.getElementById('level-label')?.textContent, scrollW: document.documentElement.scrollWidth,
}));
const homeReady = async (page) => { await page.waitForSelector('#home:not([hidden])', { timeout: 30000 }); await page.waitForTimeout(400); await closeOverlays(page); await page.waitForTimeout(500); };

/** Visible leaf text/controls inside #home that overlap the garland. */
const garlandOverlap = (page) => page.evaluate(() => {
  const g = document.getElementById('home-garland');
  if (!g || g.hidden) return { shown: false };
  const r = g.getBoundingClientRect();
  const hits = [];
  for (const el of document.querySelectorAll('#home *')) {
    if (el === g || el.contains(g) || g.contains(el) || !el.getClientRects().length) continue;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) || el.matches('button, a, input, svg, img');
    if (!own || getComputedStyle(el).visibility === 'hidden') continue;
    const e = el.getBoundingClientRect();
    if (e.right > r.left && e.left < r.right && e.bottom > r.top + 2 && e.top < r.bottom - 2) hits.push(`${el.tagName.toLowerCase()}#${el.id}.${[...el.classList].join('.')} [${Math.round(e.top)}-${Math.round(e.bottom)}]`);
  }
  return { shown: true, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], hits: hits.slice(0, 12) };
});

/** Bulbs that touch a stone or a stone's number; also how many bulbs and the twinkle state. */
const lightsCheck = (page) => page.evaluate(() => {
  const svg = document.querySelector('.map-lights');
  const bulbs = [...document.querySelectorAll('.map-lights .bulb circle:not(.bulb-halo)')].map((c) => c.getBoundingClientRect()).filter((b) => b.bottom > 0 && b.top < innerHeight);
  const stones = [...document.querySelectorAll('.stone')].map((s) => s.getBoundingClientRect()).filter((b) => b.bottom > 0 && b.top < innerHeight);
  let touching = 0;
  for (const b of bulbs) if (stones.some((s) => b.right > s.left && b.left < s.right && b.bottom > s.top && b.top < s.bottom)) touching++;
  const first = document.querySelector('.map-lights .bulb');
  return { bulbsInView: bulbs.length, stonesInView: stones.length, bulbsTouchingStones: touching, still: svg?.classList.contains('still'), anim: first ? getComputedStyle(first).animationName : null, scrollW: document.documentElement.scrollWidth };
});

async function run() {
  const browser = await chromium.launch();
  const log = {};
  const rec = async (name, fn, ctx) => { try { log[name] = { ...(await fn()), errors: ctx.errors }; } catch (e) { log[name] = { failed: String(e).slice(0, 300), errors: ctx.errors }; } await ctx.context.close(); };

  // 1-2. Holly cap and Sparkle glass worn on a crafted board with sealed jars, both boards, light and dark.
  for (const piece of [{ tag: 'holly-cap', worn: { glass: 'clear', cork: 'holly', sand: 'plain' } }, { tag: 'sparkle-glass', worn: { glass: 'sparkle', cork: 'cork', sand: 'plain' } }]) for (const v of LOOKS4) {
    const ctx = await open(browser, { day: '2026-11-24', query: '&level=400', board: v.board, scene: v.scene, styles: { owned: ['cork:holly', 'glass:sparkle'], worn: piece.worn } });
    await rec(`${piece.tag}-${v.board}-${v.look}`, async () => {
      await closeOverlays(ctx.page);
      await crafted(ctx.page);
      await ctx.page.screenshot({ path: out(`${piece.tag}-${v.board}-${v.look}.png`) });
      await zoom(ctx.page, 0, `${piece.tag}-${v.board}-${v.look}-zoom.png`);
      return boardFacts(ctx.page);
    }, ctx);
  }

  // 3. The Jar styles sheet: both pieces locked (nothing owned), then owned and worn.
  for (const s of [{ tag: 'locked', styles: { owned: [], worn: { glass: 'clear', cork: 'cork', sand: 'plain' } } }, { tag: 'owned', styles: { owned: ['cork:holly', 'glass:sparkle'], worn: { glass: 'sparkle', cork: 'holly', sand: 'plain' } } }]) for (const v of LOOKS) {
    const ctx = await open(browser, { day: '2026-11-24', board: v.board, scene: v.scene, styles: s.styles });
    await rec(`styles-sheet-${s.tag}-${v.look}`, async () => {
      await homeReady(ctx.page);
      await ctx.page.evaluate(async () => (await import('/src/ui/screens/sheets/styles.ts')).openStyles(null));
      await ctx.page.waitForSelector('#styles:not([hidden]) .style-piece', { timeout: 15000 });
      await ctx.page.waitForTimeout(900);
      await ctx.page.screenshot({ path: out(`styles-sheet-${s.tag}-${v.look}-top.png`) });
      const rows = {};
      for (const [slot, id] of [['glass', 'sparkle'], ['cork', 'holly']]) {
        const el = ctx.page.locator(`#styles .style-piece[data-slot="${slot}"][data-id="${id}"]`);
        await el.scrollIntoViewIfNeeded();
        await ctx.page.waitForTimeout(400);
        await ctx.page.screenshot({ path: out(`styles-sheet-${s.tag}-${v.look}-${id}.png`) });
        rows[id] = await el.innerText();
      }
      return { rows };
    }, ctx);
  }

  // 4. Winter Tide board 25 on Christmas Day (started as the chooser does), both boards, light and dark;
  //    plus the chooser with the festive tile, and a crafted festive board so the sealed jars show the cap.
  for (const v of LOOKS4) {
    const ctx = await open(browser, { day: '2026-12-25', board: v.board, scene: v.scene });
    await rec(`board25-${v.board}-${v.look}`, async () => {
      await homeReady(ctx.page);
      await ctx.page.evaluate(async () => (await import('/src/ui/screens/sheets/event.ts')).openEvent(null));
      await ctx.page.waitForSelector('#event:not([hidden]) .event-board', { timeout: 15000 });
      await ctx.page.waitForTimeout(900);
      await ctx.page.locator('.event-board.festive').scrollIntoViewIfNeeded().catch(() => {});
      await ctx.page.waitForTimeout(300);
      await ctx.page.screenshot({ path: out(`event-chooser-2026-12-25-${v.look}.png`) });
      const tile = await ctx.page.locator('.event-board.festive').getAttribute('aria-label').catch(() => null);
      await ctx.page.click('.event-board.festive');
      await ctx.page.waitForFunction(() => window.__S.mode === 'event' && !!window.__S.session, null, { timeout: 30000 });
      await ctx.page.waitForSelector('#board .jar .unit', { state: 'attached', timeout: 30000 });
      await ctx.page.waitForTimeout(1600);
      await closeOverlays(ctx.page);
      await ctx.page.screenshot({ path: out(`board25-2026-12-25-${v.board}-${v.look}.png`) });
      const real = await boardFacts(ctx.page);
      await crafted(ctx.page, true);
      await ctx.page.screenshot({ path: out(`board25-sealed-${v.board}-${v.look}.png`) });
      await zoom(ctx.page, 1, `board25-sealed-${v.board}-${v.look}-zoom.png`);
      return { tile, real, sealed: await boardFacts(ctx.page) };
    }, ctx);
  }

  // 5. The map on 12 December: 412px, 320px at 150% text, and reduced motion.
  for (const m of [{ tag: '412', width: 412, text: 100 }, { tag: '320-150', width: 320, text: 150 }, { tag: '412-reduced', width: 412, text: 100, reduced: true }, { tag: '412-dark', width: 412, text: 100, scene: 'moonlit' }]) {
    const ctx = await open(browser, { day: '2026-12-12', width: m.width, text: m.text, reduced: m.reduced, scene: m.scene || 'midday' });
    await rec(`map-${m.tag}`, async () => {
      await homeReady(ctx.page);
      await ctx.page.evaluate(async () => (await import('/src/ui/screens/map.ts')).openMap());
      await ctx.page.waitForSelector('#map:not([hidden]) .stone', { timeout: 15000 });
      await ctx.page.waitForTimeout(1800);
      await ctx.page.screenshot({ path: out(`map-2026-12-12-${m.tag}.png`) });
      return lightsCheck(ctx.page);
    }, ctx);
  }

  // 6. Home on 12 December with the garland: 412px and 320px / 150%, light and dark.
  for (const h of [{ width: 412, text: 100, tag: '412' }, { width: 320, text: 150, tag: '320-150' }]) for (const v of LOOKS) {
    const ctx = await open(browser, { day: '2026-12-12', width: h.width, text: h.text, board: v.board, scene: v.scene });
    await rec(`home-garland-${h.tag}-${v.look}`, async () => {
      await homeReady(ctx.page);
      await ctx.page.waitForTimeout(800);
      await ctx.page.screenshot({ path: out(`home-garland-2026-12-12-${h.tag}-${v.look}.png`) });
      const g = await ctx.page.locator('#home-garland').boundingBox();
      if (g) await ctx.page.screenshot({ path: out(`home-garland-2026-12-12-${h.tag}-${v.look}-zoom.png`), clip: { x: 0, y: Math.max(0, g.y - 50), width: h.width, height: 110 } });
      return { ...(await garlandOverlap(ctx.page)), scrollW: await ctx.page.evaluate(() => document.documentElement.scrollWidth) };
    }, ctx);
  }

  // 7. Home on 27 December with New Tide's sparkles, and with reduced motion (none).
  for (const r of [false, true]) for (const v of r ? [LOOKS[0]] : LOOKS) {
    const ctx = await open(browser, { day: '2026-12-27', reduced: r, board: v.board, scene: v.scene });
    const tag = `home-newtide-2026-12-27-${v.look}${r ? '-reduced' : ''}`;
    await rec(tag, async () => {
      await homeReady(ctx.page);
      await ctx.page.waitForTimeout(2500);
      await ctx.page.screenshot({ path: out(`${tag}.png`) });
      return ctx.page.evaluate(() => ({ canvases: document.querySelectorAll('.sparkle-fx').length, garland: !document.getElementById('home-garland').hidden }));
    }, ctx);
  }

  // 8. The gift card (25 Dec) and the start card (1 Dec): 412px and 320px / 150%, light; the gift dark too.
  for (const n of [{ day: '2026-12-25', tag: 'gift' }, { day: '2026-12-01', tag: 'start' }]) for (const s of [{ width: 412, text: 100, sfx: '412', ...LOOKS[0] }, { width: 320, text: 150, sfx: '320-150', ...LOOKS[0] }, { width: 412, text: 100, sfx: '412', ...LOOKS[1] }]) {
    const ctx = await open(browser, { day: n.day, width: s.width, text: s.text, board: s.board, scene: s.scene, extra: {}, styles: { owned: [], worn: { glass: 'clear', cork: 'cork', sand: 'plain' } } });
    const tag = `notice-${n.tag}-${n.day}-${s.sfx}-${s.look}`;
    await rec(tag, async () => {
      await homeReady(ctx.page);
      await ctx.page.waitForSelector('#home-notice:not([hidden])', { timeout: 15000 });
      await ctx.page.waitForTimeout(900);
      await ctx.page.screenshot({ path: out(`${tag}.png`) });
      return ctx.page.evaluate(() => {
        const c = document.querySelector('#home-notice .notice-card').getBoundingClientRect();
        return { title: document.getElementById('notice-title').textContent, art: !document.getElementById('notice-art').hidden, card: [Math.round(c.left), Math.round(c.top), Math.round(c.width), Math.round(c.height)], vh: innerHeight, scrollW: document.documentElement.scrollWidth };
      });
    }, ctx);
  }

  // 9. The scene picker on 12 December with the Festive tags, light and dark.
  for (const v of LOOKS) {
    const ctx = await open(browser, { day: '2026-12-12', board: v.board, scene: v.scene });
    await rec(`scenes-${v.look}`, async () => {
      await homeReady(ctx.page);
      await ctx.page.evaluate(async () => (await import('/src/ui/screens/sheets/scenes.ts')).openScenes(null));
      await ctx.page.waitForSelector('#scenes:not([hidden]) .scene-badge', { timeout: 15000 });
      await ctx.page.waitForTimeout(900);
      await ctx.page.screenshot({ path: out(`scenes-2026-12-12-${v.look}.png`) });
      return ctx.page.evaluate(() => ({ festive: [...document.querySelectorAll('.scene-badge.festive')].map((b) => b.closest('button')?.innerText.replace(/\n/g, ' | ')) }));
    }, ctx);
  }

  await browser.close();
  fs.writeFileSync(out('capture-log.json'), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log, null, 1));
}
run().catch((e) => { console.error(e); process.exit(1); });
