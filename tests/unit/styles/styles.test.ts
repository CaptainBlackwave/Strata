// Design: design/gdd/jar-styles.md §3.2 (unlock), §3.3 (buying and wearing), §3.5 (state and repair), §4 (can buy), §5 (edge cases).
// Sprint 12 S2, D85, D90, D91.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type EconomyConfig, type Wallet, newWallet } from '../../../src/core/economy';
import {
  STYLE_SLOTS,
  type StyleSlot,
  type StyleState,
  type StylesConfig,
  buyStyle,
  defaultStyles,
  isStyleOwned,
  stylesOf,
  stylesOpen,
  wearStyle,
} from '../../../src/core/styles';

const cfg = config as unknown as StylesConfig;
const econ = config as unknown as EconomyConfig;
const OPEN = cfg.styles.unlockLevel;
const slot = (s: StyleSlot) => cfg.styles.slots[s];
const def = (s: StyleSlot) => slot(s)[0].id;
const price = (s: StyleSlot, id: string) => slot(s).find((p) => p.id === id)!.price;
/** The priced pieces of a slot, in config order. */
const paid = (s: StyleSlot) => slot(s).slice(1).filter((p) => (p as { earned?: number }).earned === undefined); // sold pieces; streak-only ones (sprint 16) are tested in tests/unit/streak
const allPaid = STYLE_SLOTS.flatMap((s) => paid(s).map((p) => ({ slot: s, id: p.id, price: p.price })));
const totalPrice = allPaid.reduce((n, p) => n + p.price, 0);
const wallet = (coins: number): Wallet => ({ ...newWallet(econ), coins });

describe('the catalogue', () => {
  it('has the three slots in order, each with a free default first and priced pieces after', () => {
    expect(STYLE_SLOTS).toEqual(['glass', 'cork', 'sand']);
    for (const s of STYLE_SLOTS) {
      expect(slot(s)[0].price).toBe(0);
      expect(paid(s).length).toBeGreaterThan(0);
      for (const p of paid(s)) expect(p.price).toBeGreaterThan(0);
    }
  });
});

describe('defaultStyles', () => {
  it('owns nothing and wears each slot’s default', () => {
    expect(defaultStyles(cfg)).toEqual({ owned: [], worn: { glass: def('glass'), cork: def('cork'), sand: def('sand') } });
  });
  it('returns a fresh object each call', () => {
    const a = defaultStyles(cfg);
    a.owned.push('glass:x');
    expect(defaultStyles(cfg).owned).toEqual([]);
  });
});

describe('isStyleOwned', () => {
  it('is true for every default and false for an unbought piece', () => {
    const s = defaultStyles(cfg);
    for (const sl of STYLE_SLOTS) expect(isStyleOwned(s, sl, def(sl), cfg)).toBe(true);
    expect(isStyleOwned(s, 'glass', paid('glass')[0].id, cfg)).toBe(false);
  });
  it('is true for a bought piece, only in its own slot, and false for unknown ids', () => {
    const id = paid('cork')[0].id;
    const s: StyleState = { ...defaultStyles(cfg), owned: [`cork:${id}`] };
    expect(isStyleOwned(s, 'cork', id, cfg)).toBe(true);
    expect(isStyleOwned(s, 'glass', id, cfg)).toBe(false);
    expect(isStyleOwned(s, 'cork', 'nope', cfg)).toBe(false);
    expect(isStyleOwned(s, 'glass', def('cork'), cfg)).toBe(false); // another slot's default
  });
});

describe('stylesOpen (D91)', () => {
  it('is closed at level 59 and open at level 60 (boundary)', () => {
    expect(OPEN).toBe(60);
    expect(stylesOpen(59, defaultStyles(cfg), cfg)).toBe(false);
    expect(stylesOpen(60, defaultStyles(cfg), cfg)).toBe(true);
    expect(stylesOpen(200, defaultStyles(cfg), cfg)).toBe(true);
    expect(stylesOpen(1, defaultStyles(cfg), cfg)).toBe(false);
  });
  it('is open below the unlock level for a save that owns or wears a piece (§3.2, §5)', () => {
    const id = paid('sand')[1].id;
    const owns: StyleState = { ...defaultStyles(cfg), owned: [`sand:${id}`] };
    expect(stylesOpen(5, owns, cfg)).toBe(true);
    const wears: StyleState = { owned: [`sand:${id}`], worn: { ...defaultStyles(cfg).worn, sand: id } };
    expect(stylesOpen(5, wears, cfg)).toBe(true);
  });
  it('an imported save code that owns a piece below level 60 is open after repair', () => {
    const id = paid('glass')[0].id;
    const repaired = stylesOf({ owned: [`glass:${id}`], worn: { glass: id, cork: def('cork'), sand: def('sand') } }, cfg);
    expect(stylesOpen(OPEN - 1, repaired, cfg)).toBe(true);
  });
});

