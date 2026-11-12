// PROTOTYPE - NOT FOR PRODUCTION
// Question: is a calm hero-and-tabs Home clearly better than today's stacked Home? (sprint 20 H1)
// Date: 2026-11-12
//
// One page, four tabs. All data is sample data; actions that would leave Home show a toast.
// Text is hard-coded English here (a mock-up); the build routes it through src/ui/strings.ts.
import './style.css';
import { Hero } from './hero';
import { shellSvg } from '../../../src/ui/shells';
import { medalSvg } from '../../../src/ui/badge-art';
import { portraitSvg } from '../../../src/ui/avatars';

type Tab = 'play' | 'today' | 'collection' | 'profile';
const TABS: Tab[] = ['play', 'today', 'collection', 'profile'];
const q = new URLSearchParams(location.search);
const motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
const reduced = () => motionQuery.matches || q.get('still') === '1';

// ---- Sample data (a mid-game player on Thursday 12 November) ----
const D = {
  name: 'Saffron Gull',
  coins: '1,240',
  level: 52,
  streak: 4,
  nextReward: { day: 5, what: 'Hint + Shuffle', inDays: 1 },
  goals: [
    { text: 'Clear 2 levels', n: 1, of: 2 },
    { text: 'Seal 15 jars', n: 9, of: 15 },
    { text: 'Clear a weekly board', n: 0, of: 1 },
  ],
  goalsBonus: 50,
  event: { name: 'Winter Tide', board: 12, cleared: 9, of: 24, days: 19 },
  weekly: { name: 'Fine Sieve', cleared: 2, of: 5, days: 2 },
};
const SHELLS = [
  { kind: 'spiral', colors: ['#7a5038', '#c9a27e'] },
  { kind: 'scallop', colors: ['#e3b38a', '#fff1e0'] },
  { kind: 'star', colors: ['#f28482', '#ffd3c4'] },
  { kind: 'clam', colors: ['#3d5a98', '#9fb4dd'] },
  { kind: 'moon', colors: ['#d9c3a5', '#7a6248'] },
  { kind: 'conch', colors: ['#f2e3c9', '#a0693c'] },
] as const;

// ---- Line icons (24 px, 2 px round stroke: the board's tool-icon style) ----
const I = {
  play: '<path d="M8.5 3.5h7"/><rect x="7" y="5.5" width="10" height="15" rx="3"/><path d="M7 14.5c2 1 8 1 10 0"/>',
  today: '<rect x="4" y="5" width="16" height="15" rx="3"/><path d="M4 10h16M9 3v4M15 3v4"/><path d="M9.5 15l2 2 3.5-4"/>',
  collection: '<path d="M12 20.5c-4.6 0-8-2.8-8-6.6C4 9.5 7.6 5 12 5s8 4.5 8 8.9c0 3.8-3.4 6.6-8 6.6z"/><path d="M12 20.5V7.5M8.6 19.6 7.3 9.4M15.4 19.6l1.3-10.2"/>',
  profile: '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c.9-3.9 3.7-6 7-6s6.1 2.1 7 6"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  chev: '<path d="M9.5 6l6 6-6 6"/>',
  flake: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10M10 4l2 2 2-2M10 20l2-2 2 2M4.6 10.3l2.7-.7-.7-2.7M19.4 13.7l-2.7.7.7 2.7M4.6 13.7l2.7.7-.7 2.7M19.4 10.3l-2.7-.7.7-2.7"/>',
  wave: '<path d="M3 9c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/><path d="M3 15c2-2 4 2 6 0s4 2 6 0 4 2 6 0"/>',
  sieve: '<path d="M5 6v10a2 2 0 0 0 4 0V6M10 6v10a2 2 0 0 0 4 0V6M15 6v10a2 2 0 0 0 4 0V6"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  gift: '<rect x="4" y="9" width="16" height="11" rx="2"/><path d="M3 9h18M12 9v11M12 9c-2-4-6-4-6-1.5S10 9 12 9zM12 9c2-4 6-4 6-1.5S14 9 12 9z"/>',
};
const ico = (k: keyof typeof I, cls = 'ico') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true">${I[k]}</svg>`;
const coin = '<i class="coin" aria-hidden="true"></i>';
const bar = (n: number, of: number, label: string) =>
  `<span class="bar" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="${of}" aria-valuenow="${n}"><i style="width:${(100 * n) / of}%"></i></span>`;
