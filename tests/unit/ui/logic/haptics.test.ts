// Story: production/sprints/sprint-21.md A4 (D179): a light haptic on pour, seal and win where the
// phone supports it, a Settings switch on by default, off under reduced motion. Patterns are config.
import { describe, expect, it } from 'vitest';
import { type HapticGate, type HapticsConfig, hapticFor, hapticsOn, hapticsSwitch, patternOf } from '../../../../src/ui/logic/haptics';
import gameConfig from '../../../../src/config/game-config.json';
import { HAPTICS } from '../../../../src/ui/sfx';

const CFG = (gameConfig as unknown as { haptics: HapticsConfig }).haptics;
const ON: HapticGate = { enabled: true, reducedMotion: false, supported: true };

describe('hapticFor: which event buzzes which pattern', () => {
  it('a pour is felt on its land, a seal as a double tap, a win as a triple', () => {
    expect(hapticFor('pour', CFG, ON)).toBeNull(); // the land that follows at once carries it
    expect(hapticFor('land', CFG, ON)).toBe(8);
    expect(hapticFor('seal', CFG, ON)).toEqual([12, 40, 24]);
    expect(hapticFor('win', CFG, ON)).toEqual([16, 50, 16, 50, 36]);
  });
  it('is off when the switch is off, under reduced motion, and where the browser cannot vibrate', () => {
    for (const gate of [{ ...ON, enabled: false }, { ...ON, reducedMotion: true }, { ...ON, supported: false }]) {
      expect(hapticsOn(gate)).toBe(false);
      for (const e of ['land', 'seal', 'win']) expect(hapticFor(e, CFG, gate)).toBeNull();
    }
  });
  it('an unknown event has none', () => {
    expect(hapticFor('fireworks', CFG, ON)).toBeNull();
  });
  it('the audio engine uses the config table, event for event', () => {
    for (const [e, p] of Object.entries(HAPTICS)) expect(p, e).toEqual(patternOf(CFG.patterns[e], CFG));
  });
});

describe('patternOf keeps config patterns short and soft', () => {
  const lim = { maxPulseMs: 40, maxSteps: 5 };
  it('cuts long pulses but not gaps, and drops extra steps', () => {
    expect(patternOf(90, lim)).toBe(40);
    expect(patternOf([50, 80, 10, 20, 30, 40, 50], lim)).toEqual([40, 80, 10, 20, 30]);
  });
  it('anything else is none', () => {
    for (const v of [null, 0, -5, 2.5, 'buzz', [], [10, 'x'], [10, -1], {}]) expect(patternOf(v, lim)).toBeNull();
  });
});

describe('hapticsSwitch: the Vibration row in Settings', () => {
  it('is on by default for a new player', async () => {
    const { freshSave } = await import('../../../../src/ui/storage');
    expect(freshSave(gameConfig as unknown as Parameters<typeof freshSave>[0]).settings.haptics).toBe(true);
  });
  it('shows the saved choice where the phone can vibrate', () => {
    expect(hapticsSwitch(ON)).toEqual({ shown: true, disabled: false, checked: true });
    expect(hapticsSwitch({ ...ON, enabled: false })).toEqual({ shown: true, disabled: false, checked: false });
  });
  it('shows off and disabled under reduced motion, keeping the saved choice for later', () => {
    expect(hapticsSwitch({ ...ON, reducedMotion: true })).toEqual({ shown: true, disabled: true, checked: false });
  });
  it('is hidden where the browser cannot vibrate (iPhone)', () => {
    expect(hapticsSwitch({ ...ON, supported: false }).shown).toBe(false);
  });
});
