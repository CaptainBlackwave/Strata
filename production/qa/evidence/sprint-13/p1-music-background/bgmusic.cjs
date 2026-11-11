// Sprint 13 P1 (phone check "background"): does the music go silent when the game tab is hidden (another tab in front)? Measures the real output level.
// usage: node bgmusic.cjs [baseUrl]   (after `npm run build` and `npx vite preview`)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const SAVE = { level: 5, tutorialDone: true, seenWhatsNew: '0.13.0', settings: { sound: true, music: true, haptics: false, patterns: false, soundVolume: 1, musicVolume: 1 }, onboarding: { visits: 3, installShown: true, offlineNoticed: true, homeHintSeen: true, scenesNewSeen: true } };
(async () => {
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await b.newContext({ viewport: { width: 412, height: 900 } });
  await ctx.addInitScript((v) => {
    if (!sessionStorage.getItem('s')) { localStorage.setItem('strata.save.v2', v); sessionStorage.setItem('s', '1'); }
    const orig = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      if (dest instanceof AudioDestinationNode && !window.__an) {
        const an = this.context.createAnalyser(); an.fftSize = 2048; window.__an = an;
        orig.call(this, an); orig.call(an, dest); return dest;
      }
      return orig.call(this, dest, ...rest);
    };
    window.__rms = () => { const a = window.__an; if (!a) return -1; const d = new Float32Array(a.fftSize); a.getFloatTimeDomainData(d); return Math.sqrt(d.reduce((s, x) => s + x * x, 0) / d.length); };
  }, JSON.stringify(SAVE));
  const p = await ctx.newPage();
  await p.goto(process.argv[2] || 'http://localhost:5541/'); await p.waitForTimeout(800);
  await p.click('#btn-play', { force: true }); await p.waitForTimeout(3500); // a tap unlocks audio; music fades in
  const rms = async () => (await p.evaluate(() => window.__rms())).toFixed(4);
  const vis = async () => p.evaluate(() => document.visibilityState);
  console.log('playing:', await vis(), 'rms', await rms());
  const setHidden = (h) => p.evaluate((h) => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') }); document.dispatchEvent(new Event('visibilitychange')); }, h);
  await setHidden(true); await p.waitForTimeout(2500);
  console.log('hidden (event fired):', await vis(), 'rms', await rms());
  await setHidden(false); await p.waitForTimeout(3500);
  console.log('shown again:', await vis(), 'rms', await rms());
  await p.evaluate(() => window.dispatchEvent(new Event('blur'))); await p.waitForTimeout(2000);
  console.log('window blur only (no visibility event):', await vis(), 'rms', await rms());
  await p.evaluate(() => window.dispatchEvent(new Event('focus'))); await p.waitForTimeout(3500);
  console.log('focus again:', await vis(), 'rms', await rms());
  await p.evaluate(() => window.dispatchEvent(new Event('pagehide'))); await p.waitForTimeout(2000);
  console.log('pagehide only:', await vis(), 'rms', await rms());
  await b.close();
})();