const cal = (small = false) => `<span class="cal${small ? ' cal-sm' : ''}" aria-hidden="true"><b>Thu</b><i>12</i></span>`;
const portrait = (cls: string) => `<span class="portrait ${cls}" aria-hidden="true">${portraitSvg({ id: 'sailboat', bg: '#cde3f0' }, 'rope')}</span>`;

// ---- Views ----
function goalRows(): string {
  return D.goals
    .map((g) => `<li><span class="g-text">${g.text}</span>${bar(g.n, g.of, g.text)}<span class="g-num">${g.n}/${g.of}</span></li>`)
    .join('');
}

function playView(): string {
  return `
  <section class="hero" aria-labelledby="hero-level">
    <div class="sky" aria-hidden="true"><span class="moon"></span></div>
    <div class="sea" aria-hidden="true"><i class="w1"></i><i class="w2"></i><i class="glint"></i></div>
    <div class="beach" aria-hidden="true"></div>
    <div class="hero-head">
      <span class="brand">Strata</span>
      <h1 id="hero-level" class="hero-level">Level ${D.level}</h1>
    </div>
    <canvas id="hero-canvas" class="hero-canvas" aria-hidden="true"></canvas>
    <div class="sweep" aria-hidden="true"></div>
  </section>
  <div class="play-wrap">
    <button class="play" type="button" data-act="Level ${D.level}"><span>Play</span></button>
  </div>
  <section class="strip" aria-label="Today">
    <div class="strip-head"><h2>Today</h2><button class="link" type="button" data-go="today">See all ${ico('chev', 'ico ico-sm')}</button></div>
    <div class="strip-row">
      <button class="card mini daily" type="button" data-act="Today's daily puzzle">
        ${cal(true)}
        <span class="mini-text"><strong>Daily puzzle</strong><span class="soft">Today: tricky</span><span class="accent">${D.streak}-day streak</span></span>
      </button>
      <button class="card mini event" type="button" data-act="Winter Tide">
        <span class="mini-ico ice" aria-hidden="true">${ico('flake')}</span>
        <span class="mini-text"><strong>${D.event.name}</strong><span class="soft">${D.event.cleared} of ${D.event.of} cleared</span><span class="accent">${D.event.days} days left</span></span>
      </button>
    </div>
    <p class="next-reward">${ico('gift', 'ico ico-sm')}<span>Next streak reward: <b>${D.nextReward.what}</b> in ${D.nextReward.inDays} day</span></p>
    <div class="card goals" role="group" aria-label="Today's goals">
      <span class="goals-head"><strong>Today's goals</strong><span class="soft">+${D.goalsBonus} ${coin} for all three</span></span>
      <ul class="goal-list">${goalRows()}</ul>
    </div>
  </section>`;
}

