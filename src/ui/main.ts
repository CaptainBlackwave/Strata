/**
 * Strata's browser front end: home screen, tutorial, board rendering, boosters,
 * rewards and the pour animation. It owns no game rules: GameSession (rules) and
 * economy.ts (coins and boosters) decide, and this file displays and asks.
 * Implements design/game-brief.md MVP 5-6 and design/competitive-roadmap.md C1-C5.
 */
import './style.css';
import rawConfig from '../config/game-config.json';
import { type Board, type Jar, canPour, isClosed, isSealed, pourAmount } from '../core/board';
import { type CollectionConfig, allShells, grantShell, knownShells, milestoneDue, setProgress } from '../core/collection';
import { type DailyConfig, generateDaily, recordDailySolve, sharePours, streakStatus, utcDateKey, weekday } from '../core/daily';
import { type BoosterId, type EconomyConfig, addBoosters, addCoins, clearReward, isFreeBooster, spendBooster } from '../core/economy';
import { generateLevel, tutorialBoard } from '../core/generator';
import { type GameConfig, type MechanicId, launchLevel } from '../core/levels';
import { createRng } from '../core/rng';
import { GameSession, type SessionEvent, sessionOptions } from '../core/session';
import { type ThemeConfig, type ThemeTokens, activeTheme, buyTheme, inSeason, localDateKey } from '../core/themes';
import {
  type Profile,
  type ProfileConfig,
  type Progress,
  type Slot,
  type SlotItem,
  SLOTS,
  bumpStats,
  catalog,
  generateName,
  isUnlocked,
  isValidName,
  newlyUnlocked,
  normaliseName,
  progressOf,
  repairProfile,
  sameProfile,
  selected as pickOf,
  unlockProgress,
  withPick,
} from '../core/profile';
import { DICE_SVG, LOCK_SVG, STAT_ICONS, portraitSvg } from './avatars';
import { GameAudio } from './audio';
import { burst, celebrate, sparkleAround } from './fx';
import { sceneSealBurst, sceneWinDisplay, startSceneFx } from './scene-fx';
import { type FocusTarget, LayerStack } from './layers';
import { computeLayout } from './layout';
import { UI_TOKEN_VARS, type UiThemeTokens } from './theme-tokens';
import { shellSvg } from './shells';
import { type SaveData, exportSave, importSave, loadSave, writeSave } from './storage';
import { t } from './strings';

const config = rawConfig as unknown as GameConfig & EconomyConfig & DailyConfig & CollectionConfig & ThemeConfig & ProfileConfig;
/** Presentation-only timings (ms) and tilt angle: animation feel, not gameplay. */
const ANIM = { lift: 210, streamIn: 90, flow: 230, streamOut: 90, back: 220, tilt: 100, winDelay: 650 } as const;
/** How long a refused jar keeps its static red outline (ms): presentation only. */
const NOPE_MS = 700;
/** How long Restart waits for its confirming second tap (ms): presentation only (F6). */
const RESTART_CONFIRM_MS = 3000;

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const boardEl = $('board');
const levelLabel = $('level-label');
const challengeTag = $('challenge-tag');
const movesEl = $('moves');
const coinsEl = $('coins');
const toastEl = $('toast');
const winEl = $('win');
const homeEl = $('home');
const settingsEl = $('settings');
const coachEl = $('coach');
const coachText = $('coach-text');
const btnNext = $<HTMLButtonElement>('btn-next');
const toolButtons = [...document.querySelectorAll<HTMLButtonElement>('.tool[data-booster]')];

// ---- Layers (F3: dialogs hold keyboard focus) ------------------------------

/** Every overlay draws in stack order; only the top one is interactive (the toast stays live). */
const layers = new LayerStack<HTMLElement>(() => [...($('app').children as HTMLCollectionOf<HTMLElement>)], [toastEl], 20);

/** Whether focus can land on `el`: on the page, not hidden, not inert and not disabled. */
function canFocus(el: unknown): el is HTMLElement {
  return el instanceof HTMLElement && el.isConnected && !el.closest('[hidden],[inert]') && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0;
}

/** The first control in `layer` that can take focus. */
function firstFocusable(layer: HTMLElement): HTMLElement | null {
  const all = layer.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex]:not([tabindex="-1"])');
  return [...all].find(canFocus) ?? null;
}

/**
 * Opens `el` as the top layer: everything behind becomes inert, and focus moves to
 * `first` (or the layer's first control). `opener` gets focus back on close; it defaults
 * to whatever had focus.
 */
function openLayer(el: HTMLElement, first: HTMLElement | null = null, opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  layers.open(el, opener === document.body ? null : opener);
  const target = canFocus(first) ? first : firstFocusable(el);
  target?.focus();
}

/**
 * Closes `el`. With `restore`, focus returns to its opener, or to the new top layer's
 * first control if the opener is gone. Returns the opener, so a sub-screen that replaces
 * this layer can hand focus back to the same place.
 */
function closeLayer(el: HTMLElement, restore = true): FocusTarget | null {
  const opener = layers.close(el);
  if (restore) {
    if (canFocus(opener)) opener.focus();
    else {
      const top = layers.top();
      if (top) firstFocusable(top)?.focus();
    }
  }
  return opener;
}

const TOKEN_VARS: Record<keyof ThemeTokens, string> = {
  bgTop: '--bg-top', bgBottom: '--bg-bottom', sea: '--sea', ink: '--ink', inkSoft: '--ink-soft', glass: '--glass',
  glassEdge: '--glass-edge', card: '--card', accent: '--accent', accentInk: '--accent-ink', surface: '--surface',
  surface2: '--surface-2', toastBg: '--toast-bg', toastFg: '--toast-fg', sky: '--sky', themeColor: '--theme-color',
};

/** Colour-blind patterns defined in style.css (.pat-0 … .pat-13), one per palette colour. */
const PATTERNS = 14;
const BOOSTER_NAMES: Record<BoosterId, string> = { undo: t.undo, shuffle: t.shuffle, extraJar: t.jar, hint: t.hint };
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let save: SaveData = loadSave(config);
let level = save.level;
/** What is being played: a numbered level, today's daily puzzle, or the tutorial. */
let mode: 'level' | 'daily' | 'tutorial' = 'level';
let dailyDate = '';
let dailyName = '';
let session!: GameSession;
let challenge = false;
let selected: number | null = null;
let busy = false;
let pendingWin = false;
let jarEls: HTMLButtonElement[] = [];
let unitHeight = 0;
const returning = new Set<number>();
let toastTimer = 0;
let hintTimer = 0;
let restartTimer = 0; // Restart's second-tap window (F6); declared before boot uses it
const audio = new GameAudio(save.settings);
const shuffleRng = createRng(Date.now() >>> 0);

// ---- Boot ---------------------------------------------------------------

const params = new URLSearchParams(location.search);
const levelParam = Number(params.get('level'));
const qaLevel = Number.isInteger(levelParam) && levelParam >= 1; // QA launch argument (run-and-observe)
applyStrings();
save.shells = knownShells(save.shells, config); // D26: before the profile repair counts them
repairSaveProfile();
writeSave(save);
applyTheme(currentTheme());
window.setInterval(() => {
  if ($('scenes').hidden) applyTheme(currentTheme()); // follow the clock in auto mode
}, 60_000);
wireInput();
if (qaLevel) {
  level = launchLevel(levelParam, save.level); // replay only, never beyond progress (D3)
  startLevel(level);
} else {
  startLevel(level);
  showHome();
}

// ---- Save code (decision D16) -------------------------------------------

let restoreArmed = false;

function openTransfer(opener: FocusTarget | null = null): void {
  $<HTMLTextAreaElement>('transfer-code').value = exportSave(save);
  $('transfer-status').textContent = t.saveCodeHelp;
  restoreArmed = false;
  $('btn-restore-code').textContent = t.restoreCode;
  openLayer($('transfer'), $('transfer-code'), opener);
}

async function copySaveCode(): Promise<void> {
  const box = $<HTMLTextAreaElement>('transfer-code');
  box.value = exportSave(save);
  try {
    await navigator.clipboard.writeText(box.value);
    $('transfer-status').textContent = t.codeCopied;
  } catch {
    box.select(); // clipboard blocked: leave it selected for a manual copy
    $('transfer-status').textContent = t.codeSelectManually;
  }
}

/** Restores from the pasted code. The first tap asks for confirmation; the second replaces progress. */
function restoreSaveCode(): void {
  const imported = importSave($<HTMLTextAreaElement>('transfer-code').value, config);
  if (!imported) {
    restoreArmed = false;
    $('btn-restore-code').textContent = t.restoreCode;
    $('transfer-status').textContent = t.codeInvalid;
    audio.play('nope');
    return;
  }
  if (!restoreArmed) {
    restoreArmed = true;
    $('btn-restore-code').textContent = t.restoreConfirm;
    $('transfer-status').textContent = t.restoreWarning(imported.level, imported.wallet.coins);
    return;
  }
  save = imported;
  save.shells = knownShells(save.shells, config); // D26
  repairSaveProfile();
  writeSave(save);
  audio.configure(save.settings);
  applyTheme(currentTheme());
  closeLayer($('transfer'), false);
  showToast(t.restored);
  startLevel(save.level);
  showHome();
}

