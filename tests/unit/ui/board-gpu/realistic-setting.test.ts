// D164/D165: Realistic sand is a free Settings switch, on by default (D165); it survives save and repair.
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
  it('is on (Realistic) for a new player and for an older save without the field (D165)', () => {
    expect(freshSave(econ).settings.realistic).toBe(true);
    expect(load({ sound: true })).toBe(true);
  });
  it('keeps a stored choice, Classic included, and repairs a bad value to Realistic', () => {
    expect(load({ realistic: false })).toBe(false);
    expect(load({ realistic: true })).toBe(true);
    expect(load({ realistic: 'yes' })).toBe(true);
  });
});
