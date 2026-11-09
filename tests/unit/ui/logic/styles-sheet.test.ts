// Story: sprint-12 S4 (D85, D90, D91): the Styles sheet's action button and the one-time New mark, DOM-free.
import { describe, expect, it } from 'vitest';
import config from '../../../../src/config/game-config.json';
import { type StylesConfig, defaultStyles } from '../../../../src/core/styles';
import { freshOnboarding, onboardingOf } from '../../../../src/ui/logic/onboarding';
import { styleAction, stylesNewDue } from '../../../../src/ui/logic/styles-sheet';

const cfg = config as unknown as StylesConfig;
const OPEN = cfg.styles.unlockLevel;
const seaglass = cfg.styles.slots.glass.find((p) => p.id === 'seaglass')!;

describe('styleAction (S4)', () => {
  it('says "wearing" for the piece worn in its slot, the default included', () => {
    expect(styleAction(defaultStyles(cfg), 0, OPEN, 'glass', 'clear', cfg)).toBe('wearing');
  });
  it('says "wear" for an owned piece or a default not worn', () => {
    const s = { owned: ['glass:seaglass'], worn: { ...defaultStyles(cfg).worn } };
    expect(styleAction(s, 0, OPEN, 'glass', 'seaglass', cfg)).toBe('wear');
    const wearing = { owned: ['glass:seaglass'], worn: { ...s.worn, glass: 'seaglass' } };
    expect(styleAction(wearing, 0, OPEN, 'glass', 'clear', cfg)).toBe('wear');
  });
  it('says "buy" when affordable and "need" when not', () => {
    expect(styleAction(defaultStyles(cfg), seaglass.price, OPEN, 'glass', 'seaglass', cfg)).toBe('buy');
    expect(styleAction(defaultStyles(cfg), seaglass.price - 1, OPEN, 'glass', 'seaglass', cfg)).toBe('need');
  });
  it('says "closed" for a piece not owned while the shop is closed, and for unknown pieces', () => {
    expect(styleAction(defaultStyles(cfg), 99_999, OPEN - 1, 'glass', 'seaglass', cfg)).toBe('closed');
    expect(styleAction(defaultStyles(cfg), 99_999, OPEN, 'glass', 'nope', cfg)).toBe('closed');
  });
});

describe('stylesNewDue (S4, like the Scenes mark)', () => {
  it('shows once the shop is open, until Styles is opened', () => {
    expect(stylesNewDue(freshOnboarding(), true)).toBe(true);
    expect(stylesNewDue(freshOnboarding(), false)).toBe(false);
    expect(stylesNewDue({ ...freshOnboarding(), stylesNewSeen: true }, true)).toBe(false);
  });
  it('the save repairs the flag', () => {
    expect(onboardingOf({ stylesNewSeen: true }, false).stylesNewSeen).toBe(true);
    expect(onboardingOf({ stylesNewSeen: 'y' }, false).stylesNewSeen).toBe(false);
    expect(onboardingOf(undefined, true).stylesNewSeen).toBe(false);
  });
});
