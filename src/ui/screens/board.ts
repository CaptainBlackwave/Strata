/** The board screen: starting levels, session events, input, Restart, the stuck banner, boosters and hints. */
import { type Board, canPour, isClosed, isSealed } from '../../core/board';
import { generateDaily, utcDateKey } from '../../core/daily';
import { generateWeekly, parseWeek } from '../../core/weekly';
import { type BoosterId, isFreeBooster, spendBooster } from '../../core/economy';
import { type BoosterArm, type RestartArm, BOOSTER_IDLE, RESTART_IDLE, stepBooster, stepRestart } from '../logic/arm';
import { tutorialBoard } from '../../core/generator';
import { type MechanicId } from '../../core/levels';
import { type AssistJob, type AssistPort, type AssistRequest, type AssistResponse, type AssistResult, AssistClient, runAssist } from '../../core/assist';
import { type GenPort, type GenRequest, type GenResponse, type PreparedLevel, Prefetcher } from '../../core/prefetch';
import { type HintResult, type SessionEvent, GameSession, sessionOptions } from '../../core/session';
import { bumpStats } from '../../core/profile';
import { mapAvailable } from '../../core/map';
import { writeSave } from '../storage';
import { t } from '../strings';
import { $, announce, boardEl, btnNext, challengeTag, closeLayer, coachEl, coachText, homeEl, layers, levelLabel, showToast, toastEl, toolButtons, winEl } from '../dom';
import { showHome } from './home';
import { screenOut } from '../fx';
import { coach, updateHud } from './hud';
import { buildJars, nope, onJarTapDo, renderAllJars, sealFx, setSelected, updateJar } from './jars';
import { animatePour, recoverPour } from './pour';
import { introduce } from './sheets/guide';
import { openMap } from './map';
import { boosterHintOnStart } from './onboarding';
import { openWeekly, weeklyThemeName } from './sheets/weekly';
import { audio, config, shuffleSeed, state } from '../state';

/** How long Restart waits for its confirming second tap (ms): presentation only (F6). */
const RESTART_CONFIRM_MS = 3000;
/** How long Hint or Shuffle waits on the worker before its "Thinking…" cue shows (ms): presentation only (TD-13). */
const THINKING_CUE_MS = 150;

let hintTimer = 0;
let restartTimer = 0; // Restart's second-tap window (F6)
let boosterTimer = 0;
let restartArm: RestartArm = RESTART_IDLE; // TD-12: the pure state behind the armed Restart button
let boosterArm: BoosterArm = BOOSTER_IDLE; // TD-12: the pure state behind `state.armedBooster`
let startToken = 0; // the latest startLevel call; an older one still waiting gives way
let thinkingTimer = 0;
let thinkingHadFocus = false;
/** Background generation of upcoming levels (sprint 8 P4, D46). */
export const prefetcher = new Prefetcher(config, workerPort);
/** Hint and Shuffle off the main thread (TD-13), on their own instance of the same worker module. */
export const assists = new AssistClient(assistPort);
/** False under the `?level=N` QA route: Hint and Shuffle then run synchronously, as before TD-13. */
let assistsOffThread = true;

/** Runs Hint and Shuffle on the main thread for this page (the `?level=N` QA route, TD-13). */
export function assistsOnMainThread(): void {
  assistsOffThread = false;
}

export function startDaily(): void {
  audio.unlock();
  screenOut(homeEl); // sprint 10 F5: Home fades off the board
  closeLayer(homeEl, false);
  state.mode = 'daily';
  state.dailyDate = utcDateKey(state.clock()); // TD-16: the app clock
  const gen = generateDaily(state.dailyDate, config);
  state.dailyName = gen.spec.name;
  beginSession(gen.board, gen.spec.challenge);
  levelLabel.textContent = t.dailyLabel(state.dailyDate);
  challengeTag.textContent = t.dailyTag(state.dailyName);
  challengeTag.hidden = false;
  coach(null);
  introduce(gen.spec.mechanics);
}

