# Teardown: Magic Sort! (Grand Games A.Ş.): observed mechanics

> **Purpose.** This records the *rules* of the liquid-sort genre as observed in a
> shipped game, so that Strata can be designed against them. It is a behavioural
> teardown, not a decompilation. No code, levels, art, audio, names or characters
> were taken from the app, and none may be added to this repository.
>
> **Method.** We followed the REA (Reverse Engineer Anything) evidence discipline:
> every claim names its evidence and its confidence, and anything unverified is
> marked as such. The evidence is (1) the Google Play listing screenshot supplied
> by the project owner on 2026-11-07, and (2) general genre knowledge of
> water/ball-sort puzzles, which are a widely cloned, uncopyrightable rule set. No
> APK was obtained or analysed.

## 1. Store-listing facts

| Fact | Evidence | Confidence |
|---|---|---|
| Publisher Grand Games A.Ş., rated 4.4★ from 614K reviews, 10M+ downloads, 189 MB | Listing screenshot | High |
| Monetised with ads and in-app purchases | "Contains ads • In-app purchases" | High |
| Rated Everyone | Listing badge | High |
| Engine is probably Unity (likely IL2CPP) | Inferred from download size and publisher's genre. **Not verified.** | Low |

## 2. Core rules (observed)

| # | Rule | Evidence | Confidence |
|---|---|---|---|
| R1 | The board is a set of transparent vessels. Each holds a stack of coloured units, bottom to top. | Screenshots 1 and 2 | High |
| R2 | Standard levels use **capacity 4**: four units per vessel and four units of each colour. | Screenshot 1: 28 bottles, each showing 4 bands | High |
| R3 | **Challenge levels use tall vessels**: about 7 tubes holding roughly 12 to 14 units each. | Screenshot 2 ("CHALLENGE YOURSELF!") | Medium (the exact capacity can't be counted reliably) |
| R4 | A move takes the **top run of one colour** from a source vessel and pours it into a target. | Screenshot 1 shows a tilted bottle pouring one colour into a near-empty bottle | High (genre standard) |
| R5 | A pour is legal only if the target is **empty**, or its top colour **matches**, and it has free space. | Genre standard | High |
| R6 | A pour moves as many units as fit: `min(run length, free space)`. Any remainder stays in the source. | Genre standard | High |
| R7 | A level starts with a few **empty vessels** (usually 2) as working space. | Screenshot 1: one bottle is empty, and the poured-into one was | Medium |
| R8 | **Win**: every vessel is either empty or full of a single colour. | Genre standard | High |
| R9 | **Stuck** happens when no legal move changes the board. The game offers undo, restart, or a booster. | Genre standard | High |
| R10 | Boards **scale with progression**: more colours, the same few spare vessels, and layouts that wrap into rows (screenshot 1 has a 4×7 grid). | Screenshot 1 | Medium |
| R11 | Some sort games show **single units flying** between vessels (a ball or droplet variant). | Screenshot 2: one orange piece in mid-air | Low (could be decoration) |

## 3. Meta and monetisation layer (genre-typical, not verified in this app)

| Feature | Typical form | Strata decision |
|---|---|---|
| Undo | Limited charges, refilled by watching ads | **Unlimited, free.** There are no ads (brief: out of scope). |
| Extra vessel booster | Adds one empty vessel, sold or rewarded by ad | **One free per level**, set in config |
| Hidden ("?") units | Covered units revealed when they reach the top | **Included** as Strata's "buried sand" from level 8 |
| Level counter, endless levels | Procedural or hand-authored | **Seeded procedural generation**, checked solvable |
| Mascot or story wrapper | Cartoon character, cauldron, collection meta | **Not copied.** Strata uses a seaside sand-art market with no mascot. |
| Lives, energy, IAP shop | Present in many titles | **Out of scope** |

## 4. Systems this implies

1. **Board model.** Vessels are arrays of colour ids. Pours, legality and win
   checks are pure functions. → `src/core/board.ts`
2. **Solver.** Depth-first search over hashed, canonical states. It proves every
   generated level solvable and powers hints. → `src/core/solver.ts`
3. **Generator.** A seeded shuffle of `colors × capacity` units into vessels,
   rejected and re-rolled until the solver proves it solvable and it isn't already
   near-solved. → `src/core/generator.ts`
4. **Difficulty curve.** Level number → (colours, capacity, spare vessels, buried
   depth). This is data-driven. → `src/config/game-config.json`, `src/core/levels.ts`
5. **Session.** Move history, undo, restart, the extra-vessel booster and stuck
   detection, emitted as events for the UI. → `src/core/session.ts`

## 5. What would need the APK, and why we skip it

REA can parse an APK's manifest, signatures and resources, and IL2CPP metadata,
which shows class and method names. That would tell us which ad SDKs and analytics
the game uses and how its systems are named. It would **not** improve Strata's
design, because the rules above can be seen just by playing. Using decompiled
code, level data or assets would also be copying protected material. REA's own
`DISCLAIMER.md` excludes "copying proprietary software or reproducing its
protected code and assets." If more detail is wanted later, play-testing the app
and recording observations here is the right tool.
