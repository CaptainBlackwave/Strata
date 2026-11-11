/**
 * The Styles sheet's rules (sprint 12 S4; design/gdd/jar-styles.md §3.2–§3.3), DOM-free so they
 * are unit-tested. The sheet in src/ui/screens/sheets/styles.ts shows them.
 */
import { type StyleSlot, type StyleState, type StylesConfig, isStyleOwned, stylesOpen } from '../../core/styles';
import { type Onboarding } from './onboarding';

/** What the sheet's main button does for the previewed piece. */
export type StyleAction = 'wearing' | 'wear' | 'buy' | 'need' | 'earned' | 'closed';

/**
 * The action for piece `slot:id`: `wearing` (already worn; no button), `wear` (owned or a default),
 * `buy` (affordable), `need` (not enough coins), `earned` (a streak-only piece not granted yet: no
 * Buy, sprint 16), or `closed` (unknown, or the shop is not open yet).
 * Example: `styleAction(save.styles, save.wallet.coins, save.level, 'glass', 'seaglass', config)`.
 */
export function styleAction(state: StyleState, coins: number, level: number, slot: StyleSlot, id: string, config: StylesConfig): StyleAction {
  const piece = config.styles.slots[slot]?.find((p) => p.id === id);
  if (!piece) return 'closed';
  if (state.worn[slot] === id) return 'wearing';
  if (isStyleOwned(state, slot, id, config)) return 'wear';
  if (piece.earned !== undefined) return 'earned';
  if (!stylesOpen(level, state, config)) return 'closed';
  return coins >= piece.price ? 'buy' : 'need';
}

/**
 * Whether the Styles button carries its one-time "New" mark: the shop is open and Styles has not
 * been opened since. Example: `stylesNewDue(save.onboarding, stylesOpen(save.level, save.styles, config))`.
 */
export function stylesNewDue(o: Onboarding, open: boolean): boolean {
  return open && !o.stylesNewSeen;
}
