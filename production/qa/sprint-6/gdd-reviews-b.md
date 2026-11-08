# Sprint 6, Q1 part B: design reviews of five GDDs

> **Date:** 2026-11-08 · **Procedure:** `/design-review` (`.claude/skills/design-review/SKILL.md`), run non-interactively for the sprint 6 quality pass.
> **Review mode:** `lean` (sprint 6 capacity line), so Phase 3b specialist agents were not spawned. **Workflow:** `standard`.
> **Docs:** `shell-collection.md`, `scenes.md`, `feel-audio-ui.md`, `save-data.md`, `player-profile.md`. The other six GDDs are reviewed in part A.

## How this run differs from the skill

- **Freshness check not run.** `design/gdd/reviews/` does not exist, so every review here is a first review with no receipt. `review-receipts.sh` was not run because this session has no shell. No review log was written (read-only run).
- **Section presence checked by hand.** `gdd-structure-check.sh` was not run (no shell). I read each document's headings and spot-read every section a verdict depends on.
- **Registry empty.** `design/registry/entities.yaml` has no entries, so I cross-checked values against the related GDDs each document names, `src/config/game-config.json` and the source files in each doc's `source:` frontmatter.
- **No questions asked and no edits made.** Every point that needs the owner is recorded as a finding.
- **Cross-document issues** are counted in `gdd-cross-review.md` (IDs `GX-n`). Where one also shows up in a single doc, this file points to it without counting it a second time. The one exception is GB-PP-1, which is counted here and also as GX-2 because it is a defect in this one document.

## Severity and verdict scale

| Severity | Meaning |
|---|---|
| blocker | Blocks approval under the skill: a required section is missing, or a rule contradicts an owner decision or another GDD, so anyone implementing from the doc would build the wrong thing |
| major | The doc misstates what the code does or what was decided, or leaves a shipped rule unspecified |
| minor | Incomplete or imprecise, but a careful reader would not build the wrong thing |
| nit | Wording, consistency, or an advisory section |

**Verdicts:** APPROVED means no blocker and no major. NEEDS REVISION means majors, or blockers that one small doc edit can fix. MAJOR REVISION NEEDED means several blockers or a structural rewrite. "Required at `standard`" means Overview, Detailed Rules/Design, Edge Cases, Dependencies, Acceptance Criteria, plus Formulas when the system defines numeric rules. Player Fantasy and Tuning Knobs are advisory.

**Which is right:** where the doc and the code disagree, each finding says which one the owner-decision tables (D1–D18 and M1–M4 in `systems-index.md`, SC-1 to SC-8, PP-1 to PP-10) favour.

---

## 1. Shell collection (`design/gdd/shell-collection.md`)

