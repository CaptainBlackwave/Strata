/**
 * Scene colour tokens the UI adds on top of core's ThemeTokens (sprint 6 F4: AX-6, AX-7,
 * AX-8, AX-9, AX-10, UX-all-5). Each scene in `game-config.json` → `themes.list[].tokens`
 * sets them; `tests/unit/core/themes.test.ts` checks their contrast in every scene.
 * They are optional here so an older config still loads (style.css has midday defaults).
 */
export interface UiThemeTokens {
  /** Accent-coloured text, and the fill behind small accent-ink labels: ≥ 4.5:1 on card and surface-2. */
  readonly accentText?: string;
  /** Warm red text: the name error and the daily streak line. ≥ 4.5:1 on card and surface-2. */
  readonly coralText?: string;
  /** Keyboard focus ring: ≥ 3:1 on card, surface-2 and both background stops. */
  readonly focus?: string;
  /** The seal shimmer's and win glow's halo, as `r, g, b` (D73): a calm light tint in the scene's hue. */
  readonly glow?: string;
  /** The bright centre of that glow and the colour of its sand motes, as `r, g, b` (D73). */
  readonly glowCore?: string;
  /**
   * Sprint 25 U1: the colour every elevation shadow, scrim and ground shadow is tinted with.
   * Optional: style.css derives it (the scene's ink by day, a near-black of the sky by night).
   */
  readonly shadow?: string;
}

/** CSS custom property for each UI token. */
export const UI_TOKEN_VARS: Readonly<Record<keyof UiThemeTokens, string>> = {
  accentText: '--accent-text',
  coralText: '--coral-text',
  focus: '--focus',
  glow: '--glow',
  glowCore: '--glow-core',
  shadow: '--shadow-c',
};

/** Whether a scene's surfaces are light or dark: style.css keys `:root[data-scheme='dark']` on it. */
export type SceneScheme = 'light' | 'dark';

/**
 * Sprint 25 U1: a scene is dark when its card colour is dark (relative luminance under 0.4),
 * so every night scene gets the night lip, shadow and band tokens without a hand-kept list of
 * scene ids. Takes `#rgb` or `#rrggbb`; anything else counts as light.
 */
export function sceneScheme(card: string): SceneScheme {
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(card.trim())?.[1];
  if (!hex) return 'light';
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(full.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4 ? 'dark' : 'light';
}
