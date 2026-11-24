const { chromium } = require('playwright');
const OUT = process.argv[2], TAG = process.argv[3] || 'before';
(async () => {
  const browser = await chromium.launch();
  const rows = [];
  const cases = [
    { name: 'daily', q: '?daily=2027-01-16&board=dom', time: '2027-01-16T12:00:00Z' },
    { name: 'daily-wed', q: '?daily=2027-01-20&board=dom', time: '2027-01-20T12:00:00Z' },
    { name: 'level', q: '?level=361&board=dom' },
    { name: 'level-1000', q: '?level=1000&board=dom' },
  ];
  for (const [w, text] of [[320, 150], [320, 100], [412, 100], [412, 150]]) for (const c of cases) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 760 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    if (c.time) await ctx.clock.setFixedTime(new Date(c.time));
    await ctx.addInitScript(([text]) => {
      localStorage.setItem('strata.save.v2', JSON.stringify({ tutorialDone: true, level: 1000, seenMechanics: ['narrow','frozen','locked','funnel','hourglass','sieve','clam','wet','tide','crab','lighthouse','sun'], seenWhatsNew: '9.9.9', settings: { sound: false, music: false, haptics: false }, onboarding: { visits: 9, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true, stylesNewSeen: true, mapHintSeen: true, boosterHintSeen: true } }));
      if (text !== 100) document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = `${text}%`; });
    }, [text]);
    const page = await ctx.newPage();
    await page.goto(`http://localhost:5231/${c.q}`);
    await page.waitForSelector('#board .jar', { timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const m = await page.evaluate(() => { const l = document.getElementById('level-label'); const tag = document.getElementById('challenge-tag'); return { text: l.textContent, cut: l.scrollWidth > l.clientWidth + 1, lw: l.clientWidth, sw: l.scrollWidth, fs: getComputedStyle(l).fontSize, tagLines: tag && !tag.hidden ? Math.round(tag.getBoundingClientRect().height / parseFloat(getComputedStyle(tag).lineHeight)) : 0, pageScroll: document.documentElement.scrollWidth > innerWidth }; });
    rows.push({ w, text, case: c.name, ...m });
    if (w === 320 && text === 150) await page.screenshot({ path: `${OUT}/${TAG}-${c.name}-320-150.png`, clip: { x: 0, y: 0, width: 320, height: 160 } });
    await ctx.close();
  }
  for (const r of rows) console.log(`${r.w}/${r.text} ${r.case.padEnd(10)} cut=${r.cut} label="${r.text}" fs=${r.fs} w=${r.lw}/${r.sw} tagLines=${r.tagLines} pageScroll=${r.pageScroll}`);
  await browser.close();
})();