describe('buyStyle (§3.3, §4)', () => {
  it('spends the price, adds slot:id to owned and wears it', () => {
    const p = paid('glass')[0];
    const w = wallet(p.price + 7);
    const r = buyStyle(w, defaultStyles(cfg), OPEN, 'glass', p.id, cfg);
    expect(r.ok).toBe(true);
    expect(r.wallet.coins).toBe(7);
    expect(r.wallet.boosters).toEqual(w.boosters);
    expect(r.state.owned).toEqual([`glass:${p.id}`]);
    expect(r.state.worn.glass).toBe(p.id);
  });
  it('buys with exactly the price (boundary) and refuses one coin short', () => {
    const id = paid('sand')[2].id;
    const pr = price('sand', id);
    expect(buyStyle(wallet(pr), defaultStyles(cfg), OPEN, 'sand', id, cfg).ok).toBe(true);
    const w = wallet(pr - 1);
    const s = defaultStyles(cfg);
    const r = buyStyle(w, s, OPEN, 'sand', id, cfg);
    expect(r.ok).toBe(false);
    expect(r.wallet).toBe(w);
    expect(r.state).toBe(s);
  });
  it('buying a cork piece leaves glass and sand worn as they were', () => {
    const g = paid('glass')[1].id;
    const sa = paid('sand')[0].id;
    const s: StyleState = { owned: [`glass:${g}`, `sand:${sa}`], worn: { glass: g, cork: def('cork'), sand: sa } };
    const c = paid('cork')[2].id;
    const r = buyStyle(wallet(totalPrice), s, OPEN, 'cork', c, cfg);
    expect(r.ok).toBe(true);
    expect(r.state.worn).toEqual({ glass: g, cork: c, sand: sa });
    expect(s.worn.cork).toBe(def('cork')); // the input is not mutated
    expect(s.owned).toEqual([`glass:${g}`, `sand:${sa}`]);
  });
  it('refuses, returning the same objects, when closed, unknown, already owned or a default', () => {
    const id = paid('glass')[0].id;
    const w = wallet(totalPrice);
    const s = defaultStyles(cfg);
    const refused = (r: { ok: boolean; wallet: Wallet; state: StyleState }, ws: Wallet, ss: StyleState) => {
      expect(r.ok).toBe(false);
      expect(r.wallet).toBe(ws);
      expect(r.state).toBe(ss);
    };
    refused(buyStyle(w, s, OPEN - 1, 'glass', id, cfg), w, s); // closed
    refused(buyStyle(w, s, OPEN, 'glass', 'unknown', cfg), w, s);
    refused(buyStyle(w, s, OPEN, 'cork', id, cfg), w, s); // an id from another slot
    refused(buyStyle(w, s, OPEN, 'nope' as StyleSlot, id, cfg), w, s); // an unknown slot
    for (const sl of STYLE_SLOTS) refused(buyStyle(w, s, OPEN, sl, def(sl), cfg), w, s); // defaults are never bought
    const bought = buyStyle(w, s, OPEN, 'glass', id, cfg);
    refused(buyStyle(bought.wallet, bought.state, OPEN, 'glass', id, cfg), bought.wallet, bought.state); // already owned
  });
  it('is open below the unlock level when the save already owns a piece', () => {
    const owns: StyleState = { ...defaultStyles(cfg), owned: [`cork:${paid('cork')[0].id}`] };
    const id = paid('sand')[0].id;
    expect(buyStyle(wallet(totalPrice), owns, 1, 'sand', id, cfg).ok).toBe(true);
  });
  it('any purchase order works: forward, reverse and by name all end owning all and spending the total', () => {
    for (const order of [allPaid, [...allPaid].reverse(), [...allPaid].sort((a, b) => a.id.localeCompare(b.id))]) {
      let w = wallet(totalPrice);
      let s = defaultStyles(cfg);
      for (const p of order) {
        const r = buyStyle(w, s, OPEN, p.slot, p.id, cfg);
        expect(r.ok).toBe(true);
        expect(r.state.worn[p.slot]).toBe(p.id);
        ({ wallet: w, state: s } = r);
      }
      expect(w.coins).toBe(0);
      expect([...s.owned].sort()).toEqual(allPaid.map((p) => `${p.slot}:${p.id}`).sort());
      for (const p of allPaid) expect(isStyleOwned(s, p.slot, p.id, cfg)).toBe(true);
    }
  });
});

