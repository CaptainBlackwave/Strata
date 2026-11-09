# Sprint 12 S3: jar style art (evidence)

Design: `design/gdd/jar-styles.md` §3.1, §3.4, §4. Captured on the real build (`npm run build`, then
`npx vite preview --port 5530 --strictPort`) by `node production/qa/evidence/sprint-12/art/shots.cjs`
at 412 px, deviceScaleFactor 2, reduced motion on. Level 61 opens with `?level=61`. The styles are
set with `page.evaluate` on `#board` and `#home` (`data-glass`, `data-cork`, `data-sand`).

So that every mark shows on every piece, the script dresses some jars by hand. This is presentation
only and touches no game state. One jar is filled with lagoon and given `.sealed`. Others get
`.frozen`, `.locked`, `.funnel`, `.narrow`, a From/To hint pair and `.selected`. On the sand sheets,
buried units are repainted in all 14 palette colours (level 61 starts mostly buried).

| File | Shows |
|---|---|
| `sheet-glass.png` | (a) clear, seaglass, amber, cobalt and pearl (columns) in midday, moonlit, wintersnow and auroranight (rows), with ice, padlock, funnel, narrow, hint, selected and sealed marks on top |
| `sheet-cork.png` | (a) cork, driftwood, rope, scallop and brass on the board in the same four scenes |
| `sheet-sand.png` | (a) plain, fine, glint, layered and ripple in the same four scenes |
| `sheet-sand-patterns-on.png` | (b) every sand piece with colour patterns ON (midday and auroranight): the `.pat-*` pattern stays on top of each texture |
| `sheet-cork-closeup.png` | (c) a close-up of the sealed jar for every cork, in all four scenes |
| `home-midday-default.png`, `home-moonlit-default.png` | (d) Home with no style attributes: today's look |
| `home-midday-seaglass-brass-ripple.png`, `home-moonlit-seaglass-brass-ripple.png` | (d) Home with one combined look (sea glass, brass, ripple) |
| `home-midday-art-closeup.png`, `home-moonlit-art-closeup.png` | (d) a close-up of the same Home art |
