## Bug: jars under the toolbar after a level opens (found in sprint 8, P3)

**Cause:** `beginSession()` lays out the jars before `startLevel()` writes "Level N" and shows the Tall jars tag. On a narrow phone at large text, that text wraps the HUD to two rows (the sprint 6 HUD wrap fix), so the board area shrinks after the jars were already sized. Only a window resize re-laid them out.

**Fix:** a `ResizeObserver` on the board re-lays out the jars whenever the board's size changes, for any reason (HUD wrap, text size, rotation). It is deferred while a pour animates and skipped when the size is unchanged.

**Check** (`coldlayout.cjs`, iPhone SE 320 px, levels opened directly with `?level=N`; lowest jar bottom against the toolbar top):

| Level, text | Without the fix | With the fix |
|---|---|---|
| 120, 100% | 489 / 490 (just fits) | 463 / 490 ✓ |
| 120, 150% | **546 / 484, overlap** | 460 / 484 ✓ |
| 150, 150% | **546 / 484, overlap** | 379 / 484 ✓ |
| 30, 150% | **546 / 484, overlap** | 379 / 484 ✓ |
| 26, 100% | 425 / 490 | 421 / 490 ✓ |

Starting from Home with Play was already fine. Screenshot: `bug-cold-layout-L120-150-fixed.png`.
