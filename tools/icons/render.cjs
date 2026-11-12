// Strata's app icon (sprint 21 A2, D179): the three logo jars of layered sand on sand cream.
// Writes public/icon.svg, then renders every PNG from it with Playwright's Chromium:
//   icon-192.png, icon-512.png, icon-maskable-512.png (art inside the 80% safe zone),
//   apple-touch-icon.png (180) and favicon-32.png.
// Run: node tools/icons/render.cjs   (needs the preinstalled Playwright, see docs/engine-reference/web/VERSION.md)
const fs = require('fs');
const path = require('path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const PUB = path.join(__dirname, '..', '..', 'public');
const CREAM = '#f6ecd9';
const EDGE = '#8c7a64'; // the logo's glass edge, rgba(90, 70, 50, 0.55) over the cream, made opaque
const [RED, AMBER, TEAL] = ['#c8553d', '#f2a541', '#2a9d8f'];
// The logo (pre-0.19 style.css .logo-jars): 46 × 92 px side jars, a 112 px middle, 12 px apart,
// layers to 30%, 58% and 84% of the glass. Scaled ×2.39 into a 512 square.
const S = 110 / 46;
const W = 46 * S;
const GAP = 12 * S;
const BOTTOM = 404;
const JARS = [
  { h: 92 * S, layers: [RED, AMBER, TEAL] },
  { h: 112 * S, layers: [TEAL, RED, AMBER] },
  { h: 92 * S, layers: [AMBER, TEAL, RED] },
];
const STOPS = [0, 0.3, 0.58, 0.84];
const STROKE = 9;
const RB = 20 * S; // bottom corner radius
const left0 = (512 - (3 * W + 2 * GAP)) / 2;
const f = (n) => Math.round(n * 100) / 100;

function jar(j, i) {
  const x0 = left0 + i * (W + GAP);
  const y0 = BOTTOM - j.h;
  const x1 = x0 + W;
  const open = `M${f(x0)} ${f(y0)}V${f(BOTTOM - RB)}A${f(RB)} ${f(RB)} 0 0 0 ${f(x0 + RB)} ${f(BOTTOM)}H${f(x1 - RB)}A${f(RB)} ${f(RB)} 0 0 0 ${f(x1)} ${f(BOTTOM - RB)}V${f(y0)}`;
  const layers = j.layers
    .map((c, k) => {
      const top = BOTTOM - j.h * STOPS[k + 1];
      const bot = BOTTOM - j.h * STOPS[k];
      return `<rect x="${f(x0)}" y="${f(top)}" width="${f(W)}" height="${f(bot - top + 0.5)}" fill="${c}"/>` +
        `<rect x="${f(x0)}" y="${f(top)}" width="${f(W)}" height="5" fill="#fff" opacity="0.22"/>`;
    })
    .join('');
  const air = BOTTOM - j.h * STOPS[3];
  // The cork: 60% of the jar's width, standing 24 px over the rim.
  const cw = W * 0.6;
  const cx = x0 + (W - cw) / 2;
  return `<g>
  <clipPath id="j${i}"><path d="${open}Z"/></clipPath>
  <g clip-path="url(#j${i})">
    <rect x="${f(x0)}" y="${f(y0)}" width="${f(W)}" height="${f(air - y0 + 1)}" fill="#fff" opacity="0.55"/>
    ${layers}
    <rect x="${f(x0)}" y="${f(air)}" width="${f(W)}" height="${f(BOTTOM - air)}" filter="url(#grain)" opacity="0.5"/>
    <rect x="${f(x0 + 13)}" y="${f(y0 + 16)}" width="11" height="${f(j.h - 58)}" rx="5.5" fill="#fff" opacity="0.38"/>
  </g>
  <path d="${open}" fill="none" stroke="${EDGE}" stroke-width="${STROKE}" stroke-linejoin="round"/>
  <rect x="${f(cx)}" y="${f(y0 - 24)}" width="${f(cw)}" height="31" rx="8" fill="url(#cork)" stroke="#8a6136" stroke-width="5"/>
</g>`;
}

const art = `<g id="art">
  <ellipse cx="256" cy="${BOTTOM + 14}" rx="${f(1.5 * W + GAP + 16)}" ry="13" fill="#5a4632" opacity="0.12"/>
  ${JARS.map(jar).join('\n  ')}
</g>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<title>Strata</title>
<defs>
  <linearGradient id="cork" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d8a86b"/><stop offset="1" stop-color="#b7834a"/></linearGradient>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7"/>
    <feColorMatrix values="0 0 0 0 0.35  0 0 0 0 0.27  0 0 0 0 0.2  0 0 0 -1.6 0.95"/>
    <feComposite in2="SourceGraphic" operator="in"/>
  </filter>
</defs>
<rect width="512" height="512" fill="${CREAM}"/>
${art}
</svg>
`;

(async () => {
  fs.writeFileSync(path.join(PUB, 'icon.svg'), svg);
  const b = await chromium.launch();
  const p = await b.newPage({ deviceScaleFactor: 1 });
  const data = 'data:image/svg+xml;base64,' + Buffer.from(svg).toString('base64');
  const shot = async (file, size, scale = 1) => {
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0;background:${CREAM}"><img src="${data}" style="display:block;width:${size}px;height:${size}px;transform:scale(${scale})"></body></html>`);
    await p.waitForFunction(() => document.images[0].complete);
    await p.screenshot({ path: path.join(PUB, file), omitBackground: false });
  };
  await shot('icon-512.png', 512);
  await shot('icon-192.png', 192);
  await shot('apple-touch-icon.png', 180);
  await shot('favicon-32.png', 32);
  // Maskable: the art shrunk to 76% on the full cream square, so it sits inside the safe zone
  // (a circle of 40% radius) whatever mask the launcher uses.
  await shot('icon-maskable-512.png', 512, 0.76);
  await b.close();
  console.log('icons written to', PUB);
})();
