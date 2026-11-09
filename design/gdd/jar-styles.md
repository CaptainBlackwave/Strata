---
status: implemented (sprint 12)
owner: game-designer / economy-designer
decisions: D85, D86, D89, D90, D91, D92
verified-by: owner art approval 2026-11-09 (D94)
---

# Jar styles: Design Document

> Sprint 12, from the owner interview after 0.11.1 (D84–D92 in `systems-index.md`).
> Prices are set by the balance pass (S5) and recorded in §4.

## 1. Overview

Jar styles are the late-game coin sink (D85). From level 60 (D91), the player can buy cosmetic pieces for
the jars in three slots: **glass**, **cork** and **sand** (D90). Each slot has a free default and four pieces
to buy, and any owned pieces combine. Styles change only how jars look. They never change a rule, a sand
colour (D89) or a puzzle, and they show in every scene, on the board and on the Home art. They are bought
with coins earned by play, like scenes, at a pace of about one new purchase every 1–2 weeks for a regular
player (D86).

## 2. Player Fantasy

"These are my jars." A long-time player has a collection on the shelf: frosted sea glass, a driftwood
stopper, sand with a faint glint. Each piece is a small, calm goal that takes a week or two of play, and
the board still reads exactly as before.

## 3. Detailed Rules

### 3.1 The catalogue

Ids are stable (they are saved). Names live in `strings.ts`; ids and prices in `game-config.json` under
`styles`.

| Slot | Id | Name | Look | Default |
|---|---|---|---|---|
| glass | `clear` | Clear glass | today's glass | yes, free |
| glass | `seaglass` | Sea glass | frosted, a pale green edge | |
| glass | `amber` | Amber bottle | a warm amber rim and highlight | |
| glass | `cobalt` | Cobalt rim | a deep blue rim, clear body | |
| glass | `pearl` | Pearl | a soft pearly shine | |
| cork | `cork` | Cork | today's cork | yes, free |
| cork | `driftwood` | Driftwood | a grey, grained wooden stopper | |
| cork | `rope` | Rope knot | cork wrapped in twine | |
| cork | `scallop` | Scallop cap | a small ribbed shell cap | |
| cork | `brass` | Brass lid | a warm metal cap | |
| sand | `plain` | Plain sand | today's matte grain | yes, free |
| sand | `fine` | Fine grain | a finer, denser speckle | |
| sand | `glint` | Glint | a few tiny sparkles | |
| sand | `layered` | Layered | faint lines within each layer | |
| sand | `ripple` | Ripple | soft wave marks | |

### 3.2 Unlock (D91)

- The Styles button shows on Home once `save.level ≥ styles.unlockLevel` (60), that is, after clearing
  level 59. Before that it is hidden; nothing about styles shows.
- A player who already wears or owns a style (a save code from a later player) still sees them.
- The first Home where styles are open shows the quiet "New" mark on the Styles button (as Scenes, R4),
  until Styles is opened once.

### 3.3 Buying and wearing (D90)

- Any piece can be bought in any order once unlocked, if `coins ≥ price`. Buying spends the coins, adds the
  piece to `owned` and wears it at once in its slot.
- Wearing an owned piece (or a default) is free and changes only its slot.
- Boosters, scenes and styles share one wallet. Nothing is refunded.
- The sheet previews any piece on a sample jar in the current scene before buying (no commitment).

### 3.4 What a style may change (D89)

- **Glass**: the outline, rim, highlight and a faint tint of the glass edge. The glass body over the sand
  stays clear; a tint never sits over the sand.
- **Cork**: the stopper on sealed jars (and the Home art).
- **Sand**: the grain texture only: dot size and density, a static glint, faint lines within a layer, soft
  ripples. **Never a colour.** Every texture is a light overlay with a capped opacity (§4), so each sand
  colour's average shade moves by at most a small, tested amount.
- **Colour patterns on**: the pattern textures (`.pat-*`) stay visible on top of any sand style.
- **Reduced motion**: no style animates; `glint` is a still sparkle.
- Mechanics keep their marks: frozen ice, narrow necks, funnels and padlocks draw over every style.

### 3.5 State and data

- Save (`save-data.md`): `styles: { owned: string[]; worn: { glass: string; cork: string; sand: string } }`.
  `owned` holds bought ids as `slot:id` (e.g. `glass:seaglass`); defaults are never stored.
- Repair, field by field: unknown or malformed ids are dropped; a worn id that is not owned and not the
  default falls back to the default. A save without `styles` gets `{ owned: [], worn: defaults }`.
