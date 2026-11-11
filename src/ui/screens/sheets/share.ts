/**
 * The share preview (sprint 14 H2, design/gdd/sharing.md §3.1, D122): the picture as it will be
 * sent, a "Show my name" switch that starts off, and Share. Share sends the picture with the
 * text where the phone allows it, else the text, else copies it (`shareTo`).
 */
import { themeById } from '../../../core/themes';
import { $, closeLayer, openLayer } from '../../dom';
import type { FocusTarget } from '../../layers';
import { type CardText, cardAddress, cardJarColors, cardPlan } from '../../logic/share-card';
import { cardBlob } from '../../share-card';
import { config, state } from '../../state';
import { t } from '../../strings';
import { currentTheme } from '../../theme';
import { shareTo } from '../win';

/** What to share: the text and link (unchanged from before), the card's words and the jars' colours. */
export interface ShareRequest {
  readonly text: string;
  readonly card: Pick<CardText, 'headline' | 'sub' | 'lines'>;
  /** Palette indices of the board's sand, first ones first; the card shows up to `sharing.jars`. */
  readonly colors: readonly number[];
}

let request: ShareRequest | null = null;
let file: File | null = null;
let imageUrl: string | null = null;
/** Bumped by every render, so a slow earlier drawing can't replace a newer one. */
let renderId = 0;

const img = () => $('share-card-img') as HTMLImageElement;
const nameSwitch = () => $('share-name') as HTMLInputElement;

/** Draws the card for the current request and switch, and shows it. */
async function render(): Promise<void> {
  const id = ++renderId;
  const r = request;
  if (!r) return;
  const tokens = themeById(config, currentTheme()).tokens;
  const plan = cardPlan(
    { ...r.card, name: state.save.profile.name, address: cardAddress(location.href) },
    tokens,
    cardJarColors(r.colors, config.sharing.jars, config.palette.length),
    config.palette,
    { ...config.sharing.card, patterns: state.save.settings.patterns, showName: nameSwitch().checked },
  );
  img().alt = t.shareCard.alt(plan.headline, plan.name ? [...plan.lines, plan.name] : plan.lines);
  const blob = await cardBlob(plan);
  if (id !== renderId) return;
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = blob ? URL.createObjectURL(blob) : null;
  file = blob ? new File([blob], 'strata.png', { type: 'image/png' }) : null;
  img().hidden = !imageUrl; // no picture (no canvas): the text is still shared
  if (imageUrl) img().src = imageUrl;
}

/** Opens the preview for `r`, with the name switch off (D122). Example: `openShare(req, $('btn-share'))`. */
export function openShare(r: ShareRequest, opener: FocusTarget | null = document.activeElement as HTMLElement | null): void {
  request = r;
  file = null;
  nameSwitch().checked = false;
  $('share-sheet-status').textContent = '';
  void render();
  openLayer($('share-sheet'), $('btn-share-send'), opener);
}

/** Closes the preview and frees its picture. */
export function closeShare(): void {
  closeLayer($('share-sheet'));
  if (imageUrl) URL.revokeObjectURL(imageUrl);
  imageUrl = null;
  file = null;
  request = null;
}

/** Wires Close, the name switch and Share. */
export function wireShare(): void {
  $('btn-close-share').addEventListener('click', closeShare);
  nameSwitch().addEventListener('change', () => void render());
  $('btn-share-send').addEventListener('click', () => {
    if (request) void shareTo(request.text, $('share-sheet-status'), file);
  });
}