/**
 * Starts board `index` (0-based) of the weekly set of `week` (design/gdd/weekly-set.md §3.4, §3.8).
 * Like the daily, it is generated here on the main thread (well inside the daily's budgets), and the
 * week is fixed at the start, so a board won after Monday 00:00 UTC counts for its own week (§3.6).
 */
export function startWeekly(week: string, index: number): void {
  audio.unlock();
  screenOut(homeEl);
  closeLayer(homeEl, false);
  state.mode = 'weekly';
  state.weeklyWeek = week;
  state.weeklyIndex = index;
  const gen = generateWeekly(week, index, config);
  beginSession(gen.board, gen.spec.challenge);
  levelLabel.textContent = t.weekly.label(parseWeek(week)?.week ?? 0, index + 1);
  challengeTag.textContent = weeklyThemeName(week);
  challengeTag.hidden = false;
  coach(null);
  introduce(gen.spec.mechanics);
}

/** Home's Play: the tutorial until it is done, then level 1, then the level map from level 2 (D51). */
export function play(): void {
  audio.unlock();
  if (mapAvailable(state.save)) return openMap();
  screenOut(homeEl); // sprint 10 F5: Home fades off the board
  closeLayer(homeEl, false);
  if (!state.save.tutorialDone) startTutorial();
  else startLevel(state.save.level);
}

export function startTutorial(): void {
  state.mode = 'tutorial';
  beginSession(tutorialBoard(config), false);
  levelLabel.textContent = t.level(1);
  challengeTag.hidden = true;
  coach(0, t.tutorialLift);
}

/**
 * Starts numbered level `n` (P4): instantly from the prefetch cache when the worker already
 * made it; by waiting for the worker when it is making it now (a "Preparing" toast only after
 * 150 ms, `quiet` skips it); otherwise by generating synchronously, as before P4.
 * `replay` marks a replay started from the map (D50), so Continue returns to the map.
 */
export function startLevel(n: number, quiet = false, replay = false): void {
  state.mode = 'level';
  state.replay = replay;
  state.level = n;
  const token = ++startToken;
  const ready = prefetcher.get(n);
  if (ready) return showLevel(ready);
  if (!prefetcher.pending(n)) return showLevel(prefetcher.generateNow(n));
  state.busy = true; // the previous board (if any) takes no input until the new one arrives
  let toasted = false;
  const spinner = quiet ? 0 : window.setTimeout(() => {
    toasted = true;
    showToast(t.preparingLevel);
  }, 150);
  void prefetcher.wait(n).then((p) => {
    window.clearTimeout(spinner);
    if (toasted) toastEl.classList.remove('show');
    if (token !== startToken || state.mode !== 'level' || state.level !== n) return; // the player moved on
    showLevel(p ?? prefetcher.generateNow(n)); // worker failed or timed out: synchronous
  });
}

/** Puts a prepared level on the board, then prefetches what the player can start next. */
export function showLevel(gen: PreparedLevel): void {
  const n = gen.level;
  beginSession(gen.board, gen.spec.challenge);
  levelLabel.textContent = t.level(n);
  challengeTag.textContent = t.challenge;
  challengeTag.hidden = !gen.spec.challenge;
  coach(null);
  boosterHintOnStart(n, state.replay); // level 1's first play names the boosters once (O2)
  updateHud();
  introduce(gen.spec.mechanics);
  // Next (n + 1, also after a replay) and Play from home (save.level).
  prefetcher.request([n + 1, state.save.level].filter((l) => l !== n));
}

/** The Web Worker behind the prefetcher, or `null` where workers are unavailable. */
export function workerPort(): GenPort | null {
  return workerChannel<GenRequest, GenResponse>();
}

/** A second instance of the same worker for Hint and Shuffle (TD-13), or `null` without workers. */
export function assistPort(): AssistPort | null {
  return workerChannel<AssistRequest, AssistResponse>();
}

