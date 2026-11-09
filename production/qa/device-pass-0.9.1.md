# Device pass: 0.9.1, emulated (D62)

> The checklist in `production/qa/device-checklist.md` (D58), run by Claude on 2026-11-09 against the **live game** (`https://captainblackwave.github.io/Strata/`, 0.9.1). It used Chromium device emulation through Playwright: Pixel 7, iPhone SE and 200% text, with a 4× CPU throttle where smoothness was checked. This is **not** Safari and not a real phone. The lines marked "real phone only" still need the owner's phone.
>
> Script: `production/qa/evidence/sprint-10/device-pass/pass.cjs`. Raw results: `result.json`. Screenshots are in the same folder.

| Checklist line | Result | Evidence |
|---|---|---|
| Aurora night: the board stays smooth | **Pass (emulated).** 4 s idle on the board at a 4× throttle: frame p50 16.7 ms, p95 16.8 ms, max 16.8 ms, no page errors | `smooth-auroranight.png` |
| Winter lights: the same | **Pass (emulated).** p50 16.7 ms, p95 16.7 ms, max 16.8 ms | `smooth-winterlights.png` |
| Phone doesn't get warm within 2 minutes | **Real phone only** | — |
| New Year fireworks: the win-card bursts are smooth and the text readable | **Pass (emulated).** Won the level; 2.5 s of the card at a 4× throttle, max frame 16.8 ms; the text is readable | `fireworks-win.png` |
| Pinch zooms the page | **Pass (configuration).** The viewport meta allows zoom (`width=device-width, initial-scale=1, viewport-fit=cover`, with no `user-scalable=no` and no `maximum-scale`). A real two-finger pinch is **real phone only** | `result.json` → `zoom.meta` |
| Fast taps never zoom by themselves | **Pass (emulated).** `touch-action: manipulation` on the board and body; six fast taps on a jar left `visualViewport.scale` at 1 | `level-120-hits.png` |
| Level 100+: every jar is easy to hit, and no tap lands on a neighbour | **Pass (emulated).** Level 141 has 17 jars. The narrowest hit area is 33 × 96 px on iPhone SE and 52 × 153 px on Pixel 7. No hit areas overlap, and tapping each jar selected that jar every time. A thumb's actual feel is **real phone only** | `level-141-*.png` |
| Largest text: Home, board, win card and Settings readable, nothing cut off or under the toolbar | **Pass, with one cosmetic finding.** At 200% text on iPhone SE and Pixel 7 there is no sideways scrolling, the jars sit above the toolbar, and the level can be won. The win card is taller than the screen but scrolls, with focus on Continue. **Finding:** the booster count badges cover the Shuffle, Jar and Hint icons at 200%. The labels stay readable. To be fixed in sprint 10 | `text200-*.png` |
| Screen reader: pour and seal announced | **Pass (emulated text).** The live region read "Poured 1 terracotta into jar 6." The spoken output of VoiceOver or TalkBack is **real phone only** | `result.json` → `screenReader` |
| Hint announced | **Pass (emulated text).** "Hint: pour jar 1 into jar 6" | same |
| Offline: open once, airplane mode, reopen and play the next level | **Pass (emulated).** The service worker controlled the page; offline reload booted and the next level started (7 jars) with no errors. An installed home-screen app in real airplane mode is **real phone only** | `offline-board.png` |
| What's new shows once after an update | **Pass (emulated).** A save that last saw 0.9.0 got the card; after "Got it" and a reload it did not show again | `whats-new.png` |

## Still for a real phone (owner)
- Warmth or battery over 2 minutes in Aurora night and Winter lights.
- A real two-finger pinch, and how a thumb feels hitting jars at level 100 and later.
- Real Safari on iPhone: layout and the scene effects.
- VoiceOver or TalkBack speech.
- Vibration, on Android only (iPhone browsers ignore it).
- The installed app in airplane mode.

## Notes
- The frame times sit at the 60 Hz cap (16.7 ms) because headless Chromium paces animation frames to vsync. The scene layers run at 30 fps by design. The useful result is that no frame was dropped at a 4× throttle.
