// PROTOTYPE - NOT FOR PRODUCTION. Screenshots each direction x scene, then composes compare-*.png
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path'), fs = require('fs');
const dir = __dirname, shots = path.join(dir, 'shots'); fs.mkdirSync(shots, { recursive: true });
const url = (d, s, w) => `file://${dir}/index.html?dir=${d}&scene=${s}&w=${w}`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1800, height: 1000 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const only = process.argv[2];
  for (const w of only === 'narrow' ? ['narrow'] : ['wide'])
    for (const s of ['light', 'dark']) for (const d of 'ABC') {
      await p.goto(url(d, s, w)); await p.addStyleTag({ content: '.bar{display:none!important}' });
      for (const id of ['home', 'today', 'board', 'win'])
        await p.locator('#s-' + id).screenshot({ path: `${shots}/${d}-${s}-${w}-${id}.png` });
    }
  console.log('errors', errs);
  if (only !== 'narrow') {
    for (const s of ['light', 'dark']) {
      const cell = (d, id) => `<img src="${d}-${s}-wide-${id}.png" style="width:390px;display:block">`;
      const html = `<body style="margin:0;background:${s === 'light' ? '#d8d1c3' : '#070c16'};padding:24px;font:700 16px system-ui;color:${s === 'light' ? '#333' : '#ddd'}"><div style="display:grid;grid-template-columns:repeat(3,390px);gap:24px">` +
        ['A  Sea glass', 'B  Beach-hut tactile', 'C  Tide-line editorial'].map(t => `<div>${t}</div>`).join('') +
        ['home', 'board', 'win'].map(id => 'ABC'.split('').map(d => cell(d, id)).join('')).join('') + '</div>';
      fs.writeFileSync(`${shots}/_c.html`, html);
      const q = await b.newPage({ viewport: { width: 1290, height: 900 }, deviceScaleFactor: 1 });
      await q.goto(`file://${shots}/_c.html`); await q.waitForTimeout(300);
      await q.screenshot({ path: `${dir}/compare-${s}.png`, fullPage: true }); await q.close();
    }
  }
  await b.close();
})();