// ---- Scenes (sprint 4) --------------------------------------------------


function currentTheme(): string {
  const now = new Date();
  return activeTheme(save.themes, now.getHours(), config, localDateKey(now)); // holiday scenes follow the local date (B5)
}

/** Applies a scene's colour tokens. Sand colours are never touched (decision S4-4). */
function applyTheme(id: string): void {
  const theme = config.themes.list.find((x) => x.id === id) ?? config.themes.list[0];
  const root = document.documentElement.style;
  for (const [key, cssVar] of Object.entries(TOKEN_VARS)) root.setProperty(cssVar, theme.tokens[key as keyof ThemeTokens]);
  const extra = theme.tokens as ThemeTokens & UiThemeTokens;
  for (const [key, cssVar] of Object.entries(UI_TOKEN_VARS)) {
    const value = extra[key as keyof UiThemeTokens];
    if (value) root.setProperty(cssVar, value);
    else root.removeProperty(cssVar); // fall back to the style.css default
  }
  document.body.dataset.theme = theme.id;
  startSceneFx(theme.id); // the scene's animated layer, if it has one (scene-fx.ts)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.tokens.themeColor);
}

let previewing: string | null = null;

function openScenes(opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  previewing = currentTheme();
  renderScenes();
  openLayer($('scenes'), $('scene-grid').querySelector<HTMLElement>('[aria-pressed="true"]'), opener);
}

function renderScenes(): void {
  $('scenes-coins').textContent = String(save.wallet.coins);
  // Use or Buy turns clock-matching off, so the switch re-syncs on every render (UX-scenes-1).
  $<HTMLInputElement>('set-auto').checked = save.themes.auto;
  const grid = $('scene-grid');
  const today = localDateKey(new Date());
  grid.replaceChildren(
    ...[...config.themes.list].sort((a, b) => a.price - b.price).map((theme) => {
      const owned = theme.price === 0 || save.themes.owned.includes(theme.id);
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'scene-card';
      card.dataset.id = theme.id;
      card.setAttribute('aria-pressed', String(previewing === theme.id));
      const k = theme.tokens;
      card.innerHTML = `<span class="scene-swatch" style="--sw-edge:${k.glassEdge};background:radial-gradient(120% 50% at 50% 115%, ${k.sea} 0 40%, transparent 41%),radial-gradient(80% 70% at 80% 0, ${k.sky} 0 35%, transparent 60%),linear-gradient(${k.bgTop}, ${k.bgBottom})"><i></i><i></i><i></i></span><span class="scene-name"></span><span class="scene-status"></span>`;
      card.querySelector('.scene-swatch')!.setAttribute('data-scene', theme.id);
      card.querySelector('.scene-name')!.textContent = theme.name;
      const badges = [inSeason(theme, today) && ['season', t.sceneInSeason], (theme.tier ?? 1) > 1 && ['tier', t.sceneAnimated]].filter(Boolean) as string[][];
      if (badges.length) {
        const row = document.createElement('span');
        row.className = 'scene-badges';
        for (const [cls, text] of badges) {
          const b = document.createElement('span');
          b.className = `scene-badge ${cls}`;
          b.textContent = text;
          row.appendChild(b);
        }
        card.querySelector('.scene-name')!.after(row);
      }
      const status = card.querySelector('.scene-status') as HTMLElement;
      const inUse = owned && currentTheme() === theme.id;
      status.textContent = inUse ? t.sceneInUse : owned ? t.sceneOwned : String(theme.price);
      status.classList.toggle('price', !owned);
      card.addEventListener('click', () => {
        previewing = theme.id;
        applyTheme(theme.id);
        audio.play('select');
        renderScenes();
        $('scene-grid').querySelector<HTMLElement>(`[data-id="${theme.id}"]`)?.focus(); // keep focus on the rebuilt card
      });
      return card;
    }),
  );
  const theme = config.themes.list.find((x) => x.id === previewing)!;
  const owned = theme.price === 0 || save.themes.owned.includes(theme.id);
  const btn = $<HTMLButtonElement>('btn-scene-buy');
  const inUse = owned && currentTheme() === theme.id;
  btn.hidden = inUse;
  btn.disabled = !owned && save.wallet.coins < theme.price;
  btn.textContent = owned ? t.sceneUse(theme.name) : save.wallet.coins >= theme.price ? t.sceneBuy(theme.name, theme.price) : t.sceneNeed(theme.price, save.wallet.coins);
  $('scenes-auto-note').textContent = t.matchClockNote;
}

function confirmScene(): void {
  if (!previewing) return;
  const theme = config.themes.list.find((x) => x.id === previewing)!;
  const owned = theme.price === 0 || save.themes.owned.includes(theme.id);
  if (!owned) {
    const r = buyTheme(save.wallet, save.themes.owned, theme.id, config);
    if (!r.ok) return;
    save.wallet = r.wallet;
    save.themes = { ...save.themes, owned: r.owned };
    audio.play('coin');
    showToast(t.sceneBought(theme.name));
  }
  // Choosing a scene by hand pins it (turns clock-matching off).
  save.themes = { ...save.themes, selected: theme.id, auto: false };
  writeSave(save);
  applyTheme(currentTheme());
  $('home-coins').textContent = String(save.wallet.coins);
  updateHud();
  renderScenes();
}

function closeScenes(): void {
  closeLayer($('scenes'));
  previewing = null;
  applyTheme(currentTheme()); // drop any unpurchased preview
}

// ---- Screens ------------------------------------------------------------

function showHome(): void {
  closeLayer(winEl, false);
  $('home-coins').textContent = String(save.wallet.coins);
  $('btn-play').textContent = save.tutorialDone ? t.play(save.level) : t.playTutorial;
  const today = utcDateKey(new Date()); // the daily follows UTC (design/gdd/daily-puzzle.md, M4)
  const day = config.daily.week[weekday(today)];
  const status = streakStatus(save.daily, today);
  const [y, m, d] = today.split('-').map(Number);
  $('daily-dow').textContent = new Date(y, m - 1, d).toLocaleDateString('en', { weekday: 'short' });
  $('daily-dom').textContent = String(d);
  $('daily-title').textContent = t.daily;
  $('daily-sub').textContent = status.solvedToday ? t.dailySolved : t.dailyNew(day.name);
  $('daily-streak').textContent = status.passAtRisk ? t.passAtRisk : status.current > 0 ? `${t.streakDays(status.current)}${save.daily.passes ? ` · ${t.passes(save.daily.passes)}` : ''}` : t.noStreak;
  $('btn-daily').classList.toggle('solved', status.solvedToday);
  $('btn-daily').hidden = !save.tutorialDone;
  const total = allShells(config).length;
  $('shells-label').textContent = t.shellCount(save.shells.length, total);
  const last = allShells(config).find((x) => x.id === save.shells.at(-1)) ?? allShells(config)[0];
  $('shell-ico').innerHTML = shellSvg(last, save.shells.length === 0);
  $('btn-shells').hidden = !save.tutorialDone;
  $('btn-scenes').hidden = !save.tutorialDone;
  renderProfileChip();
  openLayer(homeEl, $('btn-play'), null);
}

function startDaily(): void {
  audio.unlock();
  closeLayer(homeEl, false);
  mode = 'daily';
  dailyDate = utcDateKey(new Date());
  const gen = generateDaily(dailyDate, config);
  dailyName = gen.spec.name;
  beginSession(gen.board, gen.spec.challenge);
  levelLabel.textContent = t.dailyLabel(dailyDate);
  challengeTag.textContent = t.dailyTag(dailyName);
  challengeTag.hidden = false;
  coach(null);
  introduce(gen.spec.mechanics);
}

const MECHANICS: MechanicId[] = ['narrow', 'frozen', 'locked', 'funnel'];

/** A tiny static jar illustrating a mechanic, built from the same classes as the board. */
function miniJar(id: MechanicId): string {
  const lockC = config.palette[2].hex;
  const units = id === 'narrow' ? ['#2a9d8f'] : id === 'funnel' ? ['#f2a541', '#f2a541'] : ['#c8553d', '#2a9d8f', '#f2a541'];
  const sand = units.map((c) => `<span class="unit" style="--c:${c}"></span>`).join('');
  const extra = id === 'frozen' ? '<span class="ice"></span>' : '';
  const top = id === 'locked' ? `<span class="padlock" style="--lock:${lockC}"></span>` : id === 'funnel' ? '<span class="funnel-mark"></span>' : '';
  return `<span class="mini-jar ${id}" aria-hidden="true">${top}<span class="glass"><span class="sand">${sand}</span>${extra}<span class="shine"></span></span></span>`;
}

/** Shows the intro card for any mechanic on this board the player hasn't met yet. */
function introduce(ids: readonly MechanicId[]): void {
  const fresh = ids.filter((id) => !save.seenMechanics.includes(id));
  if (!fresh.length) return;
  save.seenMechanics = [...save.seenMechanics, ...fresh];
  writeSave(save);
  showMechanicCards(fresh, t.newJar);
}

