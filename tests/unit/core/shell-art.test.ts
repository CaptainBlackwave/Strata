// Story: design/gdd/shell-collection.md (expedition sets): every shell has real artwork.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type CollectionConfig, allShells } from '../../../src/core/collection';
import { SHELL_KINDS, shellSvg } from '../../../src/ui/shells';

const cfg = config as unknown as CollectionConfig;

describe('shell artwork', () => {
  it('every shell in the catalog uses a shape that has its own drawing', () => {
    for (const s of allShells(cfg)) expect(SHELL_KINDS, `${s.id} (${s.kind})`).toContain(s.kind);
  });
  it('adds six new shapes for the expedition sets, each used at least once', () => {
    const used = new Set(allShells(cfg).map((s) => s.kind));
    for (const k of ['turban', 'cone', 'urchin', 'heart', 'tusk', 'ammonite']) {
      expect(SHELL_KINDS).toContain(k);
      expect(used.has(k), k).toBe(true);
    }
  });
  it('different shapes draw different artwork', () => {
    const svgs = SHELL_KINDS.map((kind) => shellSvg({ kind, colors: ['#aaaaaa', '#555555'] }));
    expect(new Set(svgs.map((s) => s.replace(/sc\d+/g, ''))).size).toBe(SHELL_KINDS.length);
  });
  it('a stone shell carries a texture, a glowing shell carries a glow marker, and locked shells show neither', () => {
    const base = { kind: 'ammonite', colors: ['#cfc4b0', '#7d6a55'] as [string, string] };
    expect(shellSvg({ ...base, effect: 'stone' })).toContain('data-effect="stone"');
    expect(shellSvg({ ...base, effect: 'glow' })).toContain('data-effect="glow"');
    expect(shellSvg({ ...base, effect: 'stone' }, true)).not.toContain('data-effect');
  });
  it('every shell in every set gets a distinct colourway within its set', () => {
    for (const set of cfg.collection.sets) {
      const looks = set.shells.map((s) => `${s.kind}:${s.colors.join(',')}`);
      expect(new Set(looks).size, set.name).toBe(looks.length);
    }
  });
});
