# Sprint 8 P6: TD-2 (split showWin) and TD-9 (data-s strings) - no-behaviour-change check

Date: 2026-11-08. Branch `worktree-agent-a259b66d04b6485fd`. Story: `production/sprints/sprint-8.md` P6.

## What changed

- TD-2: `showWin` is now `openWin` + `winTutorial` / `winDaily` / `winLevel` (+ `renderRewards`, `renderShell`). Save, reward and stat changes are the pure `applyWin` in `src/core/win.ts`.
- TD-9: index.html names its strings (`data-s`, `data-s-title`, `data-s-label`); `applyStrings` is one loop per attribute. Dotted keys (`whatsNew.button`, `tabs.avatar`) address nested groups.

## Method

Two builds served side by side with Vite and driven by the same Playwright script (Pixel 7, reduced motion, fixed save with name "Tester", What's new already seen, 5000 coins, 500 hint charges):

- **before**: base commit `f093d9f` (temporary worktree), port 5204.
- **after**: this branch at the TD-9 commit, port 5203.

The script dumps text, `title` and `aria-label` of every element under `#app`, and, per win flow, the whole win card, the in-game coins and the saved JSON (`localStorage`). Both outputs were compared with a deep equality check.

## Result: identical

No differences in any dump, no console errors or page errors in either build.

| Check | Before == after |
|---|---|
| Static labels: boot with What's new open, Home, Profile, Edit profile, Shell cabinet, Scenes, Settings, Save code, What's new, in-game HUD (10 dumps, 2,407 label rows) | yes |
| Level first clear (level 3): "Level cleared", "11 pours - new best", +20, save level 4, coins +20, stats pours 11 / coinsEarned 20 | yes |
| Level 5 first clear: shell row "New shell: Periwinkle" | yes |
| Level 5 with 4 Tide Pool shells owned: "New shell: Sea Star / Tide Pool set complete! +150 coins and 1 Shuffle, Jar and Hint"; coins +170 | yes |
| Replay of level 3 at save level 8: reward row hidden, note "Already cleared: no coins this time", level stays 8, coins +0 | yes |
| Perfect (the recorded hint moves replayed with no booster): "Perfect!", "No hint, shuffle or extra jar used", +30, perfectClears 1, boostersUsed 0 | yes |
| Daily first solve: "Daily solved!", "64 pours - 1-day streak", +30, Share shown, Continue says Home, shell granted, dailyShare {date, 64} | yes |
| Daily replay same day: reward hidden, "Already solved today: no reward this time", dailyShare unchanged (GA-DP-6), dailiesSolved stays 1, pours still counted | yes |
| Daily out of order (last solve dated 2099): "Your device date is earlier than your last solve...", streak 3 unchanged, no reward, no dailyShare (D10) | yes |
| Tutorial: "Nice pour!", "Start level 1" button, no reward row, `tutorialDone` true | yes |
| aria-describedby on the win card, avatar and Home-button visibility, Share visibility in every flow | yes |

Screenshots of the after build are in `production/qa/evidence/sprint-8/refactor/` (win-level-first, -shell, -set, -replay, -perfect; win-daily-first, -replay; win-tutorial; home screens: profile, edit, cabinet, scenes, settings, savecode, whatsnew).

## Not compared

- The daily "used a streak pass" and "earned a streak pass" notes: not driven in the browser; covered by `tests/unit/core/win.test.ts`.
- All-shells-owned completion bonus row: unit test only (the config has `coinsWhenComplete: 0`).
- The harness solves levels through the hint key and records the moves; the Perfect run replays them, so it is the same board by level number, not a different one.
- The restart/leave flows, scenes purchase and the profile edit were opened but not exercised; they were not touched.

## Automated

`npm test` all green (28 files, 472 tests, +19 over base: 17 in `tests/unit/core/win.test.ts`, 2 in `tests/unit/ui/index-strings.test.ts`), `npm run typecheck` and `npm run build` green. The existing economy, daily and collection tests were not changed.

Honesty note: the TD-2 pinning tests were written against `applyWin` (extracted in the same commit) with expected values taken from the old `showWin` rules, not by running the old code; the browser comparison above is what proves the refactor kept the old behaviour.