function showMechanicCards(ids: readonly MechanicId[], kicker: string, opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  $('intro-kicker').textContent = kicker;
  $('intro-list').replaceChildren(
    ...ids.map((id) => {
      const row = document.createElement('div');
      const unlockAt = config.mechanics.list.find((m) => m.id === id)!.unlockAt;
      const known = save.seenMechanics.includes(id) || save.level > unlockAt;
      row.className = `intro-row${known ? '' : ' unknown'}`;
      row.innerHTML = `${miniJar(id)}<div><h2></h2><p></p></div>`;
      row.querySelector('h2')!.textContent = t.mechanics[id].name;
      row.querySelector('p')!.textContent = known ? t.mechanics[id].rule : t.unlocksAt(unlockAt);
      return row;
    }),
  );
  openLayer($('intro'), $('btn-intro-ok'), opener);
}

/** Grants the next shell (or the completion bonus) and fills the win card's shell row. */
function awardShell(): void {
  const r = grantShell(save.shells, config);
  const row = $('win-shell');
  if (!r.shell) {
    earn(config.collection.coinsWhenComplete);
    $('win-shell-art').innerHTML = '';
    $('win-shell-text').textContent = t.allShellsBonus(config.collection.coinsWhenComplete);
    row.hidden = false;
    return;
  }
  save.shells = r.owned;
  $('win-shell-art').innerHTML = shellSvg(r.shell);
  let text = t.newShell(r.shell.name);
  if (r.completedSet) {
    const bonus = config.collection.setReward;
    earn(bonus.coins);
    save.wallet = addBoosters(save.wallet, bonus.boosters);
    text += `\n${t.setComplete(r.completedSet.name, bonus.coins)}`;
  }
  $('win-shell-text').textContent = text;
  row.hidden = false;
}

function openCabinet(): void {
  const owned = new Set(save.shells);
  const cleared = save.level - 1;
  const every = config.collection.everyLevels;
  const remaining = every - (cleared % every);
  $('cabinet-title').textContent = t.cabinetTitle;
  $('cabinet-next').textContent = save.shells.length < allShells(config).length ? t.nextShell(remaining) : t.allShellsBonus(config.collection.coinsWhenComplete);
  const sets = $('cabinet-sets');
  sets.replaceChildren(
    ...setProgress(save.shells, config).map((p) => {
      const sec = document.createElement('section');
      sec.className = `shell-set${p.complete ? ' complete' : ''}`;
      // Completed sets start collapsed so the list stays short; tap the header to open one.
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'shell-set-head';
      head.innerHTML = `<h3></h3><span>${p.owned}/${p.total}</span>`;
      head.querySelector('h3')!.textContent = p.set.name;
      head.setAttribute('aria-expanded', String(!p.complete));
      const body = document.createElement('div');
      body.className = 'shell-set-body';
      body.id = `shell-set-${p.set.id}`;
      body.hidden = p.complete;
      head.setAttribute('aria-controls', body.id);
      head.addEventListener('click', () => {
        const open = head.getAttribute('aria-expanded') !== 'true';
        head.setAttribute('aria-expanded', String(open));
        body.hidden = !open;
        audio.play(open ? 'select' : 'deselect');
      });
      const grid = document.createElement('div');
      grid.className = 'shell-grid';
      for (const sh of p.set.shells) {
        const has = owned.has(sh.id);
        const cell = document.createElement('figure');
        cell.className = has ? 'shell-cell' : 'shell-cell locked';
        cell.innerHTML = `${shellSvg({ ...sh, effect: p.set.effect }, !has)}<figcaption></figcaption>`;
        cell.querySelector('figcaption')!.textContent = has ? sh.name : t.lockedShell;
        grid.appendChild(cell);
      }
      const note = document.createElement('p');
      note.className = 'shell-set-note';
      note.textContent = p.complete ? t.setDone : t.setRewardNote(config.collection.setReward.coins);
      body.append(grid, note);
      sec.append(head, body);
      return sec;
    }),
  );
  openLayer($('cabinet'), $('btn-close-cabinet'));
}

// ---- Player profile (design/gdd/player-profile.md) ----------------------

/** Credits coins earned by play and counts them for the "Coins earned" stat. */
function earn(coins: number): void {
  save.wallet = addCoins(save.wallet, coins);
  save.stats = bumpStats(save.stats, { coinsEarned: coins });
}

/** The progress values unlocks are measured against, from the live save. */
function progressNow(): Progress {
  return progressOf({
    level: save.level,
    bestStreak: save.daily.best,
    shellsOwned: save.shells.length,
    setsCompleted: setProgress(save.shells, config).filter((p) => p.complete).length,
    stats: save.stats,
  });
}

/** Makes the saved profile safe to show: a valid name, and only known, unlocked picks. */
function repairSaveProfile(): void {
  save.profile = repairProfile(save.profile, config, progressNow(), () => generateName(Math.random, t.nameWords));
}

function avatarOf(id: string) {
  return config.profile.avatars.find((a) => a.id === id) ?? config.profile.avatars[0];
}
function plateOf(id: string) {
  return config.profile.plates.find((p) => p.id === id) ?? config.profile.plates[0];
}
/** An avatar in its frame, as SVG markup. */
function portraitOf(p: Pick<Profile, 'avatar' | 'frame'>): string {
  return portraitSvg(avatarOf(p.avatar), p.frame);
}

/** A name on its plate. The name is set as text, never as markup (it can be typed by the player). */
function plateEl(plateId: string, name: string, extra = ''): HTMLElement {
  const plate = plateOf(plateId);
  const el = document.createElement('span');
  el.className = `plate${extra ? ` ${extra}` : ''}`;
  el.dataset.plate = plate.id;
  el.style.setProperty('--pl-bg', plate.bg);
  el.style.setProperty('--pl-bg2', plate.bg2 ?? plate.bg);
  el.style.setProperty('--pl-edge', plate.edge);
  el.style.setProperty('--pl-ink', plate.ink);
  const text = document.createElement('span');
  text.className = 'plate-text';
  text.textContent = name;
  el.append(text);
  return el;
}

function renderProfileChip(): void {
  const chip = $('btn-profile');
  chip.hidden = !save.tutorialDone;
  chip.setAttribute('aria-label', t.profileLabel(save.profile.name));
  $('profile-chip-art').innerHTML = portraitOf(save.profile);
  $('profile-chip-plate').replaceChildren(plateEl(save.profile.plate, save.profile.name, 'plate-sm'));
}

function openProfile(): void {
  renderProfile();
  openLayer($('profile'), $('btn-close-profile'));
}

function renderProfile(): void {
  $('profile-art').innerHTML = portraitOf(save.profile);
  $('profile-plate').replaceChildren(plateEl(save.profile.plate, save.profile.name, 'plate-lg'));
  $('profile-level').textContent = String(save.level);
  const sets = setProgress(save.shells, config);
  const scenesOwned = config.themes.list.filter((x) => x.price === 0 || save.themes.owned.includes(x.id)).length;
  const s = save.stats;
  const rows: [keyof typeof t.statLabels, string][] = [
    ['levels', String(save.level - 1)],
    ['perfectClears', String(s.perfectClears)],
    ['streak', String(streakStatus(save.daily, utcDateKey(new Date())).current)],
    ['bestStreak', String(save.daily.best)],
    ['dailiesSolved', String(s.dailiesSolved)],
    ['shells', `${save.shells.length}/${allShells(config).length}`],
    ['sets', `${sets.filter((p) => p.complete).length}/${sets.length}`],
    ['scenes', `${scenesOwned}/${config.themes.list.length}`],
    ['pours', s.pours.toLocaleString('en')],
    ['coinsEarned', s.coinsEarned.toLocaleString('en')],
    ['boostersUsed', String(s.boostersUsed)],
  ];
  $('stats-grid').replaceChildren(
    ...rows.map(([key, value]) => {
      const tile = document.createElement('div');
      tile.className = 'stat';
      tile.innerHTML = `<svg class="stat-ico" viewBox="0 0 24 24" aria-hidden="true">${STAT_ICONS[key]}</svg><dt></dt><dd></dd>`;
      tile.querySelector('dt')!.textContent = t.statLabels[key];
      tile.querySelector('dd')!.textContent = value;
      return tile;
    }),
  );
  $('stats-note').textContent = t.statsFootnote;
}

// The Edit Profile sheet works on a draft; Save commits it (PP-8).
let draft: Profile;
let activeSlot: Slot = 'avatar';

function openEditProfile(): void {
  draft = { ...save.profile };
  activeSlot = 'avatar';
  $<HTMLInputElement>('name-input').value = draft.name;
  $('pick-note').textContent = '';
  renderEdit();
  openLayer($('edit-profile'), $(`tab-${activeSlot}`));
}

/** The name to draw on plates while editing: the draft if valid, else the saved one. */
function draftName(): string {
  return isValidName(draft.name, config) ? normaliseName(draft.name) : save.profile.name;
}

