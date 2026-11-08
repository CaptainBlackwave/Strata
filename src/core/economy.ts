/**
 * Coins and booster charges. Pure functions over an immutable wallet, so the UI
 * never owns economy state. Implements design/competitive-roadmap.md item C2.
 * Coins come only from play: there are no purchases, ads or lives (decisions D1-D3).
 */

/** The four in-level boosters. */
export type BoosterId = 'undo' | 'shuffle' | 'extraJar' | 'hint';

/** The economy part of game-config.json. */
export interface EconomyConfig {
  readonly economy: {
    readonly startCoins: number;
    readonly coinsPerLevel: number;
    readonly perfectBonus: number;
    readonly challengeBonus: number;
  };
  readonly boosters: Readonly<Record<BoosterId, { readonly start: number; readonly price: number }>>;
}

/** What the player owns. */
export interface Wallet {
  readonly coins: number;
  readonly boosters: Readonly<Record<BoosterId, number>>;
}

/** The result of a wallet operation. `wallet` is unchanged (same object) when `ok` is false. */
export interface WalletResult {
  readonly ok: boolean;
  readonly wallet: Wallet;
  /** Coins spent by this operation (0 when a stored charge was used). */
  readonly paidCoins: number;
}

/** A new player's wallet. Example: `newWallet(config).coins // 100` */
export function newWallet(config: EconomyConfig): Wallet {
  const b = config.boosters;
  return {
    coins: config.economy.startCoins,
    boosters: { undo: b.undo.start, shuffle: b.shuffle.start, extraJar: b.extraJar.start, hint: b.hint.start },
  };
}

/**
 * Uses one booster: a stored charge if there is one, otherwise buys it with coins.
 * Fails, changing nothing, if neither is possible.
 */
export function spendBooster(wallet: Wallet, id: BoosterId, config: EconomyConfig): WalletResult {
  if (wallet.boosters[id] > 0) {
    return { ok: true, wallet: { ...wallet, boosters: { ...wallet.boosters, [id]: wallet.boosters[id] - 1 } }, paidCoins: 0 };
  }
  const price = config.boosters[id].price;
  if (wallet.coins >= price) return { ok: true, wallet: { ...wallet, coins: wallet.coins - price }, paidCoins: price };
  return { ok: false, wallet, paidCoins: 0 };
}

/** Buys one stored charge of a booster. */
export function buyBooster(wallet: Wallet, id: BoosterId, config: EconomyConfig): WalletResult {
  const price = config.boosters[id].price;
  if (wallet.coins < price) return { ok: false, wallet, paidCoins: 0 };
  return {
    ok: true,
    wallet: { coins: wallet.coins - price, boosters: { ...wallet.boosters, [id]: wallet.boosters[id] + 1 } },
    paidCoins: price,
  };
}

/** Coins for clearing a level. `perfect` means it was cleared without any booster. */
export function levelReward(result: { readonly perfect: boolean; readonly challenge: boolean }, config: EconomyConfig): number {
  const e = config.economy;
  return e.coinsPerLevel + (result.perfect ? e.perfectBonus : 0) + (result.challenge ? e.challengeBonus : 0);
}

/** Adds coins. */
export function addCoins(wallet: Wallet, amount: number): Wallet {
  return { ...wallet, coins: wallet.coins + Math.max(0, Math.floor(amount)) };
}

/** Adds booster charges, for example a set-completion bundle. */
export function addBoosters(wallet: Wallet, bundle: Readonly<Partial<Record<BoosterId, number>>>): Wallet {
  const boosters = { ...wallet.boosters };
  for (const id of Object.keys(bundle) as BoosterId[]) boosters[id] += Math.max(0, Math.floor(bundle[id] ?? 0));
  return { ...wallet, boosters };
}

/**
 * Coins for winning a level, paid on its first clear only: replaying a level you have
 * already cleared pays nothing (design/gdd/economy.md, M1). `nextLevel` is the player's
 * saved progress (the next level to play), so a clear at or beyond it is a first clear.
 * Example: `clearReward({ level: 3, nextLevel: 7, perfect: true, challenge: false }, cfg) // 0`
 */
export function clearReward(
  result: { readonly level: number; readonly nextLevel: number; readonly perfect: boolean; readonly challenge: boolean },
  config: EconomyConfig,
): number {
  return result.level >= result.nextLevel ? levelReward(result, config) : 0;
}
