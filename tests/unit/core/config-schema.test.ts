// Story: production/sprints/sprint-8.md (P6), TD-11 (docs/tech-debt.md): the config shape the UI code relies on.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import css from '../../../src/ui/style.css?raw';

describe('palette and colour-blind patterns (TD-11)', () => {
  const patternClasses = new Set([...css.matchAll(/^\.pat-(\d+)\b/gm)].map((m) => Number(m[1])));

  it('the palette has at least 14 colours', () => {
    expect(config.palette.length).toBeGreaterThanOrEqual(14);
  });

  it('every palette colour has its own .pat-N class in style.css', () => {
    for (let i = 0; i < config.palette.length; i++) expect(patternClasses.has(i), `.pat-${i} missing`).toBe(true);
  });
});
