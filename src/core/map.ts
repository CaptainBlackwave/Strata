/**
 * The level map's pure rules (design/gdd/level-map.md D48, D49, D51, D52): when the map shows,
 * which stones it shows, each stone's state and specials, the scenery band, and the stone's
 * screen-reader name. DOM-free: `src/ui/screens/map.ts` draws what these return.
 */
import { type CollectionConfig, milestoneDue } from './collection';
import { type GameConfig, type MechanicId, hasMechanicCard, levelSpec } from './levels';

/** The `map` block of game-config.json. */
export interface MapConfig {
  readonly map: {
    /** Stones a phone screen shows at once (about 6, D52). Large text lowers it: stones never overlap. */
    readonly stonesPerScreen: number;
    /** Locked levels shown ahead of the next one (D49). */
    readonly lookahead: number;
    /** Levels per scenery band (D48, D52). */
    readonly bandSize: number;
    /** Most stones on the track, so its height stays inside browser element limits. */
    readonly maxStones: number;
    /** Scenery ids in band order, cycling. Each needs a name in strings.ts and art in the map screen. */
    readonly scenery: readonly string[];
  };
}

/** Where a stone stands relative to the player's progress. */
export type StoneState = 'cleared' | 'next' | 'locked';

/** What is special about a level, from its spec (nothing new is stored, §2.2). */
export interface StoneSpecials {
  /** A tall-jar (challenge) level. */
  readonly tall: boolean;
  /** Clearing it first earns a shell (milestone). */
  readonly shell: boolean;
  /** The jar mechanic that debuts here, if any. */
  readonly debut: MechanicId | null;
}

/** One stone on the path. */
export interface Stone {
  readonly level: number;
  readonly state: StoneState;
  /** Cleared without boosters at least once (counted from the M3 update on). */
  readonly perfect: boolean;
  /** Fewest pours, if recorded. */
  readonly best: number | undefined;
  readonly specials: StoneSpecials;
}

/** The slice of the save the map reads. `SaveData` satisfies it structurally. */
export interface MapProgress {
  /** The next level to play (1-based). */
  readonly level: number;
  readonly best: Readonly<Record<string, number>>;
  /** Levels cleared Perfect, sorted. */
  readonly perfect: readonly number[];
}

/** The words a stone's name is built from; the UI passes them in from strings.ts. */
export interface StoneWords {
  readonly level: (n: number) => string;
  readonly cleared: string;
  readonly next: string;
  readonly locked: string;
  readonly perfect: string;
  readonly tall: string;
  readonly shell: string;
  readonly newJar: (id: MechanicId) => string;
}

/** A scenery band: its index, scenery id and level range. */
export interface SceneryBand {
  readonly band: number;
  readonly id: string;
  readonly first: number;
  readonly last: number;
}

/**
 * Whether Home's Play opens the map (D51): only after the tutorial and from level 2, so a new
 * player's first taps go straight to the tutorial and then level 1, as before (§3).
 */
export function mapAvailable(p: { readonly level: number; readonly tutorialDone: boolean }): boolean {
  return p.tutorialDone && p.level >= 2;
}

/**
 * The levels on the track: every cleared level, the next and `lookahead` locked ones (D49).
 * Example: `mapWindow(3, config) // { first: 1, last: 23 }`.
 */
export function mapWindow(nextLevel: number, config: MapConfig): { first: number; last: number } {
  const last = nextLevel + config.map.lookahead;
  return { first: Math.max(1, last - config.map.maxStones + 1), last };
}

/** The specials of `level` (D49): tall jars, a shell milestone, a mechanic debut. */
export function specialsOf(level: number, config: GameConfig & CollectionConfig): StoneSpecials {
  const debut = config.mechanics.list.find((m) => m.unlockAt === level)?.id;
  return {
    tall: levelSpec(level, config).challenge,
    shell: milestoneDue(level, config),
    // Card mechanics only: the sieve (D96) gets its badge with its card (sprint 13 M2 UI task).
    debut: debut !== undefined && hasMechanicCard(debut) ? debut : null,
  };
}

/** The stone for `level` given the player's progress. */
export function stoneAt(level: number, p: MapProgress, config: GameConfig & CollectionConfig): Stone {
  const state: StoneState = level < p.level ? 'cleared' : level === p.level ? 'next' : 'locked';
  return {
    level,
    state,
    perfect: state === 'cleared' && p.perfect.includes(level),
    best: state === 'cleared' ? p.best[String(level)] : undefined,
    specials: specialsOf(level, config),
  };
}

/** The scenery band `level` sits in (D48): a new one every `bandSize` levels, cycling through the list. */
export function sceneryAt(level: number, config: MapConfig): SceneryBand {
  const { bandSize, scenery } = config.map;
  const band = Math.floor((level - 1) / bandSize);
  return { band, id: scenery[band % scenery.length], first: band * bandSize + 1, last: (band + 1) * bandSize };
}

/**
 * The stone's accessible name: level, state, Perfect, then each special.
 * Example (English words): "Level 41, cleared, perfect, new jar: frozen".
 */
export function stoneName(stone: Stone, words: StoneWords): string {
  const parts = [words.level(stone.level), words[stone.state]];
  if (stone.perfect) parts.push(words.perfect);
  if (stone.specials.tall) parts.push(words.tall);
  if (stone.specials.shell) parts.push(words.shell);
  if (stone.specials.debut) parts.push(words.newJar(stone.specials.debut));
  return parts.join(', ');
}