**Verdict: NEEDS REVISION** · Completeness 6/6 required (Formulas required: milestone interval, rewards). Player Fantasy and Tuning Knobs are absent (advisory at `standard`).
Dependency graph: `economy.md` ✓, `daily-puzzle.md` ✓, `feel-audio-ui.md` ✓, `save-data.md` ✓, `player-profile.md` ✓ (all exist).
Values checked: everyLevels 5, coinsWhenComplete 50, setReward 150 + 1 of each booster, 8 sets × 5 = 40 shells, the 20 shapes, the set and shell names. All match `game-config.json` and `collection.ts`. The formula `5 − ((furthestLevel − 1) mod 5)` matches `openCabinet` in `main.ts`.
Rough scope signal: S.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GB-SC-1 | major | §4 Edge Cases, "Not Yet Handled" / "Unclear" | Both "Not Yet Handled" items are closed. The text "Replaying levels pays coins today (`economy.md`, confirmed mismatch)" is false: M1 is fixed, and `showWin` pays through `clearReward`, first clear only. The skip-ahead item is also closed (D3, sprint 5). "Unclear" holds two items that are already decided. The code is right (M1, D3). | Move all four items under "Handled in Code" with their decision IDs. Leave "Not Yet Handled" as "None". | S |
| GB-SC-2 | minor | §2.1 / §4 "unknown ids in a save are ignored" | Only `grantShell` ignores unknown ids. `storage.ts` keeps any string (it only de-duplicates), and `main.ts` uses `save.shells.length` for the home count, the Profile "Shells" stat and the `shells` unlock (Gold frame at 40). An edited or imported code with unknown ids inflates all three. See GX-15. | Say "unknown ids are not granted and not counted", then either drop unknown ids at load or count only catalog ids. Owner picks the fix. | S |
| GB-SC-3 | minor | §3 Formulas, "Shell supply" | "A daily player … in roughly a month" gives no levels-per-day assumption. `player-profile.md` §4 sets its unlock pacing to "match shell pacing (§3)", so two docs rest on an unstated number. | State the rate, for example "at ~3.5 levels a day: 5 shells a week from levels + 7 from dailies ≈ 12 a week, so 40 in about 3.5 weeks". | S |
| GB-SC-4 | minor | §5 Dependencies | §5 leaves out `player-profile.md`, which §2.3 lists as a dependant. It also never names the level win flow (`session-boosters.md` / `level-generation.md`), which triggers milestone shells. | Make §5 match §2.3, and add the level-win trigger. | S |
| GB-SC-5 | minor | Tuning Knobs (absent, advisory) | `everyLevels`, `coinsWhenComplete` and `setReward` have no safe range or rationale. `.claude/rules/design-docs.md` asks that balance values link to a rationale. | Add a Tuning Knobs table with each knob's safe range and what it affects, for example everyLevels 3–10, which changes how long the 40 shells last. | S |
| GB-SC-6 | minor | §4 Edge Cases (missing) | Catalog changes have no rule. Shells are granted "next unowned in catalog order", so a shell inserted into an earlier set (the seasonal-shells follow-up) would be granted next and could pay that older set's reward. Reordering sets changes which set a player finishes next. | Add a rule: new shells are only appended as new sets, ids are never removed or reordered once shipped, and the set reward is paid only when the shell that completes the set is granted. | S |
| GB-SC-7 | nit | §2.1 "Earning a shell" | "First daily solve of each day" does not say that a replay or an out-of-order solve (D10) grants no shell. The code grants one only when `counts` (`main.ts showWin`). | Add one clause: "a daily replay or a solve dated before the last one grants nothing". | S |
| GB-SC-8 | nit | Player Fantasy (absent, advisory) | No Player Fantasy section. The Overview's "a long-term goal: fill a cabinet" is close to one. | Add a two-line fantasy, for example "a beachcomber's cabinet that fills at a steady, guaranteed pace". | S |

Cross-document issues about this doc (counted in the cross-review): the brief's out-of-scope "no collection meta" (GX-3), and the Night Shore glow against "no magic" (GX-6).

---

## 2. Scenes (`design/gdd/scenes.md`)

**Verdict: APPROVED** (minor revisions recommended) · Completeness 6/6 required (Formulas required: prices, hours). Player Fantasy and Tuning Knobs are absent (advisory).
Dependency graph: `economy.md` ✓, `feel-audio-ui.md` ✓, `save-data.md` ✓, `player-profile.md` ✓.
Values checked: prices 0/300/500/800, hours 9–17 / 5–9 / 17–20 / 20–5, 16 tokens, the Manual/Auto/fallback rules. All match `game-config.json` and `themes.ts` (`activeTheme`, `themeForHour`, `buyTheme`). The 60 s re-check and preview-restore-on-close match `main.ts`.
Rough scope signal: S.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GB-SN-1 | minor | §4 Edge Cases; Open Questions | "Not Yet Handled" holds a decided item (scene sound, D17). "Unclear" holds a question that was never asked (can Midday be removed, can scenes be gifted or re-bought), recorded as "no change". "Open Questions" says "None open on sound", which hides the un-asked question. | Move scene sound to Handled. List the un-asked question under Open Questions as open, pending the owner. | S |
| GB-SN-2 | minor | §2.1 Picker | Not specified: turning on "Match my clock" saves at once and moves the preview to the clock's scene (`main.ts`, `set-auto` change handler). Picking a scene, by contrast, needs Buy/Use. | Add: "The clock toggle is saved immediately, with no confirm. Turning it on previews the clock's scene (if owned)." | S |
| GB-SN-3 | minor | §3 Formulas, "Cost in clears" | This duplicates `economy.md` §3 "Scene cost in levels", which also gives Perfect-clear figures. Two docs own one figure. See GX-16. | Keep the formula in `economy.md` and link to it from here. | S |
| GB-SN-4 | minor | §2.1 prices; Tuning Knobs (absent) | Prices 300/500/800 have no stated rationale or time-to-earn target. `economy.md` open question 1 leaves it open. The design-docs rule says balance values link to a rationale. | Add a Tuning Knobs row per price, with a safe range and a target (for example "Moonlit ≈ 2 weeks of a daily player's income"), set by the economy balance pass (GX-11). | S |
| GB-SN-5 | minor | §2.3 vs §5 Dependencies | The two lists differ: §2.3 "Depends on" leaves out `save-data.md`, and §5 leaves out `player-profile.md`. | Make the two lists match. | S |
| GB-SN-6 | minor | §6 Acceptance Criteria | Only core rules have criteria (`themes.test.ts`). Preview restore on close, the 60 s clock re-check, the address-bar colour and the button states ("Needs N coins (you have M)", disabled) have none. | Add Playwright or screenshot criteria for each, with a pass condition. | S |
| GB-SN-7 | nit | §2.1 Readability / §3 Contrast | The doc does not name which token pairs are checked. `contrastRatio` parses only `#rrggbb`, so the rgba tokens (`glass`, `surface`) cannot be the checked background. | List the checked pairs. Say that rgba surfaces are covered only by screenshots. | S |

