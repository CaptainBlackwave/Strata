// Records Strata's synthesised audio for listening sign-off (D67): every sound event, and the
// music of each scene, exactly as it leaves the engine.
//
//   node tools/audio/capture.cjs <devServerUrl> <outDir> [--music-seconds 20] [--scenes a,b]
//
// Run it against `npx vite --port N` of the code to record (a checkout of the old version for
// "before"). The page imports src/ui/audio.ts straight from the dev server, so nothing in the game
// changes for recording. AudioContext is wrapped so its destination also feeds a MediaRecorder;
// clips are saved as .webm (Opus) and converted with ffmpeg to .ogg, then measured
// (integrated loudness in LUFS, true peak in dBTP) with ffmpeg's ebur128 filter.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [base, out, ...rest] = process.argv.slice(2);
const opt = (name, dflt) => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : dflt; };
const MUSIC_S = Number(opt('--music-seconds', 20));
fs.mkdirSync(out, { recursive: true });

// Every event the engine knows, with the detail the game passes; unknown events are skipped.
const EVENTS = [
  ['select', {}], ['deselect', {}], ['nope', {}], ['pour', { units: 1 }], ['pour', { units: 3 }], ['land', { pitch: 1 }],
  ['seal', {}], ['win', {}], ['coin', {}], ['booster', {}], ['shuffle', {}],
  ['mapStone', {}], ['locked', {}], ['unlock', {}], ['shell', {}], ['sceneBought', {}], ['playHere', {}],
];

function measure(file) {
  // ebur128 prints a summary on stderr: "I: -23.4 LUFS" and "Peak: -1.2 dBFS" (true peak with peak=true).
  let txt = '';
  try { execFileSync('ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { stdio: ['ignore', 'ignore', 'pipe'] }); }
  catch (e) { txt = String(e.stderr || ''); }
  if (!txt) txt = execFileSync('sh', ['-c', `ffmpeg -hide_banner -nostats -i "${file}" -af ebur128=peak=true -f null - 2>&1`]).toString();
  const sum = txt.slice(txt.lastIndexOf('Summary:'));
  const I = /I:\s+(-?[\d.]+|-inf) LUFS/.exec(sum)?.[1];
  const P = /Peak:\s+(-?[\d.]+|-inf) dBFS/.exec(sum)?.[1];
  return { lufs: I === undefined ? null : Number(I), truePeak: P === undefined ? null : Number(P) };
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('pageerror', String(e)));
  await page.addInitScript(() => {
    // Tap the speakers: every context's destination is a gain that also feeds one recorder stream.
    const Real = window.AudioContext;
    window.__taps = [];
    class Tapped extends Real {
      constructor(...a) {
        super(...a);
        const tap = super.createGain();
        tap.connect(super.destination);
        const rec = super.createMediaStreamDestination();
        tap.connect(rec);
        this.__tap = tap;
        window.__taps.push(rec.stream);
      }
      get destination() { return this.__tap; }
    }
    window.AudioContext = Tapped;
    window.webkitAudioContext = Tapped;
    window.__record = (ms) => new Promise((res) => {
      const stream = window.__taps[window.__taps.length - 1];
      const r = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus', audioBitsPerSecond: 128000 });
      const chunks = [];
      r.ondataavailable = (e) => chunks.push(e.data);
      r.onstop = async () => {
        const buf = new Uint8Array(await new Blob(chunks).arrayBuffer());
        let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
        res(btoa(s));
      };
      r.start();
      setTimeout(() => r.stop(), ms);
    });
  });
  await page.goto(base);
  const info = await page.evaluate(async () => {
    const mod = await import('/src/ui/audio.ts');
    const opts = { sound: true, music: false, haptics: false, soundVolume: 0.8, musicVolume: 0.8 };
    const audio = new mod.GameAudio(opts);
    audio.unlock();
    window.__audio = audio; window.__opts = opts;
    return { hasSetScene: typeof audio.setScene === 'function' };
  });
  const scenes = (opt('--scenes', '') || JSON.parse(fs.readFileSync(path.join(process.cwd(), 'src/config/game-config.json'), 'utf8')).themes.list.map((t) => t.id).join(',')).split(',');
  const results = { events: {}, music: {}, hasSetScene: info.hasSetScene };
  const save = (name, b64) => {
    const webm = path.join(out, name + '.webm'); const ogg = path.join(out, name + '.ogg');
    fs.writeFileSync(webm, Buffer.from(b64, 'base64'));
    execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', webm, '-c:a', 'libopus', '-b:a', '96k', ogg]);
    fs.unlinkSync(webm);
    return measure(ogg);
  };
  // Sound events: each recorded on its own, 400 ms of lead-in, the sound, then silence to its tail.
  for (const [ev, detail] of EVENTS) {
    const name = 'sfx-' + ev + (detail.units ? '-' + detail.units : '');
    const b64 = await page.evaluate(async ([ev, detail]) => {
      const done = window.__record(ev === 'win' ? 2600 : 1600);
      await new Promise((r) => setTimeout(r, 300));
      window.__audio.play(ev, detail);
      return done;
    }, [ev, detail]);
    results.events[name] = save(name, b64);
  }
  // Music: the old engine has one theme (no setScene); the new one is recorded per scene.
  await page.evaluate(() => { window.__opts.sound = false; window.__opts.music = true; window.__audio.configure({ ...window.__opts }); });
  const list = info.hasSetScene ? scenes : ['all-scenes'];
  for (const id of list) {
    const b64 = await page.evaluate(async ([id, ms]) => {
      if (window.__audio.setScene) window.__audio.setScene(id);
      await new Promise((r) => setTimeout(r, 2500)); // let the crossfade finish
      return window.__record(ms);
    }, [id, MUSIC_S * 1000]);
    results.music['music-' + id] = save('music-' + id, b64);
  }
  fs.writeFileSync(path.join(out, 'loudness.json'), JSON.stringify(results, null, 1));
  console.log(JSON.stringify(results));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
