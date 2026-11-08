# Sprint 6 Q1 (part A): GDD design reviews

> **Date:** 2026-11-08 · **Task:** Q1 part A (`production/sprints/sprint-6.md`) · **Reviewer:** game-designer (subagent)
> **Procedure:** `/design-review` (`.claude/skills/design-review/SKILL.md`), review mode `lean`, as sprint 6 sets it. Workflow `standard`.
> **Scope:** `pour-rules.md`, `level-generation.md`, `jar-mechanics.md`, `session-boosters.md`, `economy.md`, `daily-puzzle.md`

## How this run was done (read this before the verdicts)

- **Non-interactive and read-only.** No GDD, code or config was edited. No review log was appended, no systems-index status was changed and nothing was committed. Phase 5 (next-step prompts, tracking updates) was **not run**. The owner picks fixes from the merged report (Q6).
- **Phase 3b (specialist agents) not run.** It runs only in `full` mode and sprint 6 sets `lean`. Every finding comes from this single-session review, so none carries a specialist tag. There is no senior creative-director verdict, so the verdicts below are this review's own.
- **Helper scripts not run.** `review-receipts.sh` (freshness check) and `gdd-structure-check.sh` (section presence) need Bash, which this session did not have. Both checks were done by hand: no prior review logs exist in `design/gdd/reviews/`, so all six are **first reviews**, and section presence was read from each document's headings.
- **Registry empty.** `design/registry/entities.yaml` is the unpopulated stub, so the Registry Values check had no entries to search. Values were cross-checked against the code and `src/config/game-config.json` named in each doc's `source:` frontmatter, and against the owner decisions D1–D18 in `design/gdd/systems-index.md`.
- **Skill mismatch.** This run was started under the `balance-check` skill header, but the task asked for `/design-review`, and that is the procedure followed. No balance report was produced. The economy balance pass is still open (see GA-ECON-1).
- **Completeness at `standard`.** Required: Overview, Detailed Rules (accepted as `## Detailed Design`), Edge Cases, Dependencies, Acceptance Criteria, plus Formulas for all six (each defines numeric rules). **All six have all required sections (6/6).** None has Player Fantasy or Tuning Knobs. That is advisory at `standard` and is listed as a nit per doc, never as missing.
- **Dependency graph.** Every GDD named in every Dependencies section exists in `design/gdd/` (pour-rules, level-generation, jar-mechanics, session-boosters, economy, daily-puzzle, shell-collection, scenes, feel-audio-ui, save-data, player-profile). No broken references.
- **Severity → verdict.** `blocker` = cannot ship or implement as written; `major` = belongs under the skill's *Required Before Implementation* (wrong or missing rule, doc contradicts code or a decision, untested player-facing risk); `minor` = *Recommended Revision*; `nit` = *Nice-to-Have*. Any major gives at least **NEEDS REVISION**. **MAJOR REVISION NEEDED** is kept for a design that is unsound at its core. None of the six is.
- **Which is right.** Where a D-decision settles a doc-vs-code disagreement, the finding says so. Where no decision covers it, the finding is marked **owner decision**.

---

## 1. Pour rules (`design/gdd/pour-rules.md`, abbrev PR)

**Verdict: NEEDS REVISION** · Completeness 6/6 required · Scope signal: S

