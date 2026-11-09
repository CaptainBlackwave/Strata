# Strata changelog

The game's release history. The repository's root `CHANGELOG.md` belongs to the Claude Code Game Studios framework, not the game. Versions come from `package.json` (D56). Each release is tagged `vX.Y.Z` on `main`.

**Tags to create.** This project's Claude sessions can't push tags (their GitHub access covers only the working branch). The owner creates each one, either from GitHub (Releases → *Draft a new release* → type the tag → *Target*: the commit below; the notes under each version can go in the release body) or from a local clone (`git tag -a v0.8.0 05d5be5 -m "Strata 0.8.0" && git push origin --tags`).

| Tag | Commit on `main` |
|---|---|
| v0.5.0 | `b903057` (player profile) |
| v0.6.0 | `43c1420` (sprint 6, PR #2) |
| v0.7.0 | `ab56334` (sprint 7, PR #3) |
| v0.8.0 | `05d5be5` (sprint 8, PR #4) |
| v0.9.0 | the sprint 9 squash commit on `main`, once its PR is merged |

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
