// Story: bug sweep, strata-dwd. On a narrow win card at large text, the milestone Share ran off
// the card: the row did not wrap and its text could not shrink. The layout is checked in the
// browser (production/qa/evidence/bugfix/strata-dwd/); this keeps the rules from being dropped.
import { describe, expect, it } from 'vitest';
// The project has no Node type definitions, and vitest empties CSS imports, so read the file directly.
// @ts-expect-error node:fs types are not installed
import { readFileSync } from 'node:fs';

const css = (readFileSync as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
/** The declarations of the first rule whose selector is exactly `selector`. */
function rule(selector: string): string {
  const i = css.indexOf(`${selector} {`);
  return i < 0 ? '' : css.slice(i, css.indexOf('}', i));
}

describe('win card rows with a Share (strata-dwd)', () => {
  it('wrap, so the button can drop under the text', () => {
    expect(rule('.win-shell:has(.moment-share)')).toMatch(/flex-wrap:\s*wrap/);
  });
  it('let the text shrink instead of pushing the button out', () => {
    const text = rule('.win-shell:has(.moment-share) > span:not(.win-shell-art)');
    expect(text).toMatch(/min-width:\s*0/);
    expect(text).toMatch(/flex:\s*1 1/);
  });
  it('keep the button its full size and pushed to the end of its line', () => {
    const btn = rule('.win-shell .moment-share');
    expect(btn).toMatch(/flex:\s*none/);
    expect(btn).toMatch(/margin-left:\s*auto/);
  });
});
