# Sprint 11 O1–O4: install and onboarding evidence (D78)

The plan is in `production/sprints/sprint-11.md` (O1–O4). Every screenshot was taken from a production
build (`npm run build`, `npx vite preview --port 5520 --strictPort`) with Playwright's Chromium, under
reduced motion, and looked at. The scripts are in `scripts/`. `with-preview.sh` runs one of them with
its own preview server.

| Task | Screenshots | Result log | What it shows |
|---|---|---|---|
| O1 Add to Home Screen | `o1-install-android-pixel7.png`, `o1-install-iphone-se-100.png`, `o1-install-iphone-se-150.png` | `o1-install-result.json` (`install.cjs`) | Android: a captured `beforeinstallprompt` (faked, because headless Chromium never offers one), and the card's button calls `prompt()`. iPhone: the Share, Add to Home Screen, Add steps with one button. Escape closes it. Shown once (not again after a reload). Hidden on the first visit, with only 2 levels cleared, and when `navigator.standalone` is set. At 150% text on the SE the card scrolls a little inside itself (`ios150Overflow`, review R5) |
| O2 first run | `before-*` and `after-*`: `01-home-first` … `21-map-first`, for `pixel7` (100%) and `se150` (iPhone SE, 150%) | `before-first-run.json`, `after-first-run.json` (`first-run.cjs`, moves from `solutions.ts`) | The tutorial and levels 1–10 from an empty save, then Home and the first map. The fixes are in `*-l1-board.png` (booster line) and `*-21-map-first.png` (map line). The review is `production/qa/sprint-11/first-run-review.md` |
| O3 share link | `o3-link-today-daily.png`, `o3-share-win-card.png`, `o3-link-past-day.png`, `o3-link-past-day-se-150.png` | `o3-share-result.json` (`share.cjs`) | `?daily=<today>` opens today's daily at once and the address is cleaned. Share's text ends with `http://localhost:5520/?daily=2026-11-09`, built from the page address, with `daily` as its only parameter, and that link opens the daily. A past day shows "That daily is over" over Home, and "Play today's" opens today's. Escape returns to Home. `?level=3` still opens level 3. A new player's link, and a weekly link, open Home |
| O4 offline notice | `o4-offline-ready-toast.png` | `o4-offline-result.json` (`offline.cjs`) | On the first visit sw.js posted `strata:offline-ready` and the toast showed before the page was controlled, so it came from the message. Not shown on the next visit. The page loads offline. With storage blocked there was no toast, although the worker was active |

Unit tests (written first and seen failing): `tests/unit/ui/logic/onboarding.test.ts` (O1: the platform
from the user agent and display mode, when the card is due, and the save field's repair),
`tests/unit/ui/logic/launch.test.ts` (O3: building and parsing the link, date and ISO week keys, and the
past-day fallback), and `tests/unit/ui/logic/offline-notice.test.ts` (O4: the notice rule, the sw.js
message, and the storage probe).
