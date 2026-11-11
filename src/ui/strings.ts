/**
 * Every user-facing string, in one table, per .claude/rules/ui-code.md (no
 * hardcoded UI text). Only English ships for now. Add a locale by adding a table.
 */

import { version } from '../../package.json';

/**
 * The release the "What's new" card describes (D46, D52): the game's version from
 * package.json, the single source (D56). Bump package.json together with a new first entry
 * in `whatsNew.releases` (a unit test holds the two equal); a save whose `seenWhatsNew` differs sees the card once on Home.
 */
export const WHATS_NEW_VERSION: string = version;

/** One "What's new" posting: the release it describes, a short name and its 3-5 plain lines. */
export interface WhatsNewRelease {
  /** The release's version, as in package.json. */
  version: string;
  /** A few words naming the release. */
  name: string;
  /** What changed, for players, in 3-5 short plain lines. */
  lines: string[];
}

/** A count with thousands separators, as the stats grid shows it: 1200 → "1,200". */
const n0 = (n: number) => n.toLocaleString('en');

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
  /** The daily win card on a long streak (D99): the step included in the reward. */
  longStreak: (coins: number) => `Long streak bonus +${coins}`,
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
    hourglass: { name: 'Hourglass jar', rule: 'Every third pour on the board, the hourglass flips: its sand turns upside down. The number on it counts the pours left.', tap: 'Hourglass: it flips after every third pour.' },
    sieve: { name: 'Sieve jar', rule: 'A sieve jar only lets its own colour in: the colour of its band. Anything can be poured out.', tap: 'Sieve: only the colour of its band goes in.' },
    clam: { name: 'Clam jar', rule: 'A clam jar stays shut under its shell until the count runs out: every pour on the board counts down. Then it opens and plays like any jar.', tap: 'Clam: shut until the count on its shell runs out.' },
  },
  newJar: 'New jar!',
  gotIt: 'Got it',
  jarGuide: 'Jar guide',
  keysNote: 'Keys: 1–9 and 0 pick jars 1–10; hold Shift for jars 11–20. Z Undo · S Shuffle · J Jar · H Hint · R Restart.',
  /**
   * The "What's new" changelog (D46, D52): one posting per release, newest first. Each posting
   * keeps its 3-5 short plain lines exactly as it shipped. The card shown once on Home after an
   * update lists only the first; Settings > What's new lists them all.
   */
  whatsNew: {
    version: WHATS_NEW_VERSION,
    title: "What's new",
    button: "What's new",
    /** The heading above each posting. */
    versionLabel: (v: string) => `Version ${v}`,
    /** The mark beside the newest posting. */
    latest: 'Latest',
    releases: [
      {
        version: '0.13.0',
        name: 'Three new jars',
        lines: [
          'The hourglass jar at level 101: every third pour, it flips its sand upside down.',
          'The sieve jar at level 141: only the colour of its band goes in.',
          'The clam jar at level 181: shut under its shell until the count runs out.',
          'From 28 November the new jars join the Saturday daily, and from 30 November the weekly set.',
          'Long streaks pay more from day 30 and day 60, and the priciest scenes now cost less.',
        ],
      },
      {
        version: '0.12.0',
        name: 'Jar styles',
        lines: [
          'Jar styles: from level 60, spend coins on new glass, corks and sand textures.',
          'Mix and match pieces, and preview any of them before you buy.',
          'Styles never change a sand colour, and colour patterns stay on top.',
        ],
      },
      {
        version: '0.11.1',
        name: 'A smoother first run, and a weekly bonus',
        lines: [
          'Clear all five weekly boards for a coin bonus, once a week.',
          'Share the weekly set and the link opens it directly.',
          'Level 10, the first tall-jar level, is a gentler step.',
        ],
      },
      {
        version: '0.11.0',
        name: 'Badges and the weekly set',
        lines: [
          'A shelf of 28 badges on your profile, earned as you play.',
          'A weekly set: five new boards every Monday, and a badge for clearing them all.',
          'Share a daily and the link opens that puzzle directly.',
          'Add Strata to your home screen to play it like an app, even offline.',
        ],
      },
      {
        version: '0.10.1',
        name: 'Look fixes',
        lines: [
          'The volume sliders now match the scene you are in.',
          'Sealing a jar and clearing a level glow in each scene\'s own colours.',
          'In the night scenes that glow is cool moonlight instead of warm sand.',
        ],
      },
      {
        version: '0.10.0',
        name: 'Music and feel',
        lines: [
          'Every scene now has its own music.',
          'Sliders for sound and music volume in Settings.',
          'Softer, richer sounds, and a gentle glow when you seal a jar or clear a level.',
          'Smoother moves between Home, the map and the board.',
        ],
      },
      {
        version: '0.9.1',
        name: 'Fixes',
        lines: [
          'Hints and shuffles no longer freeze the game on big boards.',
          'A shell you have not looked at yet stays marked "New" until you do.',
          'Large text fits better on the map and the booster prices.',
          'Updates download cleanly, and old files are cleared out.',
        ],
      },
      {
        version: '0.9.0',
        name: 'The beach path',
        lines: [
          'A beach path map shows every level, with what you earned on each.',
          'Replay any level to earn its Perfect mark or beat your best pours.',
          'Strata now plays in one tab at a time, so no progress is lost.',
          'Aurora night, Winter lights and Rainbow after rain look better.',
        ],
      },
      {
        version: '0.8.0',
        name: 'Free undo and new scenes',
        lines: [
          'Undo is free now.',
          'Twelve new scenes to buy, from sea fog to aurora night.',
          "A banner tells you when you're stuck, and hints are clearer.",
          'Jars are easier to tap, and you can pinch to zoom.',
          'Sealed jars now show their sand.',
        ],
      },
    ] as WhatsNewRelease[],
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
    jars: { narrow: 'narrow', frozen: 'frozen', locked: 'locked lid', funnel: 'funnel', hourglass: 'hourglass', sieve: 'sieve', clam: 'clam' },
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
  jarStates: {
    narrow: 'narrow',
    frozen: 'frozen',
    locked: (c: string) => `locked until ${c} is sealed`,
    funnel: 'one-way funnel',
    /** An hourglass jar's state (D96): `left` is the pours until its next flip (1..every). */
    hourglass: (left: number) => (left === 1 ? 'hourglass, flips after the next pour' : `hourglass, flips in ${left} pours`),
    /** A sieve jar's state (D96): `c` is its band colour's name. */
    sieve: (c: string) => `sieve, ${c} only`,
    /** A closed clam's state (D96, §2.6): `left` is the pours until it opens (1..opensAfter). An open clam has no state. */
    clam: (left: number) => (left === 1 ? 'clam, closed, opens after the next pour' : `clam, closed, opens in ${left} pours`),
  },
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
  /** Said after the pour that flipped an hourglass (D96). `jar` is 1-based. */
  flipAnnounce: (jar: number) => `The hourglass flipped (jar ${jar}).`,
  /** Shown when a pour into a sieve jar is refused because of its colour (D96). `colour` is the band colour's name. */
  sieveRefused: (colour: string) => `Only ${colour} sand can go in this sieve.`,
  /** Shown when a closed clam is tapped or poured into (D96, §2.6). `left` is the pours until it opens. */
  clamRefused: (left: number) => (left === 1 ? 'This clam opens after the next pour.' : `This clam opens in ${left} pours.`),
  /** Said after the pour that opened a clam (D96, §2.6). `jar` is 1-based. */
  clamAnnounce: (jar: number) => `The clam opened (jar ${jar}).`,
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
    jarsSealed: 'Jars sealed',
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
  // Badge shelf (sprint 11, D76, design/gdd/badges.md). Keys match `name` in game-config.json `badges.list`.
  badges: {
    firstSeal: { name: 'First Seal', desc: 'Seal your first jar' },
    jarStacker: { name: 'Jar Stacker', desc: 'Seal 100 jars' },
    jarHarbour: { name: 'Jar Harbour', desc: 'Seal 1,000 jars' },
    paddler: { name: 'Paddler', desc: 'Clear 10 levels' },
    rockPooler: { name: 'Rock Pooler', desc: 'Clear 50 levels' },
    harbourHand: { name: 'Harbour Hand', desc: 'Clear 100 levels' },
    oldSalt: { name: 'Old Salt', desc: 'Clear 250 levels' },
    steadyHand: { name: 'Steady Hand', desc: 'Make 1,000 pours' },
    sandRiver: { name: 'Sand River', desc: 'Make 10,000 pours' },
    smoothSand: { name: 'Smooth Sand', desc: 'Clear a level Perfect' },
    stillWater: { name: 'Still Water', desc: 'Get 25 perfect clears' },
    glassCalm: { name: 'Glass Calm', desc: 'Get 100 perfect clears' },
    tallOrder: { name: 'Tall Order', desc: 'Perfect a tall-jar level' },
    highTide: { name: 'High Tide', desc: 'Perfect 10 tall-jar levels' },
    beachcomber: { name: 'Beachcomber', desc: 'Find your first shell' },
    fullPockets: { name: 'Full Pockets', desc: 'Collect 20 shells' },
    matchedSet: { name: 'Matched Set', desc: 'Complete a shell set' },
    cabinetComplete: { name: 'Cabinet Complete', desc: 'Complete all 8 shell sets' },
    changeOfSky: { name: 'Change of Sky', desc: 'Own 4 scenes' },
    paintedSkies: { name: 'Painted Skies', desc: 'Own 8 scenes' },
    narrowEscape: { name: 'Narrow Escape', desc: 'Meet your first special jar' },
    oddJarsOut: { name: 'Odd Jars Out', desc: 'Meet all four special jars' },
    dayTripper: { name: 'Day Tripper', desc: 'Win in 2 different scenes' },
    everyShore: { name: 'Every Shore', desc: 'Win in every scene you own (4 or more)' },
    morningDip: { name: 'Morning Dip', desc: 'Solve a daily puzzle' },
    tideTable: { name: 'Tide Table', desc: 'Solve 30 daily puzzles' },
    sevenTides: { name: 'Seven Tides', desc: 'Reach a 7-day daily streak' },
    fullMoon: { name: 'Full Moon', desc: 'Reach a 30-day daily streak' },
  },
  /** A not-yet badge's progress line, by the stat its rule reads, e.g. "34/100 jars". `everyOwnedScene` is every-shore's. */
  badgeCount: {
    levels: (have: number, need: number) => `${n0(have)}/${n0(need)} levels`,
    jarsSealed: (have: number, need: number) => `${n0(have)}/${n0(need)} jars`,
    pours: (have: number, need: number) => `${n0(have)}/${n0(need)} pours`,
    perfectClears: (have: number, need: number) => `${n0(have)}/${n0(need)} perfect`,
    tallPerfect: (have: number, need: number) => `${n0(have)}/${n0(need)} tall-jar Perfect`,
    shells: (have: number, need: number) => `${n0(have)}/${n0(need)} shells`,
    sets: (have: number, need: number) => `${n0(have)}/${n0(need)} sets`,
    scenesOwned: (have: number, need: number) => `${n0(have)}/${n0(need)} scenes`,
    scenesPlayed: (have: number, need: number) => `${n0(have)}/${n0(need)} scenes`,
    mechanicsSeen: (have: number, need: number) => `${n0(have)}/${n0(need)} special jars`,
    dailiesSolved: (have: number, need: number) => `${n0(have)}/${n0(need)} dailies`,
    bestStreak: (have: number, need: number) => `${n0(have)}/${n0(need)} days`,
    everyOwnedScene: (have: number, need: number) => `${n0(have)}/${n0(need)} scenes`,
  },
  badgesTitle: 'Badges',
  badgesCount: (earned: number, total: number) => `${earned} of ${total} earned`,
  /** Read by a screen reader after a not-yet badge's name (the tile is dimmed for sighted players). */
  badgeLockedSr: 'not earned yet',
  /** A weekly-set badge on the shelf (badges.md §3.9), e.g. "Week 46, 2026". */
  badgeWeekly: (year: number, week: number) => `Week ${week}, ${year}`,
  badgeWeeklyDesc: 'Cleared the weekly set',
  /** The win card row and the toast: one combined line (badges.md §3.6). */
  newBadges: (names: readonly string[]) => (names.length === 1 ? `New badge: ${names[0]}` : `New badges: ${names.join(', ')}`),
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
    iosNote: 'No Share button? Tap \u00b7\u00b7\u00b7 first, then scroll to Add to Home Screen.',
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
    /** Once, on the first clear of level `onboarding.homeHintLevel` (R1, D81). */
    homeHint: 'Today\u2019s daily puzzle is on Home.',
    /** The tutorial's win card when a shared link arrived before it (R2, D82). */
    sharedDailyReady: 'Your friend\u2019s daily puzzle is ready.',
    sharedWeeklyReady: 'Your friend\u2019s weekly set is ready.',
    playSharedDaily: 'Play the daily',
    playSharedWeekly: 'See the weekly set',
    /** The quiet mark on Scenes the first time one is affordable (R4, D82). */
    newMark: 'New',
  },
  /** Jar styles (design/gdd/jar-styles.md, sprint 12 S4): the Home button and the sheet. Names by slot and id. */
  styles: {
    title: 'Jar styles',
    intro: 'Change how your jars look. A style never changes a sand colour.',
    slots: { glass: 'Glass', cork: 'Cork', sand: 'Sand' } as Readonly<Record<string, string>>,
    names: {
      glass: { clear: 'Clear glass', seaglass: 'Sea glass', amber: 'Amber bottle', cobalt: 'Cobalt rim', pearl: 'Pearl' },
      cork: { cork: 'Cork', driftwood: 'Driftwood', rope: 'Rope knot', scallop: 'Scallop cap', brass: 'Brass lid' },
      sand: { plain: 'Plain sand', fine: 'Fine grain', glint: 'Glint', layered: 'Layered', ripple: 'Ripple' },
    } as Readonly<Record<string, Readonly<Record<string, string>>>>,
    wearing: 'Wearing',
    owned: 'Owned',
    free: 'Free',
    wear: (name: string) => `Wear ${name}`,
    buy: (name: string, price: number) => `Buy ${name} \u00b7 ${price}`,
    need: (price: number, have: number) => `Needs ${price} coins (you have ${have})`,
    bought: (name: string) => `${name} is yours`,
    previewing: (name: string) => `Previewing ${name}`,
  },
  // sprint 11 weekly
  /** The weekly set (design/gdd/weekly-set.md, D77): Home card, chooser, board label, win card and Share. */
  weekly: {
    title: 'Weekly set',
    /** Theme names by `weekly.themes[].id` and `weekly.themesFrom[].themes[].id` in game-config.json (§3.3). */
    // The hourglass, sieve and clam themes join from 2026-W49 (`weekly.themesFrom`, sprint 13 W1, D98).
    themes: { narrow: 'Narrow Necks', frozen: 'Cold Snap', locked: 'Lock and Key', funnel: 'Funnel Week', deep: 'Deep Sand', hourglass: 'Turning Tides', sieve: 'Fine Sieve', clam: 'Clam Bay' } as Readonly<Record<string, string>>,
    progress: (cleared: number, total: number) => (cleared >= total ? 'Set complete \u2713' : `${cleared} of ${total} cleared`),
    daysLeft: (n: number) => (n <= 1 ? 'Last day' : `${n} days left`),
    /** The Home card's theme line, e.g. "Lock and Key · 6 days left". */
    cardSub: (theme: string, left: string) => `${theme} \u00b7 ${left}`,
    /** The chooser's line under its heading, e.g. "Week 46 · Lock and Key · 2 of 5 cleared". */
    sheetSub: (week: number, theme: string, progress: string) => `Week ${week} \u00b7 ${theme} \u00b7 ${progress}`,
    board: (n: number) => `Board ${n}`,
    boardCleared: (pours: number) => `Cleared \u00b7 best ${pours} ${pours === 1 ? 'pour' : 'pours'}`,
    boardOpen: 'Not cleared yet',
    /** The board screen's label, e.g. "Week 46 · Board 2". */
    label: (week: number, n: number) => `Week ${week} \u00b7 Board ${n}`,
    winTitle: (n: number) => `Board ${n} cleared`,
    completeTitle: 'Weekly set complete!',
    winText: (pours: number, cleared: number, total: number) => `${pours} ${pours === 1 ? 'pour' : 'pours'} \u00b7 ${cleared} of ${total} cleared`,
    replay: 'Already cleared this week',
    outOfDate: 'This board\u2019s week is over, so it isn\u2019t counted',
    /** Share (§3.9): each board's best pours this week in order, "–" for a board not cleared. */
    shareText: (week: string, theme: string, pours: readonly (number | null)[], url: string) => {
      const done = pours.filter((p): p is number => p !== null);
      const list = pours.map((p) => (p === null ? '\u2013' : String(p))).join(' \u00b7 ');
      const line = done.length === pours.length ? `All ${pours.length} boards: ${list} (${done.reduce((a, b) => a + b, 0)} pours)` : `${done.length} of ${pours.length} boards: ${list}`;
      return `Strata Weekly ${week} (${theme})\n${line}\n${url}`;
    },
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
