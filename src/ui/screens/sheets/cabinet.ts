/** The shell cabinet sheet. */
import { allShells, setProgress } from '../../../core/collection';
import { streakStatus, utcDateKey } from '../../../core/daily';
import { shellSvg } from '../../shells';
import { t } from '../../strings';
import { $, closeLayer, openLayer } from '../../dom';
import { audio, config, state } from '../../state';

/** How many shells the player had when the cabinet was last opened (or at boot). Later ones are "New" (UX-cab-4). */
let seenShells = 0;

export function openCabinet(): void {
  const owned = new Set(state.save.shells);
  const fresh = new Set(state.save.shells.slice(seenShells));
  seenShells = state.save.shells.length;
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
      // Completed sets start collapsed so the list stays short; tap the header to open one. A set
      // holding a new shell opens so the mark is seen (UX-cab-4). The button sits inside the h3,
      // so heading navigation still finds each set (UX-cab-2).
      const expanded = !p.complete || p.set.shells.some((sh) => fresh.has(sh.id));
      const title = document.createElement('h3');
      title.className = 'shell-set-title';
      const head = document.createElement('button');
      head.type = 'button';
      head.className = 'shell-set-head';
      head.innerHTML = `<span class="shell-set-name"></span><span class="shell-set-count">${p.owned}/${p.total}</span>`;
      head.querySelector('.shell-set-name')!.textContent = p.set.name;
      head.setAttribute('aria-expanded', String(expanded));
      title.append(head);
      const body = document.createElement('div');
      body.className = 'shell-set-body';
      body.id = `shell-set-${p.set.id}`;
      body.hidden = !expanded;
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
        if (fresh.has(sh.id)) {
          const badge = document.createElement('span');
          badge.className = 'shell-new';
          badge.textContent = t.shellNew;
          cell.prepend(badge);
        }
        if (!has) {
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
      sec.append(title, body);
      return sec;
    }),
  );
  openLayer($('cabinet'), $('btn-close-cabinet'));
}

/** Wires the shell cabinet's buttons. */
export function wireCabinet(): void {
  seenShells = state.save.shells.length; // shells owned at boot are not new
  $('btn-shells').addEventListener('click', openCabinet);
  $('btn-close-cabinet').addEventListener('click', () => closeLayer($('cabinet')));
}
