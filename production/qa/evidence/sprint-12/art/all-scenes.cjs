// Sprint 12 S3 (jar-styles.md §8): level 61 in all 16 scenes, each wearing a different mix so every
// piece appears in at least four scenes. usage: node all-scenes.cjs <baseUrl> <outDir>
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const VERSION = require('../../../../../package.json').version;
const [base, out] = process.argv.slice(2);
const cfg = require('../../../../../src/config/game-config.json');
const scenes = cfg.themes.list.map((t) => t.id);
const pick = (slot, i) => cfg.styles.slots[slot][1 + (i % 4)].id;
(async () => {
  const b = await chromium.launch();
  const errors = [];
  for (const [i, scene] of scenes.entries()) {
    const ctx = await b.newContext({ viewport: { width: 412, height: 860 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
    const save = { seenWhatsNew: VERSION, tutorialDone: true, level: 62, seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'], onboarding: { visits: 1, installShown: true, offlineNoticed: true }, settings: { sound: false, music: false, haptics: false, patterns: false }, themes: { owned: scenes, selected: scene, auto: false } };
    await ctx.addInitScript((v) => { if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); } }, JSON.stringify(save));
    const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(`${scene}: ${e}`));
    await p.goto(`${base}?level=61`); await p.waitForTimeout(1200);
    const worn = { glass: pick('glass', i), cork: pick('cork', i + 1), sand: pick('sand', i + 2) };
    await p.evaluate((w) => { for (const id of ['board', 'home']) { const el = document.getElementById(id); for (const k of Object.keys(w)) el.dataset[k] = w[k]; } }, worn);
    await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}-${scene}-${worn.glass}-${worn.cork}-${worn.sand}.png`) });
    await ctx.close();
  }
  await b.close();
  console.log(errors.length ? errors.join('\n') : 'no page errors');
})();
