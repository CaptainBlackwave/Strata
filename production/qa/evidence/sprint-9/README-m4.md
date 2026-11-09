# Sprint 9 M4: one active tab (D57, TD-14)

Task M4 in `production/sprints/sprint-9.md`. Rule: **the newest tab takes over.**

## What was built

- `src/ui/tab-lock.ts` is the protocol. It has one message, `{ kind: 'claim', id, at }`, and is DOM-free and injectable. A tab claims the save when it opens and when the player presses Play here. A tab that hears a newer claim yields. `at` is a Lamport-style stamp, so a Play here always outranks the claim it answers. Equal stamps go to the larger id, so exactly one tab is active.
  - The channel is `BroadcastChannel('strata.tab.v1')`. Where that is missing, the fallback is the `storage` event on the localStorage key `strata.tab.v1`.
- `src/ui/screens/other-tab.ts` is the UI side. A yielding tab does three things:
  - it calls `pauseSaves(true)`, so `writeSave` does nothing;
  - it stops its music;
  - it **pins** the `#other-tab` overlay with `LayerStack.pin`. A layer that opens later, such as a win card from a pour still in flight, goes underneath it, and everything else is `inert`. Keys are swallowed while the overlay is on top.
- **Play here**:
  - claims the save, which resumes writes and makes the other tab yield;
  - reloads the save from storage and runs the boot repair (`knownShells`, `repairSaveProfile`);
  - writes, re-applies audio and scene, closes every layer, and starts the save's level behind Home.
- TD-14's second half: a write the browser refuses shows one toast per session (`onSaveError`, string `saveFailed`).

## Unit tests (written first, watched failing)

- `tests/unit/ui/tab-lock.test.ts`, 12 tests. They first failed because `src/ui/tab-lock.ts` did not exist. They cover:
  - the newest tab taking over;
  - Play here when its clock is behind;
  - a late older claim;
  - a simultaneous claim, which ends with exactly one active tab;
  - junk messages;
  - three tabs;
  - the storage-event channel;
  - a blocked store;
  - a paused `writeSave`;
  - the write-error hook.
- `tests/unit/ui/layers.test.ts`: one new test for the pinned layer. It first failed with `stack.pin is not a function`.

## Two-tab browser run

Script: `m4/two-tab.cjs`. Raw log: `m4/two-tab-result.json`.

Setup:
- Pixel 7 with reduced motion;
- two pages in **one** context, so they share localStorage;
- the save seeded once with `seenWhatsNew: '0.8.0'` and 60 hints, so the script can solve boards by following the hint ring.

The run was done twice: once over BroadcastChannel, and once with `BroadcastChannel` deleted, which forces the storage-event fallback. Both runs gave identical results.

| Step | Result (both channels) |
|---|---|
| A wins level 1 | save level 2, best `{1:10}` |
| B opens | B shows Home at **Level 2**, so it read A's progress. A shows the overlay: `other-tab` on top, win card and board `inert`, focus on Play here |
| Escape and a tap on A | the overlay stays |
| B wins level 2 | save level 3, best `{1:10, 2:11}`, 140 coins |
| A tries to write by script (Sound toggle, Continue) | the save is byte-identical to B's. **A did not overwrite B** |
| A presses Play here | A shows Home at **Level 3**, the save it reloaded. B shows the overlay with focus on Play here |
| A wins level 3, then B tries to write | final save: level 4, best `{1,2,3}`, 160 coins, 32 pours. **No save lost** |
| Page errors | none |

## Screenshots (each one looked at)

- `m4/m4-a-overlay.png`: tab A covered by the overlay once B opened. The win card is underneath and dimmed.
- `m4/m4-b-overlay-after-play-here.png`: tab B covered after A pressed Play here.
- `m4/m4-a-home-after-play-here.png`: A's Home after Play here, showing "Play · Level 3" from B's progress.
- `m4/m4-a-overlay-fallback.png`: the same overlay over the storage-event channel.

## Notes for the owner

- **Copy.** The title and the button are from the plan. The body line "Your progress is kept in that tab. Play here to continue on this one." is new, and `ux-designer` may want to reword it. The scrim for this layer is darker than other cabinets (0.6 instead of 0.35) so the win card behind it doesn't compete. That is a visual call for `art-director`.
- **Focus.** After a tap on the backdrop, focus is on `body`. Every other element is inert, so Tab still reaches only Play here.
- **Known gap**, recorded in `save-data.md`: a write in the old tab in the milliseconds between the new tab's load and its claim arriving can still be overwritten. Closing it would need Web Locks.
