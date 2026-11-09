# Sprint 13 M1: the hourglass jar UI (evidence)

Design: `design/gdd/jar-mechanics.md` §2.4 (D96). Script: `check.cjs`, run against the real build:

```
npm run build
npx vite preview --port 5533 --strictPort
node production/qa/evidence/sprint-13/hourglass/check.cjs http://localhost:5533/ production/qa/evidence/sprint-13/hourglass
```

Each context seeds `strata.save.v2` once (sessionStorage guard) at level 101 with the four classic
mechanics seen, sound off and 99 hints, then opens the board with `#btn-play` and `#btn-map-play`.
Pours are hinted (`h`, then `.hint-from`, then `.hint-to`). Measured values are in `result.json`.

| Image | What it shows |
|---|---|
| `01-intro-card-101.png` | The "New jar!" card for the Hourglass jar on level 101's board (Midday, Pixel 7). |
| `02-board-badge-3.png` | Level 101 with the hourglass (jar 4): the badge on its base reads 3. |
| `03-after-pour-1-badge-2.png` | One pour elsewhere on the board: the badge reads 2. |
| `04-after-pour-2-badge-1.png` | Two pours: the badge reads 1 and takes the scene accent (the next pour flips it). |
| `05-flip-mid-paused.png` | The third pour, all animations paused mid-flip: the sand column turned edge-on, the glyph turned half over. |
| `06-after-flip-badge-3.png` | After the flip: jar 4's order is reversed (coral, cocoa, lavender ×2 → lavender ×2, cocoa, coral) and the badge reads 3. |
| `07-after-undo-badge-1.png` | Undo (Z): the old order and a count of 1 are back. Restart (R, R) then deals 3 again (`result.json`). |
| `08-jar-guide.png` | Settings → Jar guide: the Hourglass jar entry with its mini jar and badge, after the four classic jars. |
| `09-moonlit-badge-3.png` | Moonlit (a dark scene): the badge at 3 in the scene's toast colours. |
| `10-moonlit-badge-1.png` | Moonlit: the badge at 1 in the scene accent. |
| `11-320-150-intro.png` | 150% text on 320 × 568: the intro card. |
| `12-320-150-board.png` | 150% text on 320 × 568: the badge (40 × 26 px, 18 px text) is wider than the 27 px jar but overlaps no other jar, mark or the toolbar, and the page does not scroll sideways. |
| `13-reduced-motion-after-flip.png` | Reduced motion: right after the third pour the new order is drawn, and no flip animation runs (`reducedRunningFlips: 0`). |
| `14-win-101.png` | Level 101 won with hints (60 pours), with no page errors. |

## Results (`result.json`)

- Badge 3 → 2 → 1 → 3 over three pours; screen-reader name "Jar 4: … (hourglass, flips in 2 pours)",
  "… (hourglass, flips after the next pour)".
- Live region after the flip: "Poured 1 sage into jar 14. The hourglass flipped (jar 4)."
- Undo restores the count (1) and the order; Restart restores 3.
- The badge overlaps no cork, padlock, funnel mark, hint badge, other jar or the toolbar in Midday,
  Moonlit, or at 150% text on 320 px.
- No page errors in any context.

## Found and fixed during this run

The intro card opened over Home at boot: the board made behind Home (`startLevel(n, quiet)`) ran
`introduce`, so a debut level's card showed on Home and was marked seen there, never on the board.
Fixed in `src/ui/screens/board.ts` (commit `6edd8b3`); `01-intro-card-101.png` shows the card on the board.
