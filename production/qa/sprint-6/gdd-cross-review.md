# Sprint 6, Q2: cross-GDD review

> **Procedure:** `/review-all-gdds` (`.claude/skills/review-all-gdds/SKILL.md`, references 1–7), focus `full`, run non-interactively for the sprint 6 quality pass. Read-only: no GDD, code, config or systems-index edits, and no commit.

## Cross-GDD Review Report

- **Date:** 2026-11-08
- **GDDs reviewed:** 11 of 11 present
- **Not read:** none
- **Focus:** full (consistency and design theory, plus the scenario walkthrough)
- **Systems covered:** pour-rules, level-generation, jar-mechanics, session-boosters, economy, daily-puzzle, shell-collection, scenes, feel-audio-ui, save-data, player-profile
- **Also read:** `design/game-brief.md`, `design/gdd/systems-index.md`, `design/competitive-roadmap.md` (decision table), `src/config/game-config.json`, and these source files: `main.ts`, `storage.ts`, `collection.ts`, `profile.ts`, `themes.ts`, `strings.ts`

### How this run differs from the skill

- **Phases 2 and 3 ran in this session, not as two parallel `game-designer` sub-agents.** This session has no Agent tool. Neither phase was skipped: every checklist item, 2a–2f and 3a–3g, was applied, and Phase 4 walked five scenarios.
- **Entity registry is empty** (`design/registry/entities.yaml` has no entries), so the consistency checks rely on reading the GDDs in full. Run `/consistency-check` after the fixes to populate the registry.
- **No `## Summary` sections.** No GDD has one, so the Phase 1a manifest was built from each Overview instead. That narrows nothing, because all 11 were loaded.
- **Pillars.** `design/game-brief.md` has no Pillars or Anti-pillars section. Pillar drift (3f) was checked against de facto pillars taken from the brief:
  - P1: a calm, tidy-up feeling in 1–3 minute bites
  - P2: every level is solvable and no failure is permanent
  - P3: coins come only from play, with no ads, IAP, lives or energy
  - P4: original, warm-daylight seaside art

  The anti-pillars are the brief's "Out of scope" list. The check ran, but against inferred pillars, which is recorded as GX-7. The verdict is set by the blockers, not by this gap.
- **Player Fantasy (3g).** Only `player-profile.md` has a Player Fantasy section. For the other ten, fantasy coherence was judged from their Overview and Design Intent (GX-19).
- **Cross-References tables (2c).** No GDD has one, so the stale-reference check was a prose scan only (GX-21).

### Severity mapping

The skill's blocking items map to **blocker**. Its warnings map to **major** or **minor**, by player impact. Its info items map to **nit**. Where a contradiction is settled by an owner-decision table (D1–D18 and M1–M4 in `systems-index.md`, the roadmap D1–D5 and S2–S4, SC-1 to SC-8, PP-1 to PP-10), the finding names the document that is right.

---

### Consistency (Phase 2)

- **2a bidirectionality:** one asymmetry, feel-audio-ui ↔ player-profile, plus two `systems-index.md` rows (GX-10). The per-doc omissions in shell-collection §5, scenes §5 and save-data §4 are counted in `gdd-reviews-b.md`.
- **2b rule contradictions:**
  - Perfect (GX-2)
  - palette size (GX-9)
  - extra-jar cap (GX-5)
  - how unknown shell ids count (GX-15)
- **2c stale references:**
  - Decision IDs that point into two different tables (GX-8).
  - Every GDD-to-GDD reference resolves to an existing file and element. Examples: `player-profile.md` → `shell-collection.md` §3, `daily-puzzle.md` → `generateFromSpec`, `session-boosters.md` → `level-generation.md` solver.
- **2d ownership:** the scene-cost formula is owned twice (GX-16). `economy.md` restates the streak, set and scene figures, but it declares them "listed here for the coin flow", so that is accepted.
- **2e formula compatibility:** the coin flow has no measured target on either side (GX-11). Level rewards (20/30/50/60) match their downstream uses in `scenes.md`, `player-profile.md` and `economy.md`, except the profile example (GB-PP-8).
- **2f acceptance criteria:** no criteria contradict each other once GX-2 is fixed. The profile's Perfect-clear unlock test and session-boosters' "Undo three times and still win Perfect" pass together only under the M2 definition.

### Design theory (Phase 3)