function todayView(): string {
  const stops = [
    { day: 5, what: 'Hint + Shuffle', next: true },
    { day: 7, what: 'Cockle shell' },
    { day: 14, what: 'Rope frame' },
    { day: 30, what: '300 coins' },
    { day: 60, what: 'Lighthouse plate' },
  ];
  return `
  <div class="page">
    <button class="card big-daily" type="button" data-act="Today's daily puzzle">
      ${cal()}
      <span class="mini-text"><span class="eyebrow">Daily puzzle</span><strong class="lg">Thursday, tricky</strong><span class="soft">Not solved yet · pays 60 ${coin}</span></span>
      <span class="pill">Play</span>
    </button>

    <section class="card section" aria-labelledby="streak-h">
      <div class="sec-head"><h2 id="streak-h">Streak rewards</h2><span class="accent">${D.streak}-day streak</span></div>
      <ol class="track">
        ${stops.map((s) => `<li class="${s.next ? 'next' : ''}"><span class="dot" aria-hidden="true"></span><b>Day ${s.day}</b><span>${s.what}</span></li>`).join('')}
      </ol>
      <p class="soft small">2 tide passes held: a missed day won't break the streak.</p>
    </section>

    <section class="card section" aria-labelledby="goals-h">
      <div class="sec-head"><h2 id="goals-h">Today's goals</h2><span class="soft">+${D.goalsBonus} ${coin}</span></div>
      <ul class="goal-list roomy">${goalRows()}</ul>
    </section>

    <button class="card row-card" type="button" data-act="Weekly set">
      <span class="mini-ico" aria-hidden="true">${ico('sieve')}</span>
      <span class="mini-text"><span class="eyebrow">Weekly set</span><strong>${D.weekly.name}</strong><span class="soft">${D.weekly.cleared} of ${D.weekly.of} cleared · ${D.weekly.days} days left</span></span>
      ${ico('chev', 'ico chev')}
    </button>

    <button class="card row-card event-row" type="button" data-act="Winter Tide">
      <span class="mini-ico ice" aria-hidden="true">${ico('flake')}</span>
      <span class="mini-text"><span class="eyebrow">Event</span><strong>${D.event.name}</strong><span class="soft">Board ${D.event.board} open · ${D.event.cleared} of ${D.event.of}</span>${bar(D.event.cleared, D.event.of, 'Winter Tide boards cleared')}</span>
      ${ico('chev', 'ico chev')}
    </button>
    <p class="soft small center">Winter Tide ends in ${D.event.days} days.</p>
  </div>`;
}

function collectionView(): string {
  const shellRow = SHELLS.slice(0, 3).map((s) => `<span class="shell">${shellSvg(s as never)}</span>`).join('');
  return `
  <div class="page">
    <div class="grid">
      <button class="card tile" type="button" data-act="Shell cabinet">
        <span class="tile-art shells">${shellRow}</span>
        <strong>Shells</strong><span class="soft">7 of 40</span>
      </button>
      <button class="card tile" type="button" data-act="Badges">
        <span class="tile-art medals">${medalSvg('daily', 'dailiesSolved', 2)}${medalSvg('mastery', 'jarsSealed', 3)}</span>
        <strong>Badges</strong><span class="soft">12 of 48</span>
      </button>
      <button class="card tile" type="button" data-act="Jar styles">
        <span class="tile-art styles" aria-hidden="true"><i class="mj a"></i><i class="mj b"></i><i class="mj c"></i></span>
        <strong>Jar styles</strong><span class="soft">3 of 12</span>
      </button>
      <button class="card tile" type="button" data-act="Scenes">
        <span class="new-mark">New</span>
        <span class="tile-art scenes" aria-hidden="true"><i class="sc mid"></i><i class="sc moon"></i><i class="sc dawn"></i></span>
        <strong>Scenes</strong><span class="soft">2 of 9 · 1 new</span>
      </button>
      <button class="card tile wide" type="button" data-act="Beach path">
        <span class="tile-art map" aria-hidden="true">
          <svg viewBox="0 0 300 70"><path class="m-sea" d="M0 52c40-8 70 8 110 0s70-10 110-2 60 6 80 2v18H0z"/><path class="m-path" d="M14 44C60 20 90 50 140 32s90 10 146-18"/>
          ${[[14, 44], [58, 30], [100, 42], [140, 32], [190, 34], [238, 26], [286, 14]].map(([x, y], i) => `<circle class="m-stone${i === 4 ? ' here' : ''}" cx="${x}" cy="${y}" r="${i === 4 ? 7 : 5}"/>`).join('')}</svg>
        </span>
        <span class="tile-text"><strong>Beach path</strong><span class="soft">Level ${D.level} · Pier</span></span>
      </button>
    </div>
  </div>`;
}

