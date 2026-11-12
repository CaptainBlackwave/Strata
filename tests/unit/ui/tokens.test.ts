// Sprint 25 U1/U2 (production/sprints/sprint-25.md): the design tokens and components in
// src/ui/style.css. Colours live in token blocks (`:root`, `:root[data-scheme=…]`) or in scene
// and jar art; UI chrome reads tokens, so a new hard-coded colour fails here.
import { describe, expect, it } from 'vitest';
// @ts-expect-error node:fs types are not installed
import { readFileSync } from 'node:fs';
import { sceneScheme } from '../../../src/ui/theme-tokens';
import cfg from '../../../src/config/game-config.json';

const read = readFileSync as (path: URL, enc: string) => string;
const css = read(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
const html = read(new URL('../../../index.html', import.meta.url), 'utf8');

/** One declaration with the chain of selectors / at-rules it sits in. */
interface Decl {
  readonly chain: readonly string[];
  readonly prop: string;
  readonly value: string;
}

/** A small CSS walker: comments stripped, nested blocks tracked, declarations split on `;`. */
function declarations(source: string): Decl[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: Decl[] = [];
  const chain: string[] = [];
  let buf = '';
  let paren = 0;
  const flush = (): void => {
    const d = buf.trim();
    buf = '';
    const colon = d.indexOf(':');
    if (colon > 0) out.push({ chain: [...chain], prop: d.slice(0, colon).trim(), value: d.slice(colon + 1).trim() });
  };
  for (const ch of text) {
    if (ch === '(') paren++;
    if (ch === ')') paren--;
    if (paren === 0 && ch === '{') {
      chain.push(buf.trim());
      buf = '';
    } else if (paren === 0 && ch === '}') {
      flush();
      chain.pop();
    } else if (paren === 0 && ch === ';') flush();
    else buf += ch;
  }
  return out;
}

/** Token blocks: the only place UI colours are typed. */
const TOKEN_BLOCK = /^:root(\[[^\]]+\])?$/;
/**
 * Selectors whose colours are art, not chrome: jars, corks and sand, logo and win jars, coins,
 * badge medals, map icons, special-jar marks, name plates, scene swatches, the Home hero, scene
 * decorations ([data-theme]) and jar styles. Keep it to art: chrome takes a token instead.
 */
