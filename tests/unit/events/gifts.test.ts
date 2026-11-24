// Sprint 31 C3 (D238, D239; design/gdd/events.md §3.9, §4, §5, §8): the Christmas Day gift.
import { describe, expect, it } from 'vitest';
import raw from '../../../src/config/game-config.json';
import { type EconomyConfig, newWallet } from '../../../src/core/economy';
import { type GiftsConfig, applyGift, dueGift, giveGift, repairGifts } from '../../../src/core/gifts';
import { emptyStats } from '../../../src/core/profile';
import { type StylesConfig, buyStyle, defaultStyles, giftOf, isGiftPiece } from '../../../src/core/styles';
import { exportSave, freshSave, importSave, loadSave } from '../../../src/ui/storage';

const gifts = (raw as unknown as GiftsConfig).gifts;
const scfg = raw as unknown as StylesConfig;
const econ = raw as unknown as EconomyConfig;
const christmas = gifts.find((g) => g.id === 'christmas')!;
const target = (owned: string[] = []) => ({ wallet: { ...newWallet(econ), coins: 500 }, styles: { owned, worn: defaultStyles(scfg).worn }, gifts: {} as Record<string, number>, stats: emptyStats() });

describe('dueGift', () => {
  it('is due on 25 December when the stored year is absent or lower', () => {
    expect(dueGift('2026-12-25', gifts, {})).toEqual({ gift: christmas, year: 2026 });
    expect(dueGift('2027-12-25', gifts, { christmas: 2026 })).toEqual({ gift: christmas, year: 2027 });
  });
  it('is never due on another day', () => {
    for (const d of ['2026-12-24', '2026-12-26', '2026-01-25', '2026-11-25']) expect(dueGift(d, gifts, {}), d).toBeNull();
  });
  it('is never due twice in a year, nor after a later year was claimed (clock games)', () => {
    expect(dueGift('2026-12-25', gifts, { christmas: 2026 })).toBeNull();
    expect(dueGift('2026-12-25', gifts, { christmas: 2030 })).toBeNull();
  });
  it('a bad stored value counts as never given', () => {
    expect(dueGift('2026-12-25', gifts, { christmas: Number.NaN })).toEqual({ gift: christmas, year: 2026 });
    expect(dueGift('2026-12-25', undefined, {})).toBeNull();
  });
});

describe('giveGift and applyGift', () => {
  it('gives 100 coins, one hint and the Holly cap, and stores the year', () => {
    const g = giveGift(christmas, 2026, {}, []);
    expect(g).toMatchObject({ given: { christmas: 2026 }, coins: 100, boosters: { hint: 1 }, style: 'cork:holly' });
    expect(dueGift('2026-12-25', gifts, g.given)).toBeNull();
    const s = target();
    const n = applyGift(s, g);
    expect(n.wallet.coins).toBe(600);
    expect(n.wallet.boosters.hint).toBe(s.wallet.boosters.hint + 1);
    expect(n.styles.owned).toEqual(['cork:holly']);
    expect(n.styles.worn).toEqual(s.styles.worn); // granted, not worn
    expect(n.gifts).toEqual({ christmas: 2026 });
    expect(n.stats.coinsEarned).toBe(100);
    expect(s.wallet.coins).toBe(500); // pure
  });
  it('a player who owns the Holly cap gets the coins and the hint only, one copy kept', () => {
    const g = giveGift(christmas, 2027, { christmas: 2026 }, ['cork:holly']);
    expect(g.style).toBeNull();
    expect(g.given).toEqual({ christmas: 2027 });
    const n = applyGift(target(['cork:holly']), g);
    expect(n.styles.owned).toEqual(['cork:holly']);
    expect(n.wallet.coins).toBe(600);
  });
});

describe('the Holly cap is a gift piece, never sold (D239)', () => {
  const rich = { ...newWallet(econ), coins: 1_000_000 };
  it('buyStyle refuses it, as it does Frost and Sparkle glass', () => {
    for (const [slot, id] of [['cork', 'holly'], ['glass', 'frost'], ['glass', 'sparkle']] as const) expect(buyStyle(rich, defaultStyles(scfg), scfg.styles.unlockLevel, slot, id, scfg).ok, id).toBe(false);
  });
  it('giftOf and isGiftPiece name it', () => {
    expect(giftOf('cork', 'holly', scfg)).toBe('christmas');
    expect(isGiftPiece('cork', 'holly', scfg)).toBe(true);
    expect(isGiftPiece('glass', 'frost', scfg)).toBe(false);
    expect(isGiftPiece('cork', 'nope', scfg)).toBe(false);
  });
  it('the config gift names a gift piece of its own id', () => {
    const [slot, id] = christmas.style!.split(':') as ['cork', string];
    expect(giftOf(slot, id, scfg)).toBe(christmas.id);
  });
});

describe('the save (gifts and startCards)', () => {
  const load = (extra: Record<string, unknown>) => {
    const data: Record<string, string> = { 'strata.save.v2': JSON.stringify({ ...freshSave(econ), ...extra }) };
    return loadSave(econ, { getItem: (k) => data[k] ?? null, setItem: () => undefined });
  };
  it('a fresh save and an older save have none', () => {
    expect(freshSave(econ)).toMatchObject({ gifts: {}, startCards: {} });
    const old = { ...freshSave(econ) } as Record<string, unknown>;
    delete old.gifts;
    delete old.startCards;
    const data: Record<string, string> = { 'strata.save.v2': JSON.stringify(old) };
    expect(loadSave(econ, { getItem: (k) => data[k] ?? null, setItem: () => undefined })).toMatchObject({ gifts: {}, startCards: {} });
  });
  it('repairs bad values field by field', () => {
    const s = load({ gifts: { christmas: 2026.5, nope: 2026 }, startCards: { wintertide: 2026, newtide: 'x', nope: 2026 } });
    expect(s.gifts).toEqual({});
    expect(s.startCards).toEqual({ wintertide: 2026 });
    expect(load({ gifts: 'bad', startCards: null })).toMatchObject({ gifts: {}, startCards: {} });
    expect(repairGifts({ christmas: 1999 }, gifts)).toEqual({});
  });
  it('keeps good values, and they round-trip in the save code with the Holly cap', () => {
    const s = load({ gifts: { christmas: 2026 }, startCards: { wintertide: 2026, newtide: 2026 }, styles: { owned: ['cork:holly'], worn: { glass: 'clear', cork: 'holly', sand: 'plain' } } });
    expect(s.gifts).toEqual({ christmas: 2026 });
    const back = importSave(exportSave(s), econ)!;
    expect(back.gifts).toEqual({ christmas: 2026 });
    expect(back.startCards).toEqual({ wintertide: 2026, newtide: 2026 });
    expect(back.styles.owned).toEqual(['cork:holly']);
    expect(back.styles.worn.cork).toBe('holly');
  });
});
