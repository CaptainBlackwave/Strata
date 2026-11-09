// Sprint 10 F2 (D65): renders every scene's music in Chromium's real WebAudio engine with an
// OfflineAudioContext, then converts and measures it with ffmpeg.
//
// Run from the repo root:  node production/qa/evidence/sprint-10/f2/scripts/render-offline.cjs [seconds]
//
// How: esbuild bundles src/ui/music.ts for the page; each scene gets a fresh
// OfflineAudioContext(2 ch, 48 kHz), the same 2 s noise buffer the game makes (seeded here, so
// clips are reproducible), and an output gain of 0.35 = the game's musicBus (0.5) x master (0.7).
// SceneMusic.start() then pump(seconds) schedules the whole clip up front (the time-stepped
// scheduler); the crossfade clip suspends the render at 10 s to call setScene, like a tap would.
// "before-midday" is the 0.9.1 music (git show fbb2874:src/ui/audio.ts, startMusic) with the same
// graph and its 620 ms step placed at exact times.
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const esbuild = require(path.resolve('node_modules/esbuild'));

const OUT = path.resolve('production/qa/evidence/sprint-10/f2/clips');
const SECONDS = Number(process.argv[2] ?? 20);
const config = JSON.parse(fs.readFileSync('src/config/game-config.json', 'utf8'));
const scenes = config.themes.list.map((t) => t.id);

const bundle = esbuild.buildSync({ entryPoints: ['src/ui/music.ts'], bundle: true, format: 'iife', globalName: 'StrataMusic', write: false }).outputFiles[0].text;

/** Runs in the page: renders one clip and returns it as 16-bit WAV bytes (base64) plus render timing. */
async function renderInPage({ scene, seconds, mode, seed }) {
  const { SceneMusic, seededRng } = window.StrataMusic;
  const rate = 48000;
  const ctx = new OfflineAudioContext(2, Math.round(rate * seconds), rate);
  const nrng = seededRng(12345);
  const noise = ctx.createBuffer(1, rate * 2, rate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = nrng() * 2 - 1;
  const out = ctx.createGain();
  out.gain.value = 0.5 * 0.7; // musicBus x master in GameAudio
  out.connect(ctx.destination);
  const timers = { setInterval: () => 1, clearInterval: () => {} };
  if (mode === 'before') {
    // The 0.9.1 music, unchanged apart from exact step times.
    const SCALE = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25, 783.99, 880.0];
    const waves = ctx.createBufferSource();
    waves.buffer = noise;
    waves.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const swell = ctx.createGain();
    swell.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.09;
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.04;
    lfo.connect(lfoDepth).connect(swell.gain);
    waves.connect(lp).connect(swell).connect(out);
    waves.start();
    lfo.start();
    const pattern = [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 7, 5, 4, 2, 4];
    for (let step = 0; 0.62 * (step + 1) < seconds; step++) {
      const t = 0.62 * (step + 1) + 0.05;
      if (step % 4 === 3) continue;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = SCALE[pattern[step % pattern.length]] / 2;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.09, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      o.connect(g).connect(out);
      o.start(t);
      o.stop(t + 1.7);
    }
  } else {
    const music = new SceneMusic(ctx, out, noise, { rng: seededRng(seed), timers });
    music.start(scene);
    if (mode === 'crossfade') {
      music.pump(10);
      ctx.suspend(10).then(() => {
        music.setScene('softrain');
        music.pump(seconds);
        ctx.resume();
      });
    } else music.pump(seconds);
  }
  const t0 = performance.now();
  const buf = await ctx.startRendering();
  const ms = performance.now() - t0;
  const n = buf.length;
  const bytes = new Uint8Array(44 + n * 4);
  const v = new DataView(bytes.buffer);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let peak = 0;
  for (let i = 0; i < n; i++) {
    peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
    v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return { wav: btoa(bin), ms, samplePeak: peak };
}

/** Integrated loudness (LUFS), loudness range (LU) and true peak (dBTP) from ffmpeg's ebur128 summary. */
function loudness(file) {
  const r = require('node:child_process').spawnSync('/usr/bin/ffmpeg', ['-hide_banner', '-nostats', '-i', file, '-af', 'ebur128=peak=true', '-f', 'null', '-'], { encoding: 'utf8' });
  const s = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const num = (re) => Number((s.match(re) ?? [])[1]);
  return { I: num(/I:\s+(-?[\d.]+) LUFS/), LRA: num(/LRA:\s+(-?[\d.]+) LU/), TP: num(/Peak:\s+(-?[\d.inf]+) dBFS/) };
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage();
  await page.setContent('<!doctype html><title>F2 render</title>');
  await page.addScriptTag({ content: bundle });
  const jobs = [{ name: 'before-midday', scene: 'midday', mode: 'before', seconds: SECONDS }];
  for (const s of scenes) jobs.push({ name: s, scene: s, mode: 'scene', seconds: SECONDS });
  jobs.push({ name: 'crossfade-midday-to-softrain', scene: 'midday', mode: 'crossfade', seconds: SECONDS });
  if (process.env.LONG) jobs.push({ name: 'midday-2min', scene: 'midday', mode: 'scene', seconds: 130 });
  const rows = [];
  for (const job of jobs) {
    const r = await page.evaluate(renderInPage, { ...job, seed: Number(process.env.SEED ?? 2026) });
    const wav = path.join(OUT, `${job.name}.wav`);
    fs.writeFileSync(wav, Buffer.from(r.wav, 'base64'));
    const m = loudness(wav);
    execFileSync('/usr/bin/ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', wav, '-c:a', 'libvorbis', '-q:a', '5', path.join(OUT, `${job.name}.ogg`)]);
    if (!process.env.KEEP_WAV) fs.unlinkSync(wav);
    rows.push({ clip: job.name, ...m, speed: Math.round((job.seconds * 1000) / r.ms) });
    console.log(JSON.stringify(rows[rows.length - 1]));
  }
  fs.writeFileSync(path.join(OUT, process.env.SEED ? `loudness-offline-seed${process.env.SEED}.json` : 'loudness-offline.json'), JSON.stringify(rows, null, 1) + '\n');
  await browser.close();
})();