function renderEdit(focusSlot: Slot | null = null, focusId: string | null = null): void {
  const progress = progressNow();
  $('edit-art').innerHTML = portraitOf(draft);
  $('edit-plate').replaceChildren(plateEl(draft.plate, draftName(), 'plate-lg'));
  for (const slot of SLOTS) {
    const tab = $(`tab-${slot}`);
    const on = slot === activeSlot;
    tab.setAttribute('aria-selected', String(on));
    tab.tabIndex = on ? 0 : -1;
    $(`panel-${slot}`).hidden = !on;
    const current = pickOf(draft, slot);
    $(`grid-${slot}`).replaceChildren(
      ...catalog(config, slot).map((item) => {
        const open = isUnlocked(item, progress);
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `pick${open ? '' : ' locked'}`;
        btn.dataset.id = item.id;
        btn.setAttribute('role', 'radio');
        btn.setAttribute('aria-checked', String(item.id === current));
        btn.tabIndex = item.id === current ? 0 : -1;
        const req = item.unlock ? t.unlockReq[item.unlock.kind](item.unlock.count) : '';
        btn.setAttribute('aria-label', open ? item.name : t.lockedItem(item.name, req));
        if (slot === 'plate') btn.append(plateEl(item.id, draftName()));
        else {
          const art = document.createElement('span');
          art.className = 'portrait portrait-pick';
          art.innerHTML = slot === 'avatar' ? portraitOf({ avatar: item.id, frame: draft.frame }) : portraitOf({ avatar: draft.avatar, frame: item.id });
          btn.append(art);
        }
        if (!open) btn.insertAdjacentHTML('beforeend', `<span class="pick-lock">${LOCK_SVG}</span>`);
        if (item.id === current) btn.insertAdjacentHTML('beforeend', '<span class="pick-check" aria-hidden="true"></span>');
        btn.addEventListener('click', () => pick(slot, item.id));
        return btn;
      }),
    );
  }
  const valid = isValidName(draft.name, config);
  $('name-error').textContent = valid ? '' : t.nameInvalid(config.profile.name.min, config.profile.name.max);
  $<HTMLInputElement>('name-input').setAttribute('aria-invalid', String(!valid));
  $<HTMLButtonElement>('btn-save-profile').disabled = !valid;
  if (focusSlot && focusId) $(`grid-${focusSlot}`).querySelector<HTMLElement>(`[data-id="${focusId}"]`)?.focus();
}

/** Selects an item in the draft, or explains how to unlock it. */
function pick(slot: Slot, id: string): void {
  const item = catalog(config, slot).find((x) => x.id === id)!;
  const progress = progressNow();
  if (!isUnlocked(item, progress)) {
    const { have, need } = unlockProgress(item, progress);
    $('pick-note').textContent = t.unlockLine(item.name, t.unlockReq[item.unlock!.kind](item.unlock!.count), have, need);
    audio.play('nope');
    renderEdit(slot, id);
    return;
  }
  $('pick-note').textContent = '';
  draft = withPick(draft, slot, id);
  audio.play('select');
  renderEdit(slot, id);
}

function switchTab(slot: Slot): void {
  activeSlot = slot;
  $('pick-note').textContent = '';
  renderEdit();
  $(`tab-${slot}`).focus();
}

function saveEditProfile(): void {
  if (!isValidName(draft.name, config)) return;
  save.profile = { ...draft, name: normaliseName(draft.name) };
  writeSave(save);
  audio.play('select');
  renderProfile();
  renderProfileChip();
  closeLayer($('edit-profile'));
}

/** Closing asks "Discard changes?" only when the draft differs from the saved profile. */
function closeEditProfile(): void {
  if (sameProfile(draft, save.profile)) {
    closeLayer($('edit-profile'));
    return;
  }
  openLayer($('discard'), $('btn-keep-editing'));
}

function keepEditing(): void {
  closeLayer($('discard'), false);
  $(`tab-${activeSlot}`).focus();
}

function discardEdits(): void {
  closeLayer($('discard'), false);
  closeLayer($('edit-profile'));
}

/** Arrow keys inside the tab list and the pick grids (roving focus, PP-8 / A-keyboard). */
function onEditKeys(e: KeyboardEvent): void {
  const target = e.target as HTMLElement;
  const dir = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
  if (!dir) return;
  if (target.getAttribute('role') === 'tab') {
    e.preventDefault();
    switchTab(SLOTS[(SLOTS.indexOf(activeSlot) + dir + SLOTS.length) % SLOTS.length]);
  } else if (target.getAttribute('role') === 'radio') {
    e.preventDefault();
    const items = [...target.parentElement!.querySelectorAll<HTMLElement>('[role="radio"]')];
    const next = items[(items.indexOf(target) + dir + items.length) % items.length];
    const progress = progressNow();
    const item = catalog(config, activeSlot).find((x) => x.id === next.dataset.id)!;
    if (isUnlocked(item, progress)) pick(activeSlot, item.id);
    else {
      for (const el of items) el.tabIndex = -1;
      next.tabIndex = 0;
      next.focus();
    }
  }
}

/** Win card rows for cosmetics unlocked by this win (§3.7). */
function showUnlocks(items: SlotItem[]): void {
  $('win-unlocks').replaceChildren(
    ...items.map(({ slot, item }) => {
      const row = document.createElement('div');
      row.className = 'win-shell win-unlock';
      const art = document.createElement('span');
      art.className = 'win-shell-art';
      if (slot === 'plate') art.append(plateEl(item.id, save.profile.name, 'plate-sm'));
      else art.innerHTML = slot === 'avatar' ? portraitOf({ avatar: item.id, frame: save.profile.frame }) : portraitOf({ avatar: save.profile.avatar, frame: item.id });
      const text = document.createElement('span');
      text.textContent = t.newCosmetic[slot](item.name);
      row.append(art, text);
      return row;
    }),
  );
}

async function shareDaily(): Promise<void> {
  const url = location.href.split('?')[0].split('#')[0];
  const text = t.shareText(dailyDate, dailyName, sharePours(save.dailyShare, dailyDate, session.moves), save.daily.streak, url);
  try {
    if (navigator.share) {
      await navigator.share({ text });
      return;
    }
    await navigator.clipboard.writeText(text);
    showToast(t.copied);
  } catch {
    /* the share sheet was dismissed, or the clipboard is blocked */
  }
}

function play(): void {
  audio.unlock();
  closeLayer(homeEl, false);
  if (!save.tutorialDone) startTutorial();
  else startLevel(save.level);
}

function startTutorial(): void {
  mode = 'tutorial';
  beginSession(tutorialBoard(config), false);
  levelLabel.textContent = t.level(1);
  challengeTag.hidden = true;
  coach(0, t.tutorialLift);
}

function startLevel(n: number): void {
  mode = 'level';
  level = n;
  const gen = generateLevel(n, config);
  beginSession(gen.board, gen.spec.challenge);
  levelLabel.textContent = t.level(n);
  challengeTag.textContent = t.challenge;
  challengeTag.hidden = !gen.spec.challenge;
  coach(null);
  introduce(gen.spec.mechanics);
}

function beginSession(board: Board, isChallenge: boolean): void {
  // One place builds the options, so the shuffle's total budget (F7, GA-SB-4) is always passed.
  session = new GameSession(board, sessionOptions(config));
  session.onChange(onSessionEvent);
  challenge = isChallenge;
  selected = null;
  busy = false;
  pendingWin = false;
  returning.clear();
  closeLayer(winEl, false);
  hideStuckBanner(false);
  disarmRestart();
  document.body.dataset.challenge = String(isChallenge);
  buildJars();
  updateHud();
}

/** Shows the tutorial pointer on jar `i` with a caption, or hides it with `null`. */
function coach(i: number | null, text = ''): void {
  if (i === null || !jarEls[i]) {
    coachEl.hidden = true;
    return;
  }
  const r = jarEls[i].getBoundingClientRect();
  coachEl.style.left = `${r.left + r.width / 2}px`;
  coachEl.style.top = `${r.top + r.height * 0.55}px`;
  coachText.textContent = text;
  coachEl.hidden = false;
}

// ---- Session events -----------------------------------------------------

function onSessionEvent(e: SessionEvent): void {
  switch (e.type) {
    case 'pour':
      updateJar(e.move.from);
      updateJar(e.move.to, session.board.jars[e.move.to].units.length - e.moved);
      // A seal can thaw or unlock jars anywhere on the board, so redraw the rest too.
      session.board.jars.forEach((_, i) => i !== e.move.from && i !== e.move.to && updateJar(i));
      if (e.sealed) sealFx(e.move.to, config.palette[e.color].hex);
      break;
    case 'extraJar':
      buildJars();
      break;
    case 'shuffle':
      renderAllJars(true);
      break;
    case 'undo':
    case 'restart':
      selected = null;
      renderAllJars();
      break;
    case 'won':
      pendingWin = true;
      break;
    case 'stuck':
      showStuckBanner(session.lostReason ? t.cantWin : t.stuck);
      break;
  }
  if (e.type !== 'stuck' && e.type !== 'won') {
    clearHint(); // a hint describes the old board, so it must not linger onto the new one
    hideStuckBanner(); // the board changed
    disarmRestart();
    // A board that is certainly lost says so at once (D21); the solver-proven case comes from Hint.
    if (session.status !== 'won' && session.lostReason) showStuckBanner(t.cantWin);
  }
  updateHud();
}

// ---- Protect progress (F6) -------------------------------------------------

