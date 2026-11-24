# Sprint 31: Christmas at the seaside (0.27.0)

> **Status: built; releasing as 0.27.0 (2026-11-24).** From the owner interview on 2026-11-24 (decisions D236–D243). Design: `design/gdd/events.md`, plus the touched sections of `design/gdd/jar-styles.md`, `scenes.md` and `level-map.md`. Evidence: `production/qa/evidence/sprint-31/`. Target: **0.27.0, live before Winter Tide starts on 1 December (UTC)**. The release has no set date before then, but nothing ships half-done.

## Why
**Winter Tide** (sprint 17) is the advent event for December. It is built, switched on in the config, and has never run for players; its first season starts on 1 December. The owner wants to:
- check it end to end before it starts;
- add a Christmas Day special and a New Year event;
- give December a festive look;
- tell players when Winter Tide begins.

## The rules
### Winter Tide changes (D237)
- It now runs **1–25 December** (`to: "12-25"`, was `"12-31"`). New Tide takes over on 26 December, and only one event runs on a given day.
- **Board 25, Christmas Day:**
  - It opens on 25 December, the event's last day.
  - It's a bonus: **the prize (the Frost jar glass and the Winter Tide badge) still needs boards 1–24**. That calls for a new config field, `prizeBoards: 24`, defaulting to `boards`.
  - Its board shows the holly cap on its jars and is labelled "Winter Tide · Christmas Day". It is a gentle board, like the rest.
  - It pays no coins: coins are paid every 6th board, and 25 isn't a multiple of 6.
- **Catch-up:** boards 1–24 can be played until 25 December, the new last day. That shortens the old promise of "until the 31st".
  - Every string and doc that says 31 December changes.
  - The 0.16.0 What's new posting stays as it was, as history.
### Christmas Day gift (D238)
- The first time a player opens the game on 25 December (UTC), they get **the Holly cap jar piece, 100 coins and a hint**, once per year.
- The Holly cap is a keepsake, granted once for good and **never sold** (like event prizes).
- A small gift card shows on Home, and the save records the year it was given, so the gift can't be claimed twice.
### Holly cap jar style (D239)
- A new **cap** piece in `styles.slots`: a cork cap with a sprig of holly and red berries.
- It's drawn in CSS/SVG on the Classic board and on the Realistic (canvas) board, with colour-blind-safe shapes and both themes.
- It's marked as a gift piece (`"gift": "christmas"`), so `buyStyle` refuses it. The Jar styles sheet shows it locked as "Christmas Day gift · 25 December" until owned.
### New Tide (D240)
- A new event `newtide`, from **26 December to 6 January**. It crosses the year end, which the engine already supports, and its year is the year it starts.
- **Boards:** 12, one a day, with catch-up until 6 January. Gentle recipes like Winter Tide's, with no special jars (D144).
- **Coins:** 50 after boards 4, 8 and 12, so 150 a year.
- **Prize for all 12:**
  - the **New Tide badge**;
  - the **Sparkle glass** jar piece (proposed look: clear glass with fine gold flecks; open to change at review). Never sold.
- Its own Home card, chooser and win card, like Winter Tide.
- Its own atmosphere: no snow, a few gentle sparkles on Home while it runs, off under reduced motion.
### Festive look in December (D241)
- **Lights on the map:** from 1 to 31 December, a string of soft lights along the beach path.
  - The lights twinkle slowly; under reduced motion they stay still.
  - They never cover stones or text.
- **A decorated Home:** while Winter Tide runs, a small garland across the top of Home, on top of the existing snow.
- **Winter scenes first:** in December, the scene picker lists the existing **Winter snow** and **Winter lights** scenes first, with a "Festive" tag. Nothing is bought or changed for the player.
### Winter Tide has begun (D242)
- On the first open from 1 December each year, Home shows a one-time card: "Winter Tide has begun: a new board every day until Christmas." It has a Play button that opens the event chooser.
- It is dismissed for that year once seen.
- New Tide gets the same card on 26 December: "New Tide is here: 12 boards to start the year."
### Dress rehearsal (D236)
Run the built game with the clock set to:
- 30 Nov, 1 Dec, 12 Dec, 24 Dec and 25 Dec;
- 26 Dec, 31 Dec, 1 Jan, 6 Jan and 7 Jan.

On each date, check and screenshot:
- the Home card;
- the event chooser;
- the boards opening on their days;
- catch-up, and the coins and the prize;
- the snow and the music;
- the gift;
- the start cards;
- the map lights;
- the scene order.