const ART = [
  /jar|glass|cork|\.unit\b|sand|\bmj\b|\.mj\./, // jars, sand, the mini jars in mechanic tiles
  /coin|badge-medal|\.i-(shell|rib|sand|star|lock)|\.m-(grass|red|lamp)/, // coins, medals, map icons
  /clam|funnel|wet-mark|sieve|ice\b|mini-ico\.ice/, // special-jar art
  /plate\[|scene-swatch|hero-|\[data-theme=|\[data-glass=|style-/, // plates, scene art, jar styles
  /\.home::before|\.stone-mark/, // the scene's sun or moon on Home; the map's stone marks
  // TODO sprint 25 U5/U6 (audit S4): the completed shell set's fixed mint, pinned by themes.test FIXED.
  /\.shell-set\.complete/,
];
/** Neutral white and black (masks, sparkles, switch thumbs) are allowed anywhere. */
const NEUTRAL = new Set(['#fff', '#ffffff', '#000', '#000000']);
const HEX = /#[0-9a-f]{3,8}\b/gi;

const decls = declarations(css);

function isArt(chain: readonly string[]): boolean {
  const joined = chain.join(' ');
  return ART.some((re) => re.test(joined));
}

describe('style.css colour tokens (sprint 25 U1)', () => {
  it('has no raw hex colour outside the token blocks and the scene / jar art', () => {
    // Arrange
    const offenders: string[] = [];
    // Act
    for (const d of decls) {
      if (d.chain.some((c) => TOKEN_BLOCK.test(c)) || isArt(d.chain)) continue;
      for (const hex of d.value.match(HEX) ?? []) {
        if (!NEUTRAL.has(hex.toLowerCase())) offenders.push(`${d.chain.at(-1)} { ${d.prop}: … ${hex} }`);
      }
    }
    // Assert
    expect(offenders, 'use a token from :root (or derive one with color-mix)').toEqual([]);
  });

  it('never types the daytime ink-brown or the old primary lip by hand (they ignore night scenes)', () => {
    const brown = /rgba\(\s*(90,\s*70,\s*50|74,\s*59,\s*44)\s*,|#1f776c/i;
    const typed = decls.filter((d) => !d.chain.some((c) => TOKEN_BLOCK.test(c)) && brown.test(d.value));
    expect(typed.map((d) => `${d.chain.at(-1)} { ${d.prop} }`)).toEqual([]);
  });

  it('defines the type, space, radius, shadow, motion, lip, ink and band tokens', () => {
    const root = decls.filter((d) => d.chain.length === 1 && d.chain[0] === ':root').map((d) => d.prop);
    const want = [
      ...[1, 2, 3, 4, 5, 6].map((n) => `--fs-${n}`),
      '--fw-body', '--fw-bold', '--fw-black',
      ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `--sp-${n}`),
      '--r-s', '--r-m', '--r-l', '--r-pill',
      '--shadow-c', '--sh-1', '--sh-2', '--sh-3',
      '--dur-1', '--dur-2', '--dur-3',
      '--lip', '--lip-accent', '--edge', '--ink-hair', '--ink-line', '--ink-wash',
      '--band-play', '--band-today', '--band-collection', '--band-profile',
    ];
    expect(want.filter((p) => !root.includes(p))).toEqual([]);
  });

  it('derives the lips from their surfaces with color-mix, never a fixed colour', () => {
    const lips = decls.filter((d) => /^--lip(-accent|-surface)?$/.test(d.prop));
    expect(lips.length).toBeGreaterThan(0);
    for (const d of lips) expect(d.value, d.prop).toMatch(/^(color-mix\(|var\(--lip)/);
  });

  it('gives night scenes their own shadow colour and lip mix', () => {
    const dark = decls.filter((d) => d.chain[0] === ":root[data-scheme='dark']").map((d) => d.prop);
    expect(dark).toEqual(expect.arrayContaining(['--shadow-c', '--lip-mix', 'color-scheme']));
  });

  it('stops the press movement under reduced motion', () => {
    const reduced = decls.filter((d) => /prefers-reduced-motion:\s*reduce/.test(d.chain[0] ?? '') && d.chain[1] === ':root');
    expect(reduced.find((d) => d.prop === '--press-y')?.value).toBe('0px');
  });
});

describe('sceneScheme (sprint 25 U1)', () => {
  it('reads a dark card as a dark scene and a light card as light', () => {
    expect(sceneScheme('#1b2a44')).toBe('dark');
    expect(sceneScheme('#fffaf1')).toBe('light');
    expect(sceneScheme('#fff')).toBe('light');
    expect(sceneScheme('not a colour')).toBe('light');
  });

  it('marks exactly the night scenes dark', () => {
    const dark = cfg.themes.list.filter((t) => sceneScheme(t.tokens.card) === 'dark').map((t) => t.id).sort();
    expect(dark).toEqual(['auroranight', 'harvestmoon', 'lighthousenight', 'meteorshower', 'moonlit', 'newyear', 'winterlights']);
  });
});

describe('sheet header and close (sprint 25 U2, audit X4)', () => {
  const heads = [...html.matchAll(/<div class="sheet-head">([\s\S]*?)<\/div>\s*\n/g)].map((m) => m[1]);

  it('every sheet and cabinet with a title has one header with exactly one X close', () => {
    expect(heads.length).toBeGreaterThanOrEqual(12);
    for (const h of heads) {
      expect(h).toMatch(/<h2 id="[^"]+"[^>]* class="sheet-title"/);
      expect(h.match(/class="icon-btn sheet-x"/g)?.length, h.slice(0, 80)).toBe(1);
      expect(h).toMatch(/data-s-label="close"/);
    }
  });

  it('has no bottom Close buttons or older close classes left', () => {
    expect(html).not.toMatch(/sheet-close|track-close|cabinet-head/);
    expect(html).not.toMatch(/id="btn-close-[^"]+"[^>]*class="(primary|secondary)/);
  });
});