The core rules (legality, `min(run, free)`, reveal, seal, win) match `src/core/board.ts` exactly. The problem is the stuck rule. Whether a sealed jar can be poured from is decided in two places that disagree, and the stuck message depends on the answer.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GA-PR-1 | major | 2.1 Pour / Stuck; 4 Edge Cases | **Sealed jars: core and UI disagree, and stuck detection follows the core.** `canPour` (board.ts:96–107) lets a sealed jar be poured from. The UI's `isLiftable` (main.ts:1025–1028) refuses to lift it, and the solver prunes it (solver.ts:68). `usefulMoves` counts a sealed jar poured into an empty narrow jar or funnel as useful, because the kinds differ (board.ts:191). So `isStuck` can return false when the only "useful" moves are ones the player cannot make, and the stuck toast never appears. The GDD's legality list doesn't mention sealed jars at all. Not settled by D9, which covers swap-only pours only. **Owner decision.** | Make "a sealed jar can't be poured from" a core rule in `canPour` (or exclude it in `usefulMoves`), list it in 2.1, and add a board test for "sealed jar + empty narrow jar + otherwise blocked = stuck". | S |
| GA-PR-2 | minor | 2.1 Stuck | "An empty jar of the same kind" is not defined. Code: same capacity **and** the target is not a funnel (board.ts:191). A programmer can't reproduce the rule from the doc. | State the definition, with the narrow and funnel cases. | S |
| GA-PR-3 | minor | 1 Design Intent; 2.1 Stuck | "A stuck board is recoverable" is true, but "stuck" is only local: no useful move left. A board can be unwinnable while useful moves remain, so the player keeps pouring with no signal (worst with a mixed funnel, see GA-JAR-3). The doc presents stuck as if it detects lost positions. | Say plainly that stuck ≠ unwinnable, and point to the dead-end decision in GA-JAR-3. | S |
| GA-PR-4 | nit | 3 Formulas | `free` range is given as "1 to capacity". It is `1 … jarCapacity(target)` (2 for a narrow jar). The seal formula has no narrow-jar example. | Correct the range and add a narrow example. | S |
| GA-PR-5 | minor | 6 Acceptance Criteria | "A pour is legal only under the conditions in 2.1", cited to `board.test.ts`. That file has no frozen, locked or funnel case. Those conditions are tested in `mechanics.test.ts`. | Cite both files, or split the AC by condition. | S |
| GA-PR-6 | nit | (absent) Player Fantasy, Tuning Knobs | Advisory at `standard`. The only knob (capacity) is owned by level-generation. | Optional one-line Player Fantasy ("a single, readable, satisfying pour"). | S |

## 2. Level generation (`design/gdd/level-generation.md`, abbrev LG)

**Verdict: NEEDS REVISION** · Completeness 6/6 required · Scope signal: M

