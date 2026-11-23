# Sprint 29: Sunrise and sunset jars (0.25.0)

> **Status: built (2026-11-23), approved by the owner from screenshots; releasing as 0.25.0.** Play-throughs of 361 on both boards: `production/qa/evidence/sprint-29/play-361/`. From two owner interviews on 2026-11-19 (D218–D224). Design: `design/gdd/jar-mechanics.md` §2.11. Evidence: `production/qa/evidence/sprint-29/`. Target: **0.25.0**.

## Why
One new jar mechanic every 40 levels from 201 (D190): wet sand 201, the tide jar 241, the crab 281, the lighthouse 321. The owner chose the next one for **361**: a pair of banded jars that set the order of the day. **The sunrise jar is filled first and the sunset jar last** (D218, D220).

## The rules
### The pair (D218, D219)
- Two jars, each banded in its own colour (always two different colours). **Only that colour can be poured in; anything can be poured out.** Both start **empty, as two extra jars** on top of the level's spares (D225).
- **Sunrise first:** until the sunrise jar is full of its colour, no pour may fill any other jar. "The sun hasn't risen yet: fill the sunrise jar first."
- **Sunset last:** the pour that fills the sunset jar must be the winning pour. Until then it may hold its colour up to one unit short of full. "Sunset comes last: finish every other jar first."
- Wrong colour in: "Only <colour> greets the sunrise." / "Only <colour> waits for sunset."
- A level is won only when both jars are full of their colours.
### What else changes on a pair level (D221, D222)
- Nothing can seal before sunrise, so **frozen jars stay frozen and locks stay shut until the sunrise jar is filled**. No lock is keyed to the sunset colour.
- **No wet sand and no sieve** on pair levels, and the pair gives way to the tide jar, the crab and the narrow jar (D226).
- Shuffle leaves the pair's sand alone and re-draws any deal that would fill a jar before sunrise.
- Two certain dead ends, with Undo and Restart: "<Colour> can no longer reach the sunrise jar" and "<Colour> was sealed outside the sunset jar".
### Where it appears (D220)
- Debut on **level 361**, alone with two spares. From 362 its own roll at about **1 level in 8** (`shared: false`). Levels 1–360 unchanged (hash fixture). Not in the daily, weekly or events.
### Look and feel (D223)
- A band in the jar's colour with a **rising half-sun** (sunrise) or **setting half-sun** (sunset) mark on the base: an open ring, filled in once the jar is filled. It must read differently from the sieve.
- When the sunrise jar fills, **the board brightens** for a moment. When the sunset jar fills, **the win plays with a dusk tint**. Both are instant under reduced motion.
- Screen reader: "sunrise jar, <colour> only, fill it first" / "sunset jar, <colour> only, fill it last", then "filled".

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| N1 | **Design docs**: `jar-mechanics.md` §2.11 and decisions D218–D224 in `systems-index.md` | Done (`b181255`) |
| N2 | **Core rules** (DOM-free, `src/core/board.ts`, `session.ts`). Covers: `Jar.sun`; the `'sun'`, `'sunrise'` and `'sunset'` refusals in the §2.11 order; `isWon` with both jars complete in their bands; `pour()` reporting `sunrise: true`; the pair in `jarKey` and the empty-jar kind; useful moves; the two `lostReason` dead ends; Shuffle keeping the pair and re-drawing any re-deal that fills a jar early; Undo, Restart and saved boards; the solver and hints through `pour()`. Placeholder strings so nothing ships unexplained | `tests/unit/core/sun.test.ts` covers every rule and every §4 edge case. The dead ends get a property test against the solver on small boards. A crab board with the pair plays to a win. tsc and the full suite pass |
| N3 | **Generation** (`generator.ts`, `levels.ts`, `game-config.json`): **first** hash levels 1–360 into `tests/fixtures/boards-1-360.json`. Then add placement after the lighthouse, the band draw with up to 3 pairs tried, the own roll (salt 9173), the debut at 361, dropping wet sand and the sieve on pair levels, no lock keyed to the sunset colour, and the fallback as for the crab. Tune `ownChance` for about 12.5% | Levels 1–360 are byte-identical. Every pair level of 361–480 is built with the pair, within its cap, and its proof replays in order. Its share of 361–1000 is 12–13%. Dailies, weekly boards and events never have it. The stuck-rate gates pass. **The GDD records**: the levels from 361 that changed, the measured share, one-spare fallbacks from 500, and the stuck rates |
| N4 | **Look** (`src/ui/`): the band and half-sun marks on Classic and Realistic in the beach-hut style, with colour-blind patterns, clearly different from the sieve. The sunrise brightening and the dusk win, with reduced-motion versions | Screenshots of both boards, light and dark, at 412px and 320px/150%: each jar open and filled, the two moments, and reduced motion. The layout guard passes |
| N5 | **Words and teaching**: map the three refusals and the two dead ends to their strings (D223). The screen-reader labels and announcements. The intro card on 361, the Jar guide entry and the map badge, replacing the N2 placeholders | Screenshots of each refusal note, both dead-end notes, the intro card, the guide entry and the map badge. A screen-reader label test |
| R1 | **0.25.0**: screenshots to the owner first (D224), then the layout guard, tests, a play-through of 361 to a win on both boards, What's new ("A new pair of jars: sunrise first, sunset last"), the changelog, and the release (D199) | tsc, tests, build, `guard:layout` and the play-throughs pass. The owner approves the look |

**Order**: N2 comes first. N3 depends on N2, and its hash fixture must be made before any generator change. N4 and N5 can run alongside N3 once N2's placeholders are in. R1 comes last.

## Risks
- **Proofs on one-spare levels.** Sunrise first removes the usual way of making room (filling a jar early), so late levels with one spare may fail more proofs and fall back, as the crab did. N3 measures this. If too many lose the pair, the owner chooses between a bigger budget, keeping the pair in the fallback with two spares, or accepting it.
- **Solver time.** The refusals cut moves, which may make search faster, but `proveDeal` now tries up to 3 band pairs. Level starts must stay inside the existing budgets on every device.
- **Readability.** Two banded jars plus the strict rule is a lot to read on a phone. That is why D223 adds the marks, the moments and the warmer notes, and why the owner sees screenshots before release.

## Decisions
- D218: a banded pair named "Sunrise and sunset", in different colours. Each takes only its colour, anything can be poured out, and both are dealt on filled jars.
- D219: both ends are strict, by refusal. The sunset jar may hold up to one short of full. A pour that breaks both rules gets the sunrise note.
- D220: debut on 361 alone with two spares. Levels only. From 362, its own roll at about 1 in 8. Fallback as for the crab.
- D221: two certain dead ends. Filling an ordinary jar in the sunset colour is allowed and then reported.
- D222: the crab is allowed. No wet sand or sieve. Frozen jars and locks stay shut until sunrise, and no lock is keyed to the sunset colour. Shuffle keeps the pair. Up to 3 band pairs are tried.
- D223: half-sun marks, the sunrise and dusk moments, the warmer strings, one rule card and the screen-reader lines.
- D224: one sprint, released as 0.25.0 with screenshots before release.
- D226: the pair gives way to the tide jar, the crab and a rolled narrow jar (those levels drop the pair); its chance rises to 0.22 to stay at about 1 in 8.
- D225: the pair is dealt empty as two extra jars (replaces "dealt on filled jars" in D218), because dealt on filled jars only half of the pair rolls could be built.

## Out of scope
- A same-colour pair (both jars in one colour).
- The pair in the daily, weekly or events (open question in §2.11).
- Bringing wet sand or the sieve back to pair levels.
- Changes to any other mechanic.