- **3a progression loops:** one primary loop: numbered levels unlock the next level. Shells, profile unlocks, the daily streak and scenes all hang off it. Shells and profile unlocks are paid by the same milestones (levels, dailies, sets), which reinforces the primary loop rather than competing with it. No finding.
- **3b attention budget:** three systems are active during a level: pours, jar mechanics (up to 2 from level 101) and boosters (four, with a charge-or-coins choice). Economy, shells, profile and the daily are passive during play. That is within the 3–4 limit. No finding.
- **3c dominant strategies:** Restart substitutes for paid Undo (GX-4). Buying Extra Jars cancels the spare-jar ramp lever (GX-12).
- **3d economy:** coins have one repeatable sink and several one-time ones (GX-11). Booster charges have a fixed lifetime supply, with no shop (D7) (GX-4).
- **3e difficulty:** several levers change between levels 75 and 101, and nothing measures difficulty or session length (GX-13).
- **3f pillars:** the brief is out of date against the shipped scope (GX-3, GX-4, GX-5, GX-6), and the pillars are not formal (GX-7).
- **3g fantasy:** no conflicts. Every document presents a calm, earned, seaside tidy-up; the profile's "never a nag and never a store" matches P3. Coverage is thin (GX-19).

### Scenarios walked (Phase 4): 5

1. **First clear of level 25 completes Tide Pool.** Chain: level reward → milestone shell → set reward → profile unlocks. In order: `clearReward` pays 20 or 30, shell #5 completes the set for +150 coins and 1 of each booster, and both Lighthouse (levels ≥ 25) and Anchor (sets ≥ 1) unlock. `newlyUnlocked` runs after `awardShell`, so the win card shows the shell row, the set line and two unlock rows. "Coins earned" adds both amounts. Works as documented. The stacked rewards are by design (nit only, no finding).
2. **Stuck with no charges and too few coins.** Chain: pour-rules → session-boosters → economy → feel-audio-ui. **Contradictory messaging** (GX-1).
3. **Daily solve: out of order, or with all 40 shells owned.** Chain: daily → shell → economy → profile. Out of order: no coins, no shell, no `dailiesSolved`, but pours are counted. All shells owned: +50 coins, counted in "Coins earned". `daily-puzzle.md`, `shell-collection.md`, `player-profile.md` §5 and the code agree. Midnight-UTC crossing is not specified (GX-18).
4. **Restore a save code mid-session.** Chain: save-data → player-profile → scenes → economy. The confirmation state is undefined (GX-14).
5. **Perfect win that used Undo.** Chain: session-boosters → economy → player-profile. Contradictory definitions and messaging (GX-2, GX-17).

---

## Findings