The ramp formulas check out against `levels.ts` (level 105 → 47.5%, level 82 → 0.42). But the doc was only partly updated after sprint 5. Its recipe, ranges and content list still describe the pre-D1/D8 game. It also claims a guarantee ("a level always loads") that the code does not enforce.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GA-LG-1 | major | 2.1 Recipe | "Every 10th level is a tall-jar challenge: … **no mechanics**" contradicts D8 (mechanics from level 100, built: levels.ts:97, `challenge.mechanicsFrom: 100`). The doc's own Edge Cases record D8. **D8 settles it: the code is right.** | Rewrite the bullet: "no mechanics before level 100; from 100, at the normal chance". | S |
| GA-LG-2 | major | 1, 2.1, 3 Formulas, 5 Content Dependencies | Stale ranges after D1. Colours "3–12" and "12-colour palette" (now 14; palette has 14 entries). Buried depth "0–2" (now 0–3). Jar count `colours + spare (+1)` with "spare = 2" misses spare 1 + narrow/funnel, combos (+2), fallback step 2 (2 spares + special jar) and extra jars. Content Dependencies omits `ramp.*`, `generator.stepNodeBudget` 25,000, `stepAttemptNodeBudget` 12,000 and `challenge.mechanicsFrom`. | Update every range and the jar-count formula, and list all config keys with current values. | S |
| GA-LG-3 | major | 2.1 Fallback chain; 4 Edge Cases | "Each step is still solver-proven, **so a level always loads**" is overclaimed. The last step can still throw (generator.ts:56–57), and `startLevel` has no catch (main.ts:706), so a failure leaves a broken screen. The "1–500 no failures" sweep is not a retained test: tests cover 1–200 plus 460 and 470 (placement.test.ts:96, 195). Levels are endless. | Define behaviour on total failure (e.g. a last plain 2-spare step that cannot fail, or a caught error with a re-deal), state the verified range, and keep the 1–500 sweep as a test or a retained report. | M |
| GA-LG-4 | minor | 6 Acceptance Criteria | "Average difficulty of levels 150–250 is more than 2 points above 46–58" uses a score the GDD never defines. The test defines it as `colours + buriedDepth + 3·(2 − spare) + mechanics.length` (placement.test.ts:161). | Add the score to Formulas, with its weights and rationale, or reword the AC. | S |
| GA-LG-5 | minor | 4 Edge Cases; 6 AC / DoD | Fixture range is inconsistent: Edge Cases says "fixture-tested for levels 1–80", the DoD says 1–59, and the test checks plain levels 1–59 only (placement.test.ts:75). "1–200 with mechanics replay to a win from the solver's own path" is really "every 4th mechanic level, by hints at a 60k budget". | Make all three say what the test does. | S |
| GA-LG-6 | minor | 2.1 Fallback chain | Fallback effects on difficulty and onboarding are not stated. Step 2 keeps the swap's narrow/funnel **and** adds back a second spare, so a fallback level is easier than an unswapped one. Step 3 drops every mechanic, including a debut mechanic on its debut level. | Document both effects, and decide whether a debut level may lose its mechanic (owner decision). | S |
| GA-LG-7 | minor | 2.1 Recipe (spare swap) | The spare swap runs after `pickMechanics`, so a debut level at 60 or above can gain an extra narrow jar. Locked's debut at 61 stays alone today only because of the current seed (the test at placement.test.ts:29 would catch a change). No rule protects the "debut alone" onboarding promise. | Skip the swap on debut levels in `levelSpec`, and state the rule. | S |
| GA-LG-8 | nit | (absent) Player Fantasy, Tuning Knobs | Advisory. Content Dependencies lists keys but no safe ranges. | Optional Tuning Knobs table with ranges. | S |

## 3. Jar mechanics (`design/gdd/jar-mechanics.md`, abbrev JAR)

**Verdict: NEEDS REVISION** · Completeness 6/6 required · Scope signal: M

The four jar rules match `board.ts` / `settle()` and are well tested. The schedule numbers and the combo ceiling no longer match the code after D1. One edge case overclaims what the stuck message catches.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GA-JAR-1 | major | 1 Design Intent; 3 Formulas; 6 AC | Stale chance. "P = 0.34", "between 25% and 45% of levels (tested)" and the AC "Between 25% and 45% of non-challenge levels" predate D1. The code ramps 0.34 → 0.5 from 45 to 120 (levels.ts:146–149), and the test asserts 42–58% past 120 (placement.test.ts:47–57). **D1 settles it: the code is right.** | Replace with the ramp formula (cite level-generation) and the tested bands. | S |
| GA-JAR-2 | major | 2.1 Schedule; 3 Formulas | Mechanics per level are higher than documented. The doc says one before 101 and two from 101. The spare swap (levels.ts:112–123) adds a narrow or funnel to a level that already rolled frozen or locked. So from level 60 a level can carry 2 mechanics, and from 101 up to 3 (e.g. frozen + locked + narrow). The test bounds only the rolled list (placement.test.ts:67). Ties to the open "small board combos" item in 4. **Owner decision:** allow this, or cap it. | State the real ceiling (or cap it in code), and add a test on `levelSpec(...).mechanics.length`. | S |
| GA-JAR-3 | major | 4 Edge Cases | "A funnel filled with mixed colours leaves the board stuck" overclaims. A mixed funnel makes the level **unwinnable forever**, since it can't be poured from or sealed. But `isStuck` fires only when no useful move is left (test: "…with nothing else to do", mechanics.test.ts:73). The player can keep pouring on a lost board with no signal. The same goes for a lock whose key colour ends up in a mixed funnel. Undo still recovers the board, but the player isn't told. **Owner decision.** | Add a cheap dead-end check (funnel holds two or more colours → unwinnable), show the stuck or dead-end message, document it, test it. | M |
| GA-JAR-4 | minor | 6 AC | "Every 10th level is plain" is stale (D8). "Levels 1–80 fixture" should be 1–59 (see GA-LG-5). | Update both. | S |
| GA-JAR-5 | minor | 4 Edge Cases | Generation timing disagrees between docs: here "worst 196 ms", level-generation "worst 577 ms", both for levels 1–500. | Keep one figure, owned by level-generation, with the sweep date. | S |
| GA-JAR-6 | nit | 2.1 Player-facing | Screen-reader example "locked until **teal** is sealed". The palette has no teal (lagoon, mint, sky). | Use a real palette name, after checking which name the UI speaks. | S |
| GA-JAR-7 | nit | (absent) Player Fantasy, Tuning Knobs | Advisory. `cap`, `count`, `chance`, `comboChance` have no safe ranges. | Optional Tuning Knobs table. | S |

