# Sprint 11 A2: badge shelf evidence (D76)

Design: `design/gdd/badges.md`. Script: `shots.cjs` (`node shots.cjs http://localhost:5510/ .`), run against
`npm run build` + `npx vite preview --port 5510 --strictPort`, headless Chromium with reduced motion.
Every save is seeded in `strata.save.v2` with `seenWhatsNew` equal to package.json's version (0.10.1) and
`tutorialDone: true`. No page errors in any run. There was no horizontal overflow on the page or the Profile card in any run.

| Screenshot | Device | Save | What it shows |
|---|---|---|---|
| `shelf-empty-412-top.png`, `shelf-empty-412-end.png` | Pixel 7 (412 px) | level 5, nothing earned | "0 of 28 earned"; every badge dimmed with its progress, e.g. "0/1 jars" |
| `shelf-part-412-top.png`, `shelf-part-412-end.png` | Pixel 7 | an **old save with no `badges` field**: level 60, Tide Pool set, best streak 9, 30 Perfect, 1,400 pours, 34 jars sealed, 2 scenes | Back-filled quietly at load to "12 of 28 earned". There was no toast at load (`toastAtLoad: false`). Earned badges are in colour, others are greyed with progress ("34/100 jars", "2/10 tall-jar Perfect", "9/30 days"). Two columns |
| `shelf-part-320-150-top.png`, `shelf-part-320-150-end.png` | 320 × 568, root font 150% | the same old save | One column, names and descriptions wrap, nothing cut off |
| `win-card-badge-412.png` | Pixel 7 | level 5, won with hints (`h`, then `.hint-from`, `.hint-to`) | One combined row under the shell row: "New badges: First Seal, Beachcomber" with the First Seal medallion |

Measured in the same runs:
- Win card: the badge row is inside `#win-unlocks`, and the card's `aria-describedby` was `win-text win-reward-sr win-shell-text win-unlocks`, so a screen reader hears the row with the result. After the win the save held `badges: ["first-seal", "shells-1"]`, `stats.jarsSealed: 5` and `scenesPlayed: ["midday"]`.
- The back-filled save held, in catalogue order: `first-seal, levels-10, levels-50, pours-1000, perfect-1, perfect-25, tall-perfect-1, shells-1, sets-1, mechanics-1, daily-1, streak-7`.
- A not-yet tile reads to a screen reader as "Jar Stacker, not earned yet. Seal 100 jars 34/100 jars".

A bug found and fixed during the run: the first tiles used the class `.badge`, which is already the booster
count bubble (absolutely positioned), so the shelf drew over the top of the screen. The tiles are now `.badge-tile`.

Not captured: the scene-purchase toast ("Dawn unlocked! · New badge: Change of Sky"). It is wired in
`src/ui/screens/sheets/scenes.ts` and its rule is unit-tested, but it was not screenshotted.
