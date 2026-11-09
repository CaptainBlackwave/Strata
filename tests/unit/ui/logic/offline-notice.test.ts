// Story: production/sprints/sprint-11.md O4 (D78): the one-time offline-ready notice, DOM-free.
import { describe, expect, it } from 'vitest';
import swSource from '../../../../public/sw.js?raw';
import { OFFLINE_READY, freshOnboarding, isOfflineReady, offlineNoticeDue } from '../../../../src/ui/logic/onboarding';
import { type KeyValueStore, saveStored } from '../../../../src/ui/storage';

const mod = { exports: {} as unknown };
new Function('module', swSource)(mod);
const sw = mod.exports as { OFFLINE_READY: string };

describe('offlineNoticeDue (O4)', () => {
  it('shows once, when the save can remember it', () => {
    expect(offlineNoticeDue(freshOnboarding(), true)).toBe(true);
    expect(offlineNoticeDue({ ...freshOnboarding(), offlineNoticed: true }, true)).toBe(false);
  });
  it('never shows when storage is blocked, because it could not be remembered', () => {
    expect(offlineNoticeDue(freshOnboarding(), false)).toBe(false);
  });
});

describe('the offline-ready message (O4)', () => {
  it('is the one sw.js posts after its install caching completes', () => {
    expect(sw.OFFLINE_READY).toBe(OFFLINE_READY);
    expect(swSource).toMatch(/if \(!complete\) throw[\s\S]*?notifyOfflineReady\(\)/);
  });
  it('is recognised only in its own shape', () => {
    expect(isOfflineReady({ type: OFFLINE_READY })).toBe(true);
    for (const v of [null, 'strata:offline-ready', { type: 'other' }, {}]) expect(isOfflineReady(v)).toBe(false);
  });
});

describe('saveStored (O4)', () => {
  const mem = (): KeyValueStore => {
    const m = new Map<string, string>();
    return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) };
  };
  it('is true once the save reads back', () => {
    const s = mem();
    s.setItem('strata.save.v2', '{}');
    expect(saveStored(s)).toBe(true);
  });
  it('is false with no save, no storage, or storage that throws', () => {
    expect(saveStored(mem())).toBe(false);
    expect(saveStored(null)).toBe(false);
    expect(saveStored({ getItem: () => { throw new Error('SecurityError'); }, setItem: () => undefined })).toBe(false);
  });
});
