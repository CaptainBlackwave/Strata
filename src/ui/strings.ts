/**
 * Every user-facing string, in one table, per .claude/rules/ui-code.md (no
 * hardcoded UI text). Only English ships for now. Add a locale by adding a table.
 */

const en = {
  level: (n: number) => `Level ${n}`,
  challenge: 'Tall jars',
  pours: 'pours',
  undo: 'Undo',
  restart: 'Restart',
  jar: 'Jar',
  hint: 'Hint',
  patterns: 'Patterns',
  patternsTitle: 'Show a symbol on each colour (colour-blind aid)',
  winTitle: 'Level cleared',
  winText: (moves: number, best: number | undefined) =>
    best !== undefined && best < moves ? `${moves} pours · best ${best}` : `${moves} pours${best === undefined || best === moves ? ' · new best' : ''}`,
  next: 'Next level',
  stuck: 'No pours left. Undo, restart or add a jar.',
  noHint: 'No way forward from here. Try undo or restart.',
  noJars: 'No spare jars left this level.',
  jarLabel: (i: number, contents: string) => `Jar ${i + 1}: ${contents}`,
  jarEmpty: 'empty',
  buried: 'buried',
  sealed: 'sealed',
  boardLabel: 'Sand jars',
} as const;

/** The active string table. */
export const t = en;
