# Sprint 9 M3: the level map (D47–D52), evidence

Spec: `design/gdd/level-map.md`. Built on the session branch after M2 (TD-1 split).

## What was built
- **Pure rules** in `src/core/map.ts`:
  - `mapAvailable`: the map shows only after the tutorial and from level 2.
  - `mapWindow`: cleared levels, the next level and 20 locked.
  - `stoneAt`: cleared, next or locked, plus the Perfect mark and best pours.
  - `specialsOf`: tall jars from `levelSpec`, shell milestones from `milestoneDue`, and debuts from `mechanics.list[].unlockAt`.
  - `sceneryAt`: a band every 20 levels, cycling through the config list.
  - `stoneName`: the screen-reader name, built from words passed in from `strings.ts`.
- **Replay rules** in `src/core/win.ts` (D50, D52):
  - Replays still pay no coins.
  - A level's first Perfect is added to `perfect` (kept sorted) and adds 1 to `stats.perfectClears`. This happens once per level, from a first clear or a replay.
  - A lower pour count updates `best`.
  - The card gains `perfectEarned` and `newBest`.
- **Save**: `SaveData.perfect: number[]`.
  - Old saves load it as `[]`.
  - Repair keeps integers from 1 to 1,000,000, deduplicated and sorted.
  - It survives export and import.
- **Config**: `game-config.json` → `map`:
  - `stonesPerScreen` 6, `lookahead` 20, `bandSize` 20, `maxStones` 50000;
  - `scenery`: rock pools, dunes, pier, lighthouse, cove.
- **Screen**: `src/ui/screens/map.ts` (`wireMap()` is called from `app.ts`), markup in `index.html`, CSS at the end of `style.css`. It has:
  - a winding path drawn with SVG and CSS from the scene tokens, a sea strip with surf, and per-band scenery art and a band name;
  - virtualised stones and bands;
  - a fixed "Play · Level N" button;
  - tap cards on the layer stack;
  - roving-tabindex keyboard moves;
  - a pulse on the next stone, removed under reduced motion.
- **Wiring**:
  - `board.play()` opens the map when `mapAvailable`.
  - `startLevel(n, quiet, replay)` sets `state.replay`.
  - After a replay, Continue reads "Back to map" and returns to the map, centred on the replayed level.
  - `keys.ts` routes keys to the map and its card.
  - The win card's replay note is "Perfect earned", "New best: X pours", or "Replay: no coins" (several are joined with " · ").

## §5 acceptance criteria

| Criterion | Evidence |
|---|---|
| Play opens the map at the next level; "Play · Level N" starts it in one tap | `m3/results.json` `map3`, `map60`, `map201`: `nextCentreOffset: 0` (centred) and Play reads "Play · Level N". `boardFromMap` equals `boardFromQuery` (`boardSame: true`), so a level started from the map gets the same jars and layout as `?level=60`. `m3/board-level-60-from-map.png` |
| Cleared stones show the Perfect mark and best pours; specials are iconed; the next 20 are locked | `m3/map-level-3.png`, `m3/map-level-60.png`, `m3/map-level-201.png`. The tap card shows "Best 22 pours · Perfect ✓" and "New jar: frozen" (`m3/tap-card-cleared-41.png`). The locked card shows "Unlocks after level 60" and "New jar: locked lid" (`m3/tap-card-locked-61.png`). `tests/unit/map/map.test.ts` covers the window (`last = next + 20`) |
| Replays pay no coins; a first Perfect sets the mark and counts once; a better pour count updates best; unit tests | `tests/unit/map/replay.test.ts` (12 tests). In the browser, the save after a replay of level 3 is `{ coins: 640 (unchanged), perfect: [3], perfectClears: 9 → 10 }`, and the card says "Perfect earned" with the Driftwood frame unlock: `m3/replay-win-perfect-earned.png`. After Continue the map shows "Level 3, cleared, perfect": `m3/map-after-replay.png` |
| Keyboard and screen reader | `results.json`: from Play, ArrowDown focuses "Level 60, next level, tall jars, shell milestone". 19 more ArrowDowns reach "Level 41, cleared, perfect, new jar: frozen". Enter opens its card with focus on Replay. Escape returns focus to stone 41. ArrowUp ×20 reaches "Level 61, locked, new jar: locked lid". Escape twice gets back to Home with focus on Play. Enter on the map with focus on Play plays the next level |
| Screenshots | Levels 3, 60 and 201; tap card `tap-card-cleared-41.png`; locked stone `tap-card-locked-61.png`; 150% text at 320 px: `map-se-320-text-150.png` and `tap-card-se-320-text-150.png` (stones 72 px, card 288×274 inside 320×568); reduced motion: `map-reduced-motion.png` (`pulse: "none"` against `stone-pulse` normally, scroll jumps) |

Also checked:
- **Level 1234** (`map1234`): 13 stones and 1 band in the DOM out of a 147,093 px track. Scrolled to the top, 7 stones remain.
- **Tutorial player**: Play still starts the tutorial (`tutorial`).
- **Level 1 after the tutorial**: plays directly (`level1`).
- **QA route**: `?level=N` is unchanged.
- **Errors**: none in any run (`errors: []`).

The script is `m3/shots.cjs` (`node shots.cjs http://localhost:5310 <outDir>` against `vite preview`). The screenshots are Pixel 7 except the SE ones.

## Tests
`npm test`: 506 tests in 32 files. The new ones are in `tests/unit/map/`:
- `map.test.ts`
- `replay.test.ts`
- `save-perfect.test.ts`
- `map-ui.test.ts`

`npm run typecheck` and `npm run build` are clean. The core and save tests were seen failing before they were implemented. For the save tests, that meant running them against the pre-M3 `storage.ts`.

## Deviations and notes
- **`win.test.ts` changed on purpose (D52).** "A perfect replay does not count" encoded the old rule. Its replay now starts from a save where level 2 is already Perfect.
- **No replay flag in `applyWin`.** It already tells a replay from a first clear by `level < save.level`, so the D50 rules apply to every replay, including `?level=N`. The UI flag `state.replay` only routes Continue back to the map.
- **Continue after a map replay returns to the map** ("Back to map"), instead of going to level N+1. The spec does not say; this keeps the player where they chose the replay.
- **Perfect mark**: a white shell on an accent disc at the stone's corner. The milestone shell icon sits in the tag row under the stone, so the two can't be confused.
- **`maxStones` (50,000)** caps the track at the most recent stones. Browsers limit element height (about 17–33 M px), and saves allow up to level 1,000,000.
- **At 150% text the pitch has a floor** of 4.75 rem, so a 320 × 568 screen shows about 4 stones rather than 6. They scale and never overlap (§3).
- **Pre-existing quirk, not changed**: `t.winText` says "new best" when the pours equal the old best and says nothing when they beat it. The new replay note covers a real new best.
