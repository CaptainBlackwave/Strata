# Game Brief: Strata

**One-sentence pitch:** Pour layers of coloured sand between glass jars at a sunny seaside stall until every jar holds a single, perfect colour.

## Core loop
- Read the jars, then tap a jar to lift it and tap another to pour its top layer.
- Untangle the colours using the spare jars as working space. Undo freely; there's one extra-jar rescue per level.
- A full single-colour jar seals with a little shimmer. Seal them all to clear the level and open the next, slightly harder one.

## Player goal & fail state — what "working" looks like
- **Goal:** every jar is either empty or full of one colour (it holds exactly `capacity` units of that colour). This clears the level.
- **Fail state:** none is permanent. When no legal pour is left, the game says you're **stuck** and offers Undo, Restart or the extra jar. Every generated level is proven solvable before it's shown.

## MVP — what must exist to be the game
1. **Pour rules, win and stuck.** Top-run pours: legal only onto an empty jar or a matching top with free space, moving `min(run, free space)` units. Recognises a cleared level, and a board with no useful pour left.
2. **Solvable level generator.** A seeded shuffle with a solver that proves each level can be won.
3. **Difficulty curve.** Level number sets colours, capacity, spare jars and buried layers, all from `src/config/game-config.json`.
4. **Session tools.** Unlimited undo, restart, one extra jar per level, and a solver-backed hint.
5. **Playable touch UI.** Jars wrap into rows, tap to pour with a pour animation, a HUD with level, moves and buttons, and a win card.
6. **Progress save.** The current level persists in `localStorage`.

## Out of scope — not building this
- No ads, IAP, currencies, lives or energy timers.
- No mascot, story or collection meta. Theme comes only from the art direction below.
- No hand-authored level packs and no online features or accounts.
- No audio in the MVP.

## Build order
1. Board rules and win/stuck checks, with unit tests (the core fun is all here).
2. Solver and generator: prove levels are solvable before anything is drawn.
3. Difficulty curve from config.
4. Session: history, undo, restart, extra jar, hint.
5. Touch UI and pour animation, checked with screenshots.
6. Progress save and polish (buried layers revealed, win card).

---
**Who it's for / what they feel:** casual puzzle players on a phone who want a calm, tidy-up feeling in 1–3 minute bites.

**Art & audio direction:** warm daylight: a cream and sea-glass background, chunky rounded glass jars, and matte sand colours in terracotta, saffron, sage, lagoon, coral and plum. No night sky, no magic.

**Reference game:** the liquid-sort genre as teardown-documented in `design/reverse-engineering/magic-sort-teardown.md`. The MVP keeps the top-run pour rule, spare vessels, undo and extra-vessel booster, and hidden units. It drops the monetisation, mascot and meta layer.
