import { describe, expect, it } from 'vitest';
import swSource from '../../../public/sw.js?raw';

// public/sw.js is a classic worker script; given a `module` object it exports its pure helpers (TD-8).
const mod = { exports: {} as unknown };
new Function('module', swSource)(mod);
const sw = mod.exports as {
  assetsOf: (html: string, scope: string) => string[];
  referencedUrls: (html: string, scope: string, textOf: (u: string) => Promise<string | null>) => Promise<Set<string>>;
  staleAssets: (cached: string[], keep: Set<string>, scope: string) => string[];
};

const SCOPE = 'https://x.test/game/';
const u = (p: string): string => SCOPE + p;
const HTML = '<script type="module" src="./assets/index-new.js"></script><link href="./assets/index-new.css">';

describe('service worker pruning (TD-8)', () => {
  it('reads the page assets as absolute URLs', () => {
    expect(sw.assetsOf(HTML, SCOPE)).toEqual([u('assets/index-new.js'), u('assets/index-new.css')]);
  });

  it('follows worker chunks, chunk imports and css urls transitively', async () => {
    const texts: Record<string, string> = {
      [u('assets/index-new.js')]: 'new Worker(new URL("gen-w1.js",import.meta.url))',
      [u('assets/gen-w1.js')]: 'import{a}from"./shared-s1.js";',
      [u('assets/index-new.css')]: '@font-face{src:url(./font-f1.woff2)} a{background:url(data:x)}',
    };
    const keep = await sw.referencedUrls(HTML, SCOPE, async (url) => texts[url] ?? null);
    expect([...keep].sort()).toEqual(
      ['index-new.js', 'index-new.css', 'gen-w1.js', 'shared-s1.js', 'font-f1.woff2'].map((n) => u('assets/' + n)).sort(),
    );
  });

  it('deletes only unreferenced assets/* entries', () => {
    const keep = new Set([u('assets/index-new.js')]);
    const cached = [u('assets/index-new.js'), u('assets/index-old.js'), u('assets/gen-old.js'), u('icon-192.png'), u('')];
    expect(sw.staleAssets(cached, keep, SCOPE)).toEqual([u('assets/index-old.js'), u('assets/gen-old.js')]);
  });

  it('deletes nothing when no references are known', () => {
    expect(sw.staleAssets([u('assets/a.js')], new Set(), SCOPE)).toEqual([]);
  });
});
