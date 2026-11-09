/** The win card for a level, the daily and the tutorial. The rules are the pure core/win.ts; this shows them. */
import { sharePours } from '../../core/daily';
import { type ShellAward, type WinCard, type WinNote, applyWin } from '../../core/win';
import { type SlotItem } from '../../core/profile';
import { celebrate } from '../fx';
import { sceneWinDisplay } from '../scene-fx';
import { shellSvg } from '../shells';
import { writeSave } from '../storage';
import { t } from '../strings';
import { $, btnNext, hideToast, openLayer, reducedMotion, winEl } from '../dom';
import { showHome } from './home';
import { coach, updateHud } from './hud';
import { plateEl, portraitOf } from './sheets/profile';
import { ANIM, audio, config, state } from '../state';

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
  }
  $('win-shell').hidden = false;
}

/** Win card rows for cosmetics unlocked by this win (§3.7). */
export function showUnlocks(items: SlotItem[]): void {
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
  );
}

export async function shareDaily(): Promise<void> {
  const url = location.href.split('?')[0].split('#')[0];
  const text = t.shareText(state.dailyDate, state.dailyName, sharePours(state.save.dailyShare, state.dailyDate, state.session.moves), state.save.daily.streak, url);
  // The outcome shows inside the card, not as a toast under the overlay (UX-win-4).
  const status = $('share-status');
  status.textContent = '';
  if (navigator.share) {
    try {
      await navigator.share({ text });
      status.textContent = t.shared;
      return;
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return; // the player closed the share sheet
      // any other failure: fall back to copying
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    status.textContent = t.copied;
  } catch {
    status.textContent = t.shareFailed;
  }
}

/** Shared opener: celebration, audio, and the card parts every mode resets. */
export function openWin(): void {
  state.pendingWin = false;
  coach(null);
  const colors = [...new Set(state.session.board.jars.flatMap((j) => j.units))].map((c) => config.palette[c].hex);
  celebrate(colors);
  sceneWinDisplay(colors); // tier 3 scenes: fireworks, a meteor shower or an aurora wave by the win card
  hideToast(); // a leftover hint or refusal toast must not sit over the win card
  audio.play('win');
  $('win-shell').hidden = true;
  $('btn-share').hidden = true;
  $('win-unlocks').replaceChildren();
  $('share-status').textContent = '';
  $('btn-win-home').hidden = state.mode !== 'level'; // a level card can stop here (UX-win-2); the daily's Continue is already Home
  $('win-avatar').hidden = state.mode === 'tutorial';
  if (state.mode !== 'tutorial') $('win-avatar').innerHTML = portraitOf(state.save.profile);
}

/** Applies the win to the save through the pure rules in core/win.ts and persists it. */
export function applyWinToSave(): WinCard {
  const r = applyWin(state.save, { mode: state.mode, level: state.level, challenge: state.challenge, dailyDate: state.dailyDate, moves: state.session.moves, assists: state.session.assists }, config);
  Object.assign(state.save, r.state);
  writeSave(state.save);
  return r.card;
}

/** The parts of the card shared by the daily and level wins: shell row, unlocks, reward row. */
export function renderRewards(card: WinCard): void {
  if (card.shell) renderShell(card.shell);
  showUnlocks(card.unlocks);
  $('win-reward').hidden = !card.rewardShown;
  if (card.rewardShown) countUp($('win-coins'), card.reward);
  $('win-reward-sr').textContent = `${t.reward(card.reward)} ${t.coins}`;
}

export function winTutorial(): void {
  applyWinToSave();
  $('win-title').textContent = t.tutorialDoneTitle;
  $('win-text').textContent = t.tutorialDoneText;
  $('win-reward').hidden = true;
  $('win-note').textContent = '';
  btnNext.textContent = t.tutorialStart;
}

export function winDaily(): void {
  const card = applyWinToSave();
  const notes: Record<WinNote, string> = { none: '', replay: '', perfect: '', outOfOrder: t.dailyOutOfOrder, dailyReplay: t.dailyReplay, usedPass: t.usedPass, earnedPass: t.earnedPass };
  $('win-title').textContent = t.dailyWinTitle;
  $('win-text').textContent = `${card.moves} ${t.poursLabel(card.moves)} · ${t.streakDays(card.streak)}`;
  $('win-note').textContent = notes[card.note];
  $('btn-share').hidden = false;
  btnNext.textContent = t.home;
  renderRewards(card);
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
  btnNext.textContent = state.replay ? t.map.backToMap : t.next;
  renderRewards(card);
}

export function showWin(): void {
  openWin();
  if (state.mode === 'tutorial') winTutorial();
  else if (state.mode === 'daily') winDaily();
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
  window.setTimeout(() => openLayer(winEl, btnNext, null), reducedMotion() ? 0 : ANIM.winDelay);
}

export function countUp(el: HTMLElement, total: number): void {
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

/** Wires the win card's Home and Share buttons (Continue is wired by the board, which starts the next level). */
export function wireWin(): void {
  $('btn-win-home').addEventListener('click', showHome); // showHome closes the card
  $('btn-share').addEventListener('click', () => void shareDaily());
}
