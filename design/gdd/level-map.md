---
status: designed and signed off (owner interview 2026-11-08, D47–D52); build in sprint 9
source: to be built in src/ui/ (map screen) and src/core/ (pure marker and replay rules)
date: 2026-11-08
verified-by: owner interview 2026-11-08
---

# Level Map: Design Document

## 1. Overview

**Purpose**: show the player's journey. Today Home has a single "Play · Level N" button. The map replaces it with a winding beach path of level stones. It opens at the next level, shows what has been earned on each level and what's coming, and lets the player replay any cleared level to chase a Perfect mark or a better pour count.

**Scope**:
- the map screen and its path art;
- the level markers;
- replays started from the map, and their rules;
- how the map replaces Play on Home.

**Out of scope**:
- new rewards, because replays pay no coins (M1);
- online features and leaderboards (anti-pillars).

### Owner decisions (interview 2026-11-08)

| # | Decision |
|---|---|
| D47 | Design in sprint 8, build in sprint 9 |
| D48 | **A winding beach path**: level stones along a vertical, scrolling shoreline. The scenery changes every 20 levels (rock pools, dunes, a pier, and so on). The map opens scrolled to the next level |
| D49 | **Markers**: a Perfect mark; best pours (shown on tap); special-level icons (tall jars, shell milestones every 5th level, new-jar debuts); locked levels ahead, shown dimmed |
| D50 | **Replays**: no coins (M1). A replay can earn a missing Perfect mark and beat the best pours. A level's first Perfect counts once towards the Perfect stat and its unlocks |
| D51 | **The map replaces Play**: Play opens the map at the next level, with a large "Play · Level N" button on it |

## 2. Detailed Design

### 2.1 Core Mechanics

**Opening**:
- Home's Play opens the map, scrolled so the next level's stone is centred.
- A large primary button, "Play · Level N", sits fixed at the bottom. One tap starts the next level, so the old one-tap start is only one tap longer.
- Keyboard: Enter on the map plays the next level.

**Path** (signed off, D52):
- The stones snake up the screen, bottom to top in level order, about 6 to a screen height on a phone.
- The scenery behind them changes every 20 levels: rock pools, dunes, a pier, a lighthouse point, a cove, and so on, cycling.
- The current scene's colours apply.
- The path is drawn as CSS and SVG, with no image files, following the art direction.

**Markers** (D49):

| State | Look | On tap |
|---|---|---|
| Cleared | Sand-coloured stone with the level number | A small card: "Level N · best X pours · Perfect ✓/–", with **Replay** and **Close** |
| Cleared Perfect | As cleared, plus a Perfect shell mark | The same |
| Next level | Larger stone with a soft pulse (still under reduced motion) | Plays the level |
| Locked ahead | Dimmed stone with a lock | "Unlocks after level N−1"; shows what's special about it, if anything |
| Special (any state) | A small icon on the stone: tall jars, a shell (milestone), or a new-jar badge (debut, with the jar's name in the tap card) | As its state |

**Locked levels ahead**: the map shows the next 20 levels as locked stones, so the player can see what's coming (for example, "New jar at 41"). It never shows the boards themselves.

**Replays** (D50):
- **Replay** starts that level's board.
- Replays pay no coins (M1).
- Clearing it with no boosters, if the level wasn't yet Perfect, sets its Perfect mark and adds 1 to the Perfect stat. That stat counts towards the Driftwood frame unlock (10 perfect clears).
- A lower pour count updates the level's best.
- The win card says what changed: "Perfect earned", "New best: X pours", or "Replay: no coins".

### 2.2 State and Data
- The save gains `perfect: number[]` (or a bit set): the levels cleared Perfect, which feeds the marks and the D50 rule. `best` already holds the best pours per level.
- Specials come from the level spec (`challenge`, `milestoneDue`, the mechanic `unlockAt`), so nothing new is stored for them.
- `stats.perfectClears` counts **each level's first Perfect from the update onwards, once** (D52): from a first clear or a replay, it adds 1 when the level isn't yet in `perfect`. Old saves start with an empty `perfect` list and keep their counter value, so the stat only ever grows. A level that was Perfect before the update can count once more when it is replayed Perfect. The owner accepted that.

### 2.3 Integration Points
- **Depends on**:
  - `feel-audio-ui.md` (Home, screens, layers and focus)
  - `level-generation.md` (specs: tall jars and mechanics)
  - `shell-collection.md` (milestones)
  - `jar-mechanics.md` (debuts)
  - `economy.md` (M1: no replay coins)
  - `player-profile.md` (the Perfect stat and unlocks)
  - `save-data.md`
  - `scenes.md` (colours)
- **Depended on by**: `feel-audio-ui.md` (Play now opens the map).

## 3. Edge Cases
- A new player who hasn't finished the tutorial: Play behaves as today (tutorial first). The map appears from level 2.
- `?level=N` (QA replay, D3) keeps working, and also respects progress.
- Levels past 500: the path is endless. Stones and scenery are generated, with no stored layout. Scrolling uses virtualisation, so only visible stones are in the DOM.
- A save code restored with a different level: the map re-centres on the new next level.
- 150% text at 320 px: the stones scale, and the tap card scrolls. Each stone is a 44 px or larger tap target (D45 rule).
- Reduced motion: no pulse and no scroll animation. The map jumps straight to the next level.

## 4. Dependencies
See 2.3.

## 5. Acceptance Criteria (for sprint 9)
- [x] Play opens the map at the next level, and "Play · Level N" starts it in one tap.
- [x] Every cleared level shows its Perfect mark and best pours. Specials are iconed, and the next 20 levels are shown locked.
- [x] Replaying a cleared level pays no coins. A first Perfect sets the mark and counts once towards the Perfect stat. A better pour count updates the best. Unit tests cover the pure rules.
- [x] Works with the keyboard (arrow keys move between stones, Enter plays) and with a screen reader (each stone has a name such as "Level 41, cleared, perfect, new jar: frozen").
- [x] Screenshots: the map at levels 3, 60 and 201; a tap card; a locked stone; 150% text at 320 px; and reduced motion.

## Open Questions and Follow-Up Work
- Signed off 2026-11-08 (D52): about 6 stones per screen with new scenery every 20 levels, Perfect counted once per level from the update onwards, and the daily stays on its Home card, not on the map.

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-11-08 | Claude | Designed from the owner interview (D47–D51); drafts flagged for sign-off |
| 2026-11-08 | Claude | Drafts signed off by the owner (D52) |
| 2026-11-09 | Claude | Built in sprint 9 M3; §5 ticked with evidence in `production/qa/evidence/sprint-9/README-m3.md`. After a map replay, Continue returns to the map |