/**
 * Restart from the HUD button or the R key. Restart can't be undone (the session clears
 * its history), so with pours on the board the first tap arms it and a second tap within
 * RESTART_CONFIRM_MS restarts.
 */
function requestRestart(): void {
  if (busy || returning.size || mode === 'tutorial') return;
  const btn = $('btn-restart');
  if (session.moves === 0 || btn.classList.contains('armed')) {
    disarmRestart();
    session.restart();
    return;
  }
  btn.classList.add('armed');
  btn.setAttribute('aria-label', t.restartArmedLabel);
  showToast(t.restartConfirm);
  restartTimer = window.setTimeout(disarmRestart, RESTART_CONFIRM_MS);
}

function disarmRestart(): void {
  window.clearTimeout(restartTimer);
  const btn = $('btn-restart');
  btn.classList.remove('armed');
  btn.removeAttribute('aria-label');
}

let leaveAction: (() => void) | null = null;

/**
 * Runs `action` (go Home, replay the tutorial) from Settings. If a board is part-way
 * played, asks "Leave this board?" first, because the board isn't kept.
 */
function leaveBoard(action: () => void): void {
  const partWay = !layers.has(homeEl) && session.moves > 0 && session.status !== 'won';
  if (!partWay) {
    closeLayer(settingsEl, false);
    action();
    return;
  }
  leaveAction = action;
  openLayer($('leave'), $('btn-keep-playing'));
}

function confirmLeave(): void {
  const action = leaveAction;
  leaveAction = null;
  closeLayer($('leave'), false);
  closeLayer(settingsEl, false);
  action?.();
}

// ---- Stuck banner (F2) ---------------------------------------------------

/**
 * Shows the persistent stuck banner with `message` (plus a Restart button) until the
 * board changes. Any variant ("no pours left", "this board can't be won now") calls this
 * with its own text from strings.ts. The board re-fits around the banner once idle.
 */
function showStuckBanner(message: string): void {
  const banner = $('stuck');
  const wasHidden = banner.hidden;
  banner.hidden = false;
  // Set the text after the banner is visible so the polite live region announces it.
  requestAnimationFrame(() => {
    if (!banner.hidden) $('stuck-text').textContent = message;
  });
  if (wasHidden) relayoutWhenIdle();
}

/** Hides the stuck banner. `relayout` re-fits the board to the freed space. */
function hideStuckBanner(relayout = true): void {
  const banner = $('stuck');
  if (banner.hidden) return;
  banner.hidden = true;
  $('stuck-text').textContent = '';
  if (relayout) relayoutWhenIdle();
}

/** Rebuilds the jars for the current board size once no pour is animating. */
function relayoutWhenIdle(): void {
  if (busy || returning.size) {
    window.setTimeout(relayoutWhenIdle, 60);
    return;
  }
  buildJars();
}

function sealFx(i: number, color: string): void {
  const el = jarEls[i];
  el.classList.remove('just-sealed');
  void el.offsetWidth;
  el.classList.add('just-sealed');
  window.setTimeout(() => {
    sparkleAround(el, color);
    sceneSealBurst(el, color); // New Year: a small firework above the jar
    audio.play('seal');
  }, reducedMotion() ? 0 : 180);
}

function showWin(): void {
  pendingWin = false;
  coach(null);
  const colors = [...new Set(session.board.jars.flatMap((j) => j.units))].map((c) => config.palette[c].hex);
  celebrate(colors);
  sceneWinDisplay(colors); // New Year: fireworks around the win card
  hideToast(); // a leftover hint or refusal toast must not sit over the win card
  audio.play('win');
  $('win-shell').hidden = true;
  $('btn-share').hidden = true;
  $('win-unlocks').replaceChildren();
  $('win-avatar').hidden = mode === 'tutorial';
  if (mode !== 'tutorial') $('win-avatar').innerHTML = portraitOf(save.profile);
  const before = progressNow();
  if (mode === 'tutorial') {
    save.tutorialDone = true;
    writeSave(save);
    $('win-title').textContent = t.tutorialDoneTitle;
    $('win-text').textContent = t.tutorialDoneText;
    $('win-reward').hidden = true;
    $('win-note').textContent = '';
    btnNext.textContent = t.tutorialStart;
  } else if (mode === 'daily') {
    const r = recordDailySolve(save.daily, dailyDate, config);
    save.daily = r.state;
    const counts = !r.alreadySolved && !r.outOfOrder;
    earn(r.reward);
    save.stats = bumpStats(save.stats, { pours: session.moves, dailiesSolved: counts ? 1 : 0 });
    if (counts) {
      awardShell();
      save.dailyShare = { date: dailyDate, pours: session.moves }; // Share reports this solve, not a replay (GA-DP-6)
    }
    writeSave(save);
    showUnlocks(newlyUnlocked(config, before, progressNow()));
    $('win-title').textContent = t.dailyWinTitle;
    $('win-text').textContent = `${session.moves} ${t.poursLabel(session.moves)} · ${t.streakDays(r.state.streak)}`;
    $('win-reward').hidden = !counts;
    $('win-note').textContent = r.outOfOrder ? t.dailyOutOfOrder : r.alreadySolved ? t.dailyReplay : r.usedPass ? t.usedPass : r.earnedPass ? t.earnedPass : '';
    $('btn-share').hidden = false;
    btnNext.textContent = t.home;
    if (counts) countUp($('win-coins'), r.reward);
  } else {
    const perfect = session.assists === 0;
    const firstClear = level >= save.level;
    // Coins on the first clear only; replays pay nothing (design/gdd/economy.md, M1).
    const reward = clearReward({ level, nextLevel: save.level, perfect, challenge }, config);
    const key = String(level);
    const prevBest = save.best[key];
    if (prevBest === undefined || session.moves < prevBest) save.best[key] = session.moves;
    save.level = Math.max(save.level, level + 1);
    earn(reward);
    save.stats = bumpStats(save.stats, { pours: session.moves, perfectClears: firstClear && perfect ? 1 : 0 });
    if (firstClear && milestoneDue(level, config)) awardShell();
    writeSave(save);
    showUnlocks(newlyUnlocked(config, before, progressNow()));
    $('win-title').textContent = perfect ? t.perfectTitle : t.winTitle;
    $('win-text').textContent = t.winText(session.moves, prevBest);
    $('win-reward').hidden = !firstClear;
    $('win-note').textContent = !firstClear ? t.replayNote : perfect ? t.perfectNote : '';
    btnNext.textContent = t.next;
    if (firstClear) countUp($('win-coins'), reward);
  }
  window.setTimeout(() => openLayer(winEl, btnNext, null), reducedMotion() ? 0 : ANIM.winDelay);
}

function countUp(el: HTMLElement, total: number): void {
  if (reducedMotion()) {
    el.textContent = t.reward(total);
    updateHud();
    return;
  }
  let shown = 0;
  el.textContent = t.reward(0);
  const step = Math.max(1, Math.ceil(total / 12));
  const timer = window.setInterval(() => {
    shown = Math.min(total, shown + step);
    el.textContent = t.reward(shown);
    if (shown % (step * 3) === 0 || shown === total) audio.play('coin');
    if (shown >= total) {
      window.clearInterval(timer);
      updateHud();
      const chip = $('coins-chip');
      chip.classList.remove('bump');
      void chip.offsetWidth;
      chip.classList.add('bump');
    }
  }, 55);
}

// ---- Rendering ----------------------------------------------------------

function buildJars(): void {
  const board = session.board;
  const rect = boardEl.getBoundingClientRect();
  const layout = computeLayout({ width: rect.width, height: rect.height, jars: board.jars.length, capacity: board.capacity });
  unitHeight = layout.unitHeight;
  const s = boardEl.style;
  s.setProperty('--jar-w', `${layout.jarWidth}px`);
  s.setProperty('--unit-h', `${layout.unitHeight}px`);
  s.setProperty('--jar-h', `${layout.jarHeight}px`);
  s.setProperty('--gap-x', `${layout.gapX}px`);
  s.setProperty('--gap-y', `${layout.gapY}px`);
  s.setProperty('--cols', String(layout.cols));

  boardEl.replaceChildren();
  const rows = document.createElement('div');
  rows.className = 'rows';
  jarEls = board.jars.map((_, i) => {
    const jar = document.createElement('button');
    jar.type = 'button';
    jar.className = 'jar';
    jar.dataset.index = String(i);
    jar.innerHTML =
      '<span class="cork" aria-hidden="true"></span><span class="padlock" aria-hidden="true"></span><span class="funnel-mark" aria-hidden="true"></span>' +
      '<span class="glass"><span class="sand"></span><span class="ice" aria-hidden="true"></span><span class="shine"></span></span>' +
      '<span class="hint-badge" aria-hidden="true"></span>';
    jar.addEventListener('click', () => onJarTap(i));
    rows.appendChild(jar);
    return jar;
  });
  boardEl.appendChild(rows);
  renderAllJars();
}

function renderAllJars(shake = false): void {
  session.board.jars.forEach((_, i) => {
    updateJar(i);
    if (shake && !reducedMotion()) jarEls[i].animate([{ translate: '0 0' }, { translate: '0 -6px' }, { translate: '0 0' }], { duration: 260, delay: i * 25 });
  });
}

