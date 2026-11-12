// Issue: strata-gbw.3, .4, .5 (leftover sweep B). At 320 px with 150% text the Home gear ran off
// screen, switches squashed when their label wrapped, and the Jar styles action touched Close.
// The layout is checked in the browser (production/qa/evidence/bugfix/strata-gbw-layout/); this
// keeps the rules from being dropped.
import { describe, expect, it } from 'vitest';
// @ts-expect-error node:fs types are not installed
import { readFileSync } from 'node:fs';

const css = (readFileSync as (path: URL, enc: string) => string)(new URL('../../../src/ui/style.css', import.meta.url), 'utf8');
/** The declarations of every rule whose selector is exactly `selector`, joined. */
function rule(selector: string): string {
  let out = '';
  for (let i = css.indexOf(`\n${selector} {`); i >= 0; i = css.indexOf(`\n${selector} {`, i + 1)) out += css.slice(i, css.indexOf('}', i));
  return out;
}

describe('Home top row (strata-gbw.3)', () => {
  it('the profile chip can shrink, so the gear stays on screen', () => {
    expect(rule('.profile-chip')).toMatch(/min-width:\s*0/);
    expect(rule('.profile-chip')).toMatch(/flex:\s*0 1 auto/);
  });
  it('the gear never shrinks', () => {
    expect(rule('.home-settings')).toMatch(/flex:\s*none/);
  });
});

describe('switches (strata-gbw.4)', () => {
  it('keep their full size when the label wraps', () => {
    expect(rule('.toggle input')).toMatch(/flex:\s*none/);
  });
});

describe('Jar styles sheet (strata-gbw.5)', () => {
  // 0.15.1 strata-r20: no longer faded with opacity (unreadable); a muted surface with full ink, a lock and no shadow.
  it('a disabled buy button reads as locked but stays readable', () => {
    const r = rule('.scene-buy:disabled');
    expect(r).not.toMatch(/opacity/);
    expect(r).toMatch(/color:\s*var\(--ink\)/);
    expect(r).toMatch(/background:\s*var\(--surface-2\)/);
    expect(r).toMatch(/box-shadow:\s*none/);
    expect(r).toMatch(/cursor:\s*not-allowed/);
    expect(rule('.scene-buy:disabled::before')).toMatch(/mask:/); // the lock icon
  });
});

describe('sheet Close (strata-r20, sprint 25 U2)', () => {
  // The bottom Close buttons (strata-r20's full-width .sheet-close) became the one header X
  // (.sheet-head .sheet-x); tests/unit/ui/tokens.test.ts checks every sheet uses it.
  it('the sheet header stays in view while a long sheet scrolls, so its X is always reachable', () => {
    expect(rule('.sheet-head')).toMatch(/position:\s*sticky/);
    expect(rule('.sheet-head')).toMatch(/top:\s*0/);
  });
});
