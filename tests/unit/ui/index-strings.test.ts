// Story: production/sprints/sprint-8.md (P6), TD-9 (docs/tech-debt.md): index.html names its strings by key.
import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import { t } from '../../../src/ui/strings';

/** Every `data-s`, `data-s-title` and `data-s-label` attribute in index.html, with its key. */
const attrs = [...html.matchAll(/\bdata-s(?:-(title|label))?="([^"]*)"/g)].map((m) => ({ kind: m[1] ?? 'text', key: m[2] }));

/** The string at `key` (`a.b` for a nested group), or undefined. */
function lookup(key: string): unknown {
  return key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], t);
}

describe('data-s attributes in index.html (TD-9)', () => {
  it('finds the attributes (the parse is not empty)', () => {
    expect(attrs.length).toBeGreaterThan(40);
    expect(new Set(attrs.map((a) => a.kind))).toEqual(new Set(['text', 'title', 'label']));
  });

  it('every key names a string in strings.ts', () => {
    for (const { kind, key } of attrs) expect(typeof lookup(key), `data-s (${kind}) key "${key}"`).toBe('string');
  });
});
