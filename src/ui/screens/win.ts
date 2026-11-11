/** The win card for a level, the daily and the tutorial. The rules are the pure core/win.ts; this shows them. */
import { isSealed } from '../../core/board';
import { sharePours, streakStep, utcDateKey } from '../../core/daily';
import { goalWinRows } from '../logic/goals-card';
import { trackWinRows } from '../logic/streak-track';
import { type ShareKey, shareLink } from '../logic/launch';
import { type ShareNavigator, shareChannel } from '../logic/share-card';
import { openShare } from './sheets/share';
import { activeVersus, shareChallenge } from './friend';
import { challengeVerdict } from '../logic/challenge';
import { type Moment, shareMoments } from '../logic/moments';
import { siteLink } from '../logic/launch';
import { badgeName } from './sheets/badges';
import { homeHintDue, takeShare } from '../logic/onboarding';
import { openShared } from './onboarding';
import { type ShellAward, type WinCard, type WinNote, applyWin } from '../../core/win';
import { type SlotItem } from '../../core/profile';
import { celebrate, flyCoins, mapFx, winBloom } from '../fx';
import { noteFirstClear } from '../fx-plan';
import { sceneWinDisplay } from '../scene-fx';
import { shellSvg } from '../shells';
import { writeSave } from '../storage';
import { currentTheme } from '../theme';
import { t } from '../strings';
import { $, btnNext, closeLayer, hideToast, openLayer, reducedMotion, winEl } from '../dom';
import { showHome, trackNames } from './home';
import { coach, updateHud } from './hud';
import { plateEl, portraitOf } from './sheets/profile';
import { badgeRow } from './sheets/badges';
import { shareWeekly } from './sheets/weekly';
import { styleSwatchEl } from './sheets/styles';
import { type StyleSlot } from '../../core/styles';
import { ANIM, audio, config, state } from '../state';

/** Seconds after the win chime that a shell row's sound starts, so the two don't blur (F1, D68). */
const SHELL_SOUND_DELAY = 0.8;
/** Seconds after the win chime that a cosmetic unlock's sound starts, after any shell's. */
const UNLOCK_SOUND_DELAY = 1.2;

/** Fills the win card's shell row from the award `applyWin` made. */
export function renderShell(award: ShellAward): void {
  if (award.kind === 'complete') {
    $('win-shell-art').innerHTML = '';
    $('win-shell-text').textContent = t.allShellsBonus(award.coins);
  } else {
    $('win-shell-art').innerHTML = shellSvg(award.shell);
    let text = t.newShell(award.shell.name);
    if (award.completedSet) text += `\n${t.setComplete(award.completedSet.name, award.setCoins)}`;
    $('win-shell-text').textContent = text;
    audio.play('shell', { delay: SHELL_SOUND_DELAY });
  }
  $('win-shell').hidden = false;
}

/** Win card rows for cosmetics unlocked by this win (§3.7), then one row for its badges (badges.md §3.6). */
export function showUnlocks(items: SlotItem[], badges: readonly string[] = []): void {
  if (items.length || badges.length) audio.play('unlock', { delay: UNLOCK_SOUND_DELAY }); // once, for both
  const badgeEl = badgeRow(badges);
  $('win-unlocks').replaceChildren(
    ...items.map(({ slot, item }) => {
      const row = document.createElement('div');
      row.className = 'win-shell win-unlock';
      const art = document.createElement('span');
      art.className = 'win-shell-art';
      if (slot === 'plate') art.append(plateEl(item.id, state.save.profile.name, 'plate-sm'));
      else art.innerHTML = slot === 'avatar' ? portraitOf({ avatar: item.id, frame: state.save.profile.frame }) : portraitOf({ avatar: state.save.profile.avatar, frame: item.id });
      const text = document.createElement('span');
      text.textContent = t.newCosmetic[slot](item.name);
      row.append(art, text);
      return row;
    }),
    ...(badgeEl ? [badgeEl] : []),
  );
}

/**
 * Win card rows for streak-track days this win claimed (boosters, a jar style, a scene; frames and
 * plates already show as unlock rows), then for daily goals it reached and the all-goals bonus
 * (sprint 16, D136, D137). They join #win-unlocks, so the card's description covers them.
 */
