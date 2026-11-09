# F9: booster badges at large text

This is the finding from the emulated device pass (`production/qa/device-pass-0.9.1.md`): at 200% text, the booster count and price badges covered the Shuffle, Jar and Hint icons and ran over the tool names.

**Fix (`src/ui/style.css`):** each tool is a size container. When a tool is narrower than 4.5 of its own ems (large text), its badge takes the icon's place, centred, at full text size, and that icon is hidden. The name and the count still say what the tool is. Undo has no badge, so it keeps its icon. At normal text nothing changes.

**First attempt, rejected:** I first put the badge on its own row above the icon. That made the toolbar taller, and on a 320 px screen at 150–200% text, level 141's jars shrank from 27–29 px to 9 px (`hit150.cjs`). The final fix keeps the toolbar's height.

| Check (`badges.cjs`, `hit150.cjs`) | Before | After |
|---|---|---|
| Badge over the tool name at 200% (iPhone SE, Pixel 7) | yes, every tool | no |
| Badge over its neighbour tool at 200% | yes (`badges-*-200-*-before.png`) | no |
| 100% text | the icon is 16–46% covered by the corner badge (by design) | unchanged |
| Level 141 jar width at 150% / 200% on iPhone SE | 29 / 27 px | 29 / 27 px, the same as 0.9.1 |
| Jars above the toolbar, no sideways scroll | yes | yes |
