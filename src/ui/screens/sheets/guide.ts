/** The intro card for new jar mechanics, and the Jar guide. */
import { type MechanicId } from '../../../core/levels';
import { type FocusTarget } from '../../layers';
import { writeSave } from '../../storage';
import { t } from '../../strings';
import { $, closeLayer, openLayer } from '../../dom';
import { config, state } from '../../state';
import { HOURGLASS_MARK } from '../jars';

/** The Jar guide's entries: every configured mechanic, in config (unlock) order. */
export const MECHANICS: readonly MechanicId[] = config.mechanics.list.map((m) => m.id);

/** A tiny static jar illustrating a mechanic, built from the same classes as the board. */
export function miniJar(id: MechanicId): string {
  const lockC = config.palette[2].hex;
  const units = id === 'narrow' ? ['#2a9d8f'] : id === 'funnel' ? ['#f2a541', '#f2a541'] : ['#c8553d', '#2a9d8f', '#f2a541'];
  const sand = units.map((c) => `<span class="unit" style="--c:${c}"></span>`).join('');
  const extra = id === 'frozen' ? '<span class="ice"></span>' : '';
  const top = id === 'locked' ? `<span class="padlock" style="--lock:${lockC}"></span>` : id === 'funnel' ? '<span class="funnel-mark"></span>' : '';
  // The hourglass shows its full count, like a freshly dealt one.
  const every = config.mechanics.list.find((m) => m.id === 'hourglass')?.every ?? 3;
  const mark = id === 'hourglass' ? HOURGLASS_MARK.replace('></b>', `>${every}</b>`) : '';
  return `<span class="mini-jar ${id}" aria-hidden="true">${top}<span class="glass"><span class="sand">${sand}</span>${extra}<span class="shine"></span></span>${mark}</span>`;
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
}

/** Wires the Jar guide and the intro card's button. */
export function wireGuide(): void {
  // The Jar guide lists the keys where a keyboard is likely (UX-board-8).
  $('btn-guide').addEventListener('click', () => showMechanicCards(MECHANICS, t.jarGuide, undefined, matchMedia('(pointer: fine)').matches ? t.keysNote : ''));
  $('btn-intro-ok').addEventListener('click', () => closeLayer($('intro')));
}
