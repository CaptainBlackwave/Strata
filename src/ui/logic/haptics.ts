/**
 * The haptic plan (sprint 21 A4, D179; sprint 10 F4, D64): which game event buzzes which short
 * pattern, and when nothing buzzes at all. DOM-free, so it is unit-tested without a browser; the
 * audio engine (audio.ts) reads the browser and calls it. Patterns are data in game-config.json
 * (`haptics.patterns`): a pour's touch rides on its `land`, a seal is a double tap, a win a triple.
 */

/** A vibration pattern in milliseconds (navigator.vibrate), or `null` for an explicit none. */
export type Haptic = number | number[] | null;

/** Tuning for the haptics: `haptics` in game-config.json. */
export interface HapticsConfig {
  /** The pattern for each sound event, or null for none. */
  readonly patterns: Readonly<Record<string, Haptic>>;
  /** The longest single pulse allowed, in ms: longer ones are cut to it (soft, never a buzz). */
  readonly maxPulseMs: number;
  /** The most numbers a pattern may hold (pulses and gaps); the rest are dropped. */
  readonly maxSteps: number;
}

/** What decides whether a haptic plays at all. */
export interface HapticGate {
  /** The player's Settings switch, "Vibration" (on by default). */
  readonly enabled: boolean;
  /** `prefers-reduced-motion: reduce`: haptics stay off, like the motion they accompany (A4). */
  readonly reducedMotion: boolean;
  /** The browser has navigator.vibrate (no iPhone browser does). */
  readonly supported: boolean;
}

/** Whether any haptic can play: supported, switched on and no reduced motion. Example: `hapticsOn({ enabled: true, reducedMotion: false, supported: true }) // true`. */
export function hapticsOn(g: HapticGate): boolean {
  return g.supported && g.enabled && !g.reducedMotion;
}

/**
 * One config value as a safe pattern: whole, positive milliseconds; pulses (even places) cut to
 * `maxPulseMs`; at most `maxSteps` numbers. Anything else is none. Example: `patternOf([12, 40, 99], cfg) // [12, 40, 40]` with `maxPulseMs: 40`.
 */
export function patternOf(v: unknown, cfg: Pick<HapticsConfig, 'maxPulseMs' | 'maxSteps'>): Haptic {
  const ok = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0;
  if (ok(v)) return Math.min(v, cfg.maxPulseMs);
  if (!Array.isArray(v) || v.length === 0 || !v.every(ok)) return null;
  return v.slice(0, cfg.maxSteps).map((ms, i) => (i % 2 === 0 ? Math.min(ms, cfg.maxPulseMs) : ms));
}

/**
 * The pattern `event` plays now, or null for none: off when the gate is closed, else the event's
 * safe pattern from the config. Example: `hapticFor('seal', cfg, gate) // [12, 40, 24]`.
 */
export function hapticFor(event: string, cfg: HapticsConfig, gate: HapticGate): Haptic {
  if (!hapticsOn(gate)) return null;
  return patternOf(cfg.patterns[event], cfg);
}

/**
 * What the Settings switch shows (A4): hidden where the browser cannot vibrate; disabled with a
 * note under reduced motion; else a normal switch showing the saved choice.
 */
export function hapticsSwitch(g: HapticGate): { readonly shown: boolean; readonly disabled: boolean; readonly checked: boolean } {
  if (!g.supported) return { shown: false, disabled: true, checked: false };
  if (g.reducedMotion) return { shown: true, disabled: true, checked: false };
  return { shown: true, disabled: false, checked: g.enabled };
}
