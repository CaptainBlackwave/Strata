# Competitive sprint 1: evidence (2026-11-08)

Production build, `vite preview`, headless Chromium emulating a Pixel 7 (iPhone SE for 10).

| Shot | Shows |
|---|---|
| 01-home | Home screen: logo jars, coins, Play |
| 02/03-tutorial | Coach ring + captions: lift, then pour |
| 04-tilt-mid-pour, 04b-tilt-100deg | The jar past horizontal, sand surface level, stream into the target |
| 05-tutorial-done | "Nice pour!" card |
| 06-level-1-boosters | Booster bar with charge badges |
| 07-hint-price-badge | A booster at 0 charges shows its coin price (60) |
| 08-win-perfect | Perfect clear: +30 (20 base + 10 perfect), coins 100 → 130 |
| 09-settings | Settings sheet toggles |
| 10-iphone-se-level-45 | 320 px, 14 jars, no overflow (scrollWidth 320 = innerWidth) |

Scripted checks: level 3 played to a win from the solver's path. Perfect awarded +30.
Continue → Level 4. Shuffle used a charge (3 → 2). No page errors.
The economy was also observed working: hints ran out after 3 charges plus one coin purchase.