function unitColor(color: number, buried: boolean): string {
  return buried ? 'var(--buried)' : config.palette[color].hex;
}

/** Redraws jar `i`. Units at index `growFrom` and above animate in. */
function updateJar(i: number, growFrom = Infinity): void {
  const board: Board = session.board;
  const jar = board.jars[i];
  const el = jarEls[i];
  if (!el) return;
  const sand = el.querySelector('.sand') as HTMLElement;
  sand.replaceChildren(
    ...jar.units.map((color, k) => {
      const u = document.createElement('span');
      u.className = 'unit';
      if (k < jar.hidden) {
        u.classList.add('buried');
      } else {
        u.style.setProperty('--c', config.palette[color].hex);
        if (save.settings.patterns) u.classList.add(`pat-${color % PATTERNS}`);
      }
      if (k >= growFrom) {
        u.classList.add('grow');
        u.style.animationDelay = `${(k - growFrom) * 70}ms`;
      }
      return u;
    }),
  );
  const sealed = isSealed(jar, board.capacity);
  el.classList.toggle('sealed', sealed);
  if (!sealed) el.classList.remove('just-sealed');
  renderMechanics(el, jar);
  el.classList.toggle('selected', selected === i);
  el.setAttribute('aria-pressed', String(selected === i));
  const contents = jar.units.length ? jar.units.map((c, k) => (k < jar.hidden ? t.buried : config.palette[c].id)).join(', ') : t.jarEmpty;
  const states = [
    jar.cap !== undefined ? t.jarStates.narrow : '',
    jar.frozen ? t.jarStates.frozen : '',
    jar.lock !== undefined ? t.jarStates.locked(config.palette[jar.lock].id) : '',
    jar.funnel ? t.jarStates.funnel : '',
    sealed ? t.sealed : '',
  ].filter(Boolean);
  el.setAttribute('aria-label', t.jarLabel(i, states.length ? `${contents} (${states.join(', ')})` : contents));
}

/** Draws a jar's mechanic state, and plays the thaw/unlock effect when one ends. */
function renderMechanics(el: HTMLElement, jar: Jar): void {
  const wasFrozen = el.dataset.frozen === '1';
  const wasLocked = el.dataset.lock !== undefined && el.dataset.lock !== '';
  el.classList.toggle('narrow', jar.cap !== undefined);
  el.classList.toggle('funnel', jar.funnel === true);
  el.classList.toggle('frozen', jar.frozen === true);
  el.classList.toggle('locked', jar.lock !== undefined);
  const glass = el.querySelector('.glass') as HTMLElement;
  if (jar.cap !== undefined) glass.style.height = `${unitHeight * jar.cap + Math.round(unitHeight * 0.45)}px`;
  else glass.style.removeProperty('height');
  const padlock = el.querySelector('.padlock') as HTMLElement;
  if (jar.lock !== undefined) {
    padlock.style.setProperty('--lock', config.palette[jar.lock].hex);
    padlock.className = `padlock${save.settings.patterns ? ` pat-${jar.lock % PATTERNS}` : ''}`;
  }
  if (wasFrozen && !jar.frozen) mechanicFx(el, 'thawing', t.thawed);
  if (wasLocked && jar.lock === undefined) mechanicFx(el, 'unlocking', t.unlocked);
  el.dataset.frozen = jar.frozen ? '1' : '';
  el.dataset.lock = jar.lock !== undefined ? String(jar.lock) : '';
}

function mechanicFx(el: HTMLElement, cls: string, label: string): void {
  showToast(label);
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  window.setTimeout(() => el.classList.remove(cls), 900);
  audio.play('booster');
  const r = el.getBoundingClientRect();
  burst({ x: r.left + r.width / 2, y: r.top + r.height * 0.3, colors: ['#dff3ff', '#ffffff', '#b9e0f5'], count: 14, spread: r.width, size: 5, duration: 600, className: 'spark' });
}

function updateHud(): void {
  movesEl.textContent = String(session.moves);
  $('moves-label').textContent = t.poursLabel(session.moves);
  coinsEl.textContent = String(save.wallet.coins);
  const over = session.status === 'won';
  for (const btn of toolButtons) {
    const id = btn.dataset.booster as BoosterId;
    const charges = save.wallet.boosters[id];
    const price = config.boosters[id].price;
    // A free booster (owner decision D-a: Undo) shows no charge or price badge.
    const free = (config.boosters[id] as { free?: boolean }).free === true;
    const badge = btn.querySelector('.badge') as HTMLElement;
    badge.hidden = free;
    badge.textContent = charges > 0 ? String(charges) : String(price);
    badge.classList.toggle('price', charges === 0);
    const usable =
      !over && mode !== 'tutorial' && (id !== 'undo' || session.canUndo) && (id !== 'extraJar' || session.extraJarsLeft > 0);
    btn.disabled = !usable;
    btn.setAttribute('aria-label', free ? t.boosterFree(BOOSTER_NAMES[id]) : t.boosterLabel(BOOSTER_NAMES[id], charges, price));
  }
  ($('btn-restart') as HTMLButtonElement).disabled = mode === 'tutorial';
}

function setSelected(i: number | null): void {
  const prev = selected;
  selected = i;
  if (prev !== null) updateJar(prev);
  if (i !== null) updateJar(i);
}

// ---- Input --------------------------------------------------------------

function isLiftable(i: number): boolean {
  const jar = session.board.jars[i];
  return !!jar && jar.units.length > 0 && !isSealed(jar, session.board.capacity) && !isClosed(jar) && !jar.funnel;
}

/** Explains why a mechanic jar refused a tap. */
function explain(i: number): void {
  const jar = session.board.jars[i];
  if (!jar) return;
  const id: MechanicId | null = jar.frozen ? 'frozen' : jar.lock !== undefined ? 'locked' : jar.funnel ? 'funnel' : jar.cap !== undefined ? 'narrow' : null;
  if (id) showToast(t.mechanics[id].tap);
}

function onJarTap(i: number): void {
  audio.unlock();
  if (busy || session.status === 'won' || returning.has(i)) return;
  if (selected === null) {
    if (isLiftable(i)) {
      setSelected(i);
      audio.play('select', { pitch: i });
      if (mode === 'tutorial') coach(i === 0 ? 1 : 0, t.tutorialPour);
    } else {
      nope(i);
      explain(i);
    }
    return;
  }
  if (selected === i) {
    setSelected(null);
    audio.play('deselect');
    if (mode === 'tutorial') coach(0, t.tutorialLift);
    return;
  }
  const from = selected;
  if (canPour(session.board, from, i)) {
    if (mode === 'tutorial') coach(null);
    void animatePour(from, i);
  } else {
    nope(i);
    explainRefusal(i);
    setSelected(isLiftable(i) ? i : null);
  }
}

/** Says why a pour into jar `i` was refused, so it isn't shown by motion and sound only (AX-5). */
function explainRefusal(i: number): void {
  const board = session.board;
  const jar = board.jars[i];
  if (!jar) return;
  if (isClosed(jar)) return explain(i);
  if (jar.units.length >= (jar.cap ?? board.capacity)) return showToast(isSealed(jar, board.capacity) ? t.jarSealedFull : t.jarFull);
  showToast(t.coloursDontMatch);
}

function nope(i: number): void {
  const el = jarEls[i];
  el.classList.remove('nope');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('nope');
  window.clearTimeout(Number(el.dataset.nopeTimer));
  el.dataset.nopeTimer = String(window.setTimeout(() => el.classList.remove('nope'), NOPE_MS));
  audio.play('nope');
}

/**
 * The tilted fill: a world-level band of sand inside the tilting glass, so the
 * surface stays horizontal while the jar rotates (teardown V2-3).
 * Returns the element plus helpers to animate it in step with the jar.
 */
function makeTiltFill(jarEl: HTMLElement, i: number) {
  const glass = jarEl.querySelector('.glass') as HTMLElement;
  const jar = session.board.jars[i];
  const Hg = glass.clientHeight;
  const W = glass.clientWidth;
  const fill = document.createElement('span');
  fill.className = 'tilt';
  const band = document.createElement('span');
  band.className = 'tilt-band';
  band.style.width = `${Hg * 3}px`;
  band.style.left = `${-Hg * 1.5}px`;
  const stripes = jar.units.map((c, k) => {
    const s = document.createElement('span');
    s.style.background = unitColor(c, k < jar.hidden);
    s.style.height = `${unitHeight + (k === 0 ? 40 : 0)}px`;
    return s;
  });
  band.append(...stripes);
  fill.appendChild(band);
  glass.appendChild(fill);
  jarEl.classList.add('tilting');
  /** Transform at tilt angle `phi` (radians): counter-rotate, drop to the low point, squash with the tilt. */
  const at = (phi: number, sign: number) => {
    const E = (Hg / 2) * Math.abs(Math.cos(phi)) + (W / 2) * Math.sin(phi);
    const k = (2 * E) / Hg;
    return `rotate(${-sign * phi}rad) translateY(${E - 3}px) scaleY(${k.toFixed(4)})`;
  };
  const keyframes = (from: number, to: number, sign: number) =>
    Array.from({ length: 9 }, (_, n) => ({ transform: at(from + ((to - from) * n) / 8, sign) }));
  return {
    fill,
    stripes,
    keyframes,
    remove: () => {
      fill.remove();
      jarEl.classList.remove('tilting');
    },
  };
}