/** Starts `gen-worker.ts` and wraps it as a port; `null` where workers are unavailable. */
function workerChannel<Req, Res>(): { post(req: Req): void; onMessage: ((res: Res) => void) | null; onError: (() => void) | null; terminate(): void } | null {
  if (typeof Worker === 'undefined') return null;
  const w = new Worker(new URL('../gen-worker.ts', import.meta.url), { type: 'module' });
  const port = { post: (req: Req) => w.postMessage(req), onMessage: null as ((res: Res) => void) | null, onError: null as (() => void) | null, terminate: () => w.terminate() };
  w.onmessage = (e: MessageEvent) => port.onMessage?.(e.data);
  w.onerror = () => port.onError?.();
  w.onmessageerror = () => port.onError?.();
  return port;
}

export function beginSession(board: Board, isChallenge: boolean): void {
  cancelAssists(); // a reply for the old level must not land on the new one (TD-13)
  // One place builds the options, so the shuffle's total budget (F7, GA-SB-4) is always passed.
  state.session = new GameSession(board, sessionOptions(config));
  state.session.onChange(onSessionEvent);
  state.challenge = isChallenge;
  state.selected = null;
  state.busy = false;
  state.pendingWin = false;
  state.returning.clear();
  closeLayer(winEl, false);
  hideStuckBanner(false);
  disarmRestart();
  document.body.dataset.challenge = String(isChallenge);
  buildJars();
  updateHud();
}

export function onSessionEvent(e: SessionEvent): void {
  cancelAssists(); // every event is a board change: a Hint or Shuffle still thinking is stale (TD-13)
  switch (e.type) {
    case 'pour':
      updateJar(e.move.from);
      updateJar(e.move.to, state.session.board.jars[e.move.to].units.length - e.moved);
      // A seal can thaw or unlock jars anywhere on the board, so redraw the rest too.
      state.session.board.jars.forEach((_, i) => i !== e.move.from && i !== e.move.to && updateJar(i));
      if (e.sealed) sealFx(e.move.to, config.palette[e.color].hex);
      announce(t.pourAnnounce(e.moved, config.palette[e.color].id, e.move.to + 1) + (e.sealed ? ` ${t.sealAnnounce(e.move.to + 1)}` : ''));
      break;
    case 'extraJar':
      buildJars();
      break;
    case 'shuffle':
      renderAllJars(true);
      break;
    case 'undo':
    case 'restart':
      state.selected = null;
      renderAllJars();
      break;
    case 'won':
      state.pendingWin = true;
      break;
    case 'stuck':
      showStuckBanner(state.session.lostReason ? t.cantWin : t.stuck);
      break;
  }
  if (e.type !== 'stuck' && e.type !== 'won') {
    clearHint(); // a hint describes the old board, so it must not linger onto the new one
    hideStuckBanner(); // the board changed
    disarmRestart();
    disarmBooster();
    // A board that is certainly lost says so at once (D21); the solver-proven case comes from Hint.
    if (state.session.status !== 'won' && state.session.lostReason) showStuckBanner(t.cantWin);
  }
  updateHud();
}

/**
 * Restart from the HUD button or the R key. Restart can't be undone (the session clears
 * its history), so with pours on the board the first tap arms it and a second tap within
 * RESTART_CONFIRM_MS restarts.
 */
export function requestRestart(): void {
  const step = stepRestart(restartArm, { type: 'tap', now: performance.now(), windowMs: RESTART_CONFIRM_MS, blocked: !!(state.busy || state.returning.size || state.mode === 'tutorial'), moves: state.session?.moves ?? 0 });
  if (step.effect === 'ignore') return;
  const btn = $('btn-restart');
  if (step.effect === 'restart') {
    disarmRestart();
    state.session.restart();
    return;
  }
  disarmBooster();
  restartArm = step.next;
  btn.classList.add('armed');
  btn.setAttribute('aria-label', t.restartArmedLabel);
  showToast(t.restartConfirm);
  restartTimer = window.setTimeout(disarmRestart, RESTART_CONFIRM_MS);
}

export function disarmRestart(): void {
  window.clearTimeout(restartTimer);
  restartArm = RESTART_IDLE;
  const btn = $('btn-restart');
  btn.classList.remove('armed');
  btn.removeAttribute('aria-label');
}

