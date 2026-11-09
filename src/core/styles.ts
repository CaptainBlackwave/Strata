/**
 * Jar styles: the late-game cosmetic coin sink. Unlock, buying, wearing and the save repair.
 * Pure functions only (no DOM). Styles change only how jars look, never a rule or a sand colour.
 * Implements design/gdd/jar-styles.md §3.2 (unlock, D91), §3.3 (buying and wearing, D90),
 * §3.5 (state and repair) and §4 (can buy). Sprint 12 S2.
 */
import type { Wallet } from './economy';

/** A part of the jar a style dresses. */
export type StyleSlot = 'glass' | 'cork' | 'sand';

/** Every slot, in display order. */
export const STYLE_SLOTS: readonly StyleSlot[] = ['glass', 'cork', 'sand'];

/**
 * The styles part of game-config.json. The first entry of each slot is its free default
 * (price 0); the rest are bought once with coins. Ids are saved, so they never change.
 */
export interface StylesConfig {
  readonly styles: {
    readonly unlockLevel: number;
    readonly slots: Readonly<Record<StyleSlot, readonly { readonly id: string; readonly price: number }[]>>;
  };
}

/**
 * The player's styles. `owned` holds bought pieces as `slot:id` (e.g. `glass:seaglass`);
 * defaults are never stored in it. `worn` is the piece shown in each slot.
 */
export interface StyleState {
  owned: string[];
  worn: Record<StyleSlot, string>;
}

/** The result of {@link buyStyle}. `wallet` and `state` are the same objects when `ok` is false. */
export interface StyleBuyResult {
  readonly ok: boolean;
  readonly wallet: Wallet;
  readonly state: StyleState;
}

const isSlot = (s: unknown): s is StyleSlot => typeof s === 'string' && (STYLE_SLOTS as readonly string[]).includes(s);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** The slot's default piece id (its first entry). */
function defaultOf(slot: StyleSlot, config: StylesConfig): string {
  return config.styles.slots[slot][0].id;
}

/** The slot's piece with this id, or undefined for an unknown slot or id. */
function pieceOf(slot: StyleSlot, id: string, config: StylesConfig) {
  return isSlot(slot) ? config.styles.slots[slot].find((p) => p.id === id) : undefined;
}

/**
 * A new player's styles: nothing owned, each slot's default worn. A fresh object every call.
 * Example: `defaultStyles(config).worn.glass // 'clear'`.
 */
export function defaultStyles(config: StylesConfig): StyleState {
  return { owned: [], worn: { glass: defaultOf('glass', config), cork: defaultOf('cork', config), sand: defaultOf('sand', config) } };
}

/**
 * Repairs a saved styles value field by field (§3.5). From `owned` it drops anything that is not a
 * `slot:id` string naming a priced piece of that slot (unknown, malformed, another slot's id,
 * a default, a duplicate). A worn id that is neither owned nor the slot's default falls back to the
 * default. A missing or non-object value gives {@link defaultStyles}. Never shares arrays with `v`.
 * Example: `stylesOf(raw.styles, config)`.
 */
export function stylesOf(v: unknown, config: StylesConfig): StyleState {
  const base = defaultStyles(config);
  if (!isObj(v)) return base;
  const owned: string[] = [];
  for (const entry of Array.isArray(v.owned) ? v.owned : []) {
    if (typeof entry !== 'string' || owned.includes(entry)) continue;
    const parts = entry.split(':');
    if (parts.length !== 2) continue;
    const [slot, id] = parts;
    if (!isSlot(slot) || id === defaultOf(slot, config) || !pieceOf(slot, id, config)) continue;
    owned.push(entry);
  }
  const state: StyleState = { owned, worn: base.worn };
  const worn = isObj(v.worn) ? v.worn : {};
  for (const slot of STYLE_SLOTS) {
    const id = worn[slot];
    if (typeof id === 'string' && isStyleOwned(state, slot, id, config)) state.worn[slot] = id;
  }
  return state;
}

/**
 * Whether the player may wear this piece: it is the slot's default, or `slot:id` is owned.
 * False for an unknown slot or id. Example: `isStyleOwned(save.styles, 'cork', 'rope', config)`.
 */
export function isStyleOwned(state: StyleState, slot: StyleSlot, id: string, config: StylesConfig): boolean {
  if (!pieceOf(slot, id, config)) return false;
  return id === defaultOf(slot, config) || state.owned.includes(`${slot}:${id}`);
}

/**
 * Whether styles show at all (D91): from `unlockLevel`, or earlier when the save already owns a
 * piece or wears anything beyond the defaults (an imported save code, §5).
 * Example: `stylesOpen(save.level, save.styles, config)`.
 */
export function stylesOpen(level: number, state: StyleState, config: StylesConfig): boolean {
  if (level >= config.styles.unlockLevel || state.owned.length > 0) return true;
  return STYLE_SLOTS.some((slot) => state.worn[slot] !== defaultOf(slot, config));
}

/**
 * Buys a piece with coins and wears it at once in its slot (§3.3, §4). Refuses, returning the same
 * `wallet` and `state` objects, when styles are closed, the slot or id is unknown, the piece is a
 * default or already owned, or `coins < price`. Other slots stay worn as they were.
 * Example: `buyStyle(save.wallet, save.styles, save.level, 'glass', 'seaglass', config)`.
 */
export function buyStyle(wallet: Wallet, state: StyleState, level: number, slot: StyleSlot, id: string, config: StylesConfig): StyleBuyResult {
  const piece = pieceOf(slot, id, config);
  const refused = { ok: false, wallet, state };
  if (!piece || !stylesOpen(level, state, config) || id === defaultOf(slot, config)) return refused;
  if (isStyleOwned(state, slot, id, config) || wallet.coins < piece.price) return refused;
  return {
    ok: true,
    wallet: { ...wallet, coins: wallet.coins - piece.price },
    state: { owned: [...state.owned, `${slot}:${id}`], worn: { ...state.worn, [slot]: id } },
  };
}

/**
 * Wears an owned piece or a default, changing only its slot (free). Returns the same `state` for
 * anything not owned or unknown. Example: `wearStyle(save.styles, 'sand', 'plain', config)`.
 */
export function wearStyle(state: StyleState, slot: StyleSlot, id: string, config: StylesConfig): StyleState {
  if (!isStyleOwned(state, slot, id, config)) return state;
  return { owned: [...state.owned], worn: { ...state.worn, [slot]: id } };
}
