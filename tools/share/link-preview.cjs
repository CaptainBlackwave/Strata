// Renders the link preview image, public/og.png (sprint 14 H1, design/gdd/sharing.md §3.3, D123).
// It is drawn from the game's own palette and Midday scene colours in game-config.json: no
// outside art. Re-run it when the palette or the Midday scene changes.
// usage (from the repo root): node tools/share/link-preview.cjs
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const config = require('../../src/config/game-config.json');

const W = 1200;
const H = 630;
const tok = config.themes.list.find((s) => s.id === config.themes.default).tokens;
const hex = Object.fromEntries(config.palette.map((p) => [p.id, p.hex]));
// Five jars, bottom layer first: three sealed, one mid-sort, one spare. `null` is empty space.
const JARS = [
  { sealed: true, layers: ['lagoon', 'lagoon', 'lagoon', 'lagoon'] },
  { sealed: true, layers: ['saffron', 'saffron', 'saffron', 'saffron'] },
  { sealed: false, layers: ['terracotta', 'terracotta', 'coral', null] },
  { sealed: false, layers: ['coral', 'coral', 'coral', null] },
  { sealed: true, layers: ['plum', 'plum', 'plum', 'plum'] },
];
const jar = (j) => `
  <div class="jar${j.sealed ? ' sealed' : ''}">
    ${j.sealed ? '<i class="cork"></i>' : ''}
    <div class="glass">${[...j.layers].reverse().map((c) => `<b style="background:${c ? hex[c] : 'transparent'}"></b>`).join('')}</div>
  </div>`;

const html = `<!doctype html><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${W}px; height: ${H}px; overflow: hidden; position: relative;
    font-family: ui-rounded, 'SF Pro Rounded', 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: linear-gradient(180deg, ${tok.bgTop}, ${tok.bgBottom}); color: ${tok.ink}; }
  .sun { position: absolute; left: 820px; top: -150px; width: 520px; height: 520px; border-radius: 50%;
    background: radial-gradient(circle, rgba(${tok.glowCore}, 0.95), rgba(${tok.glow}, 0) 68%); }
  .sea { position: absolute; left: -10%; right: -10%; bottom: -230px; height: 380px; border-radius: 50%; background: ${tok.sea}; }
  .text { position: absolute; left: 80px; top: 150px; width: 520px; }
  h1 { font-size: 132px; line-height: 1; letter-spacing: 0.04em; font-weight: 800; }
  p { margin-top: 26px; font-size: 44px; line-height: 1.2; font-weight: 600; color: ${tok.inkSoft}; }
  .chip { display: inline-block; margin-top: 34px; padding: 12px 26px; border-radius: 999px; font-size: 30px; font-weight: 700;
    background: ${tok.accent}; color: ${tok.accentInk}; }
  .jars { position: absolute; right: 70px; bottom: 96px; display: flex; gap: 22px; align-items: flex-end; }
  .jar { position: relative; width: 84px; }
  .glass { height: 300px; padding: 26px 7px 7px; border: 5px solid ${tok.glassEdge}; border-radius: 12px 12px 40px 40px;
    background: ${tok.glass}; display: flex; flex-direction: column; overflow: hidden; }
  .glass b { flex: 1; display: block; }
  .glass b:last-child { border-radius: 0 0 28px 28px; }
  .cork { position: absolute; left: 14px; top: -20px; width: 56px; height: 34px; border-radius: 9px;
    background: #c99a5b; border: 4px solid #8a6238; z-index: 1; }
  .jar:not(.sealed) { transform: translateY(0); }
</style>
<div class="sun"></div><div class="sea"></div>
<div class="text"><h1>Strata</h1><p>A calm seaside<br>sand-sort puzzle</p><span class="chip">Free · no ads · plays offline</span></div>
<div class="jars">${JARS.map(jar).join('')}</div>`;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(html);
  const out = path.join(__dirname, '../../public/og.png');
  await page.screenshot({ path: out, type: 'png' });
  await browser.close();
  console.log(`wrote ${out} (${W} x ${H})`);
})();