async function animatePour(from: number, to: number): Promise<void> {
  busy = true;
  const src = jarEls[from];
  const dst = jarEls[to];
  const srcJar = session.board.jars[from];
  const color = config.palette[srcJar.units.at(-1)!].hex;
  const targetLen = session.board.jars[to].units.length;

  if (reducedMotion()) {
    const n = pourAmount(session.board, from, to);
    session.pour(from, to);
    audio.play('pour', { units: n });
    finishPour(from);
    return;
  }

  const s = src.getBoundingClientRect();
  const d = dst.getBoundingClientRect();
  const side = d.left + d.width / 2 >= s.left + s.width / 2 ? 1 : -1;
  const r = s.height / 2;
  const rad = (ANIM.tilt * Math.PI) / 180;
  const mouthX = d.left + d.width / 2 - side * 3;
  const mouthY = d.top - 10;
  const dx = mouthX - side * r * Math.sin(rad) - (s.left + s.width / 2);
  const dy = mouthY + r * Math.cos(rad) - (s.top + s.height / 2);
  const lifted = getComputedStyle(src).transform;
  src.classList.add('pouring');
  const tilt = makeTiltFill(src, from);
  const ease = 'cubic-bezier(.3,.7,.4,1)';

  const go = src.animate(
    [{ transform: lifted === 'none' ? 'none' : lifted }, { transform: `translate(${dx}px, ${dy}px) rotate(${side * ANIM.tilt}deg)` }],
    { duration: ANIM.lift, easing: ease, fill: 'forwards' },
  );
  const tiltIn = tilt.fill.animate(tilt.keyframes(0, rad, side), { duration: ANIM.lift, easing: ease, fill: 'forwards' });
  await go.finished;

  // Stream of sand from the mouth to the target's surface.
  const glass = dst.querySelector('.glass') as HTMLElement;
  const g = glass.getBoundingClientRect();
  const surface = g.bottom - 4 - targetLen * unitHeight;
  const stream = document.createElement('div');
  stream.className = 'stream';
  stream.style.left = `${mouthX - 3}px`;
  stream.style.top = `${mouthY}px`;
  stream.style.height = `${Math.max(8, surface - mouthY)}px`;
  stream.style.setProperty('--c', color);
  document.body.appendChild(stream);
  const moved = pourAmount(session.board, from, to);
  audio.play('pour', { units: moved });
  await stream.animate([{ transform: 'scaleY(0)' }, { transform: 'scaleY(1)' }], { duration: ANIM.streamIn, easing: 'ease-in', fill: 'forwards' }).finished;

  const before = session.board.jars[from].units.length;
  session.pour(from, to);
  const after = session.board.jars[from].units.length;
  // Drain the poured stripes from the tilted fill.
  tilt.stripes.slice(after, before).forEach((el) => el.animate([{ height: `${unitHeight}px` }, { height: '0px' }], { duration: ANIM.flow, fill: 'forwards' }));
  burst({ x: mouthX, y: surface - (before - after) * unitHeight * 0.5, colors: [color], count: 10, spread: 22, angle: 0, cone: 160, size: 4, duration: 420, gravity: 14 });
  audio.play('land', { pitch: targetLen });
  await wait(ANIM.flow);

  stream.style.transformOrigin = 'bottom';
  await stream.animate([{ transform: 'scaleY(1)' }, { transform: 'scaleY(0)' }], { duration: ANIM.streamOut, fill: 'forwards' }).finished;
  stream.remove();

  // Let the player act again while the jar flies home.
  returning.add(from);
  src.classList.add('returning');
  finishPour(from);
  const back = src.animate([{ transform: `translate(${dx}px, ${dy}px) rotate(${side * ANIM.tilt}deg)` }, { transform: 'none' }], {
    duration: ANIM.back,
    easing: 'cubic-bezier(.4,0,.3,1)',
    fill: 'forwards',
  });
  const tiltOut = tilt.fill.animate(tilt.keyframes(rad, 0, side), { duration: ANIM.back, easing: 'cubic-bezier(.4,0,.3,1)', fill: 'forwards' });
  await back.finished;
  go.cancel();
  back.cancel();
  tiltIn.cancel();
  tiltOut.cancel();
  tilt.remove();
  src.classList.remove('pouring', 'returning');
  returning.delete(from);
  if (pendingWin) showWin();
}

function finishPour(from: number): void {
  if (selected === from) selected = null;
  renderSelectedState();
  busy = false;
  if (pendingWin && reducedMotion()) showWin();
}

function renderSelectedState(): void {
  jarEls.forEach((el, i) => {
    el.classList.toggle('selected', selected === i);
    el.setAttribute('aria-pressed', String(selected === i));
  });
}

function wait(ms: number): Promise<void> {
  return new Promise((res) => window.setTimeout(res, ms));
}

/** Hides the toast at once (e.g. when the win card opens). */
function hideToast(): void {
  window.clearTimeout(toastTimer);
  toastEl.classList.remove('show');
}

function showToast(text: string): void {
  toastEl.textContent = text;
  toastEl.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), 2600);
}

// ---- Boosters -----------------------------------------------------------

/** Spends a charge (or coins) and applies the booster; refunds if it couldn't apply. */
function useBooster(id: BoosterId): void {
  audio.unlock();
  if (busy || returning.size || mode === 'tutorial' || session.status === 'won') return;
  if (id === 'undo' && !session.canUndo) return showToast(t.noUndo);
  if (id === 'extraJar' && session.extraJarsLeft <= 0) return showToast(t.noJars);
  const before = save.wallet;
  const r = spendBooster(save.wallet, id, config);
  if (!r.ok) {
    audio.play('nope');
    return showToast(t.notEnoughCoins(config.boosters[id].price));
  }
  let applied = false;
  setSelected(null);
  if (id === 'undo') applied = session.undo();
  else if (id === 'extraJar') applied = session.addExtraJar();
  else if (id === 'shuffle') {
    applied = session.shuffle(shuffleRng);
    if (!applied) showToast(t.noShuffle);
    else audio.play('shuffle');
  } else if (id === 'hint') applied = showHint();
  save.wallet = applied ? r.wallet : before;
  // Free Undo is a pour taken back, not a booster, so it isn't counted (owner decision, sprint 6).
  if (applied && !isFreeBooster(id, config)) save.stats = bumpStats(save.stats, { boostersUsed: 1 });
  writeSave(save);
  if (applied) {
    if (id !== 'shuffle') audio.play('booster');
    if (r.paidCoins) showToast(t.boughtWith(r.paidCoins));
  }
  updateHud();
}

/** Highlights the solver's next move. Returns false if there is none. */
function showHint(): boolean {
  const r = session.hintResult();
  if (!('move' in r)) {
    // Not applied, so the charge or coins are refunded. A proven loss shows the banner (D21);
    // a search that ran out of budget doesn't claim the board is lost (F7, GA-SB-2).
    if (r.reason === 'unwinnable') showStuckBanner(t.cantWin);
    else if (r.reason === 'budget') showToast(t.hintBudget);
    return false;
  }
  const m = r.move;
  clearHint();
  for (const [i, cls, label] of [
    [m.from, 'hint-from', t.hintFrom],
    [m.to, 'hint-to', t.hintTo],
  ] as const) {
    const el = jarEls[i];
    (el.querySelector('.hint-badge') as HTMLElement).textContent = label;
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }
  showToast(t.hintToast(m.from + 1, m.to + 1)); // announced politely (AX-4)
  hintTimer = window.setTimeout(clearHint, 2400);
  return true;
}

/** Removes any visible hint highlight, so only one hint shows at a time. */
function clearHint(): void {
  window.clearTimeout(hintTimer);
  for (const el of jarEls) el.classList.remove('hint-from', 'hint-to');
}

// ---- Wiring -------------------------------------------------------------