function profileView(): string {
  const stats = [
    ['51', 'Levels cleared'],
    ['412', 'Jars sealed'],
    ['23', 'Dailies solved'],
    ['9', 'Best streak'],
    ['17', 'Perfect clears'],
    ['7', 'Shells found'],
  ];
  const toggle = (label: string, on: boolean, sub = '') =>
    `<li><span><b>${label}</b>${sub ? `<span class="soft small">${sub}</span>` : ''}</span><button class="switch" type="button" role="switch" aria-checked="${on}" aria-label="${label}"><i></i></button></li>`;
  return `
  <div class="page">
    <section class="card me" aria-label="Profile">
      ${portrait('portrait-lg')}
      <span class="me-text"><strong class="lg">${D.name}</strong><span class="plate">Tide watcher</span></span>
      <button class="ghost" type="button" data-act="Edit profile">Edit</button>
    </section>
    <section class="card section" aria-labelledby="stats-h">
      <div class="sec-head"><h2 id="stats-h">Stats</h2></div>
      <dl class="stats">${stats.map(([n, l]) => `<div><dt>${l}</dt><dd>${n}</dd></div>`).join('')}</dl>
    </section>
    <section id="settings" class="card section" aria-labelledby="settings-h">
      <div class="sec-head"><h2 id="settings-h">${ico('gear', 'ico ico-sm')} Settings</h2></div>
      <ul class="settings">
        ${toggle('Sound', true)}
        ${toggle('Music', false)}
        ${toggle('Realistic sand', true, 'Lit glass and falling grains')}
        ${toggle('Colour patterns', false, 'A pattern on each colour')}
        <li><span><b>Save code</b><span class="soft small">Move your progress to another device</span></span><button class="ghost" type="button" data-act="Save code">Open</button></li>
        <li><span><b>What's new</b></span><button class="ghost" type="button" data-act="What's new">0.19.0</button></li>
      </ul>
    </section>
  </div>`;
}

const TITLES: Record<Tab, string> = { play: '', today: 'Today', collection: 'Collection', profile: 'Profile' };

// ---- Shell ----
const root = document.getElementById('root')!;
root.innerHTML = `
  <div class="app">
    <header class="top">
      <button class="chip" type="button" data-go="profile" aria-label="Profile: ${D.name}">${portrait('portrait-sm')}<span class="chip-name">${D.name}</span></button>
      <h1 class="top-title" id="top-title" hidden></h1>
      <span class="top-right">
        <span class="coins">${coin}<span>${D.coins}</span><span class="sr-only"> coins</span></span>
        <button class="icon-btn gear" type="button" data-go="profile" data-settings aria-label="Settings" title="Settings" hidden>${ico('gear')}</button>
      </span>
    </header>
    <main class="views">
      ${TABS.map((t) => `<div class="view view-${t}" id="panel-${t}" role="tabpanel" aria-labelledby="tab-${t}" tabindex="-1" hidden></div>`).join('')}
    </main>
    <nav class="tabbar" aria-label="Home">
      <div role="tablist" aria-label="Home sections" class="tabs">
        ${TABS.map((t) => `<button role="tab" id="tab-${t}" aria-controls="panel-${t}" class="tab" type="button" data-tab="${t}">${ico(t as keyof typeof I)}<span>${t[0].toUpperCase() + t.slice(1)}</span>${t === 'collection' ? '<i class="new-dot" aria-hidden="true"></i><span class="sr-only">, something new</span>' : ''}</button>`).join('')}
      </div>
    </nav>
    <button class="mock-theme" type="button" aria-label="Mock-up: switch scene">${ico('moon', 'ico ico-sm')}<span>Moonlit</span></button>
    <div class="toast" role="status" aria-live="polite"></div>
  </div>`;

