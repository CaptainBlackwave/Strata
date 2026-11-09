// Story: production/sprints/sprint-9.md M3; design/gdd/level-map.md D48, D49, D51, D52 (§5: markers, window, scenery, names).
import { describe, expect, it } from 'vitest';
import config from '../../../src/config/game-config.json';
import { type MapConfig, type MapProgress, type Stone, type StoneWords, mapAvailable, mapWindow, sceneryAt, specialsOf, stoneAt, stoneName } from '../../../src/core/map';
import { type GameConfig } from '../../../src/core/levels';
import { type CollectionConfig } from '../../../src/core/collection';

const cfg = config as unknown as MapConfig & GameConfig & CollectionConfig;
const M = cfg.map;
const debutOf = (id: string) => cfg.mechanics.list.find((m) => m.id === id)!.unlockAt;

function progress(over: Partial<MapProgress> = {}): MapProgress {
  return { level: 12, best: { '3': 14, '7': 22 }, perfect: [3], ...over };
}

/** Plain test words, so the rule is checked apart from the English table. */
const WORDS: StoneWords = {
  level: (n) => `L${n}`,
  cleared: 'cleared',
  next: 'next',
  locked: 'locked',
  perfect: 'perfect',
  tall: 'tall',
  shell: 'shell',
  newJar: (id) => `jar ${id}`,
};

describe('map config (D52)', () => {
  it('holds the tuning: about 6 stones a screen, 20 ahead, a band every 20 levels, a scenery list', () => {
    expect(M.stonesPerScreen).toBeGreaterThanOrEqual(5);
    expect(M.stonesPerScreen).toBeLessThanOrEqual(7);
    expect(M.lookahead).toBe(20);
    expect(M.bandSize).toBe(20);
    expect(M.scenery.length).toBeGreaterThanOrEqual(5);
    expect(new Set(M.scenery).size).toBe(M.scenery.length);
    expect(M.maxStones).toBeGreaterThan(M.lookahead);
  });
});

describe('when the map shows (D51, §3)', () => {
  it('a player still in the tutorial, or on level 1, plays directly; the map appears from level 2', () => {
    expect(mapAvailable({ level: 1, tutorialDone: false })).toBe(false);
    expect(mapAvailable({ level: 1, tutorialDone: true })).toBe(false);
    expect(mapAvailable({ level: 2, tutorialDone: true })).toBe(true);
    expect(mapAvailable({ level: 500, tutorialDone: true })).toBe(true);
  });
});

describe('visible window (D49)', () => {
  it('shows every cleared level, the next, and the next 20 locked', () => {
    expect(mapWindow(3, cfg)).toEqual({ first: 1, last: 3 + M.lookahead });
    expect(mapWindow(201, cfg)).toEqual({ first: 1, last: 201 + M.lookahead });
  });
  it('past maxStones it keeps only the latest stones, so the track stays inside browser size limits', () => {
    const w = mapWindow(1_000_000, cfg);
    expect(w.last).toBe(1_000_000 + M.lookahead);
    expect(w.last - w.first + 1).toBe(M.maxStones);
  });
});

describe('marker state (D49)', () => {
  it('cleared below the save level, next at it, locked above it', () => {
    expect(stoneAt(3, progress(), cfg).state).toBe('cleared');
    expect(stoneAt(12, progress(), cfg).state).toBe('next');
    expect(stoneAt(13, progress(), cfg).state).toBe('locked');
  });
  it('a cleared stone carries its best pours and its Perfect mark', () => {
    expect(stoneAt(3, progress(), cfg)).toMatchObject({ perfect: true, best: 14 });
    expect(stoneAt(7, progress(), cfg)).toMatchObject({ perfect: false, best: 22 });
    expect(stoneAt(8, progress(), cfg)).toMatchObject({ perfect: false, best: undefined });
  });
  it('a Perfect listed for a level not yet cleared shows no mark', () => {
    expect(stoneAt(15, progress({ perfect: [15] }), cfg).perfect).toBe(false);
  });
});

describe('specials (D49: tall jars, shell milestones, new-jar debuts)', () => {
  it('tall jars on challenge levels, a shell every milestone, both together where they meet', () => {
    expect(specialsOf(cfg.challenge.every, cfg)).toEqual({ tall: true, shell: true, debut: null });
    expect(specialsOf(cfg.collection.everyLevels, cfg)).toEqual({ tall: false, shell: true, debut: null });
    expect(specialsOf(7, cfg)).toEqual({ tall: false, shell: false, debut: null });
  });
  it('a mechanic debut names its jar, from the config schedule', () => {
    // The hourglass (D96) included: level 101's stone shows "New jar: hourglass" (sprint 13 M1).
    // The sieve (D96, sprint 13 M2) has no card yet, so its debut stone shows no badge until its UI lands.
    for (const m of cfg.mechanics.list) expect(specialsOf(m.unlockAt, cfg).debut).toBe(m.id === 'sieve' ? null : m.id);
    expect(specialsOf(101, cfg).debut).toBe('hourglass');
    expect(specialsOf(debutOf('frozen') + 1, cfg).debut).toBeNull();
  });
  it('locked stones show their specials too (what is coming)', () => {
    const s = stoneAt(debutOf('frozen'), progress({ level: 30 }), cfg);
    expect(s.state).toBe('locked');
    expect(s.specials.debut).toBe('frozen');
  });
});

describe('scenery bands (D48, D52)', () => {
  it('changes every bandSize levels and cycles through the config list', () => {
    const n = M.scenery.length;
    expect(sceneryAt(1, cfg)).toEqual({ band: 0, id: M.scenery[0], first: 1, last: M.bandSize });
    expect(sceneryAt(M.bandSize, cfg).band).toBe(0);
    expect(sceneryAt(M.bandSize + 1, cfg)).toEqual({ band: 1, id: M.scenery[1], first: M.bandSize + 1, last: 2 * M.bandSize });
    expect(sceneryAt(n * M.bandSize + 1, cfg).id).toBe(M.scenery[0]); // cycles
    expect(sceneryAt(501, cfg).band).toBe(Math.floor(500 / M.bandSize));
  });
});

describe('screen-reader name (§5: "Level 41, cleared, perfect, new jar: frozen")', () => {
  const stone = (over: Partial<Stone>): Stone => ({ level: 41, state: 'cleared', perfect: false, best: 30, specials: { tall: false, shell: false, debut: null }, ...over });
  it('reads level, state, Perfect, then each special', () => {
    expect(stoneName(stone({ perfect: true, specials: { tall: false, shell: false, debut: 'frozen' } }), WORDS)).toBe('L41, cleared, perfect, jar frozen');
    expect(stoneName(stone({ level: 10, state: 'next', specials: { tall: true, shell: true, debut: null } }), WORDS)).toBe('L10, next, tall, shell');
    expect(stoneName(stone({ level: 50, state: 'locked' }), WORDS)).toBe('L50, locked');
  });
  it('builds the example sentence from the real stone rules', () => {
    const s = stoneAt(debutOf('frozen'), progress({ level: 60, perfect: [debutOf('frozen')] }), cfg);
    expect(stoneName(s, { ...WORDS, level: (n) => `Level ${n}`, newJar: (id) => `new jar: ${id}` })).toBe('Level 41, cleared, perfect, new jar: frozen');
  });
});
