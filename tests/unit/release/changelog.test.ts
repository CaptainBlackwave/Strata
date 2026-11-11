// The Release workflow (tools/release/release.sh) refuses to tag a version with no changelog
// section, and 0.15.0 shipped untagged because of it. This catches that before the merge.
import { describe, expect, it } from 'vitest';
// @ts-expect-error node:fs types are not installed
import { readFileSync } from 'node:fs';
import pkg from '../../../package.json';

const read = readFileSync as (path: URL, enc: string) => string;
const changelog = read(new URL('../../../production/releases/CHANGELOG.md', import.meta.url), 'utf8');

describe('changelog', () => {
  it("has a section for package.json's version, so the release can be tagged", () => {
    const escaped = pkg.version.replace(/\./g, '\\.');
    expect(changelog).toMatch(new RegExp(`^## ${escaped} \\(`, 'm'));
  });
});