describe('wearStyle (§3.3)', () => {
  const g = paid('glass')[0].id;
  const owned: StyleState = { owned: [`glass:${g}`], worn: { glass: def('glass'), cork: def('cork'), sand: def('sand') } };
  it('wears an owned piece, changing only its slot', () => {
    const r = wearStyle(owned, 'glass', g, cfg);
    expect(r.worn).toEqual({ ...owned.worn, glass: g });
    expect(r.owned).toEqual(owned.owned);
    expect(owned.worn.glass).toBe(def('glass')); // not mutated
  });
  it('wears a default back for free', () => {
    const wearing = wearStyle(owned, 'glass', g, cfg);
    expect(wearStyle(wearing, 'glass', def('glass'), cfg).worn.glass).toBe(def('glass'));
  });
  it('returns the same state for an unowned, unknown, other-slot or unknown-slot piece', () => {
    expect(wearStyle(owned, 'glass', paid('glass')[1].id, cfg)).toBe(owned);
    expect(wearStyle(owned, 'glass', 'unknown', cfg)).toBe(owned);
    expect(wearStyle(owned, 'cork', g, cfg)).toBe(owned);
    expect(wearStyle(owned, 'sand', def('cork'), cfg)).toBe(owned);
    expect(wearStyle(owned, 'hat' as StyleSlot, g, cfg)).toBe(owned);
  });
});

describe('stylesOf: repair field by field (§3.5, §5)', () => {
  const D = () => defaultStyles(cfg);
  it('a missing or non-object value gives defaults', () => {
    for (const v of [undefined, null, 'glass:seaglass', 42, true, [], ['glass:seaglass']]) expect(stylesOf(v, cfg)).toEqual(D());
  });
  it('a valid value loads as saved', () => {
    const g = paid('glass')[0].id;
    const s = paid('sand')[3].id;
    const v = { owned: [`glass:${g}`, `sand:${s}`], worn: { glass: g, cork: def('cork'), sand: s } };
    expect(stylesOf(v, cfg)).toEqual(v);
  });
  it('drops unknown, malformed, other-slot, duplicate and default ids from owned', () => {
    const g = paid('glass')[0].id;
    const c = paid('cork')[0].id;
    const owned = [`glass:${g}`, 'glass:unknown', `glass:${c}`, `hat:${g}`, g, 'glass:', ':', `glass:${g}:x`, 7, null, {}, [`glass:${g}`], `glass:${g}`, `glass:${def('glass')}`, `cork:${c}`];
    expect(stylesOf({ owned, worn: {} }, cfg).owned).toEqual([`glass:${g}`, `cork:${c}`]);
  });
  it('owned that is not an array gives none', () => {
    for (const owned of ['glass:seaglass', 3, { 0: 'glass:seaglass' }, null]) expect(stylesOf({ owned, worn: D().worn }, cfg).owned).toEqual([]);
  });
  it('a worn id that is neither owned nor the default falls back to the default, per slot', () => {
    const g = paid('glass')[0].id;
    const c = paid('cork')[1].id;
    const s = stylesOf({ owned: [`glass:${g}`], worn: { glass: g, cork: c, sand: 'unknown' } }, cfg);
    expect(s.worn).toEqual({ glass: g, cork: def('cork'), sand: def('sand') });
  });
  it('junk worn values fall back slot by slot, and unknown slot keys are ignored', () => {
    const g = paid('glass')[0].id;
    expect(stylesOf({ owned: [], worn: 'clear' }, cfg).worn).toEqual(D().worn);
    expect(stylesOf({ owned: [], worn: [g] }, cfg).worn).toEqual(D().worn);
    expect(stylesOf({ owned: [`glass:${g}`], worn: { glass: 5, cork: null, sand: [] } }, cfg).worn).toEqual(D().worn);
    const r = stylesOf({ owned: [`glass:${g}`], worn: { glass: g, hat: 'feather' } }, cfg);
    expect(r.worn).toEqual({ ...D().worn, glass: g });
    expect(Object.keys(r.worn).sort()).toEqual([...STYLE_SLOTS].sort());
    expect(stylesOf({ owned: [`glass:${g}`], worn: { sand: g } }, cfg).worn.sand).toBe(def('sand')); // an id from another slot
  });
  it('is idempotent and never shares arrays with its input', () => {
    const v = { owned: [`glass:${paid('glass')[0].id}`], worn: D().worn };
    const once = stylesOf(v, cfg);
    expect(stylesOf(once, cfg)).toEqual(once);
    expect(once.owned).not.toBe(v.owned);
    expect(once.worn).not.toBe(v.worn);
  });
});
