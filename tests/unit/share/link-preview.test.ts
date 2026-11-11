// Story: production/sprints/sprint-14.md H1; design/gdd/sharing.md §3.3 (D116, D123, D124).
// A pasted link must look like a game: title, description, and one preview image.
import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import manifest from '../../../public/manifest.webmanifest?raw';
// The image as a base64 data address, so the test needs no file access.
import ogData from '../../../public/og.png?inline';

/** The `content` of the meta tag whose `property` or `name` is `key`, or undefined. */
function meta(key: string): string | undefined {
  const tag = [...html.matchAll(/<meta\s[^>]*>/g)].map((m) => m[0]).find((t) => new RegExp(`\\b(?:property|name)="${key}"`).test(t));
  return tag?.match(/\bcontent="([^"]*)"/)?.[1];
}
const title = html.match(/<title>([^<]*)<\/title>/)?.[1] ?? '';
/** The one place the site's address is written down (D124). */
const SITE = 'https://captainblackwave.github.io/Strata/';
const IMAGE = { file: 'og.png', width: 1200, height: 630 };

describe('link preview (sharing §3.3)', () => {
  it('the page title names the game and says what it is', () => {
    expect(title).toBe('Strata: a calm seaside sand-sort puzzle');
  });
  it('the description is one plain sentence a preview can show whole', () => {
    const d = meta('description') ?? '';
    expect(d.length).toBeGreaterThanOrEqual(50);
    expect(d.length).toBeLessThanOrEqual(160);
    expect(d).toMatch(/\.$/);
    expect(JSON.parse(manifest).description).toBe(d);
  });
  it('Open Graph tags repeat the title and description and name the site', () => {
    expect(meta('og:type')).toBe('website');
    expect(meta('og:site_name')).toBe('Strata');
    expect(meta('og:title')).toBe(title);
    expect(meta('og:description')).toBe(meta('description'));
    expect(meta('og:url')).toBe(SITE);
  });
  it('the preview image is an absolute address with its size and a text alternative', () => {
    expect(meta('og:image')).toBe(SITE + IMAGE.file);
    expect(meta('og:image:type')).toBe('image/png');
    expect(meta('og:image:width')).toBe(String(IMAGE.width));
    expect(meta('og:image:height')).toBe(String(IMAGE.height));
    expect((meta('og:image:alt') ?? '').length).toBeGreaterThan(20);
  });
  it('Twitter card tags ask for the large image', () => {
    expect(meta('twitter:card')).toBe('summary_large_image');
    expect(meta('twitter:title')).toBe(title);
    expect(meta('twitter:description')).toBe(meta('description'));
    expect(meta('twitter:image')).toBe(meta('og:image'));
    expect(meta('twitter:image:alt')).toBe(meta('og:image:alt'));
  });
  it('the committed image is a PNG of exactly that size, small enough for a chat preview', () => {
    const png = Uint8Array.from(atob(ogData.slice(ogData.indexOf(',') + 1)), (c) => c.charCodeAt(0));
    const u32 = (at: number) => new DataView(png.buffer).getUint32(at);
    expect(String.fromCharCode(...png.subarray(1, 4))).toBe('PNG');
    expect(u32(16)).toBe(IMAGE.width);
    expect(u32(20)).toBe(IMAGE.height);
    expect(png.length).toBeLessThan(300 * 1024);
  });
  it('nothing in the page talks to a server: no script, pixel or font from another site (D118)', () => {
    const elsewhere = [...html.matchAll(/\b(?:src|href)="(https?:\/\/[^"]*)"/g)].map((m) => m[1]);
    expect(elsewhere).toEqual([]);
  });
});
