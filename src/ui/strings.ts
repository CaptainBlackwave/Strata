/**
 * Every user-facing string, in one table, per .claude/rules/ui-code.md (no
 * hardcoded UI text). Only English ships for now. Add a locale by adding a table.
 */

import { version } from '../../package.json';

/**
 * The release the "What's new" card describes (D46, D52): the game's version from
 * package.json, the single source (D56). Bump package.json together with
 * `whatsNew.lines`; a save whose `seenWhatsNew` differs sees the card once on Home.
 */
export const WHATS_NEW_VERSION: string = version;

const en = {
  brand: 'Strata',
  tagline: 'Sort the sand. Seal the jars.',
  play: (n: number) => `Play · Level ${n}`,
  playTutorial: 'Play',
  level: (n: number) => `Level ${n}`,
  challenge: 'Tall jars',
  /** Shown only when a level start waits over 150 ms for background generation (P4). */
  preparingLevel: 'Getting the jars ready…',
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
  southern: 'Southern hemisphere seasons',
  replayTutorial: 'Replay tutorial',
  home: 'Home',
  winTitle: 'Level cleared',
  perfectTitle: 'Perfect!',
  winText: (moves: number, best: number | undefined) =>
    best !== undefined && best <= moves ? `${moves} pours · best ${best}` : `${moves} pours${best === undefined ? ' · new best' : ''}`,
  perfectNote: 'No hint, shuffle or extra jar used',
  /** The win card after a replay that changed nothing (level-map.md D50). */
  replayNote: 'Replay: no coins',
  /** The win card when this clear gave the level its first Perfect mark (D50, D52). */
  perfectEarned: 'Perfect earned',
  /** The win card when a replay beat the level's best pours (D50). */
  newBest: (n: number) => `New best: ${n} ${n === 1 ? 'pour' : 'pours'}`,
  next: 'Continue',
  reward: (n: number) => `+${n}`,
  daily: 'Daily puzzle',
  dailyTag: (difficulty: string) => `Daily · ${difficulty}`,
  dailyLabel: (date: string) => {
    const [y, m, d] = date.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
  },
  dailyNew: (difficulty: string) => `Today: ${difficulty}`,
  dailySolved: 'Solved today ✓',
  streakDays: (n: number) => (n === 1 ? '1-day streak' : `${n}-day streak`),
  noStreak: 'Start a streak today',
  passAtRisk: 'A tide pass will save your streak',
  passes: (n: number) => (n === 1 ? '1 tide pass' : `${n} tide passes`),
  dailyWinTitle: 'Daily solved!',
  dailyReplay: 'Already solved today: no reward this time',
  usedPass: 'A tide pass saved your streak',
  earnedPass: 'You earned a tide pass',
  share: 'Share',
  copied: 'Result copied',
  shared: 'Shared',
  shareFailed: 'Couldn\u2019t share. Try again.',
  shareText: (date: string, difficulty: string, moves: number, streak: number, url: string) =>
    `Strata Daily ${date} (${difficulty})\nSolved in ${moves} pours · ${streak}-day streak\n${url}`,
  shellCount: (n: number, total: number) => `Shells ${n}/${total}`,
  cabinetTitle: 'Shell cabinet',
  newShell: (name: string) => `New shell: ${name}`,
  setComplete: (name: string, coins: number) => `${name} set complete! +${coins} coins and 1 Shuffle, Jar and Hint`,
  /** After all 40 shells. The coin bonus was removed (D38), so 0 shows the plain message. */
  allShellsBonus: (coins: number) => (coins > 0 ? `Collection complete: +${coins} coins` : 'Collection complete ✓'),
  nextShell: (n: number, daily: boolean) =>
    `${n === 1 ? 'Next shell: clear 1 more level' : `Next shell: clear ${n} more levels`}${daily ? ', or solve today\u2019s daily' : ''}`,
  /** The cabinet's line once all shells are found: a standing rule, not a payout just made (UX-cab-3). */
  collectionDone: (coins: number) => (coins > 0 ? `Collection complete: each milestone now pays ${coins} coins` : 'Collection complete ✓'),
  setRewardNote: (coins: number) => `Complete the set: ${coins} coins + 1 Shuffle, Jar and Hint`,
  /** A shell not found yet: the mark is drawn, the label is what a screen reader says (AX-15). */
  lockedShellMark: '?',
  lockedShell: 'Not found yet',
  setDone: 'Set complete ✓',
  mechanics: {
    narrow: { name: 'Narrow jar', rule: 'Holds only 2 layers and never seals. Use it as extra space, and empty it before the end.', tap: 'Narrow jar: holds 2 layers, never seals.' },
    frozen: { name: 'Frozen jar', rule: 'Iced shut: no pouring in or out. Seal any jar and every frozen jar thaws.', tap: 'Frozen: seal any jar to thaw it.' },
    locked: { name: 'Locked lid', rule: 'Closed until a jar of the lock\u2019s colour is sealed.', tap: 'Locked: seal a jar of the lock\u2019s colour to open it.' },
    funnel: { name: 'One-way funnel', rule: 'You can pour in, but never out. Fill it with a single colour!', tap: 'Funnel: pour in only. Nothing comes out.' },
  },
  newJar: 'New jar!',
  gotIt: 'Got it',
  jarGuide: 'Jar guide',
  keysNote: 'Keys: 1–9 and 0 pick jars 1–10; hold Shift for jars 11–20. Z Undo · S Shuffle · J Jar · H Hint · R Restart.',
  /** The "What's new" card: 3-5 short plain lines, shown once per version (D52). */
  whatsNew: {
    version: WHATS_NEW_VERSION,
    title: "What's new",
    button: "What's new",
    lines: [
      'The volume sliders now match the scene you are in.',
      'Sealing a jar and clearing a level glow in each scene\'s own colours.',
      'In the night scenes that glow is cool moonlight instead of warm sand.',
    ],
  },
  unlocksAt: (n: number) => `Unlocks at level ${n}`,
  /** The level map (design/gdd/level-map.md). */
  map: {
    title: 'Beach path',
    /** Words of a stone's screen-reader name: "Level 41, cleared, perfect, new jar: frozen". */
    stone: {
      cleared: 'cleared',
      next: 'next level',
      locked: 'locked',
      perfect: 'perfect',
      tall: 'tall jars',
      shell: 'shell milestone',
      newJar: (jar: string) => `new jar: ${jar}`,
    },
    /** Short jar names for the debut badge. */
    jars: { narrow: 'narrow', frozen: 'frozen', locked: 'locked lid', funnel: 'funnel' },
    best: (n: number | undefined) => (n === undefined ? 'Best –' : `Best ${n} ${n === 1 ? 'pour' : 'pours'}`),
    perfectYes: 'Perfect ✓',
    perfectNo: 'Perfect –',
    perfectYesSr: 'Perfect: yes',
    perfectNoSr: 'Perfect: not yet',
    unlocksAfter: (n: number) => `Unlocks after level ${n}`,
    special: { tall: 'Tall jars', shell: 'Shell milestone', newJar: (jar: string) => `New jar: ${jar}` },
    replay: 'Replay',
    backToMap: 'Back to map',
    /** One name per `map.scenery` id in game-config.json (tests/unit/map/map-ui.test.ts). */
    scenery: { rockpools: 'Rock pools', dunes: 'Dunes', pier: 'The pier', lighthouse: 'Lighthouse point', cove: 'The cove' } as Record<string, string>,
  },
  thawed: 'Thawed!',
  unlocked: 'Unlocked!',
  jarStates: { narrow: 'narrow', frozen: 'frozen', locked: (c: string) => `locked until ${c} is sealed`, funnel: 'one-way funnel' },
  scenes: 'Scenes',
  sceneOwned: 'Owned',
  sceneInUse: 'In use',
  sceneUse: (name: string) => `Use ${name}`,
  sceneBuy: (name: string, price: number) => `Buy ${name} · ${price}`,
  sceneNeed: (price: number, have: number) => `Needs ${price} coins (you have ${have})`,
  scenePreviewing: (name: string) => `Previewing ${name}`,
  sceneBought: (name: string) => `${name} unlocked!`,
  matchClock: 'Match my clock',
  matchClockOff: 'Choosing a scene with Use or Buy turns this off.',
  matchClockNote: 'Dawn 5–9 · Midday 9–17 · Sunset 17–20 · Moonlit 20–5, using the scenes you own. Holiday scenes you own take over on their dates.',
  sceneInSeason: 'In season',
  sceneAnimated: 'Animated',
  dailyOutOfOrder: 'Your device date is earlier than your last solve, so this one doesn\u2019t count toward your streak.',
  saveCode: 'Save code',
  saveCodeHelp: 'Copy this code to move your progress to another device.',
  yourCode: 'Your code',
  pasteCode: 'Paste a code to restore',
  restoreHelp: 'Paste a code from your other device, then tap Restore.',
  codeEmpty: 'Paste a save code in the box first.',
  copyCode: 'Copy code',
  codeCopied: 'Copied! Paste it into Strata on your other device.',
  codeSelectManually: 'Copying is blocked here; the code is selected so you can copy it yourself.',
  restoreCode: 'Restore from code',
  restoreConfirm: 'Tap again to replace my progress',
  restartConfirm: 'Tap Restart again to start this board over',
  restartArmedLabel: 'Restart: tap again to confirm',
  leaveTitle: 'Leave this board?',
  leaveText: 'Your pours here won\u2019t be kept.',
  keepPlaying: 'Keep playing',
  leave: 'Leave',
  restoreWarning: (level: number, coins: number) => `This code is at level ${level} with ${coins} coins. Restoring replaces your progress on this device.`,
  codeInvalid: 'That isn\u2019t a Strata save code. Check you copied all of it.',
  restored: 'Progress restored',
  tutorialLift: 'Tap a jar to lift it',
  tutorialPour: 'Now tap the other jar to pour',
  tutorialDoneTitle: 'Nice pour!',
  tutorialDoneText: 'Fill every jar with a single colour to clear a level.',
  tutorialStart: 'Start level 1',
  stuck: 'No pours left. Undo, shuffle, add a jar or restart.',
  coloursDontMatch: 'Top colours don\u2019t match',
  jarFull: 'That jar is full',
  jarSealedFull: 'That jar is sealed',
  hintBudget: 'Couldn\u2019t find a hint this time. Try again, or shuffle.',
  cantWin: 'This board can\u2019t be won now: Undo or Restart.',
  hintToast: (from: number, to: number) => `Hint: pour jar ${from} into jar ${to}`,
  hintFrom: 'From',
  hintTo: 'To',
  noUndo: 'Nothing to undo yet.',
  noShuffle: 'Couldn’t find a better shuffle.',
  /** On a Hint or Shuffle button while the worker searches (TD-13). */
  thinking: 'Thinking…',
  boosterThinkingLabel: (name: string) => `${name}, thinking…`,
  notEnoughCoins: (price: number) => `Needs ${price} coins. Clear levels to earn more.`,
  boughtWith: (price: number) => `Used ${price} coins`,
  /** First tap on a booster with no charges: nothing is spent yet (UX-board-7). */
  boosterConfirm: (price: number) => `Tap again to buy for ${price} coins`,
  boosterArmedLabel: (name: string, price: number) => `${name}: tap again to buy for ${price} coins`,
  jarLabel: (i: number, contents: string) => `Jar ${i + 1}: ${contents}`,
  /** Screen-reader summary of a pour (UX-board-5). `jar` is 1-based. */
  pourAnnounce: (n: number, colour: string, jar: number) => `Poured ${n} ${colour} into jar ${jar}.`,
  sealAnnounce: (jar: number) => `Jar ${jar} sealed.`,
  jarEmpty: 'empty',
  buried: 'buried',
  sealed: 'sealed',
  boardLabel: 'Sand jars',
  boosterLabel: (name: string, charges: number, price: number) =>
    charges > 0 ? `${name}, ${charges} left` : `${name}, costs ${price} coins`,
  boosterFree: (name: string) => `${name}, free`,
  // Player profile (design/gdd/player-profile.md)
  profileTitle: 'Profile',
  profileLabel: (name: string) => `Profile: ${name}`,
  editProfile: 'Edit profile',
  editProfileTitle: 'Edit profile',
  levelBadge: 'On level', // "On level 12" beside "Levels cleared 11" (UX-profile-1)
  statsTitle: 'Stats',
  statLabels: {
    levels: 'Levels cleared',
    perfectClears: 'Perfect clears',
    streak: 'Daily streak',
    bestStreak: 'Best streak',
    dailiesSolved: 'Dailies solved',
    shells: 'Shells',
    sets: 'Sets completed',
    scenes: 'Scenes',
    pours: 'Total pours',
    coinsEarned: 'Coins earned',
    boostersUsed: 'Boosters used',
  },
  statsFootnote: '* These totals count from this update onwards.',
  tabs: { avatar: 'Avatar', frame: 'Frame', plate: 'Name' },
  nameLabel: 'Your name',
  reroll: 'New random name',
  nameInvalid: (min: number, max: number) => `Use ${min}–${max} letters or numbers`,
  /** Beside Save when the name is invalid and the Name tab is not open (UX-edit-1). */
  nameInvalidTab: (min: number, max: number) => `Name tab: use ${min}–${max} letters or numbers to save`,
  platesLabel: 'Name plate',
  saveProfile: 'Save',
  discardTitle: 'Discard changes?',
  discard: 'Discard',
  keepEditing: 'Keep editing',
  lockedItem: (name: string, req: string) => `${name}, locked: ${req}`,
  unlockReq: {
    levels: (n: number) => `Clear ${n} levels`,
    perfectClears: (n: number) => `Get ${n} perfect clears`,
    bestStreak: (n: number) => `Reach a ${n}-day streak`,
    dailiesSolved: (n: number) => `Solve ${n} daily puzzles`,
    shells: (n: number) => `Collect ${n} shells`,
    sets: (n: number) => (n === 1 ? 'Complete a shell set' : `Complete ${n} shell sets`),
  },
  unlockLine: (name: string, req: string, have: number, need: number) => `${name}: ${req} · ${have}/${need}`,
  newCosmetic: {
    avatar: (name: string) => `New avatar: ${name}`,
    frame: (name: string) => `New frame: ${name}`,
    plate: (name: string) => `New name plate: ${name}`,
  },
  // One active tab (sprint 9 M4, D57, TD-14)
  otherTabTitle: 'Strata is open in another tab',
  otherTabText: 'Your progress is kept in that tab. Play here to continue on this one.',
  playHere: 'Play here',
  /** Once per session, when the browser refuses a save (storage full or blocked). */
  saveFailed: "Progress can't be saved: this browser's storage is full or blocked",
  // Sprint 9 M5: the remaining backlog findings
  /** Read after "Daily puzzle" by a screen reader; the calendar is hidden from it (UX-home-3). */
  dailyDate: (weekday: string, day: number) => `, ${weekday} ${day}`,
  /** Above the disabled toolbar in the tutorial (UX-board-9). */
  toolsLocked: 'Boosters and Restart unlock after the tutorial',
  /** Marks the counters that start at 0 from the profile update (UX-profile-2). */
  statNewMark: '*',
  statNewSr: ', counted from this update',
  /** On shells earned since the cabinet was last opened (UX-cab-4). */
  shellNew: 'New',
  // sprint 10 audio
  /** The Settings volume sliders (D66, sprint 10 F3). */
  soundVolume: 'Sound volume',
  musicVolume: 'Music volume',
  /** A slider's spoken value (aria-valuetext), e.g. "80%". */
  volumeValue: (percent: number) => `${percent}%`,
  // sprint 11 onboarding
  /** Install and onboarding (sprint 11 O1-O4, D78). */
  onboarding: {
    installTitle: 'Keep Strata on your home screen',
    installText: 'It opens full screen, like an app, and plays offline.',
    installButton: 'Add to Home Screen',
    notNow: 'Not now',
    /** iPhone and iPad: Safari has no install prompt, so the steps are shown. The share icon is drawn after step 1. */
    iosSteps: ['Tap Share', 'Choose \u201cAdd to Home Screen\u201d', 'Tap Add'],
    /** Under the steps: newer Safari hides Share behind the ··· button. */
    iosNote: 'No Share button? Tap \u00b7\u00b7\u00b7 first. You may need to scroll to find Add to Home Screen.',
    /** A `?daily=` link from an earlier day (O3). `date` is that day's key. */
    dailyOverTitle: 'That daily is over',
    dailyOverText: (date: string) => {
      const [y, m, d] = date.split('-').map(Number);
      return `The puzzle for ${new Date(y, m - 1, d).toLocaleDateString('en', { weekday: 'long', month: 'long', day: 'numeric' })} has ended. Today\u2019s is ready.`;
    },
    playToday: 'Play today\u2019s',
    /** Once, when the service worker has cached everything (O4). */
    offlineReady: 'Strata is ready to play offline',
    /** Above the map's Play button the first time the map opens (O2). */
    mapHint: 'Your path along the beach. Play the next level, or tap a cleared stone to replay it.',
    /** Above the boosters on level 1, the first board they work on (O2). */
    boosterHint: 'Stuck? Undo is free, and Shuffle, Jar and Hint help too.',
  },
  /**
   * Generated names: `Adjective Noun NN` (player-profile.md §3.5). Adjectives are at most
   * 7 letters and nouns at most 5, so every name fits the 16-character limit (unit-tested).
   */
  nameWords: {
    adjectives: ['Saffron', 'Coral', 'Sage', 'Lagoon', 'Plum', 'Sandy', 'Sunny', 'Breezy', 'Salty', 'Golden', 'Misty', 'Pebbly', 'Tidal', 'Calm', 'Amber', 'Azure'],
    nouns: ['Gull', 'Tern', 'Dune', 'Wave', 'Tide', 'Cove', 'Reef', 'Kite', 'Sail', 'Jar', 'Shell', 'Pearl', 'Bay', 'Isle', 'Buoy', 'Skiff'],
  },
} as const;

/** The active string table. */
export const t = en;
