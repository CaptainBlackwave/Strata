# Strata changelog

The game's release history. The repository's root `CHANGELOG.md` belongs to the Claude Code Game Studios framework, not the game. Versions come from `package.json` (D56). Each release is tagged `vX.Y.Z` on `main`.

**Tags and releases (D60).** The `Release` workflow (`.github/workflows/release.yml`, logic in `tools/release/release.sh`) does this:
- When a push to `main` changes `package.json`'s version, it tags that commit `vX.Y.Z` and publishes a GitHub release. The release notes are that version's section below.
- Running the workflow by hand with `mode: backfill` tags every row of the table below that is not tagged yet.
- An existing tag is never moved.

**Before a release (D185):** run `npm run build && npm run guard:layout`. It must exit 0: every Home tab and sheet, a board and its win card fit the screen at 412px and at 320px with 150% text. The report and any failure screenshots go to `production/qa/layout-guard/`.

When a release merges, add its row here so a backfill can recreate it.

| Tag | Commit on `main` |
|---|---|
| v0.5.0 | `b903057` (player profile) |
| v0.6.0 | `43c1420` (sprint 6, PR #2) |
| v0.7.0 | `ab56334` (sprint 7, PR #3) |
| v0.8.0 | `05d5be5` (sprint 8, PR #4) |
| v0.9.0 | `4a35afb` (sprint 9, PR #5) |
| v0.9.1 | `4cdd71f` (fixes after 0.9.0, PR #6) |
| v0.10.0 | `1ad5c4c` (sprint 10, PR #8) |
| v0.10.1 | `22d66e6` (look fixes, PR #9) |
| v0.11.0 | `6537631` (sprint 11, PR #12) |
| v0.11.1 | `57cfc47` (first-run fixes, PR #13) |
| v0.12.0 | `770639a` (sprint 12, PR #15) |
| v0.13.0 | `ebf60b7` (sprint 13, PR #23) |
| v0.13.1 | `252cc05` (gentler curve, PR #25) |
| v0.14.0 | `53b6c12` (sprint 14, sharing, PR #31) |

## Unreleased

## 0.21.0 (2026-11-12): sprint 23, wet sand
**For players**
- A new jar mechanic, **wet sand**, from level 201 (its intro card shows there, and the Jar guide and the map list it). Wet units are darker, with a drop and the pours left until they dry.
- Wet sand only pours onto its own colour, never into an empty jar ("Wet sand only goes onto its own colour"). Every pour on the board dries every wet unit by one; a full jar seals once its sand is dry, with a short shimmer as sand dries.
- About one level in eight from 201 has wet sand. Levels 1-200 are unchanged; daily, weekly and Winter Tide boards have none.

**Under the hood**
- Owner decisions D188-D192 (`production/sprints/sprint-23.md`, `design/gdd/jar-mechanics.md` section 2.7). `Jar.wet` counts per unit, the `'wet'` refusal, `isComplete` vs `isSealed`, `dried`/`sealedDry` on the pour event; the solver and hints know the rule and every deal is solver-proven. A board wins when sorted, and the winning pour dries it.
- Levels 1-200 are pinned by a fixture of board hashes made before the change. Some boards from 201 changed, as with every new mechanic.
- Screen-reader labels name wet units and their counts, colour-blind patterns follow the damp tone, reduced motion skips the shimmer. Layout guard: 48 screens, 0 overflow.

## 0.20.2 (2026-11-12): sprint 22, loose ends
**For players**
- The splash screen uses your saved scene's colours (a night scene no longer flashes light before Home).
- The Home hero's Realistic jars wear corks like the Classic ones, and the sparkle is larger and brighter.
- The iPhone install steps have bigger, clearer pictures (Share, Add to Home Screen, Add).
- Pours on big boards are smoother: HUD and screen-reader text are written once per frame, and audio no longer starts on the first tap while sound and music are off.

**Under the hood**
- Owner decisions D181–D187 (`production/sprints/sprint-22.md`). Classic, level 491, 4x throttle, fixed waits: p95 23–26 ms on a quiet machine (`production/qa/evidence/sprint-22/perf/`).
- New layout guard (`npm run build && npm run guard:layout`): every Home tab and sheet at 412px and 320px/150% text; 48 screens, 0 overflow. Now a release step.
- The play-through script's waits were fixed (Playwright treats an async predicate as instantly true); Realistic and Classic play-throughs win every run.

## 0.20.1 (2026-11-12): a tidier Today
**For players**
- The weekly set card on the Today tab shows its five jars in a row inside the card (they had stacked into a column running out of it).
- The card's title is the week's theme ("Lock and Key") with the days left below, instead of "Weekly set" twice.
- At 320px with 150% text, the Today cards no longer run past the right edge of the screen.

**Under the hood**
- `.mini-ico` (a grid, declared later) overrode `.weekly-jars`' flex; `.home .weekly-jars` now sets `display: flex`. `.home-panel` gets `grid-template-columns: minmax(0, 1fr)`. Evidence: `production/qa/evidence/0.20.1/weekly/`. Issue strata-26v (owner report).

## 0.20.0 (2026-11-12): sprint 21, feels like an app
**For players**
- An install card on Home after your 5th level: the browser's install on Android and desktop, step pictures on iPhone (Share, Add to Home Screen, Add). Shown at most twice, a week apart, and never once installed.
- A sharper app icon at every size (including a maskable one) and a splash screen while the game loads.
- Settings shows "Works offline" once the game is cached. A new version shows a "New version ready · Update" bar on Home; it never reloads in the middle of a board.
- The board no longer pinch- or double-tap-zooms, long-press menus are gone from game buttons, the status bar follows the scene, and vibration patterns are tuned (a Settings switch; off under reduced motion).
- The Home hero is back to the three logo jars, drawn in Realistic sand with a rare sparkle (CSS jars on Classic).
- On Realistic, settling sand forms smooth slopes instead of steps; Classic pours redraw only the jars that changed.

**Under the hood**
- Owner decisions D174–D180 (`production/sprints/sprint-21.md`). Pixi's system ticker is stopped in `GpuBoard.create`, so an idle Realistic board asks for no frames. Install, update-bar and haptic rules are pure and tested (`src/ui/logic/onboarding.ts`, `update.ts`, `haptics.ts`). Winter Tide dress rehearsal: `production/qa/evidence/sprint-21/winter/`.
- Closed: strata-1q0, strata-pwe, strata-2en, strata-8j3.

## 0.19.1 (2026-11-12): a game on Home
**For players**
- The Home hero is now a tiny game of Strata playing itself: 5 jars of mixed sand, a jar lifting and pouring its top colour onto a match every couple of seconds, corks sealing full jars, then a fresh mix. Tap it to start your level.
- A still picture on Classic, without WebGL and under reduced motion.

**Under the hood**
- Owner decision D173 (replaces the funnel scene). The hero runs a second copy of the board's own renderer, so the pour, cork and glow are the board's; seeded boards are kept only if the solver solves them in 6-14 pours (`src/ui/logic/home-hero.ts`, tuning in `homeHero`).

## 0.19.0 (2026-11-12): sprint 20, a new Home
**For players**
- A calmer Home: a live Realistic-sand scene (a still picture on Classic), the level and one big Play button, then today's daily, the event when one runs, and a card for your next streak reward with a track of every reward day.
- A tab bar at the bottom: Play, Today (daily, weekly, goals, event, streak rewards), Collection (shells, badges, jar styles, scenes, the map) and Profile (profile, stats, Settings). Tabs appear as they fill up; a dot marks something new.
- Today's goals moved to the Today tab.

**Under the hood**
- Owner decisions D166–D172, approved from a clickable mock-up (`prototypes/home-redesign/`). Pure, tested helpers for the hero, the tab unlocks and the streak card (`src/ui/logic/home-*.ts`, `streak-card.ts`); the tab bar is a full ARIA tablist with arrow keys.

## 0.18.0 (2026-11-12): sprint 19, real sand
**For players**
- A new Realistic board, on by default: soft matte glass jars and real grains of sand that slide to the lip, spill in a thin stream and pile up as they land.
- Every special jar, jar style, scene and colour-blind pattern works on it, along with corks, hints and the win glow.
- Settings > Realistic sand switches to the Classic board and back at any time, free. Phones without WebGL keep Classic.
- The sand pours from the jar's lip and the jar empties as it pours (fixed in 0.17.x on the Classic board too).

**Under the hood**
- Owner decisions D153–D165 and ADR-0001 (`docs/architecture/adr-0001-gpu-sand-board.md`): a PixiJS v8 board loaded on demand (about 103 KB gzipped), a pure sand simulation in `src/ui/sand/` (only the poured bands move, tested every step), the HTML jar buttons kept for input and accessibility, and a fall-back to Classic if WebGL is lost mid-game.
- Performance at 4× throttle in software WebGL: median frame 16.7 ms, p95 50 ms (pessimistic; real phones use the GPU).

## 0.17.0 (2026-11-11): sprint 18, a softer touch
**For players**
- The pour: sand streams in grains and settles into a soft pile that levels out; the pour and landing sounds follow how much sand moves.
- Sealing: the cork drops in with a small bounce and a sparkle, and the chime climbs a step with each jar sealed on the board.
- Winning: the sealed jars light up one by one before the win card, with a final chord in the scene's key. Tap to skip.
- Smoother sheets and cards, buttons that press in, and a gentle sway on Home.
- Winter Tide: light snow on Home and on event boards, and winter music while the event runs.
- Settings, Your stats: your progress, today, boosters and coins, and the game version and device, to copy and send with feedback. Nothing is sent automatically.
- Everything that moves stops under the device's reduced-motion setting.

**Under the hood**
- Owner decisions D148–D152. Performance at 4× CPU throttle on a 16-jar board: worst frame 76 ms with effects, 64 ms without; the cost is the existing board redraw (Beads strata-8j3), not the new effects.

## 0.16.0 (2026-11-11): sprint 17, Winter Tide
**For players**
- Winter Tide, every December (1–31, UTC): 24 gentle boards, one opening each day from the 1st to the 24th, all playable until the 31st. A Home card shows the boards open, your progress and the days left.
- 50 coins after every 6th board cleared; the Frost jar glass and the Winter Tide badge for all 24. The prize is yours for good, and a missed year can be finished next December.

**Under the hood**
- Owner decisions D141–D147. A reusable event engine (`src/core/events.ts`, `design/gdd/events.md`): a later event is one config entry. Save field `events`, repaired field by field. Event-only jar pieces and prize badges are never sold and survive save repair.

## 0.15.1 (2026-11-11): all your streak rewards
**For players**
- A "Streak rewards" sheet, opened from the line under the daily puzzle, shows all six rewards (days 3 to 100), which you have collected and how many days to the next.
- Buttons for things you can't get yet ("Needs N coins", "Streak reward · day N") are easier to read, with a small lock. The Close buttons in the Scenes and Jar styles sheets are full width.

**Under the hood**
- Beads strata-dll and strata-r20. A tester checklist for iPhone Safari and Firefox: `production/qa/tester-checklist-0.15.md`.

## 0.15.0 (2026-11-11): sprint 16, come back tomorrow
**For players**
- Streak rewards: keep your daily streak going for boosters on days 3 (Hint, Shuffle) and 7 (2 Hints, Shuffle, Jar), then the Tide Line frame (day 14), Sea Lantern jar glass (day 30), the Lighthouse name plate (day 60) and the Lighthouse Night scene (day 100). These can only be earned this way, are kept if a streak ends, and each day pays once. A streak you already have counts: your next daily solve collects what you passed.
- Today's goals on Home: three small goals each day, the same for everyone, worth 20–40 coins each and 50 more when all three are done.
- Fixes from a full bug check: Undo after a Shuffle no longer takes a pour off your count, and the "No pours left" banner comes back after Undo; the Settings button, switches and Jar styles buttons fit on small phones with large text; a weekly Share after Sunday midnight shares the week you were looking at; replaying a late level no longer freezes the screen; a damaged save resumes at your real level; storage that the browser blocks now shows a warning; a friend's challenge target no longer returns on later replays.
- A new version reaches you straight away: opening the game always checks for the latest release, and a game left open updates itself the next time you are on Home (never in the middle of a board). Before, a phone could show the previous version for up to 10 minutes after an update.

## 0.14.1 (2026-11-11): an easier climb
**For players**
- Levels get harder much more slowly. Ten colours from level 70 now last until level 250; 11, 12, 13 and 14 colours come at 250, 340, 420 and 490 (before: 65, 95, 130 and 170).
- Only one layer of sand is hidden until level 150 (before: two from level 30), and three only from level 450.
- Every level keeps two empty jars until level 300 (before: from level 60 many had one).
- Special jars still appear for the first time at their usual levels, but come more often only from level 250, and two on one board only from 250.
- Because boards from level 30 changed, best pours there start fresh, once. Your level, coins, shells and Perfect marks are kept. Levels 1–29, the daily and the weekly are unchanged.

**Under the hood**
- Owner decisions D125–D133. A simulated player that sees only visible sand (`tools/balance/sim-player.ts`) is the new difficulty measure: on 0.14.0 it got stuck on 40–80% of levels from 41 on; on 0.14.1 on none up to 150 and 12–14% from 151 to 300 (`production/qa/sprint-15/stuck-sweep.md`). The test `tests/unit/balance/gentle-climb.test.ts` holds the targets.
- The board-hash fixtures were re-baselined on purpose.

## 0.14.0 (2026-11-11): sprint 14, sharing
**For players**
- A link to Strata pasted into a chat or a post now shows a proper preview: the game's name, one line about it and a picture (sprint 14 H1).
- Sharing a daily or weekly result now sends a picture of it with the text, on phones whose share sheet takes pictures. A preview shows the picture first, with a Show my name switch that starts off. Elsewhere the text is shared or copied as before (sprint 14 H2).
- Challenge a friend: after clearing a level, or from a cleared level on the map, send a link that says "Can you beat my 34 pours?". Your friend sees the number to beat while they play, and can send their result back. A friend who hasn't reached that level is invited to play on instead. Challenges never pay coins (sprint 14 H3).
- A small Share appears on the win card when you complete a shell set, reach a 7, 30, 60 or 100-day daily streak, or earn a badge. It never pays anything (sprint 14 H4).

**Under the hood**
- Owner decisions D116–D124: growth by players sharing, web only, no server at all, no rewards for sharing (`design/gdd/sharing.md`).
- New: `sharing` in `game-config.json`, `src/ui/logic/share-card.ts`, `challenge.ts`, `moments.ts`, the canvas drawing in `src/ui/share-card.ts`, and the link preview image rendered by `tools/share/link-preview.cjs`.
- Nothing is sent to any server and nothing new is saved, except a challenge link that waits through the tutorial.

## 0.13.1 (2026-11-11): a gentler climb
**For players**
- Levels get harder more slowly. Colours used to reach 12 by level 45; now there are 9 at level 30, 10 at 45, 11 at 65 and 12 at 95 (13 at 130, 14 at 170).
- From level 21, every level ending in 3 or 8 is an easier board, with fewer colours and both spare jars.
- Less sand is hidden early: one layer until level 30, where there were two from level 12.
- Tall-jar levels have four colours through level 40, and no tall-jar level is much longer than the levels around it.
- Because the boards behind level numbers changed, best pours on levels 12 and up start fresh, once. Your level, coins, shells and Perfect marks are kept. Levels 1–11 are the same boards as before.
- Music now pauses whenever you leave the game, also when it is open inside another app's browser, and starts again when you come back (found in the phone check).

**Under the hood**
- Owner decisions D105–D112 after players reported that levels from 20 were too hard. Median solver pours for levels 31–40 went from 44 to 34; levels 171–200 are as long as before (`production/qa/gentle-curve/difficulty-sweep.md`).
- New config: `breather`, `challenge.maxPours`, `boardChanges`. The board-hash fixtures were re-baselined on purpose.

## 0.13.0 (2026-11-11): sprint 13, three new jars and the late economy
**For players**
- The hourglass jar, from level 101: every third pour anywhere on the board flips its sand upside down. The number on it counts the pours left, and Undo turns it back.
- The sieve jar, from level 141: banded in one colour, and only that colour may be poured in. Anything can be poured out.
- The clam jar, from level 181: shut under its shell until the count on it runs out (every pour on the board counts down), then it opens and plays like any jar.
- Each new jar has an intro card the first time you meet it and a spoken state for screen readers; the flip and the clam opening have their own sounds.
- From Saturday 28 November, the Saturday daily cycles through all seven special jars, the hourglass first. From the week of 30 November, the weekly set adds three themes: Turning Tides, Fine Sieve and Clam Bay. Every daily and weekly before those dates is unchanged.
- Long streaks pay more: +25 coins a day from day 30 and +50 from day 60.
- The seven priciest scenes cost less, now 4,500 to 5,400 coins (were 5,050 to 11,650), about two weeks of play each. Scenes you own are kept.

**Under the hood**
- Every board with a new jar is proven solvable by the solver, which models the flip, the band and the shell, so hints stay correct.
- New prices come from the economy model over a simulated year (`production/qa/sprint-13/late-ladder.md`).
- Pinned fixtures prove that no earlier level, daily or weekly board changed.
- Two Pages deploy fixes: explicit timeouts on the long solver sweeps (PR #18), and the placement tests split into three files (PR #20).

## 0.12.0 (2026-11-09): sprint 12, jar styles
**For players**
- Jar styles: from level 60, coins buy new looks for your jars in three slots: glass (Sea glass, Amber bottle, Cobalt rim, Pearl), corks (Driftwood, Rope knot, Scallop cap, Brass lid) and sand textures (Fine grain, Glint, Layered, Ripple). Mix and match any pieces you own.
- Preview any piece on sample jars before buying. Pieces cost 1,700 to 3,350 coins, about one or two weeks of play each.
- Styles are cosmetic only: they never change a rule or a sand colour, colour patterns stay visible on top, and nothing moves.

**Under the hood**
- A balance pass over a simulated year sets the prices (`production/qa/sprint-12/balance.md`); it also found that the scene ladder's top rungs now take three to five weeks each, noted for a later pass.
- The economy doc's stale post-collection bonus lines are corrected (the bonus was removed in sprint 7, D38).

## 0.11.1 (2026-11-09): a smoother first run, and a weekly bonus
**For players**
- Clearing all five weekly boards pays a 100-coin bonus, once a week. Single boards still pay nothing (D83).
- Share the weekly set and the link opens it directly. A daily or weekly link a friend sends before you have played the tutorial now waits for it, and is offered as soon as the tutorial ends.
- Level 3's win card mentions, once, that today's daily puzzle is on Home.
- Scenes shows a quiet "New" mark the first time you can afford one.
- Level 10, the first tall-jar level, has four colours instead of five, so it is a gentler step after level 9 (about 32 pours instead of 42).
- The Add to Home Screen card fits on small phones at large text, and the offline notice no longer covers it.

**Under the hood**
- The first-run review's recommendations R1–R5 are all resolved (D81, D82; `production/qa/sprint-11/first-run-review.md`).
- Tall-jar levels can now have their own shape rows (`challenge.curve`); only level 10 uses one.

## 0.11.0 (2026-11-09): sprint 11, badges, the weekly set and a smoother start
**For players**
- A badge shelf on your profile: 28 original seaside badges for playing, mastery, collecting, exploring and the daily. They are earned only by play and never cost or pay coins. Badges you have already earned appear quietly.
- A weekly set: every Monday (UTC), five themed boards, the same for everyone and playable all week. Each week features one special jar. Clearing all five earns that week's badge, and Share shows your pours. Weekly boards pay no coins.
- Sharing a daily now includes a link that opens that puzzle directly; an old day's link says the daily is over and offers today's.
- After a few levels, a one-time card shows how to add Strata to your home screen (the install prompt on Android, the steps on iPhone), and a one-time note says when the game is ready to play offline.
- First-run touches: a short explanation the first time the map opens, and a note on the boosters during level 1.

## 0.10.1 (2026-11-09): look fixes
**For players**
- The volume sliders are drawn in each scene's colours instead of the browser's grey, and stay readable in every scene.
- The seal shimmer and the win glow are tinted to match each scene: moonlight blue in Moonlit tide, blossom pink in Spring blossom, violet in Aurora night, and so on.

**Under the hood**
- Design docs brought up to date (the difficulty targets set in sprint 7, and the economy questions still open).
- A phone checklist page for the checks that need a real phone (D74).

## 0.10.0 (2026-11-09): sprint 10, feel and audio
**For players**
- Every scene has its own music: the same calm style, in its own key, tempo and sound, with an extra layer in some scenes (rain, sparkles, a soft thump at New Year). Changing scene crossfades, and the music goes quiet while the game is in the background.
- Sliders for sound and music volume in Settings; the switches still mute.
- Softer, richer sounds, plus new ones for the map, unlocks, shells, buying a scene and taking over from another tab. Vibration is tuned to match (Android).
- A soft shimmer when a jar seals, a gentle glow behind the win card, and coins that fly to your total. Smoother moves between Home, the map and the board. Reduced motion turns all of it off.
- At very large text sizes the booster counts stay readable and no longer cover the buttons.

**Under the hood**
- The booster, restart and leave confirmations and the key mapping are pure logic with unit tests (TD-12).
- Releases are tagged and published automatically from this changelog (D60).

## 0.9.1 (2026-11-09): fixes after 0.9.0
**For players**
- Hint and Shuffle think in the background, so the game no longer freezes on the biggest boards; the button shows "Thinking…" meanwhile.
- A shell you have not looked at yet stays marked "New" in the cabinet, even after closing the game.
- At large text sizes the booster prices, the map title and the map's scenery names no longer overlap anything.
- With two tabs open, a win in the older tab in the moment the new tab opens is no longer lost.
- Updates download cleanly: old game files are cleared from the phone, and a new icon or name shows without reinstalling.

**Under the hood**
- One fallback-step runner for levels and the daily (TD-5), boards byte-identical; clock and randomness injected in the UI (TD-16); the default scene comes from the config (TD-3).

## 0.9.0 (2026-11-09): sprint 9
**For players**
- A level map: Play opens a winding beach path of level stones. The scenery changes every 20 levels. Each cleared stone shows its Perfect mark and best pours, special levels have icons, and the next 20 levels show as locked stones with what is coming.
- Replay any cleared level from the map. Replays pay no coins, but they can earn a missing Perfect mark (which counts once towards the Perfect stat) and beat your best pours.
- One tab at a time: opening Strata in a new tab takes over, and the older tab offers "Play here", so two tabs can no longer overwrite each other's progress.
- Aurora night and Winter lights stay clear of the top bar. The Rainbow after rain arc no longer crosses the title. Seals in Meteor shower and Aurora night are easier to see.
- Smaller fixes: the tutorial explains why boosters are off; its caption wraps on small screens; the daily card says which day it is to screen readers; the newest shell is marked "New"; and equalling your best no longer says "new best".

**Under the hood**
- `main.ts` was split into one module per screen (TD-1). The single version now lives in `package.json` (D56).

## 0.8.0 (2026-11-08): sprint 8
**For players**
- Twelve new scenes to buy (the full scene ladder): Sea fog, High summer, Spring blossom, Autumn shore, Rainbow after rain, Winter snow, Harvest moon, Soft rain, Winter lights, New Year fireworks, Meteor shower and Aurora night. Seasonal ones show an "In season" badge, and holiday scenes take over Match my clock on their dates.
- A "Southern hemisphere seasons" setting.
- Levels start instantly: the next one is prepared in the background.
- Pinch to zoom. Jars are easier to tap (at least 44 px each).
- A "What's new" card after each update.
- A second tap confirms before a booster spends coins. The win card has a Home button. The Save code sheet keeps your code apart from the restore box. Pours and seals are announced to screen readers. Shift+1 to 0 pick jars 11 to 20.
- Fixed: jars could sit under the toolbar after opening a level at large text; the installed game could show an empty board offline; an interrupted pour could lock the board.

## 0.7.0 (2026-11-08): sprint 7
**For players**
- Sealed jars now show all their sand (they used to keep a "?").
- The first four ladder scenes. The endless coin bonus after all 40 shells is replaced by the scene ladder as the long-term coin goal.
- The longest boards are capped: levels 93, 153, 161 and 177 were re-dealt.

## 0.6.0 (2026-11-08): sprint 6
**For players**
- Undo is free and unlimited.
- A stuck banner offers Undo, Shuffle, Jar and Restart, and says when a board can no longer be won.
- Hints are visible with reduced motion and are announced to screen readers.
- Dialogs keep keyboard focus, text is readable in every scene, and there is a Settings button on Home.
- Restart and leaving a level ask first.

## 0.5.0 (2026-11-08): the player profile
**For players**
- A profile with your name, avatar, frame and name plate, earned by playing, plus lifetime stats.