## 4. Session and boosters (`design/gdd/session-boosters.md`, abbrev SB)

**Verdict: NEEDS REVISION** · Completeness 6/6 required · Scope signal: M

The Perfect rule (M2) and the history and extra-jar behaviour match `session.ts`. The open problems are a config value that contradicts D5, misleading hint feedback, an unmeasured worst case for Shuffle, and a pillar tension over Undo pricing.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GA-SB-1 | major | 5 Content Dependencies | "`extraJarsPerLevel` 1" contradicts 2.1 and D5. Config is `null` (no cap), built and tested (session.test.ts:191). **D5 settles it: the config is right.** | Change to `null` (no cap). | S |
| GA-SB-2 | major | 2.1 Hint; 4 Edge Cases | **The hint gives the wrong message when it gives up.** `hint()` returns null both when the board is unwinnable and when the solver budget ran out (session.ts:206–209). The UI shows "No way forward from here. Try undo or shuffle." for both (strings.ts:108), so on a large winnable board it tells the player the position is lost. The production budget is 40,000. The hint tests use 10k on levels ≤45 (session.test.ts:9, 78), and the 1–200 replay uses 60k (placement.test.ts:100). Nothing tests 40k on late boards (14 colours, 16+ jars). "Hints always lead to a win" is wider than the evidence. | Pass the reason up (`solvable === null` vs `false`) with a separate toast ("Couldn't find a hint this time"), and add an AC: at the 40k budget, hint returns a move on at least N% of sampled states for levels 100–200. | M |
| GA-SB-3 | major | 1 Design Intent (cross-doc: `design/game-brief.md`) | **Undo pricing vs the brief: pillar tension.** Undo costs a charge (5 at start), then 40 coins, which is 2 levels of income (economy). The brief says "Undo freely" (Core loop) and "Unlimited undo, … one extra jar per level" (MVP 4). That contradicts roadmap D3 ("boosters limited") and D5 (no Jar cap). This doc's "Undo is free" means free *for Perfect* only, which reads as free in coins. **Owner decision** between the calm "tidy-up" promise and booster tension. Hand to Q2 as a cross-doc contradiction. | Either update the brief to match the built economy, or make Undo free in coins. Reword "Undo is free" to "Undo never costs Perfect". | S |
| GA-SB-4 | major | 2.1 Shuffle; 4 Edge Cases | **Shuffle can freeze the game; never measured.** Shuffle runs up to 40 solver proofs of up to 40,000 states each, on the main thread. Using level-generation's ~22 µs per state, the worst case is about 1.6M states, roughly 35 s, on a stuck late board where most re-deals are unwinnable. The doc has no time bound and no edge case for a small free pool (e.g. one free jar). | Measure the worst case on late levels, cap the total shuffle states (as `generator.stepNodeBudget` does), and document the bound and the small-pool behaviour. | M |
| GA-SB-5 | minor | 2.1 Through the UI | "An extra Jar already used shows a toast without spending" can't happen with no cap, and the toast string still says "Only one extra jar per level." (strings.ts:109), which contradicts D5. | Remove the clause. Reword or drop `noJars`. | S |
| GA-SB-6 | minor | 1 Design Intent | Decision IDs collide. "Decision D3" here means `competitive-roadmap.md` D3 (boosters limited), but systems-index D3 is `?level=N` replay. Economy has the same problem ("D1–D5"). | Prefix the roadmap IDs (e.g. `CR-D3`) everywhere. | S |
| GA-SB-7 | nit | (absent) Player Fantasy, Tuning Knobs | Advisory. The hint and shuffle budgets have no safe ranges. | Optional. | S |

