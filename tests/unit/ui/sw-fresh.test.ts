// Story: owner request after 0.14.1 ("no stale data for players").
// GitHub Pages lets browsers reuse the page for 10 minutes (Cache-Control: max-age=600), so the
// worker's network-first fetch must skip the browser cache, or players get the previous release.
import { describe, expect, it } from 'vitest';
import swSource from '../../../public/sw.js?raw';

const mod = { exports: {} as unknown };
new Function('module', swSource)(mod);
const sw = mod.exports as { fetchInit: (url: string, mode: string) => RequestInit | undefined };
const SCOPE = 'https://x.test/game/';

describe('the worker never takes the page from the browser cache', () => {
  it('the page, the manifest and the icons revalidate with the server (no-cache)', () => {
    expect(sw.fetchInit(SCOPE, 'navigate')).toEqual({ cache: 'no-cache' });
    expect(sw.fetchInit(SCOPE + '?challenge=3&pours=4', 'navigate')).toEqual({ cache: 'no-cache' });
    for (const f of ['manifest.webmanifest', 'icon-192.png', 'og.png']) expect(sw.fetchInit(SCOPE + f, 'no-cors'), f).toEqual({ cache: 'no-cache' });
  });
  it('hashed assets keep the normal cache: their names change with their content', () => {
    expect(sw.fetchInit(SCOPE + 'assets/index-Cb3UbzEx.js', 'cors')).toBeUndefined();
  });
  it('the fetches use it', () => {
    expect(swSource).toMatch(/fetch\(req, fetchInit\(req\.url, req\.mode\)\)/);
    expect(swSource).not.toMatch(/await fetch\(req\);/);
  });
});