/**
 * Shows the persistent stuck banner with `message` (plus a Restart button) until the
 * board changes. Any variant ("no pours left", "this board can't be won now") calls this
 * with its own text from strings.ts. The board re-fits around the banner once idle.
 */
export function showStuckBanner(message: string): void {
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
export function hideStuckBanner(relayout = true): void {
  const banner = $('stuck');
  if (banner.hidden) return;
  banner.hidden = true;
  $('stuck-text').textContent = '';
  if (relayout) relayoutWhenIdle();
}

/** Rebuilds the jars for the current board size once no pour is animating. */
export function relayoutWhenIdle(): void {
  if (state.busy || state.returning.size) {
    window.setTimeout(relayoutWhenIdle, 60);
    return;
  }
  buildJars();
}

export function isLiftable(i: number): boolean {
  const jar = state.session.board.jars[i];
  return !!jar && jar.units.length > 0 && !isSealed(jar, state.session.board.capacity) && !isClosed(jar) && !jar.funnel;
}

/** Explains why a mechanic jar refused a tap. */
export function explain(i: number): void {
  const jar = state.session.board.jars[i];
  if (!jar) return;
  const id: MechanicId | null = jar.frozen ? 'frozen' : jar.lock !== undefined ? 'locked' : jar.funnel ? 'funnel' : jar.cap !== undefined ? 'narrow' : null;
  if (id) showToast(t.mechanics[id].tap);
}

export function onJarTap(i: number): void {
  audio.unlock();
  if (state.busy || state.session.status === 'won' || state.returning.has(i)) return;
  if (state.selected === null) {
    if (isLiftable(i)) {
      setSelected(i);
      audio.play('select', { pitch: i });
      if (state.mode === 'tutorial') coach(i === 0 ? 1 : 0, t.tutorialPour);
    } else {
      nope(i);
      explain(i);
    }
    return;
  }
  if (state.selected === i) {
    setSelected(null);
    audio.play('deselect');
    if (state.mode === 'tutorial') coach(0, t.tutorialLift);
    return;
  }
  const from = state.selected;
  if (canPour(state.session.board, from, i)) {
    if (state.mode === 'tutorial') coach(null);
    // If the animation throws (a node detached by a rebuild, a cancelled animation), never leave `busy` stuck (TD-15).
    animatePour(from, i).catch(() => recoverPour(from));
  } else {
    nope(i);
    explainRefusal(i);
    setSelected(isLiftable(i) ? i : null);
  }
}

/** Says why a pour into jar `i` was refused, so it isn't shown by motion and sound only (AX-5). */
export function explainRefusal(i: number): void {
  const board = state.session.board;
  const jar = board.jars[i];
  if (!jar) return;
  if (isClosed(jar)) return explain(i);
  if (jar.units.length >= (jar.cap ?? board.capacity)) return showToast(isSealed(jar, board.capacity) ? t.jarSealedFull : t.jarFull);
  showToast(t.coloursDontMatch);
}

/** Cancels a booster purchase waiting for its second tap (time out, a board change, another action). */
export function disarmBooster(): void {
  window.clearTimeout(boosterTimer);
  if (state.armedBooster === null) return;
  toolButtons.find((b) => b.dataset.booster === state.armedBooster)?.classList.remove('armed');
  boosterArm = BOOSTER_IDLE;
  state.armedBooster = null;
  updateHud(); // puts the button's normal label back
}

/** Spends a charge (or coins) and applies the booster; refunds if it couldn't apply. */
export function useBooster(id: BoosterId): void {
  audio.unlock();
  // With no charges left, the first tap only names the price and a second tap within the
  // window buys, like Restart's arm (UX-board-7). Too few coins skips this: the spend is refused anyway.
  // One assist at a time (TD-13). The rules are the pure `stepBooster` (TD-12).
  const price = config.boosters[id].price;
  const blocked = !!(state.busy || state.returning.size || state.mode === 'tutorial' || state.session.status === 'won');
  const step = stepBooster(boosterArm, {
    type: 'tap', id, now: performance.now(), windowMs: RESTART_CONFIRM_MS, blocked, assistBusy: state.thinking !== null,
    canUndo: state.session?.canUndo ?? false, charges: state.save.wallet.boosters[id], coins: state.save.wallet.coins, price, free: isFreeBooster(id, config),
  });
  if (step.effect === 'ignore') return;
  if (step.effect === 'noUndo') return showToast(t.noUndo);
  if (step.effect === 'confirm') {
    disarmBooster();
    disarmRestart();
    boosterArm = step.next;
    state.armedBooster = id;
    toolButtons.find((b) => b.dataset.booster === id)?.classList.add('armed');
    updateHud();
    showToast(t.boosterConfirm(price));
    boosterTimer = window.setTimeout(disarmBooster, RESTART_CONFIRM_MS);
    return;
  }
  disarmBooster();
  if (step.effect === 'refuse') {
    audio.play('nope');
    return showToast(t.notEnoughCoins(config.boosters[id].price));
  }
  setSelected(null);
  if (id === 'hint' || id === 'shuffle') return askAssist(id);
  chargeBooster(id, () => (id === 'undo' ? state.session.undo() : state.session.addExtraJar()));
}

/**
 * Charges booster `id` (a charge, or coins) only if `apply` reports it applied, then saves,
 * plays its sound and updates the HUD. Every booster ends here, on either thread path.
 */
function chargeBooster(id: BoosterId, apply: () => boolean): void {
  const before = state.save.wallet;
  const r = spendBooster(before, id, config);
  if (!r.ok) {
    audio.play('nope');
    return showToast(t.notEnoughCoins(config.boosters[id].price));
  }
  const applied = apply();
  state.save.wallet = applied ? r.wallet : before;
  // Free Undo is a pour taken back, not a booster, so it isn't counted (owner decision, sprint 6).
  if (applied && !isFreeBooster(id, config)) state.save.stats = bumpStats(state.save.stats, { boostersUsed: 1 });
  writeSave(state.save);
  if (applied) {
    audio.play(id === 'shuffle' ? 'shuffle' : 'booster');
    if (r.paidCoins) showToast(t.boughtWith(r.paidCoins));
  }
  updateHud();
}

/**
 * Hint or Shuffle (TD-13). A hint that needs no search answers at once. Otherwise the solver
 * runs in the worker while the button shows "thinking"; the board stays playable, and a pour,
 * Undo, Restart or leaving the level drops the reply uncharged. Without a working worker, and
 * under the `?level=N` QA route, the same job runs on the main thread, so results are identical.
 */
function askAssist(id: 'hint' | 'shuffle'): void {
  const s = state.session;
  if (id === 'hint') {
    const quick = s.hintWithoutSearch();
    if (quick) return chargeBooster(id, () => showHint(quick));
  }
  const job: AssistJob = id === 'hint' ? { kind: 'hint', board: s.board, options: s.tuning } : { kind: 'shuffle', board: s.board, options: s.tuning, seed: shuffleSeed() };
  if (!assistsOffThread) return applyAssist(id, runAssist(job));
  const asked = s.revision;
  const isCurrent = () => state.session === s && s.revision === asked && s.status !== 'won' && !layers.has(homeEl);
  setThinking(id);
  void assists.run(job, isCurrent).then((out) => {
    if (out.status === 'stale') {
      if (state.thinking === id) setThinking(null); // left the level: nothing applied, nothing charged
      return;
    }
    setThinking(null);
    applyAssist(id, out.status === 'done' ? out.result : runAssist(job)); // a failed worker falls back to this thread
  });
}

/** Applies a Hint or Shuffle result to the current board and charges for it if it helped. */
function applyAssist(id: 'hint' | 'shuffle', result: AssistResult): void {
  chargeBooster(id, () => {
    if (result.kind === 'hint') return showHint(state.session.adoptHint(result.search));
    const applied = result.board !== null && state.session.applyShuffle(result.board);
    if (!applied) showToast(t.noShuffle);
    return applied;
  });
}

/**
 * Puts Hint or Shuffle into its "thinking" state, or clears it with `null` (TD-13): disabled
 * and `aria-busy` at once, the visible cue after THINKING_CUE_MS. Focus that the disabled
 * button dropped goes back to it.
 */
function setThinking(id: 'hint' | 'shuffle' | null): void {
  window.clearTimeout(thinkingTimer);
  const btn = toolButtons.find((b) => b.dataset.booster === (id ?? state.thinking));
  if (id) thinkingHadFocus = !!btn && document.activeElement === btn;
  const was = state.thinking;
  state.thinking = id;
  state.thinkingShown = false;
  if (id)
    thinkingTimer = window.setTimeout(() => {
      state.thinkingShown = true;
      updateHud();
    }, THINKING_CUE_MS);
  if (state.session) updateHud();
  if (!id && was && thinkingHadFocus && btn && !btn.disabled && (document.activeElement === document.body || document.activeElement === null)) btn.focus();
}

/** Drops any Hint or Shuffle still thinking: its board is gone (TD-13). */
export function cancelAssists(): void {
  assists.cancel();
  if (state.thinking) setThinking(null);
}

/** Highlights the hint's move. Returns false if there is none. */
export function showHint(r: HintResult): boolean {
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
    const el = state.jarEls[i];
    (el.querySelector('.hint-badge') as HTMLElement).textContent = label;
    void el.offsetWidth; // restart the CSS animation
    el.classList.add(cls);
  }
  showToast(t.hintToast(m.from + 1, m.to + 1)); // announced politely (AX-4)
  hintTimer = window.setTimeout(clearHint, 2400);
  return true;
}

