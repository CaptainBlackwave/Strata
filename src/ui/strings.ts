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

/** The moment shapes the words describe (logic/moments.ts `Moment`). */
type MomentWords = { readonly kind: 'set'; readonly name: string } | { readonly kind: 'streak'; readonly days: number } | { readonly kind: 'badge'; readonly id: string };

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** `2026-11-01` -> `1 Nov`: the daily's date on the share card. */
const shortDate = (key: string) => `${Number(key.slice(8, 10))} ${MONTHS[Number(key.slice(5, 7)) - 1]}`;

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
  /** Under the Vibration switch while the device asks for reduced motion (sprint 21 A4): it stays off. */
  hapticsReduced: 'Off while your device reduces motion',
  /** Settings, once the service worker has cached the game (sprint 21 A3). */
  worksOffline: 'Works offline',
  /** The calm bar on Home when a new version has taken over (sprint 21 A3): the text, then its button. */
  update: { ready: 'New version ready', button: 'Update' },
  patterns: 'Colour patterns',
  patternsTitle: 'Show a texture on each colour (colour-blind aid)',
  southern: 'Southern hemisphere seasons',
  realistic: 'Realistic sand',
  realisticHelp: 'Real grains that slide and pour. Off: Classic',
  realisticUnavailable: 'Not available on this device',
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
  /** Share moments on the win card (sharing §3.4). `name` is the badge's name, '' for the others. */
  moment: {
    share: 'Share',
    row: (m: MomentWords, name: string) => (m.kind === 'set' ? `${m.name} set complete!` : m.kind === 'streak' ? `${m.days}-day streak!` : `New badge: ${name}`),
    label: (m: MomentWords, name: string) => `Share: ${m.kind === 'set' ? `${m.name} set complete` : m.kind === 'streak' ? `${m.days}-day streak` : `New badge, ${name}`}`,
    card: (m: MomentWords, name: string) =>
      m.kind === 'set'
        ? { headline: `${m.name} set`, sub: 'Shell collection', lines: ['Complete', 'Every shell found'] }
        : m.kind === 'streak'
          ? { headline: `${m.days}-day streak`, sub: 'Daily puzzle', lines: [`${m.days} days`, 'One calm puzzle a day'] }
          : { headline: 'New badge', sub: name, lines: ['Badge earned', 'Earned by play'] },
    shareText: (m: MomentWords, name: string, url: string) =>
      `${m.kind === 'set' ? `I completed the ${m.name} shell set` : m.kind === 'streak' ? `I'm on a ${m.days}-day streak` : `I earned the ${name} badge`} in Strata, a calm seaside sand-sort puzzle.\n${url}`,
  },
  /** A friend's challenge on a numbered level (sharing §3.2, D121). `challenge` is the tall-jar tag. */
  friend: {
    title: 'A friend\u2019s challenge',
    beatText: (level: number, pours: number) => `A friend cleared level ${level} in ${pours} ${pours === 1 ? 'pour' : 'pours'}. Beat it?`,
    aheadText: (level: number, mine: number) => `A friend is on level ${level}. You\u2019re on level ${mine}.`,
    play: 'Play',
    notNow: 'Not now',
    playLevel: (level: number) => `Play level ${level}`,
    /** Beside the pour counter while a challenge is played. */
    target: (pours: number) => `Beat ${pours}`,
    targetSr: (pours: number) => `Your friend's score to beat: ${pours} pours`,
    verdict: (v: { kind: 'beat' | 'matched' | 'behind'; by: number }, mine: number) =>
      `${mine} ${mine === 1 ? 'pour' : 'pours'}: ` + (v.kind === 'beat' ? `you beat it by ${v.by}` : v.kind === 'matched' ? 'you matched it' : `${v.by} more than your friend`),
    /** The win card's Share on a numbered level, and the map card's button. */
    challengeFriend: 'Challenge a friend',
    sendBack: 'Send it back',
    /** The tutorial's win card when a challenge link arrived before it (D82). */
    sharedReady: 'Your friend\u2019s challenge is waiting.',
    playShared: 'See the challenge',
    shareText: (level: number, pours: number, url: string) => `Can you beat my ${pours} ${pours === 1 ? 'pour' : 'pours'} on Strata level ${level}?\n${url}`,
  },
  /** The share picture and its preview sheet (sharing §3.1, D122). */
  shareCard: {
    title: 'Share your result',
    /** The name across the top of the share picture. */
    brand: 'STRATA',
    showName: 'Show my name',
    share: 'Share',
    /** The preview image's text alternative: the card's words in one line. */
    alt: (headline: string, lines: readonly string[]) => `Share card: ${headline}. ${lines.join('. ')}.`,
    daily: (date: string, difficulty: string, pours: number, streak: number) => ({
      headline: `Daily \u00b7 ${shortDate(date)}`,
      sub: difficulty.charAt(0).toUpperCase() + difficulty.slice(1), // config names are lowercase, as the HUD shows them uppercased
      lines: [`Solved in ${pours} ${pours === 1 ? 'pour' : 'pours'}`, `${streak}-day streak`],
    }),
    level: (level: number, pours: number, perfect: boolean) => ({
      headline: `Level ${level}`,
      sub: perfect ? 'Perfect \u2713' : '',
      lines: [`${pours} ${pours === 1 ? 'pour' : 'pours'}`, 'Can you beat it?'],
    }),
    weekly: (week: string, theme: string, pours: readonly (number | null)[]) => ({
      headline: `Weekly set \u00b7 ${week.slice(week.indexOf('-') + 1)}`,
      sub: theme,
      lines: [pours.map((p) => (p === null ? '\u2013' : String(p))).join(' \u00b7 '), `${pours.filter((p) => p !== null).length} of ${pours.length} cleared`],
    }),
  },
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
    sieve: { name: 'Sieve jar', rule: 'A sieve jar only lets its own colour in: the colour of its band. Fill it with that colour to finish: the level ends only when the sieve is sealed. Anything can be poured out.', tap: 'Sieve: only the colour of its band goes in. Fill it with that colour to finish.' },
    clam: { name: 'Clam jar', rule: 'A clam jar stays shut under its shell until the count runs out: every pour on the board counts down. Then it opens and plays like any jar.', tap: 'Clam: shut until the count on its shell runs out.' },
    wet: { name: 'Wet sand', rule: 'Wet sand is darker, with a drop and a number on it. It only goes onto sand of its own colour, never into an empty jar. Every pour on the board dries it a little: at 0 it is ordinary sand. A full jar seals once its sand is dry.', tap: 'Wet sand: only onto its own colour. It dries as you pour.' },
    /** The tide jar (sprint 24 T5, D194, D195; §2.8): its intro card, Jar guide entry and tap text. */
    tide: { name: 'Tide jar', rule: 'Every fourth pour on the board, the tide turns: the sand in the tide jar rises by one layer, and its bottom layer comes up to the top. The number on its wave counts the pours left. A sealed tide jar stays still.', tap: 'Tide jar: every fourth pour, its bottom layer rises to the top.' },
    /** The crab (sprint 27 K5, D207; §2.9): its intro card, Jar guide entry and tap text (the refusal when its jar is lifted). */
    crab: { name: 'Crab jar', rule: 'A crab sits on one jar\u2019s lid. You can pour into that jar, but not out of it. Every third pour on the board the crab walks to the next jar along; the number on it counts the pours left. It never sits on a sealed jar.', tap: 'The crab is on that jar.' },
    /** The lighthouse jar (sprint 27 K5, D208, D209; §2.10): its intro card, Jar guide entry and tap text. */
    lighthouse: { name: 'Lighthouse jar', rule: 'The lighthouse jar\u2019s sand is dark, so you can\u2019t see its colours. Every fourth pour on the board the beam lights it, and its colours show until your next pour. The number on its lighthouse counts the pours left. It pours like any jar, and stays lit once sealed.', tap: 'Lighthouse jar: the beam lights it every fourth pour.' },
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
        version: '0.24.0',
        name: 'A crab and a lighthouse',
        lines: [
          'From level 281, the crab jar: a crab sits on a jar so you cannot pour out of it, and every third pour it walks to the next jar.',
          'From level 321, the lighthouse jar: its sand is dark until the beam sweeps over it every fourth pour.',
          'Each turns up on about one level in eight from its first level.',
          'The wooden shelves under the jars are gone from the board: thank you for the feedback.',
        ],
      },
      {
        version: '0.23.1',
        name: 'Night touches',
        lines: [
          'At night the sea at the foot of the screen has depth, and the wooden shelves look warm, with a fine grain.',
          'A two-line message no longer covers the bottom shelf.',
          'The Today colour is softer in night scenes.',
        ],
      },
      {
        version: '0.23.0',
        name: 'A fresh coat of paint',
        lines: [
          'Strata has a new look: warm paper cards you can press, bold headings and a colour for each part of Home.',
          'The jars now stand on wooden shelves, on Home and on every board.',
          'A tidier board: a two-row top bar, clearer buttons, and messages that no longer cover the jars.',
          'Sheets open at the top, nothing breaks mid-word with large text, and night scenes look right everywhere.',
        ],
      },
      {
        version: '0.22.0',
        name: 'The tide jar',
        lines: [
          'A new jar from level 241: the tide jar, with a wave and a number on it.',
          'Every fourth pour on the board the tide turns: its sand rises one layer, and the bottom layer comes up to the top.',
          'Plan for the turn: a sealed tide jar stays still.',
          'You will meet it on about one level in eight from level 241.',
        ],
      },
      {
        version: '0.21.0',
        name: 'Wet sand',
        lines: [
          'A new jar mechanic from level 201: wet sand. It is darker, with a drop and a number on it.',
          'Wet sand only pours onto sand of its own colour, never into an empty jar.',
          'Every pour on the board dries it a little; at 0 it is ordinary sand, and a full jar seals once it is dry.',
          'You will meet it on about one level in eight from level 201.',
        ],
      },
      {
        version: '0.20.2',
        name: 'Small polish',
        lines: [
          'The splash screen now matches your scene, so a night scene no longer flashes bright while loading.',
          'The jars on Home wear their corks in Realistic sand too, and their sparkle is easier to see.',
          'Clearer pictures for adding Strata to an iPhone home screen.',
          'Pours on big boards run a little smoother, and sound starts only when you turn it on.',
        ],
      },
      {
        version: '0.20.1',
        name: 'Tidier Today',
        lines: [
          'The weekly set card on Today shows its five little jars in a row again, filling as you clear boards.',
          "The card's title is now this week's theme, with the days left below it.",
          'With large text on a small phone, every Today card fits the screen again.',
        ],
      },
      {
        version: '0.20.0',
        name: 'Feels like an app',
        lines: [
          'Add Strata to your home screen: after a few levels Home shows you how, with pictures on iPhone.',
          'A new icon and a sandy splash screen, and Settings tells you when the game works offline.',
          'When a new version is ready, Home shows an Update bar, so nothing changes in the middle of a board.',
          'The board no longer zooms by accident, the sand settles in smooth slopes, and pours redraw faster.',
          'The Home picture is back to the three logo jars, now in Realistic sand.',
        ],
      },
      {
        version: '0.19.1',
        name: 'A game on Home',
        lines: [
          'Home now shows a little game of Strata playing itself: jars pour, sort and seal, then mix up and start again.',
          'Tap it to jump straight into your level.',
          'On the Classic board, or with reduced motion on, it shows a still picture instead.',
        ],
      },
      {
        version: '0.19.0',
        name: 'A new Home',
        lines: [
          'Home is calmer: a live sand scene, one big Play button, and today\'s daily, event and next streak reward right below.',
          'Your next streak reward now has its own card with a track of every reward day.',
          'Everything else is one tap away in the new tabs at the bottom: Today, Collection and Profile.',
        ],
      },
      {
        version: '0.18.0',
        name: 'Real sand',
        lines: [
          'The board has a new look: soft glass jars and real grains of sand that slide, spill and pile up as you pour.',
          'Every jar, style, scene and colour pattern works with it.',
          'Prefer the old look? Turn off Realistic sand in Settings to go back to Classic. You can switch any time.',
        ],
      },
      {
        version: '0.17.0',
        name: 'A softer touch',
        lines: [
          'Sand now streams in grains and settles into a soft pile, and the pour sound follows how much you move.',
          'Corks drop in with a sparkle, and the chime climbs with each jar you seal on a board. A win lights up your sealed jars before the card.',
          'Snow falls during Winter Tide, with its own winter music.',
          'New in Settings: Your stats, to copy and send us with your feedback.',
        ],
      },
      {
        version: '0.16.0',
        name: 'Winter Tide',
        lines: [
          'Winter Tide arrives on 1 December: a new board opens every day until the 24th, and you can catch up on any you missed until the 31st.',
          'The boards are gentle, whatever your level. Every sixth board pays 50 coins.',
          'Clear all 24 for the Frost jar glass and the Winter Tide badge. Winter Tide comes back every December.',
        ],
      },
      {
        version: '0.15.1',
        name: 'All your streak rewards',
        lines: [
          'Tap the line under the daily puzzle to see all six streak rewards and which you have collected.',
          'Buttons for things you can\'t get yet are easier to read, with a small lock.',
          'The Close buttons in the Scenes and Jar styles sheets are full width.',
        ],
      },
      {
        version: '0.15.0',
        name: 'Come back tomorrow',
        lines: [
          'Streak rewards: keep your daily streak going to earn boosters on days 3 and 7, then a frame, a jar glass, a name plate and a night scene you can only get this way.',
          'Rewards are yours to keep, even if a streak ends.',
          "Today's goals: three small goals each day on Home, worth coins, with a bonus when all three are done.",
        ],
      },
      {
        version: '0.14.1',
        name: 'An easier climb',
        lines: [
          'Levels get harder much more slowly: bigger boards, more hidden sand and fewer empty jars now arrive hundreds of levels later.',
          'Up to about level 150 you should rarely need a booster.',
          'Best pours from level 30 start fresh. Your progress, coins, shells and Perfect marks are kept.',
        ],
      },
      {
        version: '0.14.0',
        name: 'Share with friends',
        lines: [
          'Share your daily or weekly result as a picture. Your name stays off unless you switch it on.',
          'Challenge a friend on any level you have cleared: they see your pours to beat.',
          'A small Share appears when you finish a shell set, hit a streak milestone or earn a badge.',
          'Links to Strata now show a proper preview in chats.',
        ],
      },
      {
        version: '0.13.1',
        name: 'A gentler climb',
        lines: [
          'Levels from 12 get harder more slowly, and levels ending in 3 or 8 are easier boards.',
          'Tall-jar levels start smaller and are never much longer than the levels around them.',
          'Best pours on the changed levels start fresh. Your progress, coins, shells and Perfect marks are kept.',
        ],
      },
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
    jars: { narrow: 'narrow', frozen: 'frozen', locked: 'locked lid', funnel: 'funnel', hourglass: 'hourglass', sieve: 'sieve', clam: 'clam', wet: 'wet sand', tide: 'tide jar', crab: 'crab jar', lighthouse: 'lighthouse jar' },
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
    /** A sieve jar's state (D96, D216): `c` is its band colour's name. A sealed sieve says only its band (the label adds "sealed"). */
    sieve: (c: string, sealed = false) => (sealed ? `sieve, ${c} only` : `sieve, ${c} only, fill it with ${c} to finish`),
    /** A closed clam's state (D96, §2.6): `left` is the pours until it opens (1..opensAfter). An open clam has no state. */
    clam: (left: number) => (left === 1 ? 'clam, closed, opens after the next pour' : `clam, closed, opens in ${left} pours`),
    /** A full jar of one colour that waits for its wet sand to dry before it seals (D189, §2.7). */
    wet: 'full, seals when dry',
    /** A tide jar's state (D194, §2.8): `left` is the pours until the tide turns (1..every). */
    tide: (left: number) => (left === 1 ? 'tide jar, turns after the next pour' : `tide jar, turns in ${left} pours`),
    /** A sealed tide jar's state (D195, §2.8): it never turns again, so it has no count. */
    tideStill: 'tide jar, still',
    /** The crab's jar (D207, §2.9): `left` is the pours until it moves (1..every). */
    crab: (left: number) => (left === 1 ? 'crab on this jar, moves after the next pour' : `crab on this jar, moves in ${left} pours`),
    /** A dark lighthouse jar (D208, D209, §2.10): `left` is the pours until the beam lights it. No colour is named. */
    lighthouse: (left: number) => (left === 1 ? 'dark, lit after the next pour' : `dark, lit in ${left} pours`),
    /** A lighthouse jar the beam lights this pour (§2.10): its colours show until the next pour. */
    lighthouseLit: 'lighthouse jar, lit until the next pour',
    /** A sealed lighthouse jar (§2.10 rule 4): lit for good. */
    lighthouseSealed: 'lighthouse jar, lit for good',
  },
  /** One wet unit in a jar's screen-reader contents (D189, §2.7): `left` is the pours until it dries (1..dryAfter). */
  wetUnit: (colour: string, left: number) => (left === 1 ? `wet ${colour}, dries after the next pour` : `wet ${colour}, dries in ${left} pours`),
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
  /** The sieve dead end (D215): its band colour was sealed in another jar. `colour` is the band colour's name. */
  sieveLost: (colour: string) => `${colour.charAt(0).toUpperCase()}${colour.slice(1)} was sealed outside its sieve: Undo or Restart.`,
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
  /** Shown when wet sand is poured towards an empty jar (D189, §2.7). */
  wetRefused: 'Wet sand only goes onto its own colour.',
  /** Said after the pour that turned a tide jar (D194, §2.8). `jar` is 1-based. */
  tideAnnounce: (jar: number) => `The tide turned (jar ${jar}).`,
  /** Said after the pour that moved the crab (D207, §2.9). `jar` is 1-based. */
  crabAnnounce: (jar: number) => `The crab moved to jar ${jar}.`,
  /** Said after the pour on which the beam lit a lighthouse jar holding sand (D208, §2.10). `jar` is 1-based. */
  beamAnnounce: (jar: number) => `The beam lit jar ${jar}.`,
  /** A dark lighthouse jar's contents for the screen reader (D209): its layers, no colour. */
  darkLayers: (n: number) => (n === 1 ? '1 layer' : `${n} layers`),
  /** Said after a pour that dried wet sand (D189, §2.7). `jar` is 1-based. */
  dryAnnounce: (jar: number) => `Sand dried (jar ${jar}).`,
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
    trackDay: (n: number) => `Streak reward: reach day ${n}`,
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
    installTitle: 'Add Strata to your home screen',
    installText: 'It opens full screen, like an app, and plays offline.',
    installButton: 'Add to Home Screen',
    notNow: 'Not now',
    /** iPhone and iPad: Safari has no install prompt, so the steps are shown, each beside its picture (A1). */
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
      glass: { clear: 'Clear glass', seaglass: 'Sea glass', amber: 'Amber bottle', cobalt: 'Cobalt rim', pearl: 'Pearl', sealantern: 'Sea Lantern', frost: 'Frost' },
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
  /** The streak reward track (sprint 16, D136; daily-puzzle.md §2.4): Home's next reward, win card rows, locked pieces. */
  track: {
    /** The streak track sheet (0.15.1, strata-dll). */
    title: 'Streak rewards',
    keep: 'Rewards are yours to keep, even if a streak ends.',
    /** Home's link to the sheet once every day is collected. */
    allCollected: 'All streak rewards collected',
    /** Spoken after Home's link text, so it says where it goes. */
    linkLabel: (line: string) => `${line}. See all streak rewards`,
    current: (n: number) => (n > 0 ? `Current streak: ${n === 1 ? '1 day' : `${n} days`}` : 'No streak right now. Solve today\u2019s daily to start one.'),
    /** A sheet row's state: collected, the next one, or a later day. */
    collected: (day: number) => `Day ${day} \u00b7 Collected`,
    nextIn: (day: number, days: number) => `Day ${day} \u00b7 Next \u00b7 ${days === 1 ? '1\u00a0day' : `${days}\u00a0days`}`,
    later: (day: number) => `Day ${day}`,
    /** The daily card's line, e.g. "Next streak reward: Tide Line frame · 4 days". */
    next: (name: string, days: number) => `Next streak reward: ${name} \u00b7 ${days === 1 ? '1\u00a0day' : `${days}\u00a0days`}`,
    /** A streak that already passed unclaimed days (a player who updated mid-streak, D140). */
    catchUp: 'Your next daily solve collects your streak rewards',
    /** A win card row, e.g. "Day 7 streak reward: Hint ×2, Shuffle, Jar". */
    row: (day: number, name: string) => `Day ${day} streak reward: ${name}`,
    /** A streak-only scene or jar piece not earned yet, e.g. "Streak reward · day 100". */
    locked: (day: number) => `Streak reward \u00b7 day\u00a0${day}`,
    frame: (name: string) => `${name} frame`,
    plate: (name: string) => `${name} name plate`,
    /** A jar piece with its slot, e.g. "Sea Lantern glass". */
    style: (name: string, slot: string) => `${name} ${slot.toLowerCase()}`,
    scene: (name: string) => `${name} scene`,
    boosterNames: { hint: 'Hint', shuffle: 'Shuffle', extraJar: 'Jar', undo: 'Undo' } as Readonly<Record<string, string>>,
    /** One booster in a list: "Hint ×2", or "Shuffle" for one. */
    booster: (name: string, n: number) => (n === 1 ? name : `${name} \u00d7${n}`),
  },
  /** The new Home (sprint 20, D166-D172; design/ux/home.md): the tab bar, the hero, the Today strip and the tabs' cards. */
  homeScreen: {
    /** The tab bar: its name, each tab, and the spoken "new" dot. */
    tabsLabel: 'Home sections',
    tabs: { play: 'Play', today: 'Today', collection: 'Collection', profile: 'Profile' } as Readonly<Record<string, string>>,
    newSr: ', something new',
    /** The hero is a button that plays, like Play (D173): its spoken name. */
    heroLabel: (level: number) => `Play level ${level}`,
    heroLabelTutorial: 'Play the tutorial',
    /** The small line over the hero's level. */
    eyebrow: 'Strata',
    /** The Today strip under Play, and its link to the Today tab. */
    today: 'Today',
    seeAll: 'See all',
    seeAllLabel: 'See all of today',
    /** The Play mini card for an event, e.g. "9 of 24 cleared". */
    eventCleared: (cleared: number, total: number) => (cleared >= total ? 'All cleared \u2713' : `${cleared} of ${total} cleared`),
    /** The streak reward card (D171). */
    streak: {
      eyebrow: 'Next streak reward',
      /** The booster rewards' names: day 3 and day 7. */
      pair: 'Booster pair',
      bundle: 'Booster bundle',
      /** What kind of reward a cosmetic is, after "Day N ·". */
      kinds: { frame: 'Avatar frame', plate: 'Name plate', style: 'Jar style', scene: 'Scene' } as Readonly<Record<string, string>>,
      day: (n: number) => `Day ${n}`,
      /** Kept on one line: the space is non-breaking. */
      inDays: (n: number) => (n === 1 ? 'in\u00a01\u00a0day' : `in\u00a0${n}\u00a0days`),
      label: (reward: string, lead: string) => `Next streak reward: ${reward}. ${lead}. See all streak rewards`,
      trackLabel: (streak: number, got: readonly number[], next: number | null) =>
        [streak > 0 ? `Streak ${streak === 1 ? '1 day' : `${streak} days`}` : 'No streak yet', got.length ? `collected: day ${got.join(', ')}` : '', next !== null ? `next: day ${next}` : 'all collected'].filter(Boolean).join('; '),
    },
    /** The Today tab. */
    dailyEyebrow: 'Daily puzzle',
    dailyTitle: (weekday: string, difficulty: string) => `${weekday}, ${difficulty}`,
    dailyNotYet: 'Not solved yet',
    playPill: 'Play',
    streakRewards: 'Streak rewards',
    eventEyebrow: 'Event',
    /** The Collection tab's tiles. */
    count: (n: number, total: number) => `${n} of ${total}`,
    countNew: (n: number, total: number, fresh: number) => `${n} of ${total} \u00b7 ${fresh} new`,
    shells: 'Shells',
    mapTitle: 'Beach path',
    mapSub: (level: number) => `Level ${level}`,
    /** The Profile tab. */
    edit: 'Edit',
    moreStats: 'All stats and badges',
    settingsTitle: 'Settings',
    allSettings: 'All settings',
    saveCodeHelp: 'Move your progress to another device',
    open: 'Open',
    whatsNewHelp: (version: string) => `Version ${version}`,
  },
  /** Daily goals (sprint 16, D137; design/gdd/daily-goals.md): the Home card and the win card rows. */
  goals: {
    title: 'Today\u2019s goals',
    /** A goal's text by kind and target, e.g. "Seal 25 jars". */
    text: {
      seal: (n: number) => (n === 1 ? 'Seal a jar' : `Seal ${n} jars`),
      clear: (n: number) => (n === 1 ? 'Clear a level' : `Clear ${n} levels`),
      perfect: (n: number) => (n === 1 ? 'Clear a level Perfect' : `Clear ${n} levels Perfect`),
      daily: () => 'Solve today\u2019s daily',
      weekly: (n: number) => (n === 1 ? 'Clear a weekly board' : `Clear ${n} weekly boards`),
      beatBest: (n: number) => (n === 1 ? 'Beat your best pours on a level' : `Beat your best pours on ${n} levels`),
    } as Readonly<Record<string, (n: number) => string>>,
    progress: (have: number, need: number) => `${have}/${need}`,
    /** Spoken for a done goal's tick. */
    done: 'Done',
    /** The card's last line until all goals are done, e.g. "+50 when all three are done". */
    bonusLeft: (coins: number, n: number) => `+${coins} when all ${(['', 'one', 'two', 'three', 'four', 'five'] as const)[n] ?? n} are done`,
    allDone: 'All done',
    winRow: (text: string, coins: number) => `Goal done: ${text} \u00b7 +${coins}`,
    winBonus: (coins: number) => `All of today\u2019s goals done \u00b7 +${coins}`,
  },
  /** Seasonal events (sprint 17, D141-D147; design/gdd/events.md): Home card, chooser, board label, win card, prize. */
  /** The "Your stats" sheet (sprint 18 S1, D150): text a player copies and sends; nothing is sent automatically. */
  stats: {
    button: 'Your stats',
    heading: 'Your stats',
    intro: 'Copy these and send them to us with your feedback. Nothing is sent automatically.',
    copy: 'Copy',
    copied: 'Copied. Paste it into your message.',
    copyFailed: "Couldn't copy. Select the text and copy it yourself.",
    labels: {
      title: 'Strata stats',
      progress: 'Progress',
      today: 'Today',
      boosters: 'Boosters and coins',
      device: 'Device',
      yes: 'yes',
      no: 'no',
      rows: { level: 'Level', streak: 'Streak', bestStreak: 'Best streak', perfectClears: 'Perfect clears', dailiesSolved: 'Dailies solved', shells: 'Shells', badges: 'Badges', jarsSealed: 'Jars sealed', date: 'Date (UTC)', goals: "Today's goals done", dailyToday: 'Daily solved today', event: 'Event', boostersUsed: 'Boosters used', coinsEarned: 'Coins earned', coins: 'Coins now', pours: 'Pours', version: 'Version', browser: 'Browser', screen: 'Screen' },
    },
  },
  event: {
    /** Event names by `events[].id` in game-config.json. */
    names: { wintertide: 'Winter Tide' } as Readonly<Record<string, string>>,
    /** Badge names and shelf lines by the prize badge id. */
    badges: { 'event-wintertide': { name: 'Winter Tide', desc: 'Cleared every Winter Tide board' } } as Readonly<Record<string, { name: string; desc: string }>>,
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as readonly string[],
    monthsShort: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as readonly string[],
    /** The Home card's line, e.g. "Board 12 open · 9 of 24 cleared". */
    cardSub: (open: number, total: number, cleared: number) => `${open >= total ? `All ${total} boards open` : `Board ${open} open`} \u00b7 ${cleared >= total ? 'All cleared \u2713' : `${cleared} of ${total} cleared`}`,
    daysLeft: (n: number) => (n <= 0 ? 'Last day' : n === 1 ? 'Ends tomorrow' : `Ends in ${n} days`),
    prize: (total: number, piece: string, badge: string) => `Clear all ${total} for the ${piece} and the ${badge} badge`,
    prizeCollected: 'Prize collected',
    /** A jar piece as a prize, e.g. "Frost jar glass". */
    piece: (name: string, slot: string) => `${name} jar ${slot.toLowerCase()}`,
    /** A board in the chooser: its visible status and its spoken name. */
    boardOpen: 'Open',
    boardCleared: (pours: number) => `\u2713 ${pours}`,
    boardClearedLabel: (n: number, pours: number) => `Board ${n}, cleared, best ${pours} ${pours === 1 ? 'pour' : 'pours'}`,
    boardOpenLabel: (n: number) => `Board ${n}, not cleared yet`,
    boardLocked: (month: string, day: number) => `${month} ${day}`,
    boardLockedLabel: (n: number, month: string, day: number) => `Board ${n}, opens ${month} ${day}`,
    /** The board screen's label, e.g. "Winter Tide · Board 6". */
    label: (name: string, n: number) => `${name} \u00b7 Board ${n}`,
    winTitle: (name: string, n: number) => `${name} \u00b7 Board ${n}`,
    completeTitle: (name: string) => `${name} complete!`,
    winText: (pours: number, cleared: number, total: number) => `${pours} ${pours === 1 ? 'pour' : 'pours'} \u00b7 ${cleared} of ${total} cleared`,
    replay: 'Already cleared this year',
    /** The win card's prize row, e.g. "Frost jar glass is yours". */
    prizeRow: (piece: string) => `${piece} is yours`,
    /** A jar piece that is an event's prize, in the Jar styles sheet, e.g. "Winter Tide prize · December". */
    lockedPiece: (name: string, month: string) => `${name} prize \u00b7 ${month}`,
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
