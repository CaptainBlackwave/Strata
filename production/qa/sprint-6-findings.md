# Sprint 6 findings report (Q6)

> **Status: for the owner to pick from (2026-11-08).** This merges the five sprint 6 reviews into fix bundles, sorted by severity. Each bundle lists the findings it closes, so nothing is lost. Pick bundles and answer the decisions in section 3; the rest go to the backlog.

## Sources

| Report | Scope | Verdict | Blocker | Major | Minor | Nit |
|---|---|---|---|---|---|---|
| `sprint-6/gdd-reviews-a.md` | 6 GDDs (pour rules, level generation, jar mechanics, session boosters, economy, daily puzzle) | all NEEDS REVISION | 0 | 14 | 19 | 10 |
| `sprint-6/gdd-reviews-b.md` | 5 GDDs (shells, scenes, feel/audio/UI, save data, player profile) | 4 NEEDS REVISION, scenes APPROVED | 1 | 8 | 25 | 8 |
| `sprint-6/gdd-cross-review.md` | all 11 GDDs against each other and the brief | FAIL | 2 | 8 | 8 | 3 |
| `sprint-6/ux-review.md` | 8 new UX specs in `design/ux/` | all NEEDS REVISION | 1 | 14 | 19 | 11 |
| `sprint-6/accessibility-audit.md` | 12 screens × A1–A7, focus, names, touch targets; 4 scenes | 78 pass, 29 fail, 13 n/a | 1 | 6 | 10 | 4 |
| **Total** | | | **5** | **50** | **81** | **36** |

Several problems were found by more than one review. Merged, there are **3 distinct blockers**: the invisible hint, the stuck message, and the Perfect definition. No review found a crash in normal play or a lost save in normal use. Two risks of lost progress (restore and leaving a level) are in bundle F6.

---

## 1. Fix bundles: player-facing (code)

Sizes: S = under an hour, M = a few hours, L = a day or more.

| # | Bundle | Severity | Size | What changes | Closes |
|---|---|---|---|---|---|
| **F1** | **Hint you can see and hear** | blocker | S | The hint ring is a static style (the pulse stays as an extra), so it shows under reduced motion. "From" and "to" differ by more than colour, through a lift and a badge. A toast reads "Hint: pour jar 2 into jar 5" for screen readers | AX-1, UX-board-1, AX-4, UX-board-2 |
| **F2** | **Stuck and refused-pour feedback** | blocker | M | The stuck message names Restart. A persistent stuck banner offers Undo / Shuffle / Jar / Restart until the board changes. A refused pour also shows a short toast ("Top colours don't match"), so it isn't motion and sound only. Toasts draw above every overlay | GX-1, UX-board-4, AX-5, UX-all-3 |
| **F3** | **Dialogs that hold keyboard focus** | major | M | One shared open/close helper: `inert` on everything behind the top layer, first focus on open, focus returned to the opener on close. Home sets a first focus. Enter on Share shares instead of continuing | AX-2, AX-3, UX-all-1, UX-all-2, UX-win-1 |
| **F4** | **Contrast in every scene** | major | S–M | Completed set headers and the name error get readable colours in moonlit. Accent text, fixed colours and `--surface-2` text are added to the per-scene contrast test, and every failing pair is fixed | AX-6, AX-7, UX-all-5 (plus AX-10 focus-ring contrast) |
| **F5** | **44 px touch targets** | major | S | Icon buttons, Edit tabs, secondary buttons and cabinet set headers get at least 44 × 44 px hit areas. Restart moves further from Settings | UX-all-4 (+ AX touch-target cells) |
| **F6** | **Protect progress** | major | S–M | Editing the save code resets the Restore confirmation. Restart becomes undoable. Leaving a level part-way (Home, Replay tutorial) asks first, or offers "Continue". The save-code box and name field allow text selection on iOS | GX-14, GB-SD-3, UX-settings-1, UX-board-3, UX-settings-2, UX-settings-3 |
| **F7** | **Never hang or break on a hard board** | major | M | Level and daily generation failures are caught, with a fallback board, and the daily gets the level fallback chain. Shuffle gets a time budget. When its search budget runs out, the hint says "Couldn't find a hint this time" instead of "No way forward". A late-level hint budget test is added | GA-LG-3, GA-DP-1, GA-SB-4, GA-SB-2 |
| **F8** | **Small UI fixes** | major | S | Settings button on Home (top row, opposite the profile chip). The "Match my clock" switch shows its real state after Use or Buy | UX-home-1, UX-scenes-1 |

