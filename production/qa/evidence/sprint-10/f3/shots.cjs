// Sprint 10 F3 (D66) Settings screenshots, plus the F1/F3/F4 smoke run.
// usage: node shots.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5410 --strictPort`)
const { chromium, devices } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const [base, out] = process.argv.slice(2);
const KEY = 'strata.save.v2';
const VERSION = require('../../../../../package.json').version; // seen, so What's new doesn't cover Play
const w = (p, ms) => p.waitForTimeout(ms);
const seed = (o = {}) => JSON.stringify({ seenWhatsNew: VERSION, tutorialDone: true, level: 5, ...o });

(async () => {
  const b = await chromium.launch();
  const errors = [];
  const R = { version: VERSION, shots: [] };
  const watch = (p, tag) => {
    p.on('pageerror', (e) => errors.push(`${tag}: ${e}`));
    p.on('console', (m) => m.type() === 'error' && errors.push(`${tag}: ${m.text()}`));
  };
  const open = async (device, big, save) => {
    const ctx = await b.newContext({ ...devices[device], reducedMotion: 'reduce' });
    if (big) await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { document.documentElement.style.fontSize = '150%'; }));
    const p = await ctx.newPage();
    watch(p, `${device}${big ? ' 150%' : ''}`);
    await p.goto(base);
    await p.evaluate(([k, v]) => localStorage.setItem(k, v), [KEY, save]);
    await p.reload();
    await w(p, 600);
    return { ctx, p };
  };

  // 1. Settings at 100% and 150% text, iPhone SE (320 px) and Pixel 7, plus a muted case.
  for (const [device, tag] of [['iPhone SE', 'se'], ['Pixel 7', 'pixel7']]) {
    for (const big of [false, true]) {
      const { ctx, p } = await open(device, big, seed({ settings: { sound: true, music: big, haptics: true, patterns: false, southern: false, soundVolume: 0.65, musicVolume: 0.4 } }));
      await p.click('#btn-home-settings', { force: true });
      await w(p, 400);
      await p.$eval('#set-music-volume', (e) => e.scrollIntoView({ block: 'center' }));
      const name = `settings-${tag}-${big ? 150 : 100}${big ? '' : '-music-muted'}.png`;
      await p.screenshot({ path: path.join(out, name) });
      const m = await p.evaluate(() => {
        const s = (id) => { const e = document.getElementById(id); const r = e.getBoundingClientRect(); return { value: e.value, text: e.getAttribute('aria-valuetext'), disabled: e.disabled, h: Math.round(r.height), w: Math.round(r.width), name: e.closest('label').textContent.trim() }; };
        const card = document.querySelector('#settings .sheet-card');
        return { sound: s('set-sound-volume'), music: s('set-music-volume'), hOverflow: document.documentElement.scrollWidth > innerWidth || card.scrollWidth > card.clientWidth };
      });
      R.shots.push({ name, ...m });
      await ctx.close();
    }
  }

  // 2. Smoke: Home Play -> map -> level 5 with hints to a win; then Settings sliders by keyboard.
  {
    const { ctx, p } = await open('Pixel 7', false, seed({ wallet: { coins: 100, boosters: { undo: 3, shuffle: 3, extraJar: 3, hint: 99 } } }));
    await p.addInitScript(() => {}); // motion as the player has it (reduced, from the context)
    await p.click('#btn-play', { force: true });
    await w(p, 600);
    R.mapOpen = await p.locator('#map:not([hidden])').count() === 1;
    await p.click('#btn-map-play', { force: true });
    await w(p, 900);
    let pours = 0;
    for (let i = 0; i < 80; i++) {
      if (await p.locator('#win:not([hidden])').count()) break;
      await p.keyboard.press('h');
      try {
        await p.waitForSelector('#board .hint-from', { timeout: 6000 });
      } catch {
        continue;
      }
      await p.click('#board .hint-from', { force: true });
      await w(p, 150);
      await p.click('#board .hint-to', { force: true });
      pours++;
      await w(p, 700);
    }
    await w(p, 1500); // the shell and unlock sounds are delayed after the win chime
    R.win = { reached: await p.locator('#win:not([hidden])').count() === 1, pours, title: (await p.textContent('#win-title'))?.trim() };
    await p.screenshot({ path: path.join(out, 'smoke-win-pixel7.png') });
    await p.reload();
    await w(p, 600);
    await p.click('#btn-home-settings', { force: true });
    await w(p, 300);
    await p.focus('#set-sound-volume');
    for (let i = 0; i < 3; i++) await p.keyboard.press('ArrowLeft');
    await p.focus('#set-music-volume');
    for (let i = 0; i < 2; i++) await p.keyboard.press('ArrowRight');
    await w(p, 200);
    R.keyboard = await p.evaluate((k) => {
      const s = JSON.parse(localStorage.getItem(k)).settings;
      const v = (id) => document.getElementById(id).getAttribute('aria-valuetext');
      return { saved: { soundVolume: s.soundVolume, musicVolume: s.musicVolume }, valuetext: { sound: v('set-sound-volume'), music: v('set-music-volume') } };
    }, KEY);
    R.keyboard.ok = R.keyboard.saved.soundVolume === 0.65 && R.keyboard.saved.musicVolume === 0.9 && R.keyboard.valuetext.sound === '65%' && R.keyboard.valuetext.music === '90%';
    await p.$eval('#set-music-volume', (e) => e.scrollIntoView({ block: 'center' }));
    await p.screenshot({ path: path.join(out, 'smoke-settings-after-keys-pixel7.png') });
    await ctx.close();
  }
  R.errors = errors;
  await b.close();
  console.log(JSON.stringify(R, null, 1));
})();