function wireInput(): void {
  for (const btn of toolButtons) btn.addEventListener('click', () => useBooster(btn.dataset.booster as BoosterId));
  $('btn-stuck-restart').addEventListener('click', () => {
    if (busy || returning.size || mode === 'tutorial') return;
    session.restart(); // an explicit, labelled choice offered while stuck
  });
  $('btn-restart').addEventListener('click', requestRestart);
  $('btn-play').addEventListener('click', play);
  btnNext.addEventListener('click', () => {
    closeLayer(winEl, false);
    if (mode === 'daily') showHome();
    else startLevel(mode === 'tutorial' ? 1 : level + 1);
  });
  $('btn-daily').addEventListener('click', startDaily);
  $('btn-scenes').addEventListener('click', () => openScenes());
  $('btn-scenes-2').addEventListener('click', () => openScenes(closeLayer(settingsEl, false)));
  $('btn-scene-buy').addEventListener('click', confirmScene);
  $('btn-close-scenes').addEventListener('click', closeScenes);
  $<HTMLInputElement>('set-auto').addEventListener('change', (e) => {
    save.themes = { ...save.themes, auto: (e.target as HTMLInputElement).checked };
    writeSave(save);
    previewing = currentTheme();
    applyTheme(previewing);
    renderScenes();
  });
  $('btn-shells').addEventListener('click', openCabinet);
  $('btn-profile').addEventListener('click', openProfile);
  $('btn-close-profile').addEventListener('click', () => closeLayer($('profile')));
  $('btn-edit-profile').addEventListener('click', openEditProfile);
  $('btn-close-edit').addEventListener('click', closeEditProfile);
  $('btn-save-profile').addEventListener('click', saveEditProfile);
  $('btn-keep-editing').addEventListener('click', keepEditing);
  $('btn-discard').addEventListener('click', discardEdits);
  for (const slot of SLOTS) $(`tab-${slot}`).addEventListener('click', () => switchTab(slot));
  $('edit-profile').addEventListener('keydown', onEditKeys);
  $<HTMLInputElement>('name-input').addEventListener('input', (e) => {
    draft = { ...draft, name: (e.target as HTMLInputElement).value };
    renderEdit();
  });
  $('btn-reroll').addEventListener('click', () => {
    draft = { ...draft, name: generateName(Math.random, t.nameWords) };
    $<HTMLInputElement>('name-input').value = draft.name;
    audio.play('shuffle');
    renderEdit();
  });
  $('btn-close-cabinet').addEventListener('click', () => closeLayer($('cabinet')));
  $('btn-share').addEventListener('click', () => void shareDaily());
  $('btn-settings').addEventListener('click', openSettings);
  $('btn-home-settings').addEventListener('click', openSettings);
  $('btn-close-settings').addEventListener('click', () => closeLayer(settingsEl));
  $('btn-home').addEventListener('click', () => leaveBoard(showHome));
  $('btn-keep-playing').addEventListener('click', () => closeLayer($('leave')));
  $('btn-leave').addEventListener('click', confirmLeave);
  $('btn-savecode').addEventListener('click', () => openTransfer(closeLayer(settingsEl, false)));
  $('btn-copy-code').addEventListener('click', () => void copySaveCode());
  $('btn-restore-code').addEventListener('click', restoreSaveCode);
  // Editing the code disarms Restore, so a new code always gets its own warning (UX-settings-1).
  $('transfer-code').addEventListener('input', () => {
    if (!restoreArmed) return;
    restoreArmed = false;
    $('btn-restore-code').textContent = t.restoreCode;
    $('transfer-status').textContent = t.saveCodeHelp;
  });
  $('btn-close-transfer').addEventListener('click', () => closeLayer($('transfer')));
  $('btn-guide').addEventListener('click', () => showMechanicCards(MECHANICS, t.jarGuide, closeLayer(settingsEl, false)));
  $('btn-intro-ok').addEventListener('click', () => closeLayer($('intro')));
  $('btn-tutorial').addEventListener('click', () =>
    leaveBoard(() => {
      closeLayer(homeEl, false);
      startTutorial();
    }),
  );
  for (const key of ['sound', 'music', 'haptics', 'patterns'] as const) {
    $<HTMLInputElement>(`set-${key}`).addEventListener('change', (e) => {
      save.settings[key] = (e.target as HTMLInputElement).checked;
      writeSave(save);
      audio.configure(save.settings);
      if (key === 'patterns') renderAllJars();
    });
  }

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Keys go to the top layer only (F3); the board's shortcuts work when no layer is open.
    const top = layers.top();
    const onButton = document.activeElement instanceof HTMLButtonElement;
    if (top === $('discard')) {
      if (e.key === 'Escape') keepEditing();
      return;
    }
    if (top === $('leave')) {
      if (e.key === 'Escape') closeLayer(top);
      return;
    }
    if (top === $('edit-profile')) {
      if (e.key === 'Escape') closeEditProfile();
      else if (e.key === 'Enter' && e.target === $('name-input')) saveEditProfile();
      return;
    }
    if (top === $('profile') || top === $('transfer') || top === $('cabinet')) {
      if (e.key === 'Escape') closeLayer(top);
      return;
    }
    if (top === $('scenes')) {
      if (e.key === 'Escape') closeScenes();
      return;
    }
    if (top === $('intro')) {
      // Enter on a focused button activates that button natively.
      if (e.key === 'Escape' || (e.key === 'Enter' && !onButton)) closeLayer(top);
      return;
    }
    if (top === homeEl) {
      // Enter/Space plays, unless another home button (profile, daily, shells, scenes) has focus.
      const focused = document.activeElement;
      if (focused instanceof HTMLButtonElement && focused.id !== 'btn-play') return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        play();
      }
      return;
    }
    if (top === winEl) {
      // Enter/Space on Share (or any focused button) activates that button, not Continue (UX-win-1).
      if ((e.key === 'Enter' || e.key === ' ') && !onButton) {
        e.preventDefault();
        btnNext.click();
      }
      return;
    }
    if (top === settingsEl) {
      if (e.key === 'Escape') closeLayer(settingsEl);
      return;
    }
    if (top) return;
    const k = e.key.toLowerCase();
    if (k === 'z') useBooster('undo');
    else if (k === 's') useBooster('shuffle');
    else if (k === 'j') useBooster('extraJar');
    else if (k === 'h') useBooster('hint');
    else if (k === 'r') requestRestart();
    else if (k === 'escape') setSelected(null);
    else if (/^[0-9]$/.test(k)) {
      const i = k === '0' ? 9 : Number(k) - 1;
      if (i < jarEls.length) onJarTap(i);
    }
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (busy || returning.size) return;
      buildJars();
      if (mode === 'tutorial' && !coachEl.hidden) coach(selected === null ? 0 : selected === 0 ? 1 : 0, coachText.textContent ?? '');
    }, 120);
  });
}

function openSettings(): void {
  for (const key of ['sound', 'music', 'haptics', 'patterns'] as const) $<HTMLInputElement>(`set-${key}`).checked = save.settings[key];
  $('btn-home').hidden = layers.has(homeEl); // already Home when opened from Home
  openLayer(settingsEl, $('set-sound'));
}

function applyStrings(): void {
  for (const btn of toolButtons) (btn.querySelector('.tool-name') as HTMLElement).textContent = BOOSTER_NAMES[btn.dataset.booster as BoosterId];
  $('moves-label').textContent = t.pours;
  $('btn-restart').title = t.restart;
  $('btn-stuck-restart').textContent = t.restart;
  $('btn-settings').title = t.settings;
  $('btn-home-settings').title = t.settings;
  $('btn-home-settings').setAttribute('aria-label', t.settings);
  $('settings-title').textContent = t.settings;
  for (const el of document.querySelectorAll<HTMLElement>('[data-s]')) el.textContent = t[el.dataset.s as 'sound' | 'music' | 'haptics' | 'patterns'];
  $('btn-home').textContent = t.home;
  $('btn-tutorial').textContent = t.replayTutorial;
  $('btn-guide').textContent = t.jarGuide;
  $('btn-savecode').textContent = t.saveCode;
  $('transfer-title').textContent = t.saveCode;
  $('btn-copy-code').textContent = t.copyCode;
  $('btn-close-transfer').textContent = t.close;
  $('scenes-label').textContent = t.scenes;
  $('btn-scenes-2').textContent = t.scenes;
  $('scenes-title').textContent = t.scenes;
  $('scenes-auto-label').textContent = t.matchClock;
  $('btn-close-scenes').textContent = t.close;
  $('btn-intro-ok').textContent = t.gotIt;
  $('btn-close-settings').textContent = t.close;
  $('home-title').textContent = t.brand;
  $('home-tagline').textContent = t.tagline;
  $('btn-share').textContent = t.share;
  $('btn-close-cabinet').title = t.close;
  $('profile-title').textContent = t.profileTitle;
  $('btn-close-profile').title = t.close;
  $('btn-edit-profile').title = t.editProfile;
  $('btn-edit-profile').setAttribute('aria-label', t.editProfile);
  $('profile-level-label').textContent = t.levelBadge;
  $('stats-title').textContent = t.statsTitle;
  $('edit-title').textContent = t.editProfileTitle;
  $('btn-close-edit').title = t.close;
  for (const slot of SLOTS) $(`tab-${slot}`).textContent = t.tabs[slot];
  $('name-label').textContent = t.nameLabel;
  $('btn-reroll').innerHTML = DICE_SVG;
  $('btn-reroll').title = t.reroll;
  $('btn-reroll').setAttribute('aria-label', t.reroll);
  $('plates-label').textContent = t.platesLabel;
  $('btn-save-profile').textContent = t.saveProfile;
  $('discard-title').textContent = t.discardTitle;
  $('leave-title').textContent = t.leaveTitle;
  $('leave-text').textContent = t.leaveText;
  $('btn-keep-playing').textContent = t.keepPlaying;
  $('btn-leave').textContent = t.leave;
  $('btn-keep-editing').textContent = t.keepEditing;
  $('btn-discard').textContent = t.discard;
  boardEl.setAttribute('aria-label', t.boardLabel);
}

// ---- Offline install (sprint 3, T8) ------------------------------------
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* offline support unavailable; the game still works online */
    });
  });
}
