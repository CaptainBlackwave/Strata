// Story: production/sprints/sprint-9.md M3; design/gdd/level-map.md D48, D49: every configured scenery and jar has player text.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { t } from '../../../src/ui/strings';

describe('map strings follow the config', () => {
  it('each scenery id in map.scenery has a band name in strings.ts', () => {
    for (const id of config.map.scenery) expect(typeof t.map.scenery[id], `t.map.scenery.${id}`).toBe('string');
  });
  it('each jar mechanic has a short name for the debut badge', () => {
    // The hourglass included since sprint 13 M1 (D96).
    for (const m of config.mechanics.list) expect(typeof (t.map.jars as Record<string, string>)[m.id], `t.map.jars.${m.id}`).toBe('string');
  });
  it('the win card words for replays (D50)', () => {
    expect(t.replayNote).toBe('Replay: no coins');
    expect(t.perfectEarned).toBe('Perfect earned');
    expect(t.newBest(12)).toBe('New best: 12 pours');
  });
});
