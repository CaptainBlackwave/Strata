/**
 * The share picture's plan (sprint 14 H2, design/gdd/sharing.md §3.1): what it says, which
 * colours it uses and which way it is sent. Pure and DOM-free, so it is unit-tested; the canvas
 * drawing is src/ui/share-card.ts. The card never shows the board or a solution.
 */
import type { ThemeTokens } from '../../core/themes';
import type { UiThemeTokens } from '../theme-tokens';

/** The share picture's settings in game-config.json (`sharing`). */
export interface SharingConfig {
  readonly sharing: {
    readonly card: { readonly width: number; readonly height: number };
    readonly jars: number;
    readonly challenge: { readonly maxPours: number; readonly maxLevel: number };
    readonly streakMilestones: readonly number[];
  };
}

/** The words on a card. `name` is the profile name, shown only when the player switches it on (D122). */
export interface CardText {
  readonly headline: string;
  readonly sub: string;
  readonly lines: readonly string[];
  readonly name: string | null;
  readonly address: string;
}

/** One small sealed jar on the card: its sand colour and, with Colour patterns on, its pattern index. */
export interface CardJar {
  readonly hex: string;
  readonly pattern: number | null;
}

/** The scene colours the card draws with. Text only ever sits on `card` (all three reach 4.5:1 there). */
export interface CardColors {
  readonly bgTop: string;
  readonly bgBottom: string;
  readonly sea: string;
  readonly card: string;
  readonly ink: string;
  readonly inkSoft: string;
  readonly accentText: string;
  readonly glass: string;
  readonly glassEdge: string;
}

/** Everything the drawing needs. */
export interface CardPlan extends CardText {
  readonly width: number;
  readonly height: number;
  readonly colors: CardColors;
  readonly jars: readonly CardJar[];
}

/** Options for {@link cardPlan}. */
export interface CardOptions {
  readonly width: number;
  readonly height: number;
  /** The Colour patterns setting. */
  readonly patterns: boolean;
  /** The "Show my name" switch on the share preview (D122); off by default. */
  readonly showName: boolean;
}

/** The accent text colour when a scene has none (style.css's Midday default). */
const DEFAULT_ACCENT_TEXT = '#1a6b61';

/**
 * Builds the card's plan from its words, the scene's colours and the jars' palette indices.
 * Example: `cardPlan(text, midday, [3, 1, 0], palette, { width: 1080, height: 1350, patterns: false, showName: false })`.
 */
export function cardPlan(text: CardText, tokens: ThemeTokens & UiThemeTokens, jarColors: readonly number[], palette: readonly { readonly hex: string }[], opts: CardOptions): CardPlan {
  const name = opts.showName && text.name && text.name.trim() ? text.name.trim() : null;
  return {
    ...text,
    name,
    width: opts.width,
    height: opts.height,
    colors: {
      bgTop: tokens.bgTop,
      bgBottom: tokens.bgBottom,
      sea: tokens.sea,
      card: tokens.card,
      ink: tokens.ink,
      inkSoft: tokens.inkSoft,
      accentText: tokens.accentText ?? DEFAULT_ACCENT_TEXT,
      glass: tokens.glass,
      glassEdge: tokens.glassEdge,
    },
    jars: jarColors.map((c) => ({ hex: palette[c].hex, pattern: opts.patterns ? c : null })),
  };
}

/**
 * The first `count` distinct colours of `colors`, filled up from palette order when there are
 * fewer, never repeating one. Example: `cardJarColors([4, 4, 2], 3, 14) // [4, 2, 0]`.
 */
export function cardJarColors(colors: readonly number[], count: number, paletteSize: number): number[] {
  const out: number[] = [];
  for (const c of colors) if (!out.includes(c) && out.length < count) out.push(c);
  for (let c = 0; out.length < Math.min(count, paletteSize); c++) if (!out.includes(c)) out.push(c);
  return out;
}

/**
 * The address printed on the card: host and path, no scheme, query, hash or trailing slash.
 * Example: `cardAddress('https://x.github.io/Strata/?daily=…') // 'x.github.io/Strata'`.
 */
export function cardAddress(href: string): string {
  const url = new URL(href);
  return `${url.host}${url.pathname}`.replace(/\/+$/, '');
}

/** How a share is sent: picture and text, text only, or copied (sharing §3.1, in that order). */
export type ShareChannel = 'files' | 'text' | 'clipboard';

/** The parts of `navigator` that decide the channel, so it can be tested without a browser. */
export interface ShareNavigator {
  readonly share?: unknown;
  readonly canShare?: (data: { files: unknown[] }) => boolean;
}

/**
 * Which channel a share can use. Example: `shareChannel(navigator, file)`; a desktop browser
 * without a share sheet gives `'clipboard'`.
 */
export function shareChannel(nav: ShareNavigator, file: unknown | null): ShareChannel {
  if (typeof nav.share !== 'function') return 'clipboard';
  if (!file || typeof nav.canShare !== 'function') return 'text';
  try {
    return nav.canShare({ files: [file] }) ? 'files' : 'text';
  } catch {
    return 'text';
  }
}
