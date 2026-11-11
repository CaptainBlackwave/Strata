// Sprint 14 H1: reads the built page's preview tags the way a chat app would, and draws the card they produce.
// usage: node check.cjs <baseUrl> <outDir>   (after `npm run build` and `npx vite preview --port 5540 --strictPort`)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const [base, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 560, height: 520 }, deviceScaleFactor: 2 });
  const errors = [];
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base);
  await p.waitForTimeout(800);
  const tags = await p.evaluate(() => {
    const m = (k) => document.querySelector(`meta[property="${k}"], meta[name="${k}"]`)?.getAttribute('content') ?? null;
    return { title: document.title, description: m('description'), ogTitle: m('og:title'), ogDescription: m('og:description'), ogUrl: m('og:url'), ogImage: m('og:image'), ogAlt: m('og:image:alt'), twitterCard: m('twitter:card') };
  });
  // The image is served by this build under the same file name the tag points at.
  const file = tags.ogImage.split('/').pop();
  const img = await p.request.get(base + file);
  const result = { tags, image: { status: img.status(), type: img.headers()['content-type'], bytes: (await img.body()).length }, errors };
  await p.setContent(`<body style="margin:0;padding:24px;background:#e9edf1;font-family:system-ui,sans-serif">
    <div style="font-size:13px;color:#667;margin-bottom:8px">How a pasted link looks (drawn from the built page's tags)</div>
    <div style="width:500px;border-radius:14px;overflow:hidden;background:#fff;box-shadow:0 1px 4px #0003">
      <img src="${base + file}" alt="${tags.ogAlt}" style="display:block;width:500px;height:262px;object-fit:cover">
      <div style="padding:12px 16px 14px">
        <div style="font-size:12px;color:#778;text-transform:uppercase;letter-spacing:.04em">${new URL(tags.ogUrl).host}</div>
        <div style="font-size:17px;font-weight:700;margin:4px 0;color:#123">${tags.ogTitle}</div>
        <div style="font-size:14px;color:#445;line-height:1.35">${tags.ogDescription}</div>
      </div></div></body>`);
  await p.waitForTimeout(400);
  await p.screenshot({ path: path.join(out, 'pasted-link-card.png') });
  await b.close();
  fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 1) + '\n');
  console.log(JSON.stringify(result));
})();
