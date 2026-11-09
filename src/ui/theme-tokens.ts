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
}

/** CSS custom property for each UI token. */
export const UI_TOKEN_VARS: Readonly<Record<keyof UiThemeTokens, string>> = {
  accentText: '--accent-text',
  coralText: '--coral-text',
  focus: '--focus',
  glow: '--glow',
  glowCore: '--glow-core',
};
