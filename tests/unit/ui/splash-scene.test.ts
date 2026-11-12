// Story: production/sprints/sprint-22.md (L2, D182): the splash follows the saved scene.
// index.html's <head> script carries a copy of each scene's background tokens and the clock hours; this
// runs it against fake saves and hours and checks it picks what core/themes.ts activeTheme picks, in
// that scene's real colours (game-config.json themes.list[].tokens).
import { describe, expect, it } from 'vitest';
import html from '../../../index.html?raw';
import rawConfig from '../../../src/config/game-config.json';
import { type ThemeConfig, type ThemeState, activeTheme, themeById } from '../../../src/core/themes';

const config = rawConfig as unknown as ThemeConfig;
const source = /<script>(try\{[\s\S]*?strata\.save\.v2[\s\S]*?)<\/script>/.exec(html)?.[1] ?? '';

/** Runs the splash script with `save` stored at `hour`; the colours it set (empty for daylight) and the theme-color. */
function run(save: unknown, hour: number) {
  const vars: Record<string, string> = {};
  let themeColor = '#f6ecd9';
  const document = {
    documentElement: { style: { setProperty: (k: string, v: string) => (vars[k] = v) } },
    querySelector: () => ({ setAttribute: (_: string, v: string) => (themeColor = v) }),
  };
  const localStorage = { getItem: (k: string) => (k === 'strata.save.v2' && save !== undefined ? JSON.stringify(save) : null) };
  class FakeDate { getHours() { return hour; } }
  new Function('localStorage', 'document', 'Date', source)(localStorage, document, FakeDate);
  return { vars, themeColor };
}

/** What the splash should show for this scene. */
function expected(id: string) {
  const k = themeById(config, id).tokens;
  if (id === config.themes.default) return { vars: {}, themeColor: '#f6ecd9' };
  return { vars: { '--splash-0': k.bgTop, '--splash-1': k.bgBottom, '--splash-2': k.sea, '--splash-3': k.sky }, themeColor: k.bgTop };
}

describe('the splash script (L2, D182)', () => {
  it('is in index.html, before the splash', () => {
    expect(source).not.toBe('');
    expect(html.indexOf(source)).toBeLessThan(html.indexOf('id="splash"'));
  });
  it('shows daylight with no save, a broken save or an unknown scene', () => {
    expect(run(undefined, 22)).toEqual(expected('midday'));
    expect(run({ themes: { selected: 'nowhere', owned: ['nowhere'] } }, 12)).toEqual(expected('midday'));
    const broken = { vars: {}, themeColor: '#f6ecd9' };
    const document = { documentElement: { style: { setProperty: () => undefined } }, querySelector: () => null };
    expect(() => new Function('localStorage', 'document', source)({ getItem: () => '{not json' }, document)).not.toThrow();
    expect(run({}, 3)).toEqual(broken);
  });
  it('matches every scene\'s tokens and activeTheme, chosen or on the clock', () => {
    const ids = config.themes.list.map((t) => t.id);
    for (const selected of ids) {
      for (const owned of [ids, [config.themes.default, selected], [config.themes.default]]) {
        for (const auto of [false, true]) {
          for (let hour = 0; hour < 24; hour++) {
            const themes: ThemeState = { selected, owned, auto };
            // No date: the splash leaves the holiday scenes to the app.
            expect(run({ themes }, hour), `${selected} auto=${auto} owned=${owned.length} ${hour}h`).toEqual(expected(activeTheme(themes, hour, config)));
          }
        }
      }
    }
  });
});
