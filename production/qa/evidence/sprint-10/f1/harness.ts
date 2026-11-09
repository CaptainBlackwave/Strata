// Loudness harness: renders every event of the old and new engines in an OfflineAudioContext.
import { GameAudio as OldAudio } from './old-audio';
import { GameAudio as NewAudio } from '../../../../../../home/user/Strata/.claude/worktrees/agent-abd3950387c1c8216/src/ui/audio';
import { SOUNDS } from '../../../../../../home/user/Strata/.claude/worktrees/agent-abd3950387c1c8216/src/ui/sfx';

const SR = 48000;
const SECONDS = 2.6;

function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function measure(buf: AudioBuffer) {
  const d = buf.getChannelData(0);
  let peak = 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < d.length; i++) {
    const a = Math.abs(d[i]);
    if (a > peak) peak = a;
    if (a > 0.001) {
      if (first < 0) first = i;
      last = i;
    }
  }
  let sum = 0;
  for (let i = first; i <= last && first >= 0; i++) sum += d[i] * d[i];
  const rms = first >= 0 ? Math.sqrt(sum / (last - first + 1)) : 0;
  const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -Infinity);
  return { peakDb: db(peak), rmsDb: db(rms), ms: first >= 0 ? Math.round(((last - first) / SR) * 1000) : 0 };
}

type Case = { event: string; detail: Record<string, number> };

async function renderOld(c: Case) {
  Math.random = seeded(7);
  const ctx = new OfflineAudioContext(1, SR * SECONDS, SR);
  (window as unknown as { AudioContext: unknown }).AudioContext = function () {
    return ctx;
  };
  const a = new OldAudio({ sound: true, music: false, haptics: false });
  a.unlock();
  a.play(c.event as never, c.detail);
  return measure(await ctx.startRendering());
}

async function renderNew(c: Case, volume: number) {
  const ctx = new OfflineAudioContext(1, SR * SECONDS, SR);
  const a = new NewAudio({ sound: true, music: false, haptics: false, soundVolume: volume, musicVolume: 0 }, { createContext: () => ctx, vibrate: () => undefined, random: seeded(7) });
  a.unlock();
  a.play(c.event as never, c.detail);
  return measure(await ctx.startRendering());
}

const OLD_EVENTS = ['select', 'deselect', 'nope', 'pour', 'land', 'seal', 'win', 'coin', 'booster', 'shuffle'];

(window as unknown as { run: () => Promise<unknown> }).run = async () => {
  const cases: Case[] = [];
  for (const event of Object.keys(SOUNDS)) {
    if (event === 'pour') for (const units of [1, 4]) cases.push({ event, detail: { units } });
    else if (event === 'land') for (const pitch of [0, 7]) cases.push({ event, detail: { pitch } });
    else cases.push({ event, detail: {} });
  }
  const rows = [];
  for (const c of cases) {
    rows.push({
      ...c,
      cap: SOUNDS[c.event as keyof typeof SOUNDS].capDb,
      before: OLD_EVENTS.includes(c.event) ? await renderOld(c) : null,
      after: await renderNew(c, 1),
      afterDefault: await renderNew(c, 0.8),
    });
  }
  return rows;
};
