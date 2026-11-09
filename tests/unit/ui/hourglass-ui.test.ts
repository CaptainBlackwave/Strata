// Story: production/sprints/sprint-13.md M1 (hourglass jar UI, D96). Design: design/gdd/jar-mechanics.md 2.4.
// The hourglass is folded into MechanicId: every configured mechanic has its card, guide and
// screen-reader text, and a level's intro cards include the hourglass from its own flag.
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type GameConfig, type MechanicId, hasMechanicCard, isCardMechanic, isClassicMechanic, levelSpec, specMechanics } from '../../../src/core/levels';
import { t } from '../../../src/ui/strings';

const cfg = config as unknown as GameConfig;
// Card mechanics: the sieve (sprint 13 M2) gets its card, strings and art with its UI task.
const ids = cfg.mechanics.list.map((m) => m.id).filter(hasMechanicCard);

describe('hourglass strings (D96)', () => {
  it('every configured mechanic, the hourglass included, has a card, a map name and a jar state', () => {
    expect(ids).toContain('hourglass');
    for (const id of ids) {
      const card = t.mechanics[id];
      expect(card, id).toBeDefined();
      for (const s of [card.name, card.rule, card.tap]) expect(s.length, id).toBeGreaterThan(0);
      expect(typeof t.map.jars[id], id).toBe('string');
      expect(t.jarStates[id], id).toBeDefined();
    }
  });
  it('the card names the hourglass and says what it does', () => {
    expect(t.mechanics.hourglass.name).toBe('Hourglass jar');
    expect(t.mechanics.hourglass.rule).toMatch(/^Every third pour on the board, the hourglass flips: its sand turns upside down\./);
  });
  it('the screen reader hears the pours left until the flip', () => {
    expect(t.jarStates.hourglass(3)).toBe('hourglass, flips in 3 pours');
    expect(t.jarStates.hourglass(2)).toBe('hourglass, flips in 2 pours');
    expect(t.jarStates.hourglass(1)).toBe('hourglass, flips after the next pour');
  });
  it('a flip is announced with its jar number', () => {
    expect(t.flipAnnounce(4)).toBe('The hourglass flipped (jar 4).');
  });
});

describe('specMechanics: the intro cards of a level', () => {
  it('level 101 is the hourglass debut: its card shows, and LevelSpec.mechanics stays empty', () => {
    const spec = levelSpec(101, cfg);
    expect(spec.mechanics).toEqual([]);
    expect(spec.hourglass).toBe(true);
    expect(specMechanics(spec)).toEqual(['hourglass']);
  });
  it('the classic mechanics come first, then the hourglass', () => {
    expect(specMechanics({ mechanics: ['frozen'], hourglass: true })).toEqual(['frozen', 'hourglass']);
    expect(specMechanics({ mechanics: ['narrow', 'funnel'] })).toEqual(['narrow', 'funnel']);
    expect(specMechanics({ mechanics: [], hourglass: false })).toEqual([]);
  });
  it('earlier debut levels are unchanged', () => {
    for (const m of cfg.mechanics.list.filter((x) => x.id !== 'hourglass' && x.id !== 'sieve')) expect(specMechanics(levelSpec(m.unlockAt, cfg)), m.id).toEqual([m.id]);
  });
});

describe('classic mechanics (daily rotation, "all four special jars")', () => {
  it('are the four original mechanics, not the hourglass', () => {
    expect(ids.filter(isClassicMechanic)).toEqual(['narrow', 'frozen', 'locked', 'funnel']);
    expect(isClassicMechanic('hourglass' as MechanicId)).toBe(false);
  });
  it('keeps the sprint 13 core name as an alias', () => {
    expect(isCardMechanic).toBe(isClassicMechanic);
  });
});
