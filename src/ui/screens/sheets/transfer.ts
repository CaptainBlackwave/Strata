/** The save-code sheet (decision D16): copy this device's code, restore from a pasted one. */
import { knownShells } from '../../../core/collection';
import { type FocusTarget } from '../../layers';
import { exportSave, importSave, writeSave } from '../../storage';
import { t } from '../../strings';
import { $, closeLayer, openLayer, settingsEl, showToast } from '../../dom';
import { startLevel } from '../board';
import { showHome } from '../home';
import { repairSaveProfile } from './profile';
import { audio, config, state } from '../../state';
import { applyTheme, currentTheme } from '../../theme';

let restoreArmed = false;

/**
 * Opens the save-code sheet (UX-settings-6): this device's code is read-only with Copy, and
 * Restore reads only the separate, empty paste box, so it never warns about your own progress.
 */
export function openTransfer(opener: FocusTarget | null = null): void {
  $<HTMLTextAreaElement>('transfer-code').value = exportSave(state.save);
  $<HTMLTextAreaElement>('transfer-paste').value = '';
  $('copy-status').textContent = t.saveCodeHelp;
  $('transfer-status').textContent = t.restoreHelp;
  restoreArmed = false;
  $('btn-restore-code').textContent = t.restoreCode;
  openLayer($('transfer'), $('btn-copy-code'), opener);
}

export async function copySaveCode(): Promise<void> {
  const box = $<HTMLTextAreaElement>('transfer-code');
  box.value = exportSave(state.save);
  try {
    await navigator.clipboard.writeText(box.value);
    $('copy-status').textContent = t.codeCopied;
  } catch {
    box.select(); // clipboard blocked: leave it selected for a manual copy
    $('copy-status').textContent = t.codeSelectManually;
  }
}

/** Restores from the pasted code. The first tap asks for confirmation; the second replaces progress. */
export function restoreSaveCode(): void {
  const pasted = $<HTMLTextAreaElement>('transfer-paste').value;
  const imported = pasted.trim() ? importSave(pasted, config) : null;
  if (!imported) {
    restoreArmed = false;
    $('btn-restore-code').textContent = t.restoreCode;
    $('transfer-status').textContent = pasted.trim() ? t.codeInvalid : t.codeEmpty;
    audio.play('nope');
    return;
  }
  if (!restoreArmed) {
    restoreArmed = true;
    $('btn-restore-code').textContent = t.restoreConfirm;
    $('transfer-status').textContent = t.restoreWarning(imported.level, imported.wallet.coins);
    return;
  }
  state.save = imported;
  state.save.shells = knownShells(state.save.shells, config); // D26
  repairSaveProfile();
  writeSave(state.save);
  audio.configure(state.save.settings);
  applyTheme(currentTheme());
  closeLayer($('transfer'), false);
  closeLayer(settingsEl, false); // the sheet was opened over Settings
  showToast(t.restored);
  startLevel(state.save.level);
  showHome();
}

/** Wires the save-code sheet. */
export function wireTransfer(): void {
  $('btn-savecode').addEventListener('click', () => openTransfer($('btn-savecode')));
  $('btn-copy-code').addEventListener('click', () => void copySaveCode());
  $('btn-restore-code').addEventListener('click', restoreSaveCode);
  // Editing the code disarms Restore, so a new code always gets its own warning (UX-settings-1).
  $('transfer-paste').addEventListener('input', () => {
    if (!restoreArmed) return;
    restoreArmed = false;
    $('btn-restore-code').textContent = t.restoreCode;
    $('transfer-status').textContent = t.restoreHelp;
  });
  $('btn-close-transfer').addEventListener('click', () => closeLayer($('transfer')));
}