## 5. Economy (`design/gdd/economy.md`, abbrev ECON)

**Verdict: NEEDS REVISION** · Completeness 6/6 required · Scope signal: M

Wallet rules, prices and `clearReward` (M1) match `economy.ts` and config, and the example arithmetic checks out. The design gap is that the sink/faucet map is incomplete and no value is tied to a target.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GA-ECON-1 | major | 3 Formulas; Open Questions | **No value is tied to a target.** Every reward and price is a "first estimate". There is no target coins per session or time-to-scene (Open Q1), so none can be judged in or out of range. This breaks the design-docs rule "Balance values must link to their source formula or rationale", and leaves `/balance-check` with nothing to measure against. | Owner sets targets (e.g. minutes or sessions per scene, and how often a booster purchase should happen), then run `/balance-check` against them. | M |
| GA-ECON-2 | major | 2.1 Coin sources | **The faucet list is incomplete.** (a) Every counted daily solve also grants a shell (main.ts:816), so shells and set rewards (150 coins + 4 charges per 5 shells) come from dailies as well as every 5th level. (b) After all 40 shells, the 50-coin bonus **recurs** on every 5th level and every daily (main.ts:341–342). It has no end, but reads as a one-off. (c) Booster-charge faucets (8 sets × 4 charges) are missing from the map. | List every faucet with its rate (per level, per day, per set), including the recurring post-collection bonus. | S |
| GA-ECON-3 | minor | 3 Formulas (scene cost) | `price / reward` counts only level clears, so "Moonlit = 40 plain clears" ignores streak (30–100/day), set and tall-jar income and overstates the real cost. | Label it "level income only", or model the full flow once GA-ECON-1's targets exist. | S |
| GA-ECON-4 | nit | 2.2 Persistence | "Coins are floored and clamped at 0 when added". `addCoins` floors and ignores a negative *amount* (economy.ts:76). The balance itself isn't clamped. | Reword. | S |
| GA-ECON-5 | minor | 2.3 Integration; 2.1 Level reward | "`jar`-level data for the tall-jar flag" is garbled (it is `LevelSpec.challenge`, level-generation). The Sunday daily sets `challenge: true` (daily.ts:94) but pays no tall-jar or Perfect bonus, and this is not stated. | Fix the reference, and state that dailies pay only streak coins. | S |
| GA-ECON-6 | minor | 1 Design Intent | "`competitive-roadmap.md` D1–D5" collides with the systems-index D-numbers (see GA-SB-6). | Prefix the roadmap IDs. | S |
| GA-ECON-7 | nit | (absent) Player Fantasy, Tuning Knobs | Advisory. Config keys are listed without safe ranges (the 2–8 levels-per-booster test band is the only stated range). | Optional Tuning Knobs table. | S |

## 6. Daily puzzle (`design/gdd/daily-puzzle.md`, abbrev DP)

**Verdict: NEEDS REVISION** · Completeness 6/6 required · Scope signal: M