Cross-document issue about this doc: Moonlit tide (stars, moon, dark mode) against the brief's "No night sky" (GX-6).

---

## 3. Feel, audio and UI (`design/gdd/feel-audio-ui.md`)

**Verdict: NEEDS REVISION** · Completeness 5/5 required. On Formulas: this doc defines layout thresholds and timings, but none a balance pass would tune, so I judged Formulas advisory (see GB-FA-7). Player Fantasy and Tuning Knobs are absent (advisory).
Dependency graph: every listed GDD exists ✓. `public/sw.js` (frontmatter) exists ✓.
Values checked: the `ANIM` timings match `main.ts:49`. The palette and pattern counts do not (GB-FA-2).
Rough scope signal: M (many screens, no new systems).

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GB-FA-1 | major | §2.1 Screens / Input / Settings | Out of date against the code. Not covered: the home profile chip, Profile, Edit Profile (tabs, radio grids, "Discard changes?"), the Save code sheet, and the win-card avatar and unlock rows. Settings leaves out "Save code". Keyboard leaves out Escape on the profile, edit, discard and transfer sheets, Enter in the name field (saves), and the new home rule that Enter plays only when no other home button has focus. The code (`main.ts wireInput`, keydown handler) is right per PP-1 to PP-10 and D16. | Add the four screens and the Save code button. Write the keyboard rules as a table per screen. | M |
| GB-FA-2 | major | §2.1 Accessibility; §4 Content Dependencies | The doc says "colour patterns (12 textures, one per colour)" and "palette (12 colours)". The code has 14 of each: `PATTERNS = 14`, `.pat-0`…`.pat-13`, and 14 palette entries in config. The code is right: D1 added lavender and sky, each with a pattern (`level-generation.md` §4). See GX-9. | Change to 14, and say patterns follow the palette size. | S |
| GB-FA-3 | major | §3 Edge Cases, "Not Yet Handled" | It still says "No text scaling. Font sizes are fixed pixels", which contradicts §5 and the code (rem-based, built in sprint 5, D14). | Move to Handled, citing D14 and the sprint-5 evidence. | S |
| GB-FA-4 | major | §2.1 Input (keyboard) | Keys `1`–`9` and `0` reach only the first 10 jars. Late boards have 16 or more (14 colours + 2 spares, plus narrow, funnel and extra jars). Jars are `<button>`s, so Tab then Enter works, but the doc never says so. "Keyboard play" is a stated accessibility claim. | Specify how jars 11+ are reached (Tab order and Enter/Space) and the focus order. Check it against `design/accessibility-requirements.md` in Q5. | S |
| GB-FA-5 | minor | §2.1 Accessibility, reduced motion | "Animation skipped, effects off" is too coarse. Under reduced motion the code also cuts the win delay from 650 to 0 and the seal-fx delay from 180 to 0, and skips the coin count-up. SC-6 keeps the Night Shore halo and stops only its pulse. | List what reduced motion does to each effect. | S |
| GB-FA-6 | minor | §5 Acceptance Criteria | "The tutorial, home, win card, settings, scenes, cabinet and jar guide on a phone" has no pass condition, so it cannot be tested. | Rewrite: "Each screen screenshotted at 320 and 412 px, 100% and 150% text, in all 4 scenes: no horizontal overflow, no overlapping controls, no text outside `strings.ts`." | S |
| GB-FA-7 | minor | Formulas (absent; advisory by judgement) | `computeLayout` sets numeric rules (jar width 26–68 px, at most 4 rows, an extra row only if it makes jars more than 10% larger, a smaller unit height so 8 units fit) that exist only as prose. They are presentation, not balance, so this does not block. | Add a short Formulas table for the layout rule, with an example at 16 jars on 320 px. | S |
| GB-FA-8 | minor | Tuning Knobs (absent, advisory) | The ANIM timings, vibration patterns, layout limits, hint highlight (2.4 s) and toast (2.6 s) are hard-coded in `main.ts`, `audio.ts` and `layout.ts`, not in `game-config.json`. The coding standard says gameplay values are data-driven. The code comment treats these as presentation-only. | Record that exemption in the doc, or move the values to config. Owner choice. | S |
| GB-FA-9 | nit | Player Fantasy (absent, advisory) | The Design Intent ("a pour should feel satisfying… calm and respectful") is a fantasy statement under another heading. | Promote it to a Player Fantasy section. | S |

