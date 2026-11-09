# Sprint 10 F6: TD-12, the board's confirms and key mapping extracted and tested

Sprint: `production/sprints/sprint-10.md` F6 (D70). Debt: `docs/tech-debt.md` TD-12.

## What moved

| Pure module (DOM-free) | What it decides | Called from |
|---|---|---|
| `src/ui/logic/arm.ts` `stepBooster` | Booster price confirm (UX-board-7): idle, armed with the price until `now + window`, then bought, expired or disarmed. Also covers a free Undo, nothing to undo, not enough coins, a blocked board and a second assist (TD-13) | `useBooster`, `disarmBooster` in `src/ui/screens/board.ts` |
| `src/ui/logic/arm.ts` `stepRestart` | Restart's second-tap window (F6): acts at once with no pours, otherwise arms and restarts on a second tap inside the window | `requestRestart`, `disarmRestart` in `board.ts` |
| `src/ui/logic/leave.ts` `needsLeaveConfirm` | When "Leave this board?" asks: only for a part-way board (not from Home, not with 0 pours, not when won) | `leaveBoard` in `src/ui/screens/sheets/settings.ts` |
| `src/ui/logic/keymap.ts` `keyToAction`, `hasCommandModifier` | 1-9 and 0 pick jars 1-10, Shift picks 11-20 (digit from `e.code`), Z/S/J/H, R, Escape; Cmd, Ctrl and Alt are ignored; nothing while a layer is open; nothing past the last jar | `wireKeys` in `src/ui/screens/keys.ts` |

Both state machines take the time as a parameter. The board passes `performance.now()` and the
same 3 s `RESTART_CONFIRM_MS`. The existing `setTimeout` still sends the time-out, so an armed
button never stays armed on screen after its window. Both machines also export an explicit
transition table (`BOOSTER_TRANSITIONS`, `RESTART_TRANSITIONS`).

## Tests, seen failing first

- `tests/unit/ui/logic/arm.test.ts` (20), `leave.test.ts` (4), `keymap.test.ts` (9): 33 new tests.
- `tests-failing-first.txt`: the same files run before the modules existed (3 files fail to load).
- Suite: 573 tests in 40 files before, 606 in 43 after. `npm run typecheck` and `npm run build` are clean.

## Before and after in the browser

`compare.cjs` (Playwright Chromium, 390x844, reduced motion so pours settle fast) was run against
the base commit `fbb2874`, built from a `git archive` copy, and then against this branch. Each
build was served in turn with `npx vite preview --port 5440 --strictPort`. Every flow starts from
a fresh context seeded with `strata.save.v2`: `seenWhatsNew: "0.9.1"`, `tutorialDone: true`,
`level: 5` (141 for the keys), 500 coins (10 for the refusal), all boosters at 0, and every
mechanic seen. Home's Play opens the map, then `#btn-map-play` is clicked with `{force: true}`.
After each step the script records the toast text (cleared before the step), the shown and saved
coins, the saved charges, the badges, the armed tools, the Restart armed state and label, the
pours, whether Leave and Home are open, and the jar classes.

Flows: booster arm then buy; arm then a pour (disarms); arm then wait 3.5 s (expires) then arm
again; Hint with too few coins; Z with nothing to undo, then a free Undo; Restart with no pours,
then once and twice, then once and wait; leave with pours (asks, then Leave) and with none
(goes at once); on level 141 (17 jars) every key from 1-0, Shift+1-0, Ctrl+1, then Z, S, J, H,
R, R and Escape.

**Result: `before.json` and `after.json` are byte-identical** (sha256 `072ae0f5…7113e49`, 60
recorded steps over 9 flows). Screenshots of both builds: `*-booster-armed.png`,
`*-restart-armed.png`, `*-leave-asks.png`, `*-keys-level141.png`.

## Known boundary difference (not observable in the run)

Before, a second tap bought or restarted for as long as the armed class was still set, until the
time-out task ran. Now a tap at or after `armedAt + 3000 ms`, by `performance.now()`, re-arms
instead. The two differ only if a tap lands in the few milliseconds between the deadline and the
time-out callback.