| ID | Severity | Documents and sections | Finding | Suggested fix | Size |
|---|---|---|---|---|---|
| GX-1 | blocker | `game-brief.md` "Player goal & fail state" · `pour-rules.md` §1 Design Intent · `economy.md` §2.1 "Using a booster" · `feel-audio-ui.md` §2.1 (strings) | **Scenario 2, contradictory messaging.** The brief says the stuck state "offers Undo, Restart or the extra jar". `pour-rules.md` §1 says a stuck board is recoverable through "undo, shuffle, extra jar", leaving out Restart. The code's stuck toast says "No pours left. Undo, shuffle or add a jar." (`strings.ts` `stuck`). A player with no charges and less than the price is refused all three, and then told "Needs N coins. Clear levels to earn more." (`notEnoughCoins`) for a level they cannot clear. The only way out is the free Restart, and no message names it. A funnel dead end (`jar-mechanics.md` §2.1) is the likeliest way to get there. The brief is right (P2). | The stuck text names Restart, and when no booster is affordable says "Restart is free". Add Restart to `pour-rules.md` §1. | S |
| GX-2 | blocker | `player-profile.md` §3.4 "Perfect clears" · `competitive-roadmap.md` D4 · vs `session-boosters.md` §1, §2.1, §3 · `systems-index.md` M2 | **Rule contradiction on a rewarded rule.** The profile and roadmap D4 say "Perfect = no boosters used". `session-boosters.md` and M2 say Undo is free and a Hint that finds nothing does not count. Perfect pays +10 coins (`economy.md` §3) and drives the Driftwood frame unlock. The code follows M2 (`assists === 0`), and M2 is right. Same defect as GB-PP-1. | Restate Perfect as `assists = 0` in `player-profile.md` §3.4, and add a "superseded by M2" note to roadmap D4. | S |
| GX-3 | major | `game-brief.md` "Out of scope" ("No mascot, story or collection meta") · vs `shell-collection.md` §1–2 · `player-profile.md` §1, §3.6 | **Anti-pillar drift.** Two shipped systems are collection meta: the 40-shell cabinet with set rewards, and milestone-unlocked cosmetics. Owner decisions S2-3, S2-4, SC-1 to SC-8 and PP-1 to PP-10 approved both, so the GDDs are right and the brief is out of date. The brief is the design record for P1–P4, so its out-of-scope list is now wrong. | Amend the brief: allow "milestone collections and cosmetics, never random, never sold"; keep "no mascot, no story". Optionally add a "post-MVP scope" section. | S |
| GX-4 | major | `game-brief.md` Core loop ("Undo freely") and MVP 4 ("Unlimited undo") · vs `economy.md` §2.1, §3 · `session-boosters.md` §1, §2.1 · `game-config.json` `boosters.undo` | **Pillar drift plus a degenerate strategy.** Undo costs a charge (5 at start, +1 per completed set, so 13 for a whole playthrough) and then 40 coins (2 plain clears). Restart is free and unlimited, and keeps the Perfect mark (`session-boosters.md` §2.1). On a 1–3 minute level, a player with no Undo charges is better off restarting than paying for an undo. The tension with P1 (calm) is also confusing: M2 calls Undo "free" (for Perfect) while it costs coins. Roadmap D3 ("Boosters are limited… charges, then coins") covers boosters but never names Undo, so neither decision table settles this. | **Owner decides.** (a) Keep paid Undo and amend the brief. (b) Make Undo free and unlimited, as in the brief, and keep the charges for Shuffle, Jar and Hint. (c) Free Undo with a per-level allowance. Option (b) also removes GX-17. | S (doc) / M (code, if b or c) |
| GX-5 | minor | `game-brief.md` Core loop ("one extra-jar rescue per level"), MVP 4 · `session-boosters.md` §5 ("`extraJarsPerLevel` 1") · vs `session-boosters.md` §2.1 · `systems-index.md` D5 · config `extraJarsPerLevel: null` | **Out-of-date cap.** D5 removed the per-level cap (built in sprint 5). The brief and `session-boosters.md` §5 still say 1. D5 is right. | Update both to "no cap (D5)". | S |
| GX-6 | major | `game-brief.md` "Art & audio direction" ("warm daylight… No night sky, no magic"), "Out of scope" ("No audio in the MVP") · vs `scenes.md` §2.1 (Moonlit tide: deep-blue dark mode, stars, moon) · `shell-collection.md` SC-6 (Night Shore glow) · `feel-audio-ui.md` §2.1 (synthesised sound and music) | **Pillar drift (P4).** The owner chose the night scene (S4-1), the glowing shells (SC-6) and audio (roadmap C1). The GDDs are right and the brief's art direction is out of date. Unless it is amended, the Q8 art review has no current reference to judge against. | Amend the brief's art direction: "warm seaside light through the day, night included; no fantasy magic". Mark "no audio" as MVP-only. | S |
| GX-7 | minor | `game-brief.md` (no Pillars section) | **No formal pillars or anti-pillars.** Pillar drift for this review was judged against inferred pillars P1–P4. Future reviews will infer them differently. | Add 3–4 pillars and an anti-pillar list to the brief. P1–P4 above are a starting draft for the owner. | S |
| GX-8 | major | `systems-index.md` "Decisions" D1–D18 · `competitive-roadmap.md` D1–D5 · cited by `economy.md` §1 ("competitive-roadmap D1–D5") · `session-boosters.md` §1 ("decision D3" = roadmap) and §2.1 ("decision D5" = index) · `player-profile.md` §1 ("D5 'no mascots'" = roadmap), §3.4 ("D4's Perfect" = roadmap) · `jar-mechanics.md`, `level-generation.md`, `daily-puzzle.md` (index) | **Stale and ambiguous references.** Two decision tables share the IDs D1–D5 with different meanings: index D5 is "no Extra Jar cap" and roadmap D5 is "no mascots". `session-boosters.md` uses both meanings in one document. Any reference to D3, D4 or D5 is ambiguous. | Prefix one series, for example roadmap `RD1`–`RD5` or index `OI-1`…`OI-18`, and update the citations. A mechanical edit across about 8 docs. | M |
| GX-9 | major | `level-generation.md` §2.1 ("clamped to the 12-colour palette"), §3 ("colours 3–12"), §5 ("palette (12 colours)") · `feel-audio-ui.md` §2.1 ("12 textures"), §4 ("palette (12 colours)") · vs `level-generation.md` §4 (13 from level 90, 14 from 130) · config `palette` (14) · `main.ts` `PATTERNS = 14` | **Rule contradiction.** If someone implemented from §2.1, the clamp to 12 would cancel D1's "more colours" lever. The code and D1 are right. | Change every "12" to 14, and say that colour patterns track the palette size. | S |
| GX-10 | minor | `feel-audio-ui.md` §2.3 (player-profile is "depended on by") · `player-profile.md` §6 ("Depended on by: nothing"; Depends-on leaves out feel-audio-ui) · `systems-index.md` row 9 (feel: 1–8, 10) and row 11 (profile: 4–8, 10) · `systems-index.md` row 5 (economy: 4) vs `economy.md` §2.3 (also level-generation) | **Dependency asymmetry.** The docs disagree on which way feel-audio-ui and player-profile depend on each other, and the index lists neither direction. The index's economy row leaves out level-generation (the tall-jar flag). | Pick one direction. The convention for rows 1–8 suggests feel depends on 11, as it does on 1–8. Then update both GDDs and rows 5, 9 and 11. | S |
| GX-11 | major | `economy.md` §2.1 sources and sinks, §4 (balance not measured), Open Question 1 · `scenes.md` §1 ("Give coins a long-term use"), §2.1 · `shell-collection.md` §2.1 · `daily-puzzle.md` §3 · `systems-index.md` D7 · `player-profile.md` PP-7 | **Sinks are mostly one-time.** Sources: levels 20–60, dailies 30–100 a day, sets 8 × 150 = 1,200, and 50 per milestone after 40 shells. Repeatable sinks are boosters only. Scenes total 1,600 and are one-time; D7 rules out a shop and PP-7 rules out coin cosmetics. Projection for a player who buys no boosters: ~1,780 coins by level 60, enough for all three scenes. By level 200, ~5,900 coins from levels and sets alone (plus Perfect bonuses and ~2,700 for a 30-day streak), with nothing left to buy. The "long-term use" that `scenes.md` claims lasts about 60 levels. Paid boosters at 40–120 can absorb ~23 coins a level, so it is not an infinite-surplus loop for booster users. Nobody has measured it. | Run `/balance-check economy` with target times-to-earn. **Owner decides** whether coins need a sink after about level 60 (more scenes are allowed under D7 and PP-7), or whether a booster-only sink is enough. | M |
| GX-12 | minor | `session-boosters.md` §2.1 Extra Jar (D5, no cap) · `level-generation.md` §4 ramp lever "fewer spare jars" (D1) · `economy.md` §3 | **Partial counter-strategy.** On every swap level from 60 onward, an Extra Jar buys back the spare the ramp removed. It costs a charge or 120 coins (6 plain clears) and the Perfect bonus (−10). That limits itself at today's income, but given the late-game surplus in GX-11 the lever weakens for long-term players. | Cover it in the GX-11 balance pass. If needed, raise the Jar price after level 60, or count it in the ramp's target. | S |
| GX-13 | major | `level-generation.md` §2.1, §3, §4 (`solutionLength` unused) · `jar-mechanics.md` §2.1 (combos from 101; tall-jar mechanics from 100, D8; chance rising to 0.5 by 120) · `game-brief.md` ("1–3 minute bites") | **Difficulty spikes stack up, and nothing measures them.** Between 75 and 101 four levers move: 3 buried layers (75), 13 colours (90), mechanics on tall-jar levels (100) and second mechanics (101). Meanwhile the spare swap rises 20→75% over 60–150. No document sets a difficulty or session-length target per band, so P1's 1–3 minutes is untested past level 60. | Add a target per band (median pours or solve time), measure it with `solutionLength` or the solver node count, and playtest 60–150. Both are already follow-ups in `level-generation.md`. Consider moving `comboFrom` off 101 so it doesn't land right after D8 at 100. | M |
| GX-14 | major | `save-data.md` §2.1 (export/import has no rules), §3 · `player-profile.md` §5 ("Save is imported mid-session") · code `main.ts restoreSaveCode` | **Scenario 4, undefined state.** The first tap validates the code in the box and shows its level and coins. The second tap imports whatever is in the box by then. The confirmation is not reset when the text changes, so a player can confirm code A's summary and overwrite their progress with code B. Neither GDD defines the confirmation. Same defect as GB-SD-3. | Spec and fix: editing the box disarms the confirmation, or the second tap must carry the same code. Write the rules into `save-data.md` (GB-SD-2). | S |
| GX-15 | minor | `save-data.md` §2.1 Repair (shell list de-duplicated, non-strings dropped) · vs `shell-collection.md` §2.1, §4 ("unknown ids in a save are ignored") · `player-profile.md` §3.4, §3.6 (`shells` = shells owned) | **Rule contradiction on what counts.** Unknown ids survive load, and `save.shells.length` counts them for the home label, the Profile stat and the Gold-frame unlock (40). An edited code, or a future id change, can unlock Gold without 40 real shells. | Count only catalog ids, or drop unknown ids at load. Make the three docs say the same. | S |
| GX-16 | minor | `scenes.md` §3 "Cost in clears" · `economy.md` §3 "Scene cost in levels" | **Ownership conflict.** Two docs define the same figure, so they can drift apart. | `economy.md` owns it and `scenes.md` links to it. | S |
| GX-17 | minor | `player-profile.md` §3.4 "Boosters used" · `session-boosters.md` §2.1 Perfect · `main.ts useBooster` | **Scenario 5, mixed messages.** A win that used Undo shows "Perfect!" and also raises "Boosters used" by 1. The two docs disagree on whether Undo is a booster. | Decide with GX-4. Either exclude Undo from "Boosters used", or state that it counts. | S |
| GX-18 | nit | `daily-puzzle.md` §2.1 "Today", §4 | **Undefined order.** A daily started before 00:00 UTC and won after it counts for the date it was started (`startDaily` fixes `dailyDate`), and the docs don't say so. Scenes follow the local hour while the daily follows UTC. Each doc states its own rule, but neither notes the difference. | Add one edge-case row each. | S |
| GX-19 | nit | All GDDs except `player-profile.md` | **Thin fantasy coverage.** Ten docs have no Player Fantasy section (advisory at `standard`). 3g found no conflicts, but its input was Overview prose. | Add a one-line fantasy to each doc the next time it is edited. | S |
| GX-20 | nit | `economy.md` ("tall-jar level") · `level-generation.md`, config (`challenge`, `challengeBonus`) · `shell-collection.md` §3 (`furthestLevel`) · `save-data.md`, `player-profile.md` (`save.level`) | **Terminology drift.** There are two names for the same level type and two for the same progress value. | Pick one term for each and add a glossary line to `systems-index.md`. | S |
| GX-21 | minor | All 11 GDDs | **No Cross-References tables.** Each GDD declares its dependencies only in prose, so the stale-reference check (2c) was a prose scan with nothing machine-checkable behind it. | Add a `## Cross-References` table (Target GDD, Element, Nature) to each GDD that names another. | M |