export function showTrackAndGoals(card: WinCard): void {
  const lines = [...trackWinRows(card.track, trackNames()), ...goalWinRows(card.goals.paid, card.goals.bonus)];
  if (!lines.length) return;
  if ($('win-unlocks').childElementCount === 0) audio.play('unlock', { delay: UNLOCK_SOUND_DELAY }); // once, as for unlocks
  $('win-unlocks').append(
    ...lines.map((line) => {
      const row = document.createElement('div');
      row.className = 'win-shell win-unlock win-earned';
      const text = document.createElement('span');
      text.textContent = line;
      row.append(text);
      return row;
    }),
  );
}

/** The board's sand colours as palette indices, most first, for the share picture. */
export function boardColors(): number[] {
  const count = new Map<number, number>();
  for (const j of state.session.board.jars) for (const u of j.units) count.set(u, (count.get(u) ?? 0) + 1);
  return [...count.keys()];
}

/** Opens the share preview for this daily (sharing §3.1); the link opens this daily directly, with no save data (O3). */
export function shareDaily(): void {
  const url = shareLink(location.href, { daily: state.dailyDate });
  const pours = sharePours(state.save.dailyShare, state.dailyDate, state.session.moves);
  const streak = state.save.daily.streak;
  openShare({ text: t.shareText(state.dailyDate, state.dailyName, pours, streak, url), card: t.shareCard.daily(state.dailyDate, state.dailyName, pours, streak), colors: boardColors() }, $('btn-share'));
}

/**
 * Shares `text` (with `file`, the picture, where the share sheet takes files), else the text
 * alone, else copies it, and says how it went in `status` (sharing §3.1, UX-win-4).
 */