/** Removes any visible hint highlight, so only one hint shows at a time. */
export function clearHint(): void {
  window.clearTimeout(hintTimer);
  for (const el of state.jarEls) el.classList.remove('hint-from', 'hint-to');
}

/** Wires the board: tools, Restart, Play, Daily, Continue, jar taps and the re-layout on resize. */
export function wireBoard(): void {
  onJarTapDo(onJarTap);
  for (const btn of toolButtons) btn.addEventListener('click', () => useBooster(btn.dataset.booster as BoosterId));
  $('btn-stuck-restart').addEventListener('click', () => {
    if (state.busy || state.returning.size || state.mode === 'tutorial') return;
    state.session.restart(); // an explicit, labelled choice offered while stuck
  });
  $('btn-restart').addEventListener('click', requestRestart);
  $('btn-play').addEventListener('click', play);
  $('btn-daily').addEventListener('click', startDaily);
  btnNext.addEventListener('click', () => {
    closeLayer(winEl, false);
    if (state.mode === 'daily') showHome();
    else if (state.mode === 'weekly') {
      showHome();
      openWeekly($('btn-weekly')); // back to the five boards (weekly-set.md §3.8)
    }
    else if (state.mode === 'level' && state.replay) openMap(state.level);
    else startLevel(state.mode === 'tutorial' ? 1 : state.level + 1);
  });
  // Re-lay out the jars whenever the board's own size changes, not only on a window resize:
  // the HUD can wrap to two rows after a level starts (a long "Level 120" plus the Tall jars
  // tag at large text on a narrow phone), which shrinks the board after the jars were sized,
  // so the bottom row ran under the toolbar (found in sprint 8, P3). Text-size changes and
  // rotation are covered too. A pour in progress defers the rebuild until it settles.
  let resizeTimer = 0;
  let laidOut = { w: 0, h: 0 };
  const relayout = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!state.session) return; // the first board is still being made in the worker (P4); it lays out when it arrives
      if (state.busy || state.returning.size) return relayout();
      const r = boardEl.getBoundingClientRect();
      if (Math.abs(r.width - laidOut.w) < 1 && Math.abs(r.height - laidOut.h) < 1) return;
      laidOut = { w: r.width, h: r.height };
      buildJars();
      if (state.mode === 'tutorial' && !coachEl.hidden) coach(state.selected === null ? 0 : state.selected === 0 ? 1 : 0, coachText.textContent ?? '');
    }, 120);
  };
  window.addEventListener('resize', relayout);
  if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(boardEl);
}
