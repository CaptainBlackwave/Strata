// D164: Realistic sand is a free Settings switch, off (Classic) by default; it survives save and repair.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import type { EconomyConfig } from '../../../../src/core/economy';
import { freshSave, loadSave } from '../../../../src/ui/storage';

const econ = config as unknown as EconomyConfig;
const load = (settings: unknown) => {
  const data: Record<string, string> = { 'strata.save.v2': JSON.stringify({ ...freshSave(econ), settings }) };
  return loadSave(econ, { getItem: (k) => data[k] ?? null, setItem: () => undefined }).settings.realistic;
};

describe('the Realistic sand setting', () => {
  it('is off (Classic) for a new player and for an older save', () => {
    expect(freshSave(econ).settings.realistic).toBe(false);
    expect(load({ sound: true })).toBe(false);
  });
  it('keeps a stored choice and repairs a bad value to Classic', () => {
    expect(load({ realistic: true })).toBe(true);
    expect(load({ realistic: 'yes' })).toBe(false);
  });
});
