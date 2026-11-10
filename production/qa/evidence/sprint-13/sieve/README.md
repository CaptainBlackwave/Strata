# Sprint 13 M2: sieve jar evidence

Design: `design/gdd/jar-mechanics.md` §2.5 (D96, D97). Captured against the real build
(`npm run build`, `npx vite preview --port 5534 --strictPort`) with `node check.cjs http://localhost:5534/ .`
(Playwright, Chromium). Pixel 7 unless noted. Save seeded once per context at level 141. Measured values are in
`result.json`. No page errors in any run.

| Image | What it shows |
|---|---|
| `01-intro-card-141.png` | The "New jar!" card on level 141's board: "Sieve jar", its rule, and a mini jar wearing a terracotta band. |
| `02-board-sieve.png` | Level 141: jar 4 is the sieve, with a saffron collar and a woven mesh round its neck (screen reader: "sieve, saffron only"). |
| `03-refused-wrong-colour.png` | A slate pour into the sieve is refused: red outline and the toast "Only saffron sand can go in this sieve." |
| `04-correct-pour-in.png` | Saffron poured into the sieve after a few hinted pours ("Poured 1 saffron into jar 4."). |
| `05-jar-guide.png` | Settings, Jar guide: the Sieve jar is the last entry, after the hourglass. |
| `06-moonlit.png` | Moonlit tide (a dark scene): the band edge takes the scene ink and stays clear. |
| `07-patterns-on.png` | Colour patterns on: the band carries saffron's pattern (dots, `pat-1`). |
| `08-patterns-on-closeup.png` | Close-up of 07: the pattern on the band, and the mesh kept to a woven strip at its foot. |
| `09-styles-amber-brass-glint.png` | Jar styles worn (amber glass, brass cork, glint sand): the band keeps its colour and place. |
| `10-320-150-intro.png` | 320 x 568 at 150% text: the intro card. |
| `11-320-150-board.png` | 320 x 568 at 150% text: the board. The band clears the neighbouring jars and the page does not scroll sideways. |
| `12-sieve-sealed.png` | During the hinted play-through: the sieve sealed in saffron, its cork sitting over the band. |
| `13-win-141.png` | Level 141 won with hints (54 pours). |

Also checked in `result.json`: the card marks the sieve seen; the band overlaps no other mark and no other jar in
every scene and size; a tap on the empty sieve, with nothing lifted, shows the same message (`emptyTap`).

Notes: a saffron band on amber glass is close in hue; the ink edge and the mesh still set it apart. Nothing else looked off.
