/** The Edit Profile sheet and its discard dialog. */
import { type Profile, type Slot, SLOTS, catalog, generateName, isUnlocked, isValidName, normaliseName, sameProfile, selected as pickOf, unlockProgress, withPick } from '../../../core/profile';
import { LOCK_SVG } from '../../avatars';
import { writeSave } from '../../storage';
import { t } from '../../strings';
import { $, closeLayer, openLayer } from '../../dom';
import { plateEl, portraitOf, progressNow, renderProfile, renderProfileChip } from './profile';
import { audio, config, state } from '../../state';

// The Edit Profile sheet works on a draft; Save commits it (PP-8).
let draft: Profile;
let activeSlot: Slot = 'avatar';

export function openEditProfile(): void {
  draft = { ...state.save.profile };
  activeSlot = 'avatar';
  const input = $<HTMLInputElement>('name-input');
  input.value = draft.name;
  input.maxLength = config.profile.name.max; // the rule, not twice it (UX-edit-2)
  $('pick-note').textContent = '';
  renderEdit();
  openLayer($('edit-profile'), $(`tab-${activeSlot}`));
}

/** The name to draw on plates while editing: the draft if valid, else the saved one. */
export function draftName(): string {
  return isValidName(draft.name, config) ? normaliseName(draft.name) : state.save.profile.name;
}

export function renderEdit(focusSlot: Slot | null = null, focusId: string | null = null): void {
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
  // On the other tabs the Name panel is hidden, so the reason Save is off shows by Save (UX-edit-1).
  $('save-error').textContent = !valid && activeSlot !== 'plate' ? t.nameInvalidTab(config.profile.name.min, config.profile.name.max) : '';
  if (focusSlot && focusId) $(`grid-${focusSlot}`).querySelector<HTMLElement>(`[data-id="${focusId}"]`)?.focus();
}

/** Selects an item in the draft, or explains how to unlock it. */
export function pick(slot: Slot, id: string): void {
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

export function switchTab(slot: Slot): void {
  activeSlot = slot;
  $('pick-note').textContent = '';
  renderEdit();
  $(`tab-${slot}`).focus();
}

export function saveEditProfile(): void {
  if (!isValidName(draft.name, config)) return;
  state.save.profile = { ...draft, name: normaliseName(draft.name) };
  writeSave(state.save);
  audio.play('select');
  renderProfile();
  renderProfileChip();
  closeLayer($('edit-profile'));
}

/** Closing asks "Discard changes?" only when the draft differs from the saved profile. */
export function closeEditProfile(): void {
  if (sameProfile(draft, state.save.profile)) {
    closeLayer($('edit-profile'));
    return;
  }
  openLayer($('discard'), $('btn-keep-editing'));
}

export function keepEditing(): void {
  closeLayer($('discard'), false);
  $(`tab-${activeSlot}`).focus();
}

export function discardEdits(): void {
  closeLayer($('discard'), false);
  closeLayer($('edit-profile'));
}

/** Arrow keys inside the tab list and the pick grids (roving focus, PP-8 / A-keyboard). */
export function onEditKeys(e: KeyboardEvent): void {
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

/** Wires the Edit Profile sheet and its discard dialog. */
export function wireEditProfile(): void {
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
    draft = { ...draft, name: generateName(state.rng, t.nameWords) };
    $<HTMLInputElement>('name-input').value = draft.name;
    audio.play('shuffle');
    renderEdit();
  });
}
