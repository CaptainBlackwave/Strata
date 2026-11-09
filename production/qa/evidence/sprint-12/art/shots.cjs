// Sprint 12 S3 (design/gdd/jar-styles.md §3.1, §3.4): every glass, cork and sand piece on the real build.
// usage: npm run build && npx vite preview --port 5530 --strictPort
//        node production/qa/evidence/sprint-12/art/shots.cjs [baseUrl] [outDir]
// Styles are set with page.evaluate on #board and #home (data-glass, data-cork, data-sand), as the
// Styles sheet does. Level 61 is opened with ?level=61. To show every mark on every piece, the script
// also dresses some of the board's jars by hand (presentation only, no game state): one jar is filled
// with one colour and given `.sealed` (the cork), and others get `.frozen`, `.locked`, `.funnel`,
// `.narrow`, a hint pair and `.selected`, the same classes jars.ts sets.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const fs = require('fs');
const VERSION = require('../../../../../package.json').version;
const PALETTE = require('../../../../../src/config/game-config.json').palette.map((c) => c.hex);
const [base = 'http://localhost:5530/', out = __dirname] = process.argv.slice(2);

const SCENES = ['midday', 'moonlit', 'wintersnow', 'auroranight'];
const PIECES = {
  glass: ['clear', 'seaglass', 'amber', 'cobalt', 'pearl'],
  cork: ['cork', 'driftwood', 'rope', 'scallop', 'brass'],
  sand: ['plain', 'fine', 'glint', 'layered', 'ripple'],
};
const DEFAULTS = { glass: 'clear', cork: 'cork', sand: 'plain' };
const VIEW = { viewport: { width: 412, height: 860 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'reduce' };

function seed(scene, patterns) {
  return {
    tutorialDone: true,
    level: 61,
    seenWhatsNew: VERSION,
    settings: { sound: false, music: false, haptics: false, patterns },
    seenMechanics: ['narrow', 'frozen', 'locked', 'funnel'],
    onboarding: { visits: 1, installShown: true, offlineNoticed: true },
    themes: { owned: SCENES, selected: scene, auto: false },
    wallet: { coins: 0, boosters: { hint: 9 } },
  };
}

async function open(b, scene, patterns, search) {
  const ctx = await b.newContext(VIEW);
  await ctx.addInitScript(([v]) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('strata.save.v2', v);
      sessionStorage.setItem('seeded', '1');
    }
  }, [JSON.stringify(seed(scene, patterns))]);
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', (e) => p.errors.push(String(e)));
  await p.goto(base + search);
  await p.waitForTimeout(900);
  return { ctx, p };
}

/**
 * Dresses board jars so every mark shows (see the header). With `unbury`, buried units are drawn as
 * sand of every palette colour in turn (the sand sheets need colours, and level 61 starts mostly buried).
 */
async function dress(p, { unbury = false, patterns = false } = {}) {
  return p.evaluate(([palette, unbury, patterns]) => {
    const jars = [...document.querySelectorAll('#board .jar')];
    const paint = (u, k) => {
      u.className = 'unit' + (patterns ? ` pat-${k}` : '');
      u.style.setProperty('--c', palette[k]);
    };
    let k = 0;
    if (unbury) for (const u of document.querySelectorAll('#board .unit.buried')) paint(u, k++ % palette.length);
    const full = jars.find((j) => j.querySelectorAll('.unit').length >= 4) || jars[0];
    full.querySelectorAll('.unit').forEach((u) => paint(u, 3)); // one colour (lagoon) all the way up
    full.classList.add('sealed');
    const others = jars.filter((j) => j !== full);
    const put = (i, cls) => others[i] && others[i].classList.add(...cls);
    put(0, ['frozen']);
    put(1, ['locked']);
    if (others[1]) others[1].querySelector('.padlock').style.setProperty('--lock', '#2a9d8f');
    put(2, ['funnel']);
    put(3, ['narrow']);
    if (others[3]) others[3].querySelector('.glass').style.height = '75%';
    put(4, ['hint-from']);
    if (others[4]) others[4].querySelector('.hint-badge').textContent = 'From';
    put(5, ['hint-to']);
    if (others[5]) others[5].querySelector('.hint-badge').textContent = 'To';
    put(6, ['selected']);
    return { jars: jars.length, sealed: jars.indexOf(full) };
  }, [PALETTE, unbury, patterns]);
}

async function wear(p, worn) {
  await p.evaluate((w) => {
    for (const id of ['board', 'home']) {
      const el = document.getElementById(id);
      if (!el) continue;
      el.dataset.glass = w.glass;
      el.dataset.cork = w.cork;
      el.dataset.sand = w.sand;
    }
  }, worn);
  await p.waitForTimeout(350); // the cork's opacity transition
}