Check both boards, light and dark, at 412px and at 320px with 150% text. Anything broken gets fixed in this sprint.

## Tasks
| ID | Task | Acceptance criteria |
|----|------|---------------------|
| C1 | **Design docs**: `events.md` (Winter Tide's dates and board 25, `prizeBoards`, New Tide, the start cards), `jar-styles.md` (the Holly cap and Sparkle glass), `scenes.md`/`level-map.md` (the December look), D236–D243 in the decision log | Written |
| C2 | **Dress rehearsal, first pass**: run today's Winter Tide on the key dates, before any change, to find what's broken | A findings list with screenshots; each finding fixed in C3–C6 or logged |
| C3 | **Events core** (`src/core/events.ts`, config): Winter Tide to 12-25 with board 25 and `prizeBoards`; the `newtide` event; the Christmas Day gift rule in a pure module (`src/core/gifts.ts`, date in, gift out, once per year in the save); start-card rules | Unit tests: event windows and the year-end crossing; boards opening per day; `prizeBoards`; New Tide coins and prize; the gift once a year, never on another day, with the year stored. Event boards stay plain and deterministic (fixtures for both events' boards) |
| C4 | **Art and look** (`src/ui/`): Holly cap and Sparkle glass on both boards; board 25's festive look; map lights; Home garland; New Tide sparkles; reduced motion respected | Screenshots of both boards, light and dark; reduced motion; colour patterns |
| C5 | **Words and screens**: strings for New Tide, board 25, the gift card, the start cards, the "Festive" scene tag, and the locked-piece labels; Home cards, the chooser and win cards for New Tide; scene order in December | Screenshots of each screen at 412px and at 320px with 150% text; the layout guard passes |
| C6 | **Dress rehearsal, final**: the full date run on the finished build, with a clean findings list | Evidence for every date in `production/qa/evidence/sprint-31/rehearsal/` |
| R1 | **0.27.0**: screenshots to the owner first, then What's new ("Christmas at the seaside"), the changelog with its tag row, and the release. **Live before 1 December** | tsc, tests, build and the layout guard pass; the owner approves; the deploy is confirmed |

**Order:** C1 and C2 come first. C3, C4 and C5 run in parallel, sharing a contract of ids, strings and config set up first. C6 follows them, then R1.

## Risks
- **The deadline.** Winter Tide starts on 1 December whatever happens. If time runs short, the scope cuts in this order:
  1. Sparkle glass art (the New Tide prize can be a badge only for its first year);
  2. the Home garland;
  3. the map lights.

  Board 25, the gift, the Holly cap, New Tide and the start card are core.
- **Changing a live config.** Winter Tide's `to` date and board count change before its first run, so no player has progress yet. Its event boards 1–24 stay byte-identical, because each board's seed is its event, year and number.
- **First real run.** The dress rehearsal is the only test of the event's first run. C2 runs early, so its findings shape the work.

## Decisions
- D236: a full dress rehearsal of Winter Tide on its key dates before 1 December, with everything found fixed this sprint.
- D237: Winter Tide runs 1–25 December, with a bonus 25th Christmas Day board. The prize needs boards 1–24.
- D238: the Christmas Day gift is the Holly cap jar piece, 100 coins and a hint, once a year on the first open on 25 December.
- D239: the Holly cap is a cork cap with holly and berries, a gift piece that's never sold.
- D240: New Tide runs 26 December – 6 January, 12 boards, 50 coins after boards 4, 8 and 12, and the New Tide badge and Sparkle glass for all 12.
- D241: the December look is map lights, a Home garland during Winter Tide, and the Winter scenes listed first with a "Festive" tag.
- D242: one-time start cards for Winter Tide (on 1 December) and New Tide (on 26 December).
- D243: one complete release, 0.27.0, live before 1 December. Nothing half-done ships.
- D244 (art review, 2026-11-24): the owner asked for a bolder December look. That means:
  - bigger map lights, plus Christmas decorations along the map;
  - a deeper Home garland;
  - stronger Sparkle flecks on light scenes;
  - a larger jar on the gift card.

  Board 25's holly caps are enough: no shelf snow, since shelves stay off (D213). Evidence: `production/qa/evidence/sprint-31/art2/`.

## Out of scope
- Special jars on event boards (D144 is kept).
- Paid or limited-time sales.
- Push notifications outside the app. The start note is an in-app card; Strata has no push service.