The streak, pass and UTC rules match `daily.ts`, and the formula examples check out (2026-11-08 is a Sunday; day 8 = 100 coins). The gaps are an unguarded generation path and a few rules that live only in the code.

| ID | Severity | Section | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GA-DP-1 | major | 2.1; 4 Edge Cases | **Some date's daily could fail to load, and nothing would catch it.** `generateDaily` calls `generateFromSpec` (60 attempts) with none of the fallback chain numbered levels have, and `startDaily` has no catch (main.ts:288). Only 8 weeks of dates are tested (daily.test.ts:56; placement.test.ts:113). Saturday (10 colours, depth 2, rotating mechanic) is the riskiest day. Players can reach any date by changing the device clock. | Add a retained sweep of at least 2 years of dates, and a fallback (drop the mechanic, then add a spare) like `generateLevel`. Document both. | M |
| GA-DP-2 | minor | 3 Formulas (daily seed) | "`FNV-1a(dateKey) XOR salt`" is wrong. The code XORs the salt into the FNV offset basis *before* hashing (daily.ts:77–81), which gives a different seed. Boards must stay identical, so the code is the requirement. | Rewrite as `FNV-1a(dateKey)` with basis `2166136261 XOR seedSalt`. | S |
| GA-DP-3 | minor | 2.1 Streak; 4 Edge Cases | The backwards-clock rule (D10, built) still sits under "Not Yet Handled" with ⚠️ and the old reset wording. It isn't among the 2.1 streak rules (`gap < 0` → no reward, no reset, `outOfOrder`, daily.ts:126–128). | Move it into 2.1 as a rule, and mark the edge case ✅. | S |
| GA-DP-4 | minor | 5 Dependencies | "Boosters and Perfect-style rules apply" is misleading. A daily pays no level reward, Perfect bonus or tall-jar bonus and shows no "Perfect" title (main.ts:810–825). Only streak coins and a shell. | State exactly what a daily pays and that Perfect doesn't apply. | S |
| GA-DP-5 | minor | 2.1 Home card | After the clock moves back, `streakStatus` reports `solvedToday` for any `gap ≤ 0` (daily.ts:153), so the card shows "Solved today ✓" for a date that wasn't solved. Not covered by D10 or the ACs. **Owner decision** (likely fine; document it). | Document the behaviour, or show the normal card when `gap < 0`. | S |
| GA-DP-6 | minor | 2.1 Share | Share sends the current session's pours, including a replay of an already-solved daily (main.ts:675), so a player can share a better count than the solve that counted. | Decide whether Share uses the first counted solve, and store its pours if so. | S |
| GA-DP-7 | nit | 2.1 Today | "Switches at 00:00 UTC" means an afternoon or evening switch in the Americas, and the card shows the UTC date (evidence `m4-utc-daily-card-kiritimati.png`). Worth a line for the Q3 UX spec. | Add a UX note. | S |
| GA-DP-8 | nit | (absent) Player Fantasy, Tuning Knobs | Advisory. `daily.week` and `streak.*` have no safe ranges. | Optional. | S |

---

## Totals

| Severity | Count |
|---|---|
| blocker | 0 |
| major | 14 |
| minor | 19 |
| nit | 10 |
| **total** | **43** |

Per document: pour-rules 6 (1 major) · level-generation 8 (3 major) · jar-mechanics 7 (3 major) · session-boosters 7 (4 major) · economy 7 (2 major) · daily-puzzle 8 (1 major).

**Verdicts:** all six NEEDS REVISION. None APPROVED, none MAJOR REVISION NEEDED, none NOT ASSESSED.

**For Q2 (`/review-all-gdds`):** GA-SB-3 (brief vs economy and D5 on Undo and the extra jar), GA-SB-6 / GA-ECON-6 (decision-ID collision), GA-JAR-5 (timing figures), and GA-PR-1 + GA-JAR-3 (what "stuck" means across pour-rules, jar-mechanics and session-boosters) span documents.
