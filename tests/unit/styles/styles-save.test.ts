// Design: design/gdd/jar-styles.md §3.5 (the save field, its repair, the save code round-trip), §5 (unknown ids).
// Also design/gdd/save-data.md §2.1. Sprint 12 S2.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../src/core/economy';
import { type StyleSlot, type StylesConfig, defaultStyles, stylesOpen } from '../../../src/core/styles';
import { type KeyValueStore, exportSave, freshSave, importSave, loadSave } from '../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const cfg = config as unknown as StylesConfig;
const KEY = 'strata.save.v2';
const paid = (s: StyleSlot, i: number) => cfg.styles.slots[s][i + 1].id;
const def = (s: StyleSlot) => cfg.styles.slots[s][0].id;

function memoryStore(init: Record<string, string> = {}): KeyValueStore {
  const data = { ...init };
  return { getItem: (k) => data[k] ?? null, setItem: (k, v) => void (data[k] = v) };
}
const load = (raw: object) => loadSave(econ, memoryStore({ [KEY]: JSON.stringify(raw) }));
/** A save from before jar styles: no `styles`. */
const OLD_SAVE = { level: 72, best: {}, wallet: { coins: 4000, boosters: {} }, tutorialDone: true, badges: ['first-seal'] };

describe('the styles field in the save', () => {
  it('a fresh save, and an older save without the field, get the defaults', () => {
    expect(freshSave(econ).styles).toEqual(defaultStyles(cfg));
    expect(load(OLD_SAVE).styles).toEqual(defaultStyles(cfg));
  });
  it('a valid field loads as saved', () => {
    const g = paid('glass', 0);
    const styles = { owned: [`glass:${g}`, `cork:${paid('cork', 3)}`], worn: { glass: g, cork: def('cork'), sand: def('sand') } };
    expect(load({ ...OLD_SAVE, styles }).styles).toEqual(styles);
  });
  it('is repaired field by field, leaving the rest of the save alone', () => {
    const g = paid('glass', 1);
    const s = load({ ...OLD_SAVE, styles: { owned: [`glass:${g}`, 'glass:unknown', 'sand:newer', 5, `glass:${g}`], worn: { glass: g, cork: 'newer', sand: paid('sand', 0) } } });
    expect(s.styles).toEqual({ owned: [`glass:${g}`], worn: { glass: g, cork: def('cork'), sand: def('sand') } });
    expect(load({ ...OLD_SAVE, styles: 'glass:seaglass' }).styles).toEqual(defaultStyles(cfg));
    expect(s.badges).toEqual(['first-seal']);
    expect(s.wallet.coins).toBe(4000);
  });
  it('a save code carries it, and importSave repairs it like a load', () => {
    const s = freshSave(econ);
    s.styles = { owned: [`glass:${paid('glass', 2)}`, `sand:${paid('sand', 3)}`], worn: { glass: paid('glass', 2), cork: def('cork'), sand: paid('sand', 3) } };
    expect(importSave(exportSave(s), econ)?.styles).toEqual(s.styles);
    const bad = { ...s, styles: { owned: ['glass:unknown'], worn: { ...s.styles.worn } } };
    expect(importSave(exportSave(bad), econ)?.styles).toEqual(defaultStyles(cfg));
  });
  it('an imported code below the unlock level that owns a piece keeps styles open', () => {
    const s = freshSave(econ);
    s.level = cfg.styles.unlockLevel - 1;
    s.styles = { owned: [`cork:${paid('cork', 0)}`], worn: { ...defaultStyles(cfg).worn } };
    const back = importSave(exportSave(s), econ)!;
    expect(stylesOpen(back.level, back.styles, cfg)).toBe(true);
  });
});