## 2. Fix bundle: documents only (the code is right)

| # | Bundle | Severity | Size | What changes | Closes |
|---|---|---|---|---|---|
| **F9** | **Bring the GDDs up to date** | blocker (1) + major | M | Perfect is defined as M2's rule in `player-profile.md` (blocker). Stale numbers are updated: 14 colours and patterns, buried depth up to 3, the mechanic ramp 0.34 → 0.5, tall-jar mechanics from 100, Extra Jar with no cap. Closed "not yet handled" items move to handled. The missing rules for profile/stats and the save code are added to `save-data.md`. `feel-audio-ui.md` gets the profile screens and Save code. The economy's list of coin sources is completed. The two "D" numbering schemes are renamed so they no longer clash (roadmap D1–D5 → R1–R5). Minor and nit doc findings that touch the same files are fixed in the same pass | GX-2, GB-PP-1, GA-LG-1, GA-LG-2, GA-JAR-1, GA-SB-1, GB-SC-1, GB-FA-1, GB-FA-2, GB-FA-3, GB-FA-4, GB-SD-1, GB-SD-2, GX-8, GX-9, GA-ECON-2 |
| **F10** | **Refresh the game brief** | major | S | The brief records what you have approved since it was written: the shell collection and profile (collection meta), the moonlit scene and glowing shells, and audio. Its Undo and stuck-state lines follow decision D-a below | GX-3, GX-6 (+ GX-4 once D-a is answered) |

## 3. Decisions only you can make

| # | Question | Options | Recommendation | From |
|---|---|---|---|---|
| **D-a** | **Should Undo cost anything?** The brief says "Undo freely". The game gives 5 charges, then charges 40 coins. Restart is free and keeps Perfect, so restarting beats paying on short levels | (1) Keep it paid and change the brief. (2) Make Undo free and unlimited | (2): it matches the calm brief and removes the Restart workaround. Boosters keep their tension through Shuffle, Jar and Hint | GX-4, GA-SB-3 |
| **D-b** | **Can a sealed jar be poured from?** The rules allow it, but the screen won't lift one, so the game can think a useful move is left and hold back the stuck message | (1) No: make the rules match the screen. (2) Yes: let the screen lift sealed jars | (1): sealed means done | GA-PR-1 |
| **D-c** | **Say when a board can no longer be won?** A funnel with mixed colours, or a lock whose key colour is buried, can't be won, but play continues silently | (1) Detect it and show "This board can't be won now: Undo or Restart". (2) Leave it to the player | (1) | GA-JAR-3 |
| **D-d** | **How many mechanics per level?** The spare-jar swap can add a third mechanic from level 101 (e.g. frozen + locked + narrow) | (1) Allow up to 3 and document it. (2) Cap at 2 | (1): it's part of the D1 ramp | GA-JAR-2 |
| **D-e** | **Economy targets.** No reward or price is tied to a target, and after about level 60 coins only buy boosters | (1) Set targets (e.g. a scene every ~2 weeks of daily play) and add a long-term sink later. (2) Leave as is | (1), run `/balance-check` after | GA-ECON-1, GX-11 |
| **D-f** | **Difficulty target for levels 60–150.** Four levers move between levels 75 and 101 and nothing measures the result | (1) Set a target (e.g. median solution length per band) and test it. (2) Playtest by feel | (1) | GX-13 |

Smaller calls with a default I'll use unless you say otherwise:
- **GA-LG-6:** a level that falls back may lose its debut mechanic. Default: the intro card waits for the next level that has it.
- **GA-DP-5:** after the clock moves back, Home shows "Solved today" for an unsolved day. Default: show today's real state.
- **GA-DP-6:** Share uses the replay's pour count. Default: Share the first counted solve.

## 4. Backlog (not proposed this sprint)

- The other minor and nit findings (81 minor and 36 nit in total, fewer once merged) not covered by a bundle above. They stay in their source reports.
- Real-device checks the audit couldn't do: VoiceOver and TalkBack, iOS Dynamic Type, system reduce motion, pinch zoom (AX-17: `user-scalable=no`), Safari's Tab setting, sound and vibration on hardware.
- A shared interaction-pattern library (`design/ux/interaction-patterns.md`), noted as "not assessed" in every UX review.
- Registering entities in `design/registry/` (it's an empty stub, so values were checked against the code).
