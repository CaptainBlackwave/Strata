/**
 * A friend's challenge (sprint 14 H3, design/gdd/sharing.md §3.2): the receiver's card, the
 * level started with the friend's pours to beat, and sharing a challenge from a win or the map.
 * The rules are pure (logic/challenge.ts); a challenge never unlocks a level (D3), pays nothing
 * (D120) and is never saved, except while it waits for the tutorial (D82).
 */
import { type ChallengeOffer, challengeOffer } from '../logic/challenge';
import { shareLink } from '../logic/launch';
import { $, closeLayer, homeEl, openLayer } from '../dom';
import { audio, state } from '../state';
import { t } from '../strings';
import { startLevel } from './board';
import { openShare } from './sheets/share';

/** The offer on the open card. */
let offer: ChallengeOffer | null = null;

/** Opens the receiver's card for `?challenge=level&pours=pours`, over Home. */
export function openFriend(level: number, pours: number): void {
  offer = challengeOffer(level, pours, state.save.level);
  $('friend-text').textContent = offer.kind === 'beat' ? t.friend.beatText(level, pours) : t.friend.aheadText(level, offer.mine);
  $('btn-friend-play').textContent = offer.kind === 'beat' ? t.friend.play : t.friend.playLevel(offer.mine);
  openLayer($('friend'), $('btn-friend-play'), $('btn-play'));
}

/** Plays what the card offers: the friend's level with their pours to beat, or the receiver's own next level (D121). */
function playOffer(): void {
  const o = offer;
  offer = null;
  if (!o) return;
  audio.unlock();
  closeLayer($('friend'), false);
  closeLayer(homeEl, false);
  if (o.kind === 'ahead') return startLevel(state.save.level);
  // A cleared level is a replay (D50): no coins. The receiver's own next level is a first clear (D134).
  startLevel(o.level, false, o.level < state.save.level, { level: o.level, pours: o.pours });
}

/**
 * Opens the share preview for a challenge on `level` with `pours` (sharing §3.2): the link
 * carries only those two numbers. `colors` are the jars' sand on the card.
 */
export function shareChallenge(level: number, pours: number, opener: HTMLElement, colors: readonly number[] = []): void {
  const url = shareLink(location.href, { challenge: level, pours });
  openShare({ text: t.friend.shareText(level, pours, url), card: t.shareCard.level(level, pours, state.save.perfect.includes(level)), colors }, opener);
}

/** The challenge being played on this board, if any. */
export function activeVersus(): { readonly level: number; readonly pours: number } | null {
  return state.mode === 'level' && state.versus && state.versus.level === state.level ? state.versus : null;
}

/** Wires the card's two buttons. */
export function wireFriend(): void {
  $('btn-friend-later').addEventListener('click', () => {
    offer = null;
    closeLayer($('friend'));
  });
  $('btn-friend-play').addEventListener('click', playOffer);
}
