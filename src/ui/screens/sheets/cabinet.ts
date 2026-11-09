/** The shell cabinet sheet. */
import { allShells, setProgress } from '../../../core/collection';
import { streakStatus, utcDateKey } from '../../../core/daily';
import { shellSvg } from '../../shells';
import { t } from '../../strings';
import { $, closeLayer, openLayer } from '../../dom';
import { audio, config, state } from '../../state';

export function openCabinet(): void {
  const owned = new Set(state.save.shells);
  const cleared = state.save.level - 1;
  const every = config.collection.everyLevels;
  const remaining = every - (cleared % every);
  $('cabinet-title').textContent = t.cabinetTitle;
  // Today's unsolved daily also grants a shell, and the complete line is a standing rule, not a payout (UX-cab-3).
  const dailyOpen = state.save.tutorialDone && !streakStatus(state.save.daily, utcDateKey(new Date())).solvedToday;
  $('cabinet-next').textContent = state.save.shells.length < allShells(config).length ? t.nextShell(remaining, dailyOpen) : t.collectionDone(config.collection.coinsWhenComplete);
  const sets = $('cabinet-sets');
  sets.replaceChildren(
    ...setProgress(state.save.shells, config).map((p) => {
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
        cell.querySelector('svg')?.setAttribute('aria-hidden', 'true');
        const caption = cell.querySelector('figcaption')!;
        if (has) caption.textContent = sh.name;
        else {
          // The "?" stays on screen; a screen reader hears "Not found yet" (UX-cab-1, AX-15).
          caption.innerHTML = '<span aria-hidden="true"></span><span class="sr-only"></span>';
          caption.children[0].textContent = t.lockedShellMark;
          caption.children[1].textContent = t.lockedShell;
        }
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

/** Wires the shell cabinet's buttons. */
export function wireCabinet(): void {
  $('btn-shells').addEventListener('click', openCabinet);
  $('btn-close-cabinet').addEventListener('click', () => closeLayer($('cabinet')));
}
