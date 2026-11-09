// Sprint 10 F2 (D65): real-time capture of the music in the built game, plus the smoke run.
//
// Usage (repo root, a `vite preview` of the build already running on the port):
//   node production/qa/evidence/sprint-10/f2/scripts/capture-app.cjs <port> <label> <scene,scene,...>
//
// An init script subclasses AudioContext so `destination` returns a GainNode feeding both the real
// destination and a MediaStreamAudioDestinationNode, which MediaRecorder records (Opus in WebM,
// 256 kb/s). The save is seeded (strata.save.v2: tutorial done, level 5, every scene owned, What's
// new already seen for package.json's version). Play is tapped (the gesture that unlocks audio),
// then each scene is chosen in the Scenes sheet; after 3 s (the 2 s crossfade) 20 s is recorded.
// Then the page is reported hidden: the loudest 100 ms RMS is logged while playing, while hidden
// and when shown again (an AnalyserNode on the same tap).
// Writes clips/<label>-app-<scene>.webm, a screenshot, and prints page errors and CDP main-thread
// script time while the music plays.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const [port, label, sceneArg] = process.argv.slice(2);
const OUT = path.resolve('production/qa/evidence/sprint-10/f2/clips');
const SHOTS = path.resolve('production/qa/evidence/sprint-10/f2');
const version = JSON.parse(fs.readFileSync('package.json', 'utf8')).version;
const config = JSON.parse(fs.readFileSync('src/config/game-config.json', 'utf8'));
const owned = config.themes.list.map((t) => t.id);
const scenes = sceneArg.split(',');
const RECORD_MS = 20000;

const init = ({ version, owned }) => {
  if (!localStorage.getItem('strata.save.v2')) {
    localStorage.setItem('strata.save.v2', JSON.stringify({ level: 5, tutorialDone: true, seenWhatsNew: version, themes: { owned, selected: 'midday', auto: false } }));
  }
  const Real = window.AudioContext;
  class Tapped extends Real {
    constructor(...args) {
      super(...args);
      const real = super.destination;
      this.__tap = this.createGain();
      this.__tap.connect(real);
      this.__ms = this.createMediaStreamDestination();
      this.__tap.connect(this.__ms);
      this.__an = this.createAnalyser();
      this.__tap.connect(this.__an);
      window.__ctx = this;
    }
    get destination() {
      return this.__tap ?? super.destination;
    }
  }
  window.AudioContext = Tapped;
  // Loudest 100 ms RMS (dBFS) at the destination over ms: MediaRecorder writes no frames for a
  // silent graph, so silence is checked here instead of from a recording.
  window.__peakRms = (ms) =>
    new Promise((resolve) => {
      const buf = new Float32Array(2048);
      let peak = 0;
      const id = setInterval(() => {
        window.__ctx.__an.getFloatTimeDomainData(buf);
        peak = Math.max(peak, Math.sqrt(buf.reduce((a, x) => a + x * x, 0) / buf.length));
      }, 100);
      setTimeout(() => (clearInterval(id), resolve(peak > 0 ? +(20 * Math.log10(peak)).toFixed(1) : -Infinity)), ms);
    });
  window.__record = (ms) =>
    new Promise((resolve) => {
      const rec = new MediaRecorder(window.__ctx.__ms.stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 256000 });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.onstop = async () => {
        const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        resolve(btoa(bin));
      };
      rec.start();
      setTimeout(() => rec.stop(), ms);
    });
};

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
  await page.addInitScript(init, { version, owned });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForTimeout(800);
  await page.click('#btn-play', { force: true }); // it pulses, so it is never "stable"
  await page.waitForTimeout(500);
  const state = await page.evaluate(() => window.__ctx?.state ?? 'no context');
  console.log('audio context:', state);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Performance.enable');
  const metric = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  const save = async (name, b64) => fs.writeFileSync(path.join(OUT, `${label}-app-${name}.webm`), Buffer.from(b64, 'base64'));
  for (const [i, scene] of scenes.entries()) {
    if (i > 0 || scene !== 'midday') {
      await page.evaluate(() => (document.getElementById('scenes').hidden ? document.getElementById('btn-scenes').click() : 0));
      await page.waitForTimeout(400);
      await page.click(`#scene-grid [data-id="${scene}"]`, { force: true });
    }
    await page.waitForTimeout(3000);
    const m0 = await metric();
    const b64 = await page.evaluate((ms) => window.__record(ms), RECORD_MS);
    const m1 = await metric();
    await save(scene, b64);
    const theme = await page.evaluate(() => document.body.dataset.theme);
    console.log(JSON.stringify({ scene, theme, scriptMsPerS: +(((m1.ScriptDuration - m0.ScriptDuration) * 1000) / (RECORD_MS / 1000)).toFixed(1), taskMsPerS: +(((m1.TaskDuration - m0.TaskDuration) * 1000) / (RECORD_MS / 1000)).toFixed(1), nodes: m1.AudioHandlers }));
    if (i === 0) await page.screenshot({ path: path.join(SHOTS, `${label}-first-scene.png`) });
  }
  console.log('peak RMS while playing (dBFS):', await page.evaluate((ms) => window.__peakRms(ms), 4000));
  // Hidden page: music should stop. Fake the visibility state, record 4 s, then show it again.
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(1000);
  console.log('peak RMS while hidden, 1-5 s after (dBFS):', await page.evaluate((ms) => window.__peakRms(ms), 4000));
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await page.waitForTimeout(3000);
  console.log('peak RMS when shown again (dBFS):', await page.evaluate((ms) => window.__peakRms(ms), 4000));
  await page.screenshot({ path: path.join(SHOTS, `${label}-end.png`) });
  console.log('page errors:', errors.length ? errors : 'none');
  await browser.close();
})();
