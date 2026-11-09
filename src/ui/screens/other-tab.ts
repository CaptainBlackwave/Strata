/**
 * One active tab (D57, TD-14): when a newer tab opens, this one stops writing the save and
 * shows a blocking "Strata is open in another tab" overlay. Play here reloads the save from
 * storage (the other tab may have progressed), re-renders, and tells the other tabs to yield.
 * The protocol itself is the pure src/ui/tab-lock.ts.
 */
import { knownShells } from '../../core/collection';
import { SAVE_KEY, loadSave, onSaveError, pauseSaves, writeSave } from '../storage';
import { t } from '../strings';
import { TabLock, broadcastChannel, storageChannel } from '../tab-lock';
import { $, canFocus, closeLayer, layers, showToast } from '../dom';
import { startLevel } from './board';
import { showHome } from './home';
import { repairSaveProfile } from './sheets/profile';
import { audio, config, state } from '../state';
import { applyTheme, currentTheme } from '../theme';

/** BroadcastChannel name, and the localStorage key of the fallback channel. */
const CHANNEL = 'strata.tab.v1';
/**
 * After this tab claims the save, an older tab may still write once before it hears the claim
 * (a win landing in the same instant). For this long after a claim, another tab's write to the
 * save makes this tab reload it, so that last write isn't erased by this tab's older copy.
 * Not a gameplay value: it only has to outlast one message hop between tabs.
 */
const LATE_WRITE_MS = 3000;
let claimedAt = -Infinity;

let lock: TabLock | null = null;

/** This tab became the owner (`true`) or yielded to a newer tab (`false`). */
function onOwnerChange(active: boolean): void {
  pauseSaves(!active);
  if (active) return;
  audio.configure({ ...state.save.settings, music: false }); // two tabs must not both play music
  layers.pin($('other-tab'), null);
  const btn = $('btn-play-here');
  if (canFocus(btn)) btn.focus();
}

/** Play here: take the save back, reload it from storage and show Home on the reloaded progress. */
export function playHere(): void {
  lock?.claim(); // resumes saves through onOwnerChange(true), and the other tabs yield
  claimedAt = performance.now();
  reloadSave();
}

/** Replaces this tab's save with the stored one and shows Home on it. */
function reloadSave(): void {
  state.save = loadSave(config);
  state.save.shells = knownShells(state.save.shells, config); // D26, as at boot
  repairSaveProfile();
  writeSave(state.save);
  audio.configure(state.save.settings);
  applyTheme(currentTheme());
  for (const el of [...($('app').children as HTMLCollectionOf<HTMLElement>)]) if (layers.has(el)) closeLayer(el, false);
  state.busy = false; // a pour that was mid-flight belongs to the board being replaced
  startLevel(state.save.level, true);
  showHome();
}

/**
 * Claims the save for this tab and listens for newer tabs: BroadcastChannel where the browser
 * has it, else the `storage` event on {@link CHANNEL}. Also tells the player, once per session,
 * when a write fails (TD-14).
 */
export function wireOtherTab(): void {
  let told = false;
  onSaveError(() => {
    if (told) return;
    told = true;
    showToast(t.saveFailed);
  });
  $('btn-play-here').addEventListener('click', playHere);
  let store: Storage | null = null;
  try {
    store = window.localStorage;
  } catch {
    /* blocked storage: no tab can keep a save, so there is nothing to share */
  }
  const channel = broadcastChannel(CHANNEL) ?? (store ? storageChannel(store, CHANNEL, (fn) => window.addEventListener('storage', fn)) : null);
  if (!channel) return;
  const id = globalThis.crypto?.randomUUID?.() ?? `${state.clock().getTime().toString(36)}-${state.rng().toString(36).slice(2)}`;
  lock = new TabLock(channel, id, onOwnerChange);
  lock.start();
  claimedAt = performance.now();
  // A late write from the tab that just yielded: take it instead of overwriting it (D57).
  window.addEventListener('storage', (e) => {
    if (e.key !== SAVE_KEY || !e.newValue || !lock?.active || state.busy) return;
    if (performance.now() - claimedAt <= LATE_WRITE_MS) reloadSave();
  });
}