---

### GDDs flagged for revision

| GDD | Reason | Type | Priority |
|---|---|---|---|
| player-profile.md | Perfect definition (GX-2), decision IDs (GX-8), dependency direction (GX-10), unknown shell ids (GX-15), Boosters used (GX-17) | Consistency | Blocking |
| pour-rules.md | Recovery intent leaves out Restart (GX-1) | Consistency / Scenario | Blocking |
| feel-audio-ui.md | Stuck text (GX-1), palette 12 vs 14 (GX-9), dependency direction (GX-10) | Consistency | Blocking |
| game-brief.md | Out of date against shipped scope: collection meta, Undo, Extra Jar cap, night scene and audio (GX-3 to GX-6); no pillars (GX-7) | Design theory | Warning |
| session-boosters.md | Mixed decision IDs (GX-8), Extra Jar cap in §5 (GX-5), Undo pricing (GX-4) | Consistency | Warning |
| level-generation.md | Palette 12 vs 14 (GX-9), no difficulty target (GX-13) | Consistency / Design theory | Warning |
| economy.md | One-time sinks, balance not measured (GX-11, GX-12), duplicate formula (GX-16) | Design theory | Warning |
| save-data.md | Restore confirmation (GX-14), unknown ids (GX-15) | Scenario | Warning |
| systems-index.md | Rows 5, 9 and 11 (GX-10), ID collision with the roadmap (GX-8) | Consistency | Warning |
| scenes.md | Duplicate formula (GX-16), night sky against the brief (GX-6) | Consistency | Warning |
| shell-collection.md | Unknown ids (GX-15), collection meta against the brief (GX-3) | Consistency | Warning |
| jar-mechanics.md, daily-puzzle.md | Spike stacking at 100/101 (GX-13); midnight UTC (GX-18) | Design theory | Info |

### Verdict: FAIL

There are two blocking issues: the stuck messaging leaves out the free Restart (GX-1), and the Perfect definition contradicts M2 in `player-profile.md` (GX-2). Both are small text fixes. Every other finding is a warning or info.

### If FAIL: required actions before re-running

1. **GX-1:** the stuck message (`strings.ts` `stuck`) and `pour-rules.md` §1 name Restart as a recovery. When no booster is affordable, the message says Restart is free.
2. **GX-2:** `player-profile.md` §3.4 defines Perfect as `assists = 0` (M2), and `competitive-roadmap.md` D4 is marked superseded.
3. Then re-run `/review-all-gdds consistency`. The owner calls in GX-4, GX-11 and GX-13 can be decided independently of each other.

**Totals: blocker 2 · major 8 · minor 8 · nit 3 (21 findings)**
