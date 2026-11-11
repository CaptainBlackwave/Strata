# Evidence: share picture (sprint 14 H2, sharing §3.1)

From the production build (`npm run build`, `npx vite preview --port 5541 --strictPort`) with `check.cjs`. The share sheet is faked in the browser where noted: headless Chromium has none.

| File | Shows |
|---|---|
| `sheet-daily-pixel7.png` | The preview after a daily win on a Pixel 7: the picture, Show my name (off), Share |
| `card-daily-midday.png` | The picture as sent (1080 × 1350), Midday scene, name off |
| `card-daily-midday-name-on.png` | The same with Show my name on |
| `sheet-weekly-moonlit.png` | The preview from the weekly sheet in Moonlit tide |
| `card-weekly-moonlit-patterns.png` | The weekly picture, Moonlit tide, Colour patterns on: each jar carries its pattern |
| `sheet-320-150.png`, `sheet-320-150-scrolled.png` | 320 px wide at 150% text: the sheet fits and scrolls to Share |
| `result.json` | What was sent each way, the image sizes and text alternatives, Escape and focus, page errors (none) |

**The three ways of sending** (`result.json`):
- A share sheet that takes pictures: status "Shared", sent the text with `strata.png` (image/png, about 200 KB).
- A share sheet that takes text only: status "Shared", sent the text.
- No share sheet (desktop): status "Result copied", the text on the clipboard.

The address on the cards reads `localhost:5541` because the check runs on a local server; on the live site it reads `captainblackwave.github.io/Strata`.

**Not checked here:** a real phone's share sheet. Sending a picture depends on the browser (current iOS Safari and Android Chrome take files; many in-app browsers do not), which the fallbacks cover.
