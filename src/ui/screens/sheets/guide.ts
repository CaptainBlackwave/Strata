/** The intro card for new jar mechanics, and the Jar guide. */
import { type MechanicId } from '../../../core/levels';
import { type FocusTarget } from '../../layers';
import { writeSave } from '../../storage';
import { t } from '../../strings';
import { $, closeLayer, openLayer } from '../../dom';
import { config, state } from '../../state';
import { CLAM_SHELL, HOURGLASS_MARK, SIEVE_BAND, WET_MARK } from '../jars';
import { wetHex } from '../../logic/wet';

/** The Jar guide's entries: every configured mechanic, in config (unlock) order. */
export const MECHANICS: readonly MechanicId[] = config.mechanics.list.map((m) => m.id);

/** A tiny static jar illustrating a mechanic, built from the same classes as the board. */
export function miniJar(id: MechanicId): string {
  const lockC = config.palette[2].hex;
  // The sieve is banded terracotta and holds its own colour under a mixed top, as a dealt one may.
  const units = id === 'narrow' ? ['#2a9d8f'] : id === 'funnel' ? ['#f2a541', '#f2a541'] : id === 'sieve' ? ['#c8553d', '#c8553d', '#2a9d8f'] : id === 'wet' ? ['#c8553d', '#2a9d8f'] : ['#c8553d', '#2a9d8f', '#f2a541'];
  // Wet sand (D189, §2.7): a dry lagoon unit under a freshly wet one, which shows its full count.
  const dryAfter = config.mechanics.list.find((m) => m.id === 'wet')?.dryAfter ?? 5;
  const wetTop = id === 'wet' ? `<span class="unit wet" data-wet="${dryAfter}" style="--c:${wetHex('#2a9d8f')}">${WET_MARK.replace('<b></b>', `<b>${dryAfter}</b>`)}</span>` : '';
  const sand = units.map((c) => `<span class="unit" style="--c:${c}"></span>`).join('') + wetTop;
  const extra = id === 'frozen' ? '<span class="ice"></span>' : '';
  const top = id === 'locked' ? `<span class="padlock" style="--lock:${lockC}"></span>` : id === 'funnel' ? '<span class="funnel-mark"></span>' : '';
  // The hourglass shows its full count, like a freshly dealt one.
  const every = config.mechanics.list.find((m) => m.id === 'hourglass')?.every ?? 3;
  const mark = id === 'hourglass' ? HOURGLASS_MARK.replace('></b>', `>${every}</b>`) : '';
  const band = id === 'sieve' ? SIEVE_BAND.replace('class="sieve-band"', `class="sieve-band" style="--band:${config.palette[0].hex}"`) : '';
  // The clam is shut and shows its full count, like a freshly dealt one.
  const opensAfter = config.mechanics.list.find((m) => m.id === 'clam')?.opensAfter ?? 6;
  const shell = id === 'clam' ? CLAM_SHELL.replace('<b></b>', `<b>${opensAfter}</b>`) : '';
  return `<span class="mini-jar ${id}" aria-hidden="true">${top}<span class="glass"><span class="sand">${sand}</span>${extra}<span class="shine"></span></span>${mark}${band}${shell}</span>`;
}

/** Shows the intro card for any mechanic on this board the player hasn't met yet. */
export function introduce(ids: readonly MechanicId[]): void {
  const fresh = ids.filter((id) => !state.save.seenMechanics.includes(id));
  if (!fresh.length) return;
  state.save.seenMechanics = [...state.save.seenMechanics, ...fresh];
  writeSave(state.save);
  showMechanicCards(fresh, t.newJar);
}

export function showMechanicCards(ids: readonly MechanicId[], kicker: string, opener: FocusTarget | null = document.activeElement as HTMLElement | null, footer = ''): void {
  $('intro-title').textContent = kicker;
  $('intro-list').replaceChildren(
    ...ids.map((id) => {
      const row = document.createElement('div');
      const unlockAt = config.mechanics.list.find((m) => m.id === id)!.unlockAt;
      const known = state.save.seenMechanics.includes(id) || state.save.level > unlockAt;
      row.className = `intro-row${known ? '' : ' unknown'}`;
      row.innerHTML = `${miniJar(id)}<div><h2></h2><p></p></div>`;
      row.querySelector('h2')!.textContent = t.mechanics[id].name;
      row.querySelector('p')!.textContent = known ? t.mechanics[id].rule : t.unlocksAt(unlockAt);
      return row;
    }),
  );
  if (footer) {
    const note = document.createElement('p');
    note.className = 'intro-keys';
    note.textContent = footer;
    $('intro-list').append(note);
  }
  openLayer($('intro'), $('btn-intro-ok'), opener);
  // With six or more jars the card is taller than a phone screen: focusing Got it scrolled it to the
  // bottom, so the list opened at its end with the title cut off. Start at the top; Got it stays
  // pinned to the card's foot (style.css), so it is still in view and focused.
  const card = $('intro').querySelector<HTMLElement>('.cabinet-card');
  if (card) card.scrollTop = 0;
}

/** Wires the Jar guide and the intro card's button. */
export function wireGuide(): void {
  // The Jar guide lists the keys where a keyboard is likely (UX-board-8).
  $('btn-guide').addEventListener('click', () => showMechanicCards(MECHANICS, t.jarGuide, undefined, matchMedia('(pointer: fine)').matches ? t.keysNote : ''));
  $('btn-intro-ok').addEventListener('click', () => closeLayer($('intro')));
}
