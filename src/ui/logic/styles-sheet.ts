/**
 * The Styles sheet's rules (sprint 12 S4; design/gdd/jar-styles.md §3.2–§3.3), DOM-free so they
 * are unit-tested. The sheet in src/ui/screens/sheets/styles.ts shows them.
 */
import { type StyleSlot, type StyleState, type StylesConfig, isStyleOwned, stylesOpen } from '../../core/styles';
import { type Onboarding } from './onboarding';
import { t } from '../strings';

/** What the sheet's main button does for the previewed piece. */
export type StyleAction = 'wearing' | 'wear' | 'buy' | 'need' | 'earned' | 'closed';

/**
 * The action for piece `slot:id`: `wearing` (already worn; no button), `wear` (owned or a default),
 * `buy` (affordable), `need` (not enough coins), `earned` (a streak-only or event-prize piece not granted yet: no
 * Buy, sprint 16), or `closed` (unknown, or the shop is not open yet).
 * Example: `styleAction(save.styles, save.wallet.coins, save.level, 'glass', 'seaglass', config)`.
 */
export function styleAction(state: StyleState, coins: number, level: number, slot: StyleSlot, id: string, config: StylesConfig): StyleAction {
  const piece = config.styles.slots[slot]?.find((p) => p.id === id);
  if (!piece) return 'closed';
  if (state.worn[slot] === id) return 'wearing';
  if (isStyleOwned(state, slot, id, config)) return 'wear';
  if (piece.earned !== undefined || piece.event !== undefined) return 'earned';
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

/**
 * The lock line of a piece that is never sold (sprint 16, sprint 17): "Streak reward · day 30" for a
 * streak piece, "Winter Tide prize · December" for an event prize (its first month), or '' for a piece
 * sold for coins. `events` gives each event's first day as `MM-DD`.
 * Example: `lockText('glass', 'frost', config, config.events)`.
 */
export function lockText(slot: StyleSlot, id: string, config: StylesConfig, events: readonly { readonly id: string; readonly from: string }[] = []): string {
  const piece = config.styles.slots[slot]?.find((p) => p.id === id);
  if (!piece) return '';
  if (piece.earned !== undefined) return t.track.locked(piece.earned);
  if (piece.event !== undefined) {
    const from = events.find((e) => e.id === piece.event)?.from;
    const month = from ? (t.event.months[Number(from.slice(0, 2)) - 1] ?? '') : '';
    return t.event.lockedPiece(t.event.names[piece.event] ?? piece.event, month);
  }
  return '';
}
