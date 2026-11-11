# Sprint 13 M3: clam jar evidence

Design: `design/gdd/jar-mechanics.md` §2.6 (D96, D97). Captured against the real build
(`npm run build`, `npx vite preview --port 5535 --strictPort`) with `node check.cjs http://localhost:5535/ .`
(Playwright, Chromium). Pixel 7 unless noted. Save seeded once per context at level 181. Measured values are in
`result.json`. No page errors in any run (`pageErrors: 0`).

| Image | What it shows |
|---|---|
| `01-intro-card-181.png` | The "New jar!" card on level 181: "Clam jar", its rule, and a shut mini jar showing 6. |
| `02-board-clam-6.png` | Level 181: jar 7 is the clam, a ribbed shell over the whole glass with 6 on it (screen reader: "Jar 7: clam, closed, opens in 6 pours", no colours). |
| `02b-clam-6-closeup.png` | Close-up of the shell: ribs and growth rings fanned from the hinge at the foot, the count pill. |
| `03-after-3-pours-clam-3.png` | After three hinted pours elsewhere: the shell shows 3. |
| `04-tap-refused.png` | A tap on the closed clam, nothing lifted: red outline and "This clam opens in 6 pours."; nothing is selected. |
| `05-pour-in-refused.png` | A pour from jar 1 into the clam: refused with "This clam opens in 3 pours."; the clam is unchanged. |
| `06-clam-1-accent.png` | At 1 the pill takes the scene accent (screen reader: "opens after the next pour"). |
| `07-opening-mid-paused.png`, `07b-…closeup` | The opening pour, paused at 42% of the 520 ms opening: the jar's sand is drawn and the shell is tipping back on its hinge and fading. |
| `08-opened.png`, `08b-…closeup` | Opened: an ordinary jar (lemon on three buried units). Announced "Poured 1 coral into jar 10. The clam opened (jar 7)." |
| `08c-after-undo-closed-1.png` | Undo (Z): the clam is closed again at 1 and its label hides the sand again. |
| `09-jar-guide-top-pixel7.png`, `09-jar-guide-top-320-150.png` | Settings, Jar guide (seven jars): opens at the top, title in view, Got it pinned at the foot, focused. |
| `10-jar-guide-end-pixel7.png`, `10-jar-guide-end-320-150.png` | The guide scrolled to its end: the Clam jar entry, Got it still in view. |
| `11-moonlit.png`, `11b-moonlit-closeup.png` | Moonlit tide: the shell is dimmed for the night, the pill takes the scene's light toast colours. |
| `12-320-150-intro.png` | 320 x 568 at 150% text: the intro card. |
| `13-320-150-board.png`, `13b-…closeup` | 320 x 568 at 150% text: the 18 px count stays on the shell, clear of the other jars and toolbar; no sideways scroll. |
| `14-reduced-motion-opened.png` | Reduced motion: the clam opened with no animation (0 opening animations seen), and the announcement is the same. |
| `15-win-181.png` | Level 181 won with hints (56 pours). |

Also checked in `result.json`: the card marks the clam seen; the shell covers the glass and the pill sits inside the
shell in every scene and size; the closed clam's label names none of the board's colour names nor "buried", before
the opening and after Undo.

Notes: at 320 px and 150% text the count pill (26 px) is almost the jar's width (27 px); it is still on the shell and
readable. The shell's domed crown leaves the jar rim's two top corners showing behind it, which reads as the shell
sitting in the jar. Nothing else looked off.
