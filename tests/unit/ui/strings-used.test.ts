// Story: production/sprints/sprint-8.md P7; docs/tech-debt.md TD-10 (unused strings)
import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import { t } from '../../../src/ui/strings';

/** Every UI source except the string table itself, read as text at build time (no file I/O). */
const sources = import.meta.glob(['../../../src/ui/*.ts', '!../../../src/ui/strings.ts'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const code = Object.values(sources).join('\n');

/** A key is used as `t.key` in the code, or by a `data-s`, `data-s-title` or `data-s-label` attribute in index.html (a nested `group.key` counts for `group`). */
function isUsed(key: string): boolean {
  return new RegExp(`\\bt\\.${key}\\b`).test(code) || new RegExp(`data-s(?:-title|-label)?="${key}(?:\\.[^"]*)?"`).test(html);
}

describe('strings.ts (TD-10)', () => {
  it('has no top-level string that nothing shows', () => {
    expect(Object.keys(t).filter((key) => !isUsed(key))).toEqual([]);
  });
  it('no longer carries the "one extra jar per level" message that D5 made untrue', () => {
    expect(JSON.stringify(Object.keys(t))).not.toContain('noJars');
  });
});
