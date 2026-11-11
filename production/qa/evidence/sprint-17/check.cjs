// Sprint 17 UI evidence (E3, E2): Winter Tide's Home card on Dec 1, 12 and 31 (none on Nov 30), the chooser
// on Dec 12 with boards 1-9 cleared, event win cards on board 6 (coins) and board 24 (prize and badge),
// the Jar styles sheet with Frost locked and owned, and the badge shelf with the Winter Tide badge.
// 390x844 and 320x568 at 150% text.
// Usage: PREVIEW=http://localhost:4370 DEV=http://localhost:4371 node production/qa/evidence/sprint-17/check.cjs
// PREVIEW serves the built dist; DEV is `vite` (dev), used only for the win cards: they start an event
// board and call showWin() through the app's own modules, as a board can't be solved by script.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const OUT = __dirname;
const PREVIEW = process.env.PREVIEW || 'http://localhost:4370';
const DEV = process.env.DEV || 'http://localhost:4371';
const KEY = 'strata.save.v2';
const SIZES = [
  { tag: '390', viewport: { width: 390, height: 844 }, font: null },
  { tag: '320-150', viewport: { width: 320, height: 568 }, font: '150%' },
];
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
const progress = (boards) => ({ wintertide: { year: 2026, cleared: boards, pours: Object.fromEntries(boards.map((n) => [String(n), 20 + n])) } });

async function seeded(browser, base, size, date, patch) {
  const context = await browser.newContext({ viewport: size.viewport, deviceScaleFactor: 2, reducedMotion: 'reduce' });
  await context.clock.setFixedTime(new Date(`${date}T12:00:00Z`));
  const page = await context.newPage();
  await page.goto(base);
  await page.waitForTimeout(800);
  await page.evaluate(([key, src]) => {
    const s = JSON.parse(localStorage.getItem(key) || '{}');
    new Function('s', src)(s);
    localStorage.setItem(key, JSON.stringify(s));
  }, [KEY, `(${patch})(s)`]);
  await page.reload();
  await page.waitForTimeout(900);
  if (size.font) await page.evaluate((f) => (document.documentElement.style.fontSize = f), size.font);
  await page.evaluate(() => document.querySelectorAll('#whatsnew:not([hidden]) #btn-whatsnew-ok').forEach((b) => b.click()));
  await page.waitForTimeout(300);
  return { context, page };
}
/** A returning player at level 80, `coins`, with `events` progress and `extra` changes. */
const save = (events, coins = 400, extra = '') => `(s) => {
  s.tutorialDone = true; s.level = 80;
  s.wallet = { ...(s.wallet || {}), coins: ${coins} };
  s.events = ${JSON.stringify(events)};
  s.onboarding = { ...(s.onboarding || {}), visits: 1, installShown: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true };
  ${extra}
}`;
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

(async () => {
  const browser = await chromium.launch();
  for (const size of SIZES) {
    // Home on four dates.
    for (const [date, boards] of [['2026-11-30', []], ['2026-12-01', []], ['2026-12-12', range(1, 9)], ['2026-12-31', range(1, 9)]]) {
      const { context, page } = await seeded(browser, PREVIEW, size, date, save(progress(boards)));
      const shown = await page.evaluate(() => !document.getElementById('btn-event').hidden);
      if (shown !== (date !== '2026-11-30')) throw new Error(`event card on ${date}: ${shown}`);
      await page.evaluate(() => document.getElementById(document.getElementById('btn-event').hidden ? 'btn-weekly' : 'btn-event').scrollIntoView({ block: 'center' }));
      await shot(page, `home-${date}-${size.tag}`);
      if (date === '2026-12-12') {
        await page.click('#btn-event');
        await page.waitForTimeout(500);
        const focus = await page.evaluate(() => document.activeElement?.dataset.board);
        if (focus !== '10') throw new Error(`chooser focus: ${focus}`);
        await shot(page, `chooser-2026-12-12-${size.tag}`);
        await page.evaluate(() => document.querySelector('.event-sheet').scrollTo(0, 1e6));
        await shot(page, `chooser-2026-12-12-end-${size.tag}`);
      }
      await context.close();
    }
    // Win cards (dev server): board 6 pays 50 coins; board 24 completes the set (prize row, badge row).
    for (const [date, before, n] of [['2026-12-12', range(1, 5), 6], ['2026-12-31', range(1, 23), 24]]) {
      const { context, page } = await seeded(browser, DEV, size, date, save(progress(before)));
      await page.evaluate(async (board) => {
        const b = await import('/src/ui/screens/board.ts');
        b.startEvent('wintertide', 2026, board);
      }, n);
      await page.waitForTimeout(800);
      await page.evaluate(async () => (await import('/src/ui/screens/win.ts')).showWin());
      await page.waitForTimeout(1500);
      await shot(page, `win-event-board${n}-${size.tag}`);
      if (n === 24) {
        await page.evaluate(() => document.querySelector('#win .win-card').scrollTo(0, 1e6));
        await shot(page, `win-event-board${n}-end-${size.tag}`);
      }
      await context.close();
    }
    // Jar styles: Frost locked, then owned and worn.
    for (const [tag, extra] of [['locked', ''], ['owned', "s.styles = { owned: ['glass:frost'], worn: { glass: 'frost', cork: 'cork', sand: 'plain' } };"]]) {
      const { context, page } = await seeded(browser, PREVIEW, size, '2026-12-12', save({}, 400, extra));
      await page.click('#btn-styles');
      await page.waitForTimeout(500);
      await page.click('[data-slot="glass"][data-id="frost"]');
      await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelector('[data-slot="glass"][data-id="frost"]').scrollIntoView({ block: 'center' }));
      await shot(page, `styles-frost-${tag}-${size.tag}`);
      if (tag === 'locked') {
        await page.evaluate(() => document.querySelector('.styles-card').scrollTo(0, 1e6));
        await shot(page, `styles-frost-${tag}-end-${size.tag}`);
      }
      await context.close();
    }
    // Badge shelf with the Winter Tide badge.
    {
      const { context, page } = await seeded(browser, PREVIEW, size, '2026-12-31', save(progress(range(1, 24)), 400, "s.badges = [...(s.badges || []), 'event-wintertide'];"));
      await page.click('#btn-profile');
      await page.waitForTimeout(600);
      const found = await page.evaluate(() => {
        const tile = [...document.querySelectorAll('#badge-shelf .badge-tile')].find((x) => x.textContent.includes('Winter Tide'));
        tile?.scrollIntoView({ block: 'center' });
        return !!tile;
      });
      if (!found) throw new Error('no Winter Tide badge on the shelf');
      await shot(page, `badges-wintertide-${size.tag}`);
      await context.close();
    }
  }
  await browser.close();
  console.log('done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