async function boardShot(p) {
  const box = await p.locator('#board .rows').boundingBox();
  const pad = 26;
  return p.screenshot({ clip: { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad - 30), width: Math.min(412 - Math.max(0, box.x - pad), box.width + pad * 2), height: box.height + pad * 2 + 30 } });
}

async function jarShot(p, index) {
  const box = await p.locator('#board .jar').nth(index).boundingBox();
  const pad = 14;
  return p.screenshot({ clip: { x: box.x - pad, y: box.y - pad - 6, width: box.width + pad * 2, height: box.height * 0.55 + pad } });
}

/** A contact sheet: rows × columns of images with labels, rendered as a page and saved. */
async function sheet(b, file, title, cols, rows, cells, width) {
  const ctx = await b.newContext({ viewport: { width: 200 + cols.length * (width + 12), height: 400 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  const img = (buf) => `<img src="data:image/png;base64,${buf.toString('base64')}" style="width:${width}px;display:block">`;
  const html = `<body style="margin:0;padding:12px;font:600 14px system-ui;background:#fff;color:#222">
    <div style="font-size:18px;margin-bottom:8px">${title}</div>
    <table style="border-collapse:separate;border-spacing:6px"><tr><td></td>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>
    ${rows.map((r, i) => `<tr><th style="text-align:right;padding-right:6px">${r}</th>${cols.map((_, j) => `<td>${img(cells[i][j])}</td>`).join('')}</tr>`).join('')}
    </table></body>`;
  await p.setContent(html);
  await p.screenshot({ path: path.join(out, file), fullPage: true });
  await ctx.close();
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const report = { errors: [] };

  // (a) One contact sheet per slot: every piece (columns) in four scenes (rows), board at level 61.
  const boards = {};
  for (const scene of SCENES) {
    const { ctx, p } = await open(b, scene, false, '?level=61');
    report[scene] = await dress(p);
    for (const slot of Object.keys(PIECES)) {
      if (slot === 'sand') await dress(p, { unbury: true });
      for (const id of PIECES[slot]) {
        await wear(p, { ...DEFAULTS, [slot]: id });
        (boards[slot] ??= {})[scene + id] = await boardShot(p);
      }
    }
    report.errors.push(...p.errors);
    await ctx.close();
  }
  for (const slot of Object.keys(PIECES)) {
    const cells = SCENES.map((s) => PIECES[slot].map((id) => boards[slot][s + id]));
    await sheet(b, `sheet-${slot}.png`, `${slot}: every piece (columns) in four scenes (rows), level 61`, PIECES[slot], SCENES, cells, 300);
  }

  // (b) Every sand piece with colour patterns on, in a light and a dark scene.
  const pat = {};
  for (const scene of ['midday', 'auroranight']) {
    const { ctx, p } = await open(b, scene, true, '?level=61');
    await dress(p, { unbury: true, patterns: true });
    for (const id of PIECES.sand) {
      await wear(p, { ...DEFAULTS, sand: id });
      pat[scene + id] = await boardShot(p);
    }
    report.errors.push(...p.errors);
    await ctx.close();
  }
  await sheet(b, 'sheet-sand-patterns-on.png', 'sand with colour patterns ON: the pattern stays on top of every texture', PIECES.sand, ['midday', 'auroranight'], ['midday', 'auroranight'].map((s) => PIECES.sand.map((id) => pat[s + id])), 300);

  // (c) A sealed jar close-up for every cork, in each scene.
  const corks = {};
  for (const scene of SCENES) {
    const { ctx, p } = await open(b, scene, false, '?level=61');
    const { sealed } = await dress(p);
    for (const id of PIECES.cork) {
      await wear(p, { ...DEFAULTS, cork: id });
      corks[scene + id] = await jarShot(p, sealed);
    }
    await ctx.close();
  }
  await sheet(b, 'sheet-cork-closeup.png', 'sealed jar close-up: every cork (columns) in four scenes (rows)', PIECES.cork, SCENES, SCENES.map((s) => PIECES.cork.map((id) => corks[s + id])), 150);

  // (d) Home art: today's look, and one combined look, in a light and a dark scene.
  const combo = { glass: 'seaglass', cork: 'brass', sand: 'ripple' };
  for (const scene of ['midday', 'moonlit']) {
    const { ctx, p } = await open(b, scene, false, '');
    await p.screenshot({ path: path.join(out, `home-${scene}-default.png`) });
    await wear(p, combo);
    await p.screenshot({ path: path.join(out, `home-${scene}-seaglass-brass-ripple.png`) });
    const art = await p.locator('#home .logo-jars').boundingBox();
    await p.screenshot({ path: path.join(out, `home-${scene}-art-closeup.png`), clip: { x: art.x - 30, y: art.y - 30, width: art.width + 60, height: art.height + 50 } });
    report.errors.push(...p.errors);
    await ctx.close();
  }

  console.log(JSON.stringify(report, null, 1));
  await b.close();
})();
