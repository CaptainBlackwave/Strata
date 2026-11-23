# Sprint 29 N4/N5 evidence: sunrise and sunset jars

Captured 2026-11-23 with `jars.cjs` (Playwright + Chromium, 412 x 900, deviceScaleFactor 2) against a
Vite dev server: `PORT=5229 node production/qa/evidence/sprint-29/jars.cjs`. These shots show the final
deal: the pair is dealt **empty, as two extra jars** (D225), and gives way to the tide jar, the crab and
the narrow jar (D226). Level 361 has 12 colours, 2 spares and the pair.

Re-run parts of the set with:
- `ONLY=teach INTRO=1` for the intro card, the Jar guide and the map;
- `ONLY=board` for the board set;
- `BOARDS=gpu SCENES=moonlit` to narrow the board set further.

## Teaching (N5)

| File | Shows |
|---|---|
| `intro-361.png` | The intro card on 361: "NEW JAR!", "Sunrise and sunset jars", the one-line rule (D223) and the mini jars |
| `jar-guide-sun.png` | The Jar guide's last entry, "Sunrise and sunset jars", below the lighthouse jar |
| `map-361.png` | The beach path with 361 next and the "new jar" badge; its label reads "new jar: sunrise & sunset" |
| `jars-log-teach.json` | The captured intro and guide text, and the map stone's label |

## Board (N4, N5)

Each shot is on the Classic (`dom`) and Realistic (`gpu`) boards. Light means the midday scene and dark means moonlit.

| Files | Shows |
|---|---|
| `start-{dom,gpu}-{light,dark}.png` | 361 at the start: the two empty pair jars at the end of the row, each with its band, and the rising and setting half-sun badges, open |
| `sunrise-moment-*.png` | The sunrise light near its peak, after the pour that fills the sunrise jar has landed |
| `sunrise-filled-*.png` | The sunrise jar filled and corked, its badge filled in; the sunset jar part-filled |
| `dusk-board-*.png`, `win-dusk-*.png` | The dusk tint on the board, then behind the win card |
| `reduced-sunrise-{dom,gpu}.png`, `reduced-win-dusk-{dom,gpu}.png` | Reduced motion: no sunrise light, and the dusk tint appears instantly |
| `refusal-sunRise-*.png`, `refusal-sunSet-*.png` | The wrong colour into each pair jar: "Only <colour> greets the sunrise." / "…waits for sunset." |
| `refusal-sunrise-*.png`, `refusal-sunset-*.png` | Filling a jar before sunrise, and filling the sunset jar early |
| `lost-sunset-*.png` | The sunset dead end along the solver's path |
| `lost-sunrise-before-*.png`, `lost-sunrise-*.png` | The sunrise dead end, on a small crafted board with a funnel holding the band (it can't happen with the pair alone) |
| `patterns-{start,filled}-*.png` | Colour-blind patterns on, including on the bands |
| `320-150-{start,filled}-*.png` | 361 at 320px wide with 150% text |
| `wide-541-{dom,gpu}-320-150.png` | The widest pair board measured, 541 (18 jars with a spare-swap narrow jar), at 320px and 150%: no horizontal scroll and every badge in view |
| `jars-log-board.json` | The labels, refusal texts and checks from the last board run (`BOARDS=gpu SCENES=moonlit`) |

The layout guard (`npm run guard:layout`) passed: 48 screens checked, none overflowing.

Known, outside this sprint: the win card says "1 pours" on a one-pour win, which the injected board here triggers.
