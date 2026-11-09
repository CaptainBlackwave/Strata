// Review of PR #6 (0.9.1): a failed or partial update must never leave offline play with no files.
import { describe, expect, it } from 'vitest';
import swSource from '../../../public/sw.js?raw';

const mod = { exports: {} as unknown };
new Function('module', swSource)(mod);
const sw = mod.exports as {
  refsOf: (url: string, text: string) => string[];
  isComplete: (keep: Set<string>, cachedUrls: string[]) => boolean;
  staleAssets: (cached: string[], keep: Set<string>, scope: string, complete?: boolean) => string[];
};
const SCOPE = 'https://x.test/game/';
const u = (p: string): string => SCOPE + p;

describe('service worker completeness gate', () => {
  it('is complete only when every needed URL is cached', () => {
    const keep = new Set([u('assets/a.js'), u('assets/b.css')]);
    expect(sw.isComplete(keep, [u('assets/a.js'), u('assets/b.css'), u('assets/old.js')])).toBe(true);
    expect(sw.isComplete(keep, [u('assets/a.js'), u('assets/old.js')])).toBe(false);
    expect(sw.isComplete(new Set(), [])).toBe(false); // nothing known is not "complete"
  });
  it('does not prune the old version while the new one is incomplete', () => {
    const keep = new Set([u('assets/new.js')]);
    const cached = [u('assets/old.js')]; // new.js failed to download
    expect(sw.staleAssets(cached, keep, SCOPE, sw.isComplete(keep, cached))).toEqual([]);
    expect(sw.staleAssets([...cached, u('assets/new.js')], keep, SCOPE, true)).toEqual([u('assets/old.js')]);
  });
});

describe('service worker reference scan', () => {
  it('follows dynamic imports and non-JS assets named from JS', () => {
    const js = 'const m = import("./chunk-abc.js"); const w = new URL("./tile-9f.png", import.meta.url); import"./side-1.js";';
    expect(sw.refsOf(u('assets/index.js'), js).sort()).toEqual([u('assets/chunk-abc.js'), u('assets/side-1.js'), u('assets/tile-9f.png')].sort());
  });
});
