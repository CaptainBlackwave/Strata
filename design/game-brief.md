# Game Brief: Strata

**One-sentence pitch:** Pour layers of coloured sand between glass jars at a sunny seaside stall until every jar holds a single, perfect colour.

## Pillars (owner-approved 2026-11-08, D29; pillar 3 and the anti-pillars revised 2026-11-19, D218–D223, wording a draft for owner approval)
1. **Calm tidy-up in short bites** (1–3 minutes early, 3–5 from level 40). Never timed, never punishing: free Undo, free Restart, no fail screens.
2. **Always fair.** Every board is proven solvable, and the game tells you when you're stuck or lost.
3. **Fair to free players.** Everything in the game can be earned by playing, and nothing is random. Money buys coins, boosters and the Supporter pack (D219, D221). No cosmetic is sold directly for money; bought coins can buy coin-priced items (D222). Free income is never reduced (D231).
4. **Warm, original and readable for everyone.** Original seaside art in every light; colour is never the only cue; any text size, touch, keyboard or screen reader.

**Anti-pillars (never):** timed play (D225 allows countdowns on shop offers only) · lives or energy · random rewards (loot boxes, gacha) · charging for Undo or Restart · mascots or story · requiring an account to play (sign-in is optional, but needed to buy: D234).

**Not at launch (each needs a new owner decision):** ads of any kind (D219, D220) · subscriptions (D226) · leaderboards and social (D243).

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
- **Collection meta, milestone-only:** a 40-shell cabinet with set rewards (`design/gdd/shell-collection.md`) and a player profile with earned cosmetics (`design/gdd/player-profile.md`). Never random, never sold for money.
- **Scenes:** four time-of-day looks, including a night scene, Moonlit tide, plus a **scene ladder** of about 12 more (seasons, weather, holidays, special skies) in three animation tiers, bought with coins and kept forever; seasonal ones can be bought any time (D32, D33; `design/gdd/scenes.md`). Animation always stops under reduced motion.
- **Audio:** synthesised sound effects and music, each with its own switch (roadmap C1).

## Out of scope — not building this
- No lives or energy timers (roadmap R1). No ads at launch (D219). Purchases are covered by `design/gdd/monetization.md`.
- No mascot or story. Collections and cosmetics are never random and never sold directly for money; the Supporter pack's own items are the one exception (D221, D222).
- No hand-authored level packs. Online features are limited to optional accounts, cloud save, purchases and opt-in analytics (D232–D240, ADR-0002).

## Build order
1. Board rules and win/stuck checks, with unit tests (the core fun is all here).
2. Solver and generator: prove levels are solvable before anything is drawn.
3. Difficulty curve from config.
4. Session: history, undo, restart, extra jar, hint.
5. Touch UI and pour animation, checked with screenshots.
6. Progress save and polish (buried layers revealed, win card).

---
**Who it's for / what they feel:** casual puzzle players on a phone who want a calm, tidy-up feeling: 1–3 minute bites in the early levels, 3–5 minutes from level 40 as boards grow (D36; targets in `design/gdd/level-generation.md`).

**Art & audio direction:** warm seaside light through the day, night included: a cream and sea-glass background, chunky rounded glass jars, and matte sand colours in terracotta, saffron, sage, lagoon, coral and plum. The Moonlit tide scene has a moon and stars, and Night Shore shells glow softly. No fantasy magic. Sound is soft and synthesised: no recorded or copied audio.

**Distribution and monetization (2026-11-19):** web, Android, iOS, Mac, itch.io and the Microsoft Store (D245), published by Blackwave Studios (D248). See `design/gdd/monetization.md`, ADR-0002 and ADR-0003.

**Roadmap:** `design/competitive-roadmap.md` (sprint 1 added game feel, the economy, shuffle, the tutorial and the home screen).

**Reference game:** the liquid-sort genre as teardown-documented in `design/reverse-engineering/magic-sort-teardown.md`. The MVP keeps the top-run pour rule, spare vessels, undo and extra-vessel booster, and hidden units. It drops the genre's ads, lives and random rewards, and the mascot, and replaces the meta layer with milestone-only collections.