export async function shareTo(text: string, status: HTMLElement, file: File | null = null): Promise<void> {
  status.textContent = '';
  const channel = shareChannel(navigator as unknown as ShareNavigator, file);
  if (channel !== 'clipboard') {
    for (const data of channel === 'files' && file ? [{ files: [file], text }, { text }] : [{ text }]) {
      try {
        await navigator.share(data);
        status.textContent = t.shared;
        return;
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return; // the player closed the share sheet
        // any other failure: try the next way (text alone, then the clipboard)
      }
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = t.copied;
  } catch {
    status.textContent = t.shareFailed;
  }
}

/** The board's sand colours (hex), for the celebration. */
function colorsOf(): string[] {
  return [...new Set(state.session.board.jars.flatMap((j) => j.units))].map((c) => config.palette[c].hex);
}

/** Shared opener: celebration, audio, and the card parts every mode resets. */
export function openWin(): void {
  state.pendingWin = false;
  coach(null);
  const colors = colorsOf();
  celebrate(colors);
  sceneWinDisplay(colors); // tier 3 scenes: fireworks, a meteor shower or an aurora wave by the win card
  hideToast(); // a leftover hint or refusal toast must not sit over the win card
  audio.play('win');
  $('win-shell').hidden = true;
  $('win-shell').querySelector('.moment-share')?.remove(); // a set's Share from the last win
  $('btn-share').hidden = true;
  $('btn-share').textContent = t.share;
  $('win-unlocks').replaceChildren();
  $('share-status').textContent = '';
  $('btn-win-home').hidden = state.mode !== 'level'; // a level card can stop here (UX-win-2); the daily's Continue is already Home
  $('btn-win-shared').hidden = true; // only the tutorial's card, with a link kept (D82 R2)
  $('win-avatar').hidden = state.mode === 'tutorial';
  if (state.mode !== 'tutorial') $('win-avatar').innerHTML = portraitOf(state.save.profile);
}

/** Applies the win to the save through the pure rules in core/win.ts and persists it. */
export function applyWinToSave(): WinCard {
  const board = state.session.board;
  const sealed = board.jars.filter((j) => isSealed(j, board.capacity)).length; // counted at the win, so Undo can't farm it (badges.md §3.2)
  const weekly = state.mode === 'weekly' ? { week: state.weeklyWeek, index: state.weeklyIndex } : undefined;
  const event = state.mode === 'event' ? { id: state.eventId, year: state.eventYear, board: state.eventBoard } : undefined;
  const r = applyWin(state.save, { mode: state.mode, level: state.level, challenge: state.challenge, dailyDate: state.dailyDate, moves: state.session.moves, assists: state.session.assists, sealed, scene: currentTheme(), weekly, event, today: utcDateKey(state.clock()) }, config);
  Object.assign(state.save, r.state);
  writeSave(state.save);
  return r.card;
}

/** A quiet Share for one high point on the win card (sharing §3.4): never a pop-up, never a reward. */
function momentButton(m: Moment): HTMLButtonElement {
  const name = m.kind === 'badge' ? badgeName(m.id) : '';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'secondary moment-share';
  btn.textContent = t.moment.share;
  btn.setAttribute('aria-label', t.moment.label(m, name));
  btn.addEventListener('click', () => openShare({ text: t.moment.shareText(m, name, siteLink(location.href)), card: t.moment.card(m, name), colors: boardColors() }, btn));
  return btn;
}

/** Adds the Share buttons for this win's moments: on the set's shell row, a streak row, the badge row. */
function renderMoments(card: WinCard): void {
  const setName = card.shell?.kind === 'shell' && card.shell.completedSet ? card.shell.completedSet.name : null;
  for (const m of shareMoments({ setName, streak: state.mode === 'daily' ? card.streak : null, badges: card.badges }, config.sharing.streakMilestones)) {
    if (m.kind === 'set') $('win-shell').append(momentButton(m));
    else if (m.kind === 'badge') $('win-unlocks').querySelector('.win-badge')?.append(momentButton(m));
    else {
      const row = document.createElement('div');
      row.className = 'win-shell win-unlock win-moment';
      const text = document.createElement('span');
      text.textContent = t.moment.row(m, '');
      row.append(text, momentButton(m));
      $('win-unlocks').prepend(row);
    }
  }
}

/** The parts of the card shared by the daily and level wins: shell row, unlocks, reward row. */
export function renderRewards(card: WinCard): void {
  if (card.shell) renderShell(card.shell);
  showUnlocks(card.unlocks, card.badges);
  showTrackAndGoals(card);
  renderMoments(card);
  $('win-reward').hidden = !card.rewardShown;
  if (card.rewardShown) countUp($('win-coins'), card.reward, reducedMotion() ? 0 : ANIM.winDelay); // counts on the open card
  $('win-reward-sr').textContent = `${t.reward(card.reward)} ${t.coins}`;
  // Goal coins with no reward row (a replay, a weekly board): the count-up won't update the HUD, so do it now.
  if (!card.rewardShown && (card.goals.paid.length > 0 || card.goals.bonus > 0)) updateHud();
}

/** The link kept from before the tutorial, handed to the card's shared button (D82 R2). */
let sharedOffer: ShareKey | null = null;

export function winTutorial(): void {
  applyWinToSave();
  $('win-title').textContent = t.tutorialDoneTitle;
  $('win-text').textContent = t.tutorialDoneText;
  $('win-reward').hidden = true;
  $('win-note').textContent = '';
  btnNext.textContent = t.tutorialStart;
  // A shared link opened before the tutorial is offered here, once (D82 R2).
  const taken = takeShare(state.save.onboarding);
  sharedOffer = taken.share;
  if (sharedOffer) {
    state.save.onboarding = taken.onboarding;
    writeSave(state.save);
    const kind = 'daily' in sharedOffer ? 'daily' : 'weekly' in sharedOffer ? 'weekly' : 'challenge';
    $('win-note').textContent = kind === 'daily' ? t.onboarding.sharedDailyReady : kind === 'weekly' ? t.onboarding.sharedWeeklyReady : t.friend.sharedReady;
    const btn = $('btn-win-shared');
    btn.textContent = kind === 'daily' ? t.onboarding.playSharedDaily : kind === 'weekly' ? t.onboarding.playSharedWeekly : t.friend.playShared;
    btn.hidden = false;
  }
}

export function winDaily(): void {
  const card = applyWinToSave();
  const notes: Record<WinNote, string> = { none: '', replay: '', perfect: '', outOfOrder: t.dailyOutOfOrder, dailyReplay: t.dailyReplay, usedPass: t.usedPass, earnedPass: t.earnedPass };
  $('win-title').textContent = t.dailyWinTitle;
  $('win-text').textContent = `${card.moves} ${t.poursLabel(card.moves)} · ${t.streakDays(card.streak)}`;
  const step = card.rewardShown ? streakStep(card.streak, config) : 0; // D99: say where the extra coins come from
  $('win-note').textContent = [notes[card.note], step > 0 ? t.longStreak(step) : ''].filter(Boolean).join(' \u00b7 ');
  $('btn-share').hidden = false;
  btnNext.textContent = t.home;
  renderRewards(card);
}

/**
 * A weekly board's win card (weekly-set.md §3.8): which board, the pours and the set's progress, a
 * note for a replay or an out-of-date week, the week's badge when the set completes, and Share.
 * The reward row shows only on the win that completes the set (its bonus, D83); single boards pay nothing.
 */
export function winWeekly(): void {
  const card = applyWinToSave();
  const w = card.weekly!;
  $('win-title').textContent = w.completedNow ? t.weekly.completeTitle : t.weekly.winTitle(w.index + 1);
  $('win-text').textContent = t.weekly.winText(card.moves, w.cleared, w.total);
  $('win-note').textContent = w.outOfDate ? t.weekly.outOfDate : w.newBest ? t.newBest(card.moves) : w.firstClear ? '' : t.weekly.replay;
  $('btn-share').hidden = false;
  btnNext.textContent = t.next;
  renderRewards(card);
}

/**
 * An event board's win card (sprint 17, events.md): "Winter Tide · Board 6" (or "Winter Tide complete!"),
 * the pours and the year's progress, a replay or new-best note, the coins every 6th board, and on the
 * last board a prize row for the jar piece above the badge row. No Share (events have no share link yet).
 */
export function winEvent(): void {
  const card = applyWinToSave();
  const e = card.event;
  const name = t.event.names[state.eventId] ?? state.eventId;
  $('win-title').textContent = e?.completedNow ? t.event.completeTitle(name) : t.event.winTitle(name, state.eventBoard);
  $('win-text').textContent = e ? t.event.winText(card.moves, e.cleared, e.total) : `${card.moves} ${t.poursLabel(card.moves)}`;
  $('win-note').textContent = !e || e.firstClear ? '' : e.newBest ? t.newBest(card.moves) : t.event.replay;
  btnNext.textContent = t.next;
  renderRewards(card);
  if (e?.prizeStyle) {
    const [slot, id] = e.prizeStyle.split(':') as [StyleSlot, string];
    const row = document.createElement('div');
    row.className = 'win-shell win-unlock win-prize';
    const art = document.createElement('span');
    art.className = 'win-shell-art';
    art.append(styleSwatchEl(slot, id));
    const text = document.createElement('span');
    text.textContent = t.event.prizeRow(t.event.piece(t.styles.names[slot]?.[id] ?? id, t.styles.slots[slot] ?? slot));
    row.append(art, text);
    $('win-unlocks').prepend(row); // above the badge row
  }
}

/** What a replay changed (D50): "Perfect earned", "New best: X pours", or "Replay: no coins". */
export function replayNote(card: WinCard): string {
  const changes = [card.perfectEarned && t.perfectEarned, card.newBest && t.newBest(card.moves)].filter(Boolean);
  return changes.length ? changes.join(' · ') : t.replayNote;
}

export function winLevel(): void {
  const card = applyWinToSave();
  $('win-title').textContent = card.perfect ? t.perfectTitle : t.winTitle;
  $('win-text').textContent = t.winText(card.moves, card.prevBest);
  $('win-note').textContent = card.note === 'replay' ? replayNote(card) : card.note === 'perfect' ? t.perfectNote : '';
  // Once, on the first clear of the hint level: point a player who chains levels to Home (D81 R1).
  if (homeHintDue(state.save.onboarding, { mode: state.mode, level: state.level, firstClear: card.rewardShown }, config.onboarding.homeHintLevel)) {
    state.save.onboarding.homeHintSeen = true;
    writeSave(state.save);
    $('win-note').textContent = [$('win-note').textContent, t.onboarding.homeHint].filter(Boolean).join(' \u00b7 ');
  }
  // A friend's challenge (sharing §3.2): how this clear compares, and Share as "Send it back".
  const versus = activeVersus();
  if (versus) $('win-note').textContent = [$('win-note').textContent, t.friend.verdict(challengeVerdict(card.moves, versus.pours), card.moves)].filter(Boolean).join(' \u00b7 ');
  $('btn-share').textContent = versus ? t.friend.sendBack : t.friend.challengeFriend;
  $('btn-share').hidden = false;
  btnNext.textContent = state.replay ? t.map.backToMap : t.next;
  renderRewards(card);
  // What the map shows when it next opens (sprint 10 F5): the new stretch, or a replay's Perfect mark.
  if (card.rewardShown) mapFx.reveal = noteFirstClear(mapFx.reveal, state.level);
  else if (card.perfectEarned) mapFx.perfect = state.level;
}

export function showWin(): void {
  openWin();
  if (state.mode === 'tutorial') winTutorial();
  else if (state.mode === 'daily') winDaily();
  else if (state.mode === 'weekly') winWeekly();
  else if (state.mode === 'event') winEvent();
  else winLevel();
  // Focus lands on Continue, so the dialog describes the result: only the parts shown this time (UX-win-3).
  const described = [
    'win-text',
    !$('win-reward').hidden && 'win-reward-sr',
    $('win-note').textContent && 'win-note',
    !$('win-shell').hidden && 'win-shell-text',
    $('win-unlocks').childElementCount > 0 && 'win-unlocks',
  ].filter(Boolean);
  winEl.querySelector('.win-card')!.setAttribute('aria-describedby', described.join(' '));
  window.setTimeout(() => {
    openLayer(winEl, btnNext, null);
    winBloom(colorsOf()); // sprint 10 F5: a soft glow and drifting motes behind the card
  }, reducedMotion() ? 0 : ANIM.winDelay);
}

/**
 * Counts the reward up on the card after `delay` ms (the card's open), then flies a few coins
 * from the reward pill to the coin counter (sprint 10 F5), which updates and bumps as they land.
 */
export function countUp(el: HTMLElement, total: number, delay = 0): void {
  if (reducedMotion()) {
    el.textContent = t.reward(total);
    updateHud();
    return;
  }
  let shown = 0;
  el.textContent = t.reward(0);
  const step = Math.max(1, Math.ceil(total / 12));
  const land = () => {
    updateHud();
    const chip = $('coins-chip');
    chip.classList.remove('bump');
    void chip.offsetWidth;
    chip.classList.add('bump');
  };
  window.setTimeout(() => {
    const timer = window.setInterval(() => {
      // The player closed the card before the count finished: no coins fly over the next screen.
      if ($('win').hidden) {
        window.clearInterval(timer);
        updateHud();
        return;
      }
      shown = Math.min(total, shown + step);
      el.textContent = t.reward(shown);
      if (shown % (step * 3) === 0 || shown === total) audio.play('coin');
      if (shown >= total) {
        window.clearInterval(timer);
        flyCoins($('win-reward').querySelector('.coin'), $('coins-chip').querySelector('.coin'), total, land);
      }
    }, 55);
  }, delay);
}

/** Wires the win card's Home and Share buttons (Continue is wired by the board, which starts the next level). */
export function wireWin(): void {
  $('btn-win-home').addEventListener('click', showHome); // showHome closes the card
  $('btn-win-shared').addEventListener('click', () => {
    const share = sharedOffer;
    sharedOffer = null;
    closeLayer(winEl, false);
    if (share) openShared(share);
  });
  $('btn-share').addEventListener('click', () => {
    if (state.mode === 'weekly') return shareWeekly($('btn-share'), boardColors());
    if (state.mode === 'daily') return shareDaily();
    // A numbered level: Send it back carries this clear's pours, Challenge a friend the best (sharing §3.2).
    const pours = activeVersus() ? state.session.moves : (state.save.best[String(state.level)] ?? state.session.moves);
    shareChallenge(state.level, pours, $('btn-share'), boardColors());
  });
}