- The save code round-trips it.
- Rules are pure in `src/core/styles.ts`; the sheet is `src/ui/screens/sheets/styles.ts`; the art is CSS in
  `src/ui/style.css` keyed by `data-glass`, `data-cork` and `data-sand` attributes on the board and on any
  preview.

## 4. Formulas

| Formula | Expression | Notes |
|---|---|---|
| Can buy | `level ≥ unlockLevel ∧ ¬owned(slot:id) ∧ coins ≥ price` | defaults are never bought |
| Price | `round50(1700 × 1.0636^(i−1))`, i = 1…12, in ladder order glass, cork, sand | the first piece costs 7 days and the last 14 days of a regular player's mean net income from level 60 (240 a day: 326 without buying boosters, 154 with) (D86) |
| Sand overlay cap | each texture layer's alpha ≤ 0.25, and the mean change in a unit's colour ≤ 6% in relative luminance against plain sand | checked by a unit test on the texture table |

Prices (S5, `production/qa/sprint-12/balance.md`):

| Rank | Glass | Cork | Sand |
|---|---|---|---|
| 1 | Sea glass 1,700 | Driftwood 1,800 | Fine grain 1,900 |
| 2 | Amber bottle 2,050 | Rope knot 2,200 | Glint 2,300 |
| 3 | Cobalt rim 2,450 | Scallop cap 2,600 | Layered 2,800 |
| 4 | Pearl 2,950 | Brass lid 3,150 | Ripple 3,350 |

29,250 coins in total: about 80 days of a regular player's income without booster spending.

## 5. Edge Cases

- **Coins below every price**: pieces show their price with Buy disabled; wearing owned pieces still works.
- **Level below 60 but pieces owned** (an imported save code): the Styles button shows.
- **All 12 owned**: the sheet still opens for wearing; nothing else changes. Boosters stay the only repeatable sink.
- **Unknown id in a save** (a newer version's piece): dropped by repair; the slot falls back to its default.
- **Two tabs**: the existing one-active-tab rule (D57) covers it.
- **Tutorial board**: shows the worn styles too (cosmetic only).

## 6. Dependencies

- `economy.md`: a new one-time sink; the wallet and prices.
- `scenes.md`: styles draw in every scene; sand colours never change.
- `feel-audio-ui.md`: colour patterns, reduced motion, 150% text.
- `save-data.md`: the `styles` field and its repair.
- `player-profile.md`: none (styles are not profile items).
- `badges.md`: none in this sprint (D76: badges pay nothing; no style badges are added).

## 7. Tuning Knobs

All in `styles` in `game-config.json`.

| Knob | Value | Safe range | Affects |
|---|---|---|---|
| `unlockLevel` | 60 | 30–120 | when the sink opens |
| piece `price` | 1,700–3,350 (§4) | 1,000–8,000 | the late-game pace; keep the ladder rising so the slots interleave |

## 8. Acceptance Criteria

- [x] Rules: unlock, buy (coins, owned, worn), wear, defaults free, any order; unit tests seen failing first
  (`src/core/styles.ts`, `tests/unit/styles/styles.test.ts`; sprint 12 S2).
- [x] Save: repair field by field, old saves get defaults, unknown ids dropped; the save code round-trips
  (`src/ui/storage.ts`, `tests/unit/styles/styles-save.test.ts`; sprint 12 S2).
- [x] Art: every piece in all 16 scenes on the board and Home art; the patterns stay visible on top of every
  sand style; reduced motion has no animation; the sand overlay cap test passes
  (`production/qa/evidence/sprint-12/art/`, `all-scenes-contact.png`; `tests/unit/ui/style-art.test.ts`; S3, D93).
- [x] Sheet: keyboard and screen reader operable; preview before buying; 150% text at 320 px without
  sideways scroll (`production/qa/evidence/sprint-12/sheet/`; S4).
- [x] Balance: each piece costs 7–14 days of a regular player's mean income from level 60; prices recorded in §4 and `economy.md`; `tests/unit/balance/style-prices.test.ts` (S5).
- [x] The owner approves the art before the merge (D92): approved 2026-11-09 after the D93 fixes (D94).

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-11-09 | Claude (sprint 12, S1) | Designed from D85–D92: three slots, 15 pieces (3 free), unlock at 60, sand texture only, patterns on top |
| 2026-11-09 | Claude (sprint 12, S2) | Rules and Save criteria met: `src/core/styles.ts` (unlock, buy, wear, `stylesOf` repair) and the `styles` save field; tests in `tests/unit/styles/` |
| 2026-11-09 | Claude (sprint 12) | Built (S2–S5); art fixed after the owner's first review (D93) and approved (D94); acceptance criteria ticked |