Cross-document issues about this doc: the stuck message leaves out the free Restart (GX-1), and the dependency direction with `player-profile.md` (GX-10).

---

## 4. Save data (`design/gdd/save-data.md`)

**Verdict: NEEDS REVISION** · Completeness 5/5 required. There are no numeric rules, so Formulas is not required. Player Fantasy and Tuning Knobs are absent (advisory).
Dependency graph: every GDD named in §2.3 exists ✓.
Values checked: the key `strata.save.v2`, the legacy keys, `DEFAULT_SETTINGS` and the repair rules, against `storage.ts`.
Rough scope signal: S.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GB-SD-1 | major | §2.1 Saved fields; Repair | The table leaves out `profile` and `stats`, which are in the code (`storage.ts` `SaveData`) and in `player-profile.md` §3.8. Their repair rules are also missing: profile strings are stored as read, counters must be non-negative integers or become 0, and `main.ts` runs `repairProfile` after every load and restore. The code is right (PP decisions). | Add both rows, owned by `player-profile.md`, and their repair rules. | S |
| GB-SD-2 | major | §2.1 Detailed Design (missing rules) | Export and import (D16) appear only as Definition-of-Done and "Unclear" lines. The rules are not written down. As built: the code is `STRATA1:` + base64 of the UTF-8 JSON, and whitespace is ignored. A foreign or invalid code shows "invalid", plays the nope sound and changes nothing. The first tap shows the code's level and coins. The second tap replaces the whole save (progress, wallet, settings, tutorial flag, scenes, profile, stats), then repairs the profile, writes, restarts at `save.level` and shows Home. | Add an "Export / import" subsection with these rules, plus acceptance criteria (round trip, invalid code, two-tap restore). | M |
| GB-SD-3 | major | §3 Edge Cases (missing; code defect) | The restore confirmation is armed by the first valid code and is not reset when the text box changes (`main.ts restoreSaveCode`). A player can confirm the summary for code A, paste code B, and restore B without seeing B's summary. That risks losing progress. See GX-14. | Spec: editing the box disarms the confirmation, or the second tap must carry the same code as the first. | S |
| GB-SD-4 | minor | §2.1 Repair | "Each field is checked on its own" claims more than the code does. `best` is accepted as any object with no value checks. `themes.selected` is not checked against the catalog (that happens later in `activeTheme`). Unknown shell, mechanic and theme ids are kept and only de-duplicated. See GX-15. | Describe the actual behaviour, or tighten the repair. Owner picks. | S |
| GB-SD-5 | minor | §2.1 Writes | The list is incomplete. The save is also written at boot (after profile repair), on a daily solve, on the clock toggle, on a profile save and on restore. | Make the list complete, or say "after every state change". | S |
| GB-SD-6 | minor | §2.3 / §4 Dependencies | §4 says "all the system documents above", which is not a list. §2.3 "Depends on" names only `economy.md`, but load repair also needs the profile catalog and progress (`player-profile.md`). | List the dependencies explicitly. | S |
| GB-SD-7 | minor | §5 Acceptance Criteria | "What Exists" cites only `ui-helpers.test.ts`. It leaves out `tests/unit/profile/profile-save.test.ts` and the export/import tests. | Add both, with what they assert. | S |
| GB-SD-8 | nit | §3 "no schema version" | The versioning note should cover save codes too. `STRATA1:` is the code's version, so a future v3 save must still import `STRATA1` codes. Codes are plain base64 JSON, as easy to edit as devtools, which the doc already accepts. | Add both sentences. | S |

---

## 5. Player profile (`design/gdd/player-profile.md`)