const views: Record<Tab, () => string> = { play: playView, today: todayView, collection: collectionView, profile: profileView };
let hero: Hero | null = null;
let current: Tab = 'play';

function select(tab: Tab, focus = false): void {
  current = tab;
  for (const t of TABS) {
    const b = document.getElementById(`tab-${t}`)!;
    const on = t === tab;
    b.setAttribute('aria-selected', String(on));
    b.tabIndex = on ? 0 : -1;
    const p = document.getElementById(`panel-${t}`)!;
    p.hidden = !on;
    if (on && !p.innerHTML) p.innerHTML = views[t]();
  }
  if (tab === 'collection') document.querySelector('.new-dot')?.remove();
  document.body.dataset.tab = tab;
  const title = document.getElementById('top-title')!;
  title.textContent = TITLES[tab];
  title.hidden = tab === 'play';
  document.querySelector<HTMLElement>('.chip')!.hidden = tab !== 'play';
  document.querySelector<HTMLElement>('.gear')!.hidden = tab === 'play' || tab === 'profile';
  document.querySelector('.views')!.scrollTop = 0;
  if (tab === 'play') {
    if (!hero) {
      hero = new Hero(document.getElementById('hero-canvas') as HTMLCanvasElement, reduced);
      hero.setNight(document.body.dataset.theme === 'moonlit');
    }
    hero.start();
  } else hero?.stop();
  if (focus) document.getElementById(`tab-${tab}`)!.focus();
}

function toast(text: string): void {
  const t = document.querySelector<HTMLElement>('.toast')!;
  t.textContent = text;
  t.classList.add('show');
  clearTimeout((t as unknown as { _h: number })._h);
  (t as unknown as { _h: number })._h = window.setTimeout(() => t.classList.remove('show'), 1800);
}

document.addEventListener('click', (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-tab],[data-go],[data-act],.switch,.mock-theme');
  if (!el) return;
  if (el.dataset.tab) return select(el.dataset.tab as Tab);
  if (el.dataset.go) {
    select(el.dataset.go as Tab);
    if (el.hasAttribute('data-settings')) document.getElementById('settings')?.scrollIntoView({ block: 'start' });
    return;
  }
  if (el.classList.contains('switch')) return el.setAttribute('aria-checked', String(el.getAttribute('aria-checked') !== 'true'));
  if (el.classList.contains('mock-theme')) return setTheme(document.body.dataset.theme === 'moonlit' ? 'midday' : 'moonlit');
  toast(`Mock-up: would open ${el.dataset.act}`);
});

// A real tablist: arrows, Home and End move between tabs (sprint 20 accessibility).
document.querySelector('.tabs')!.addEventListener('keydown', (e) => {
  const k = (e as KeyboardEvent).key;
  const i = TABS.indexOf(current);
  const next = k === 'ArrowRight' ? (i + 1) % 4 : k === 'ArrowLeft' ? (i + 3) % 4 : k === 'Home' ? 0 : k === 'End' ? 3 : -1;
  if (next < 0) return;
  e.preventDefault();
  select(TABS[next], true);
});

function setTheme(theme: 'midday' | 'moonlit'): void {
  document.body.dataset.theme = theme;
  const b = document.querySelector('.mock-theme')!;
  b.innerHTML = theme === 'moonlit' ? `${ico('sun', 'ico ico-sm')}<span>Midday</span>` : `${ico('moon', 'ico ico-sm')}<span>Moonlit</span>`;
  hero?.setNight(theme === 'moonlit');
}

document.addEventListener('visibilitychange', () => (document.hidden ? hero?.stop() : current === 'play' && hero?.start()));
motionQuery.addEventListener('change', () => current === 'play' && hero?.start());
if (reduced()) document.documentElement.classList.add('still');

setTheme(q.get('theme') === 'moonlit' ? 'moonlit' : 'midday');
select((TABS as string[]).includes(q.get('tab') ?? '') ? (q.get('tab') as Tab) : 'play');
