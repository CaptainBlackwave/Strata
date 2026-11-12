// Sprint 22 L1 (D181; copied from sprint 21 P2, strata-8j3): the main-thread cost of 10 pours on level 491 (16 jars) at 4x CPU throttle,
// from a Chrome trace (CDP Tracing, devtools.timeline), on the Classic board with reduced motion (the
// board's own redraw cost, no animation). Same pours and taps as perf.cjs (fixed waits, no polling).
// Usage (dev server running):  PORT=5182 LABEL=before BOARD=dom node production/qa/evidence/sprint-22/perf/trace.cjs
// FIRSTTAP=1 leaves audio locked, so the trace includes the first tap's own cost (L1: audio start-up).
// Writes trace-<LABEL>.json: per event type the count, total and worst ms, and the tasks over 16 ms.
const { open, solvePath, pourBy } = require('./perf.cjs');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const LABEL = process.env.LABEL || 'run';
const BOARD = process.env.BOARD || 'dom';
const REDUCED = process.env.MOTION ? false : true;
(async () => {
  const browser = await chromium.launch();
  const { context, page } = await open(browser, BOARD, REDUCED);
  const moves = (await solvePath(page)).slice(0, 10);
  const cdp = await context.newCDPSession(page);
  // The first tap unlocks audio (one-off AudioContext set-up); do it before tracing so it isn't counted.
  if (!process.env.FIRSTTAP) await page.evaluate(async () => (await import('/src/ui/state.ts')).audio.unlock());
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const events = [];
  cdp.on('Tracing.dataCollected', (d) => events.push(...d.value));
  const done = new Promise((r) => cdp.once('Tracing.tracingComplete', r));
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline', transferMode: 'ReportEvents' });
  for (const m of moves) await pourBy(page, m, REDUCED ? 700 : 1800);
  await cdp.send('Tracing.end');
  await done;
  const NAMES = ['RunTask', 'EventDispatch', 'UpdateLayoutTree', 'Layout', 'PrePaint', 'Paint', 'Layerize', 'Commit'];
  const agg = {};
  for (const e of events) {
    if (e.ph !== 'X' || !e.dur || !NAMES.includes(e.name)) continue;
    const a = (agg[e.name] ??= { count: 0, totalMs: 0, worstMs: 0 });
    a.count++;
    a.totalMs += e.dur / 1000;
    a.worstMs = Math.max(a.worstMs, e.dur / 1000);
  }
  for (const a of Object.values(agg)) { a.totalMs = Math.round(a.totalMs); a.worstMs = Math.round(a.worstMs * 10) / 10; }
  const main = events.filter((e) => e.name === 'RunTask' && e.dur > 16000).map((e) => Math.round(e.dur / 100) / 10).sort((a, b) => b - a);
  const out = { label: LABEL, board: BOARD, reducedMotion: REDUCED, firstTapCounted: !!process.env.FIRSTTAP, level: 491, pours: moves.length, cpuThrottle: 4, perEvent: agg, tasksOver16ms: main };
  fs.writeFileSync(path.join(__dirname, `trace-${LABEL}.json`), JSON.stringify(out, null, 2) + '\n');
  console.log(JSON.stringify(out));
  await browser.close();
})();
