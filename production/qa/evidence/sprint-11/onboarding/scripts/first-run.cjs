// Sprint 11 O2 (D78): a first run from an empty save, the tutorial and levels 1-10, poured from the
// solver's moves (solutions.json) without boosters, then Home and the first map. Every layer that opens
// on the way is screenshotted and logged.
// usage: node first-run.cjs <baseUrl> <outDir> <tag>   (after `npm run build` and `npx vite preview --port 5520 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, out, tag = 'run'] = process.argv.slice(2);
const SOL = JSON.parse(fs.readFileSync(path.join(__dirname, 'solutions.json'), 'utf8'));
const w = (p, ms) => p.waitForTimeout(ms);
fs.mkdirSync(out, { recursive: true });

(async () => {
  const b = await chromium.launch();
  const log = { tag, runs: [] };
  for (const [device, big, short] of [['Pixel 7', false, 'pixel7'], ['iPhone SE', true, 'se150']]) {
    const ctx = await b.newContext({ ...devices[device], reducedMotion: 'reduce' });
    if (big) await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; }));
    const p = await ctx.newPage();
    const run = { device: short, errors: [], steps: [] };
    log.runs.push(run);
    p.on('pageerror', (e) => run.errors.push(String(e)));
    p.on('console', (m) => m.type() === 'error' && run.errors.push(m.text()));
    const shot = async (name) => p.screenshot({ path: path.join(out, `${tag}-${short}-${name}.png`) });
    const toast = async () => p.evaluate(() => { const t = document.getElementById('toast'); return t.classList.contains('show') ? t.textContent : ''; });
    // Any dialog layer that opened by itself: log it, screenshot it, close it with its first button.
    const layersOpen = async (where) => {
      for (let k = 0; k < 4; k++) {
        const id = await p.evaluate(() => { const el = [...document.querySelectorAll('#app > .cabinet, #app > .sheet')].find((e) => !e.hidden); return el ? el.id : ''; });
        if (!id) return;
        run.steps.push({ where, layer: id, text: (await p.textContent(`#${id}`)).replace(/\s+/g, ' ').trim() });
        await shot(`${where}-layer-${id}`);
        await p.locator(`#${id} button.primary, #${id} button`).first().click({ force: true });
        await w(p, 400);
      }
    };
    const t0 = Date.now();
    await p.goto(base);
    await w(p, 900);
    await shot('01-home-first');
    run.steps.push({ where: 'home', play: (await p.textContent('#btn-play')).trim(), daily: !(await p.locator('#btn-daily').isHidden()) });
    await p.click('#btn-play', { force: true });
    await w(p, 700);
    await shot('02-tutorial');
    run.steps.push({ where: 'tutorial', coach: (await p.textContent('#coach-text')).trim() });
    await p.locator('#board .jar').nth(0).click({ force: true });
    await w(p, 300);
    await shot('03-tutorial-lifted');
    await p.locator('#board .jar').nth(1).click({ force: true });
    await p.waitForSelector('#win:not([hidden])', { timeout: 8000 });
    await w(p, 400);
    await shot('04-tutorial-win');
    await p.click('#btn-next', { force: true });
    for (let n = 1; n <= 10; n++) {
      await w(p, 900);
      await layersOpen(`l${n}-start`);
      const label = (await p.textContent('#level-label')).trim();
      if (n === 1 || n === 2) await shot(`l${n}-board`);
      let pours = 0;
      for (const [from, to] of SOL[n].moves) {
        await p.locator('#board .jar').nth(from).click({ force: true });
        await w(p, 120);
        await p.locator('#board .jar').nth(to).click({ force: true });
        pours++;
        await w(p, 420);
        const tt = await toast();
        if (tt) run.steps.push({ where: `l${n}`, toast: tt });
      }
      await p.waitForSelector('#win:not([hidden])', { timeout: 8000 });
      await w(p, 900);
      const card = await p.evaluate(() => ({
        title: document.getElementById('win-title').textContent,
        text: document.getElementById('win-text').textContent,
        note: document.getElementById('win-note').textContent,
        shell: document.getElementById('win-shell').hidden ? '' : document.getElementById('win-shell-text').textContent,
        unlocks: document.getElementById('win-unlocks').textContent,
        coins: document.getElementById('coins').textContent,
        next: document.getElementById('btn-next').textContent,
        home: !document.getElementById('btn-win-home').hidden,
      }));
      run.steps.push({ where: `l${n}`, label, pours, card });
      if ([1, 3, 5, 10].includes(n) || card.shell || card.unlocks) await shot(`l${n}-win`);
      if (n < 10) await p.click('#btn-next', { force: true });
    }
    await p.click('#btn-win-home', { force: true });
    await w(p, 900);
    await shot('20-home-after-10');
    run.steps.push({ where: 'home-after-10', play: (await p.textContent('#btn-play')).trim(), daily: (await p.textContent('#btn-daily')).replace(/\s+/g, ' ').trim() });
    await layersOpen('home-after-10');
    await p.click('#btn-play', { force: true });
    await w(p, 1200);
    await shot('21-map-first');
    run.steps.push({ where: 'map-first', mapOpen: await p.locator('#map:not([hidden])').count() === 1, top: await p.evaluate(() => [...document.querySelectorAll('#app > *')].filter((e) => !e.hidden && !e.inert && getComputedStyle(e).position === 'fixed').map((e) => e.id).join(',')) });
    await layersOpen('map-first');
    await shot('22-map-after-layers');
    run.seconds = Math.round((Date.now() - t0) / 1000);
    await ctx.close();
  }
  await b.close();
  fs.writeFileSync(path.join(out, `${tag}-first-run.json`), JSON.stringify(log, null, 2));
  console.log(JSON.stringify(log.runs.map((r) => ({ device: r.device, errors: r.errors, seconds: r.seconds })), null, 0));
})();
