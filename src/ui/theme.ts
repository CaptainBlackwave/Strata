/** Scene colour tokens: which scene is active, and applying it to the page. */
import { type ThemeTokens, activeTheme, localDateKey, themeById } from '../core/themes';
import { startSceneFx } from './scene-fx';
import { type UiThemeTokens, UI_TOKEN_VARS } from './theme-tokens';
import { config, state } from './state';

const TOKEN_VARS: Record<keyof ThemeTokens, string> = {
  bgTop: '--bg-top', bgBottom: '--bg-bottom', sea: '--sea', ink: '--ink', inkSoft: '--ink-soft', glass: '--glass',
  glassEdge: '--glass-edge', card: '--card', accent: '--accent', accentInk: '--accent-ink', surface: '--surface',
  surface2: '--surface-2', toastBg: '--toast-bg', toastFg: '--toast-fg', sky: '--sky', themeColor: '--theme-color',
};

export function currentTheme(): string {
  const now = new Date();
  return activeTheme(state.save.themes, now.getHours(), config, localDateKey(now), { southern: state.save.settings.southern }); // holiday scenes follow the local date (B5)
}

/** Applies a scene's colour tokens. Sand colours are never touched (decision S4-4). */
export function applyTheme(id: string): void {
  const theme = themeById(config, id);
  const root = document.documentElement.style;
  for (const [key, cssVar] of Object.entries(TOKEN_VARS)) root.setProperty(cssVar, theme.tokens[key as keyof ThemeTokens]);
  const extra = theme.tokens as ThemeTokens & UiThemeTokens;
  for (const [key, cssVar] of Object.entries(UI_TOKEN_VARS)) {
    const value = extra[key as keyof UiThemeTokens];
    if (value) root.setProperty(cssVar, value);
    else root.removeProperty(cssVar); // fall back to the style.css default
  }
  document.body.dataset.theme = theme.id;
  startSceneFx(theme.id); // the scene's animated layer, if it has one (scene-fx.ts)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme.tokens.themeColor);
}
