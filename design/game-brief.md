# Game Brief: Strata

**One-sentence pitch:** Pour layers of coloured sand between glass jars at a sunny seaside stall until every jar holds a single, perfect colour.

## Core loop
- Read the jars, then tap a jar to lift it and tap another to pour its top layer.
- Untangle the colours using the spare jars as working space. Undo is free and unlimited (D19). Shuffle, the extra jar and Hint are limited boosters: charges first, then coins earned by play.
- A full single-colour jar seals with a little shimmer. Seal them all to clear the level and open the next, slightly harder one.

## Player goal & fail state — what "working" looks like
- **Goal:** every jar is either empty or full of one colour (it holds exactly `capacity` units of that colour). This clears the level.
- **Fail state:** none is permanent. When no useful pour is left, the game says you're **stuck** and offers Undo, Shuffle, Extra Jar and Restart; Undo and Restart are always free. When the board can no longer be won (a mixed funnel, a lock that can't open), it says so: "This board can't be won now: Undo or Restart" (D21). Every generated level is proven solvable before it's shown.

## MVP — what must exist to be the game
1. **Pour rules, win and stuck.** Top-run pours: legal only onto an empty jar or a matching top with free space, moving `min(run, free space)` units. Recognises a cleared level, and a board with no useful pour left.
2. **Solvable level generator.** A seeded shuffle with a solver that proves each level can be won.
3. **Difficulty curve.** Level number sets colours, capacity, spare jars and buried layers, all from `src/config/game-config.json`.
4. **Session tools.** Free unlimited undo, restart, extra jars (no per-level cap, D5), and a solver-backed hint.
5. **Playable touch UI.** Jars wrap into rows, tap to pour with a pour animation, a HUD with level, moves and buttons, and a win card.
6. **Progress save.** The current level persists in `localStorage`.

## Approved since the MVP
- **Collection meta, milestone-only:** a 40-shell cabinet with set rewards (`design/gdd/shell-collection.md`) and a player profile with earned cosmetics (`design/gdd/player-profile.md`). Never random, never sold.
- **Scenes:** four time-of-day looks, including a night scene, Moonlit tide (`design/gdd/scenes.md`).
- **Audio:** synthesised sound effects and music, each with its own switch (roadmap C1).

## Out of scope — not building this
- No ads, IAP, lives or energy timers. Coins exist but are earned only by play (see `design/competitive-roadmap.md` roadmap R1–R3).
- No mascot or story. Collections and cosmetics only as milestone rewards (above), never random and never for sale.
- No hand-authored level packs and no online features or accounts.

## Build order
1. Board rules and win/stuck checks, with unit tests (the core fun is all here).
2. Solver and generator: prove levels are solvable before anything is drawn.
3. Difficulty curve from config.
4. Session: history, undo, restart, extra jar, hint.
5. Touch UI and pour animation, checked with screenshots.
6. Progress save and polish (buried layers revealed, win card).

---
**Who it's for / what they feel:** casual puzzle players on a phone who want a calm, tidy-up feeling in 1–3 minute bites.

**Art & audio direction:** warm seaside light through the day, night included: a cream and sea-glass background, chunky rounded glass jars, and matte sand colours in terracotta, saffron, sage, lagoon, coral and plum. The Moonlit tide scene has a moon and stars, and Night Shore shells glow softly. No fantasy magic. Sound is soft and synthesised: no recorded or copied audio.

**Roadmap:** `design/competitive-roadmap.md` (sprint 1 added game feel, the economy, shuffle, the tutorial and the home screen).

**Reference game:** the liquid-sort genre as teardown-documented in `design/reverse-engineering/magic-sort-teardown.md`. The MVP keeps the top-run pour rule, spare vessels, undo and extra-vessel booster, and hidden units. It drops the monetisation and the mascot, and replaces the meta layer with milestone-only collections.