**Verdict: NEEDS REVISION** (one blocker, a one-line fix) · Completeness 6/6 required, and all 8 sections are present. Of the five docs, this is the most complete and the most testable.
Dependency graph: `save-data.md` ✓, `economy.md` ✓, `session-boosters.md` ✓, `daily-puzzle.md` ✓, `shell-collection.md` ✓, `scenes.md` ✓.
Values checked: catalog ids, names and unlocks (8/6/6), `name.min`/`max`, the word-list limits, and the `progressOf` mapping, against `game-config.json`, `profile.ts` and `main.ts`. All match except where noted.
Rough scope signal: M.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GB-PP-1 | blocker | §3.4 Stats, "Perfect clears" | Defined as "first clears of a level with no boosters used (D4's Perfect)". That contradicts `session-boosters.md` §2.1/§3 and M2: Undo is free for Perfect, and a Hint that finds nothing does not count. The code uses `session.assists === 0` (`main.ts showWin`), so the code is right (M2). This also feeds the Driftwood frame unlock. Counted again as GX-2. | Change to "first clears won with `assists = 0` (`session-boosters.md`, M2)". | S |
| GB-PP-2 | minor | §1 note; §3.4 | Decision IDs are ambiguous. "Decision D5 ('no mascots')" and "D4's Perfect" are competitive-roadmap D5 and D4, but in `systems-index.md` D4 is narrow-jar sealing and D5 is the extra-jar cap. See GX-8. | Write "roadmap D5" and "roadmap D4", or use whatever new prefix GX-8 settles on. | S |
| GB-PP-3 | minor | §1 PP-5 vs §3.5; `strings.ts` | PP-5 says "letters, numbers and single spaces". §3.5 and the code (`NAME_CHARS`) also allow single hyphens. The error "Use 2–16 letters or numbers" mentions neither spaces nor hyphens. | Note in PP-5 that hyphens were added during the build. Reword the message, for example "Use 2–16 letters or numbers (spaces and hyphens between words)". | S |
| GB-PP-4 | minor | §3.5 "2–16 characters" | The counting unit is not stated. The code counts code points (`[...name].length`) and does not normalise, so a decomposed "Zoë" counts 4, and the same visible name can pass or fail depending on the keyboard used. | Specify NFC normalisation, then a code-point count (or grapheme clusters). Add a test. | S |
| GB-PP-5 | minor | §3.4 "Boosters used" | The doc does not say whether Undo counts. The code counts every applied booster, Undo included (`useBooster` → `bumpStats`). Since M2 calls Undo "free", a Perfect clear can still raise "Boosters used". See GX-17. | Owner decides whether Undo counts. State the answer in §3.4 and §5. | S |
| GB-PP-6 | minor | §4 pacing rationale | "25/50/75/100 levels at roughly 1, 2, 3, 4 weeks" assumes about 3.5 levels a day without saying so. "1 set ≈ 25 levels" ignores daily shells, which halve that for a daily player. | State the assumed play rate, the same one as GB-SC-3, and recompute the set line for a daily player. | S |
| GB-PP-7 | minor | §7 Tuning Knobs, `unlock.count` safe range | It calls "levels ≤ ~500" a content cap. Levels are endless; 500 is the range where generation is tested (`level-generation.md` §6). | Write "tested generation range (500)" instead of "content cap". | S |
| GB-PP-8 | nit | §4 Formulas, "Coins earned" example | The example says "Level reward 25 + set bonus 150 → +175", but 25 is not a possible level reward. `economy.md` §3 gives 20, 30, 50 or 60. | Use "Perfect clear 30 + set bonus 150 → +180". | S |
| GB-PP-9 | nit | §3.4 Shells / Sets / Scenes | Totals are hard-coded in the doc ("/ 40", "/ 8", "4 scenes"). The code uses the config totals. | Write "owned / total in config". | S |
| GB-PP-10 | nit | §5 Edge Cases | Escape on the "Discard changes?" dialog means Keep editing (`main.ts` keydown handler), and the doc does not say so. | Add one row. | S |

Cross-document issue about this doc: "Depended on by: nothing" against `feel-audio-ui.md` and `systems-index.md` (GX-10).

---

## Verdict summary

| GDD | Verdict | blocker | major | minor | nit |
|---|---|---|---|---|---|
| shell-collection.md | NEEDS REVISION | 0 | 1 | 5 | 2 |
| scenes.md | APPROVED | 0 | 0 | 6 | 1 |
| feel-audio-ui.md | NEEDS REVISION | 0 | 4 | 4 | 1 |
| save-data.md | NEEDS REVISION | 0 | 3 | 4 | 1 |
| player-profile.md | NEEDS REVISION | 1 | 0 | 6 | 3 |

**Totals: blocker 1 · major 8 · minor 25 · nit 8 (42 findings)**
