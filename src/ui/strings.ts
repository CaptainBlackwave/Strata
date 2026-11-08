/**
 * Every user-facing string, in one table, per .claude/rules/ui-code.md (no
 * hardcoded UI text). Only English ships for now. Add a locale by adding a table.
 */

const en = {
  brand: 'Strata',
  tagline: 'Sort the sand. Seal the jars.',
  play: (n: number) => `Play · Level ${n}`,
  playTutorial: 'Play',
  level: (n: number) => `Level ${n}`,
  challenge: 'Tall jars',
  pours: 'pours',
  poursLabel: (n: number) => (n === 1 ? 'pour' : 'pours'),
  coins: 'coins',
  undo: 'Undo',
  restart: 'Restart',
  shuffle: 'Shuffle',
  jar: 'Jar',
  hint: 'Hint',
  settings: 'Settings',
  close: 'Close',
  sound: 'Sound effects',
  music: 'Music',
  haptics: 'Vibration',
  patterns: 'Colour patterns',
  patternsTitle: 'Show a texture on each colour (colour-blind aid)',
  replayTutorial: 'Replay tutorial',
  home: 'Home',
  winTitle: 'Level cleared',
  perfectTitle: 'Perfect!',
  winText: (moves: number, best: number | undefined) =>
    best !== undefined && best < moves ? `${moves} pours · best ${best}` : `${moves} pours${best === undefined || best === moves ? ' · new best' : ''}`,
  perfectNote: 'No boosters used',
  next: 'Continue',
  reward: (n: number) => `+${n}`,
  tutorialLift: 'Tap a jar to lift it',
  tutorialPour: 'Now tap the other jar to pour',
  tutorialDoneTitle: 'Nice pour!',
  tutorialDoneText: 'Fill every jar with a single colour to clear a level.',
  tutorialStart: 'Start level 1',
  stuck: 'No pours left. Undo, shuffle or add a jar.',
  noHint: 'No way forward from here. Try undo or shuffle.',
  noJars: 'Only one extra jar per level.',
  noUndo: 'Nothing to undo yet.',
  noShuffle: 'Couldn’t find a better shuffle.',
  notEnoughCoins: (price: number) => `Needs ${price} coins. Clear levels to earn more.`,
  boughtWith: (price: number) => `Used ${price} coins`,
  jarLabel: (i: number, contents: string) => `Jar ${i + 1}: ${contents}`,
  jarEmpty: 'empty',
  buried: 'buried',
  sealed: 'sealed',
  boardLabel: 'Sand jars',
  boosterLabel: (name: string, charges: number, price: number) =>
    charges > 0 ? `${name}, ${charges} left` : `${name}, costs ${price} coins`,
} as const;

/** The active string table. */
export const t = en;
