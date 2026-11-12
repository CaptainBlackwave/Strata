// Story: production/sprints/sprint-13.md M2 (sieve jar UI, D96). Design: design/gdd/jar-mechanics.md 2.5.
// The sieve is folded into MechanicId: its card, Jar guide entry, map debut badge and band art,
// while the daily and weekly still leave it out (isClassicMechanic) until W1.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
// @ts-expect-error node:fs types are not installed (as in style-art.test.ts)
import { readFileSync as readFs } from 'node:fs';
import { type CollectionConfig } from '../../../src/core/collection';
import { type GameConfig, type MechanicId, isClassicMechanic, levelSpec, specMechanics } from '../../../src/core/levels';
import { specialsOf } from '../../../src/core/map';
import { t } from '../../../src/ui/strings';

/** style.css as text (CSS ?raw imports are empty under Vitest; style-art.test.ts reads it the same way). */
const css = (readFs as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
const cfg = config as unknown as GameConfig & CollectionConfig;
// Every mechanic has a card again since sprint 13 M3 (the clam's UI).
const ids: MechanicId[] = cfg.mechanics.list.map((m) => m.id);

describe('the sieve is a card mechanic (D96)', () => {
  it('every configured mechanic, the sieve included, has a card, a map name and a jar state', () => {
    expect(ids).toContain('sieve');
    for (const id of ids) {
      const card = (t.mechanics as Record<string, { name: string; rule: string; tap: string } | undefined>)[id];
      expect(card, id).toBeDefined();
      for (const s of [card!.name, card!.rule, card!.tap]) expect(s.length, id).toBeGreaterThan(0);
      expect(typeof (t.map.jars as Record<string, string>)[id], id).toBe('string');
      expect((t.jarStates as Record<string, unknown>)[id], id).toBeDefined();
    }
  });
  it('level 141 introduces the sieve alone; LevelSpec.mechanics stays empty', () => {
    const spec = levelSpec(141, cfg);
    expect(spec.mechanics).toEqual([]);
    expect(specMechanics(spec)).toEqual(['sieve']);
  });
  it('intro cards come classic first, then the hourglass, then the sieve', () => {
    expect(specMechanics({ mechanics: ['frozen'], hourglass: true, sieve: true })).toEqual(['frozen', 'hourglass', 'sieve']);
    expect(specMechanics({ mechanics: ['narrow'], sieve: true })).toEqual(['narrow', 'sieve']);
  });
  it('the map shows its debut badge on level 141', () => {
    expect(specialsOf(141, cfg).debut).toBe('sieve');
  });
  it('the Jar guide order is the config order, the hourglass and the sieve before the clam', () => {
    expect(ids.slice(-4, -2)).toEqual(['hourglass', 'sieve']);
  });
  it('stays out of the daily rotation and the "all four special jars" count until W1', () => {
    expect(ids.filter(isClassicMechanic)).toEqual(['narrow', 'frozen', 'locked', 'funnel']);
  });
});

describe('the sieve band art (style.css)', () => {
  it('draws a band in the jar colour with a mesh, hidden on other jars', () => {
    expect(css).toMatch(/\.sieve-band \{\s*display: none;/);
    expect(css).toMatch(/:is\(\.jar, \.mini-jar\)\.sieve \.sieve-band \{[^}]*background-color: var\(--band\);/);
    expect(css).toMatch(/\.sieve-mesh \{[^}]*background-image:/);
  });
  it('lets a colour pattern show on the band (the mesh keeps to a strip)', () => {
    expect(css).toMatch(/\.sieve-band\[class\*='pat-'\] \.sieve-mesh \{/);
  });
});
