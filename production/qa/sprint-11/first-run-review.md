# Sprint 11 O2: first-run review (D78)

> **Played:** 2026-11-09, build 0.10.1 plus O1, O3 and O4, from an empty save. Covers the tutorial,
> levels 1–10, then Home and the first map. Run on Pixel 7 at 100% text and iPhone SE at 150% text
> (Playwright, reduced motion), poured from the solver's moves with no boosters
> (`production/qa/evidence/sprint-11/onboarding/scripts/first-run.cjs`). Logs are in `before-first-run.json`
> and `after-first-run.json`, and the screenshots are `before-*` / `after-*` in the same folder.
> No console errors on either device, before or after.

## What a new player meets, in order

| Step | What shows | Introduced? |
|---|---|---|
| First launch | Home with only the logo, coins (100) and Play. No daily, shells, scenes or profile | Good: nothing to learn yet |
| Tutorial | A one-pour board, a ring and "Tap a jar to lift it", then "Now tap the other jar to pour", and the locked-tools note | Good: short, clear, about 10 s |
| Tutorial win | "Nice pour!" and "Start level 1" | Good |
| Level 1 | 5 jars, 3 colours; the tools show **3** badges on Shuffle, Jar and Hint, and Undo is free | **Before: nothing says what the boosters are for.** After: a line above them (fix 2) |
| Levels 1–4 | 10–12 pours each, +20 or +30 coins, Perfect on every win | Gentle ramp |
| Level 5 | 18 pours, first shell (Periwinkle) on the win card | Shell row explains itself |
| Levels 6–9 | 19, 20, 22, 25 pours | Steady |
| Level 10 | **42 pours** (7 jars), second shell (Limpet) and the first frame (Driftwood) | A jump: see R3 (now 32 pours, 6 jars) |
| Win card, each level | Continue goes straight to the next level; Home is a secondary button | The player can play 10 levels without seeing Home again |
| Home after level 10 | Profile chip, Play · Level 11, the Daily card, Shells 2/40, Scenes | **Daily, shells, scenes and profile all appear at once, unexplained** (R1) |
| First map open | The beach path, cleared stones with Perfect marks, a shell badge and a new-jar badge, locked stones | **Before: nothing says what the path is or that stones can be replayed.** After: a one-time line above Play (fix 1) |
| Second visit (O1) | After 3 cleared levels, the Add to Home Screen card, once | New this sprint |
| Offline (O4) | "Strata is ready to play offline", once, a few seconds after the first load | New this sprint |

**Pacing:** the tutorial and levels 1–9 are a calm, even ramp. 10 to 25 pours a level is about 30–60 s
for a new player. Levels 1–4 may be a little easy for anyone who knows the genre, but that suits the
"calm" pillar. Level 10 is the one bump.

## Fixes made (small and clearly good)

1. **The first map open says what the map is.** A line above Play: "Your path along the beach. Play
   the next level, or tap a cleared stone to replay it." It shows on the first open only
   (`save.onboarding.mapHintSeen`), and Play is described by it for screen readers while it shows.
   Before: `before-*-21-map-first.png`; after: `after-*-21-map-first.png`.
2. **Level 1 names the boosters.** Above the toolbar, where the tutorial's "tools unlock" note sits:
   "Stuck? Undo is free, and Shuffle, Jar and Hint help too." It shows on level 1 until it is cleared,
   then never again (`save.onboarding.boosterHintSeen` is set once the player is past level 1). It uses
   the same element as the tutorial note, so it does not cover the board, even at 150% text on a 320 px
   phone. Before: `before-*-l1-board.png`; after: `after-*-l1-board.png`.
   *Found while building it:* boot quietly prepares level 1 under Home, so a "once when level 1
   starts" flag was used up before the player saw it. The rule is "until level 1 is cleared" instead.

## Recommendations for the owner (larger; not built)

- **R1. Home's features arrive all at once, after an unknown number of levels.** Continue chains
  level to level, so a new player may never see Home, the daily, shells or scenes until a later
  visit, and then sees all of them together. Options: (a) after level 3's win, Continue goes to
  Home once, with the daily card pulsing; or (b) a one-time line on the win card at level 3:
  "Today's daily puzzle is on Home". (b) is smaller. Needs a UX decision.
- **R2. A new player's daily share link opens Home** (O3), because the daily card only appears
  after the tutorial. Better: remember the link and offer the daily straight after the tutorial
  ("Your friend's daily is ready"). That is a natural follow-up for the weekly set (W2), which
  will have the same question.
- **R3. Level 10 is a jump** (42 solver pours against 25 at level 9, with 7 jars). The solver does
  not find the shortest path, so this overstates it, but it is the biggest step in the first ten,
  and it lands with the first frame unlock. Worth a look by `level-designer` in the difficulty
  bands (D36). It may be intended as the first "mini boss".
  **Resolved (D82, R3):** not a documented peak. The cause is the first tall-jar shape (5 × 8 = 40
  units against 24); shortest paths were 28 against 17, so the jump was real, not solver noise, and
  no pour cap could fix it (no 5 × 8 deal under 36). Level 10 is now 4 × 8 (6 jars): 32 solver pours,
  24 shortest. Tall jars from 20 stay 5 × 8; levels 1–9, the daily and the weekly are unchanged
  (`challenge.curve`, `design/gdd/level-generation.md` §2.1).
- **R4. Scenes are never introduced.** The Scenes button shows on Home with no hint that coins buy
  them. A "New: scenes" mark on the first Home after the player can afford one would fit the
  quiet style.
- **R5. The install card at 150% text on a 320 px phone scrolls a little inside itself** (the title
  partly scrolls off when focus lands on its button). Every element is reachable, but a shorter iOS
  text or a smaller title at that size would avoid the scroll.

## Not changed

The tutorial itself (clear, short), coin rewards, the shell and frame pacing (levels 5 and 10 feel
like rewards), and the Perfect mark on every early win (encouraging).
