// Story: production/sprints/sprint-8.md (P6), TD-11 (docs/tech-debt.md): the config shape the UI code relies on.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
// The project has no Node type definitions, and vitest empties CSS imports, so read the file directly.
// @ts-expect-error node:fs types are not installed
import { readFileSync } from 'node:fs';

describe('palette and colour-blind patterns (TD-11)', () => {
  const css = (readFileSync as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
  const patternClasses = new Set([...css.matchAll(/^\.pat-(\d+)\b/gm)].map((m) => Number(m[1])));

  it('the palette has at least 14 colours', () => {
    expect(config.palette.length).toBeGreaterThanOrEqual(14);
  });

  it('every palette colour has its own .pat-N class in style.css', () => {
    for (let i = 0; i < config.palette.length; i++) expect(patternClasses.has(i), `.pat-${i} missing`).toBe(true);
  });
});
