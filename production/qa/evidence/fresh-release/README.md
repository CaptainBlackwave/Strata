# Evidence: no stale releases (owner request after 0.14.1)

**The problem:** GitHub Pages sends `Cache-Control: max-age=600`. The offline worker fetched the page network-first, but through the browser's HTTP cache, so for up to 10 minutes after a deploy a player opening the game got the previous release. The owner saw 0.14.0 on a phone after 0.14.1 was live.

**The fix:**
- `public/sw.js` (`fetchInit`): the page and every non-hashed file are fetched with `cache: 'no-cache'`, so the browser always checks with the server (a cheap 304 when nothing changed). Hashed `assets/*` keep the normal cache, since a changed file gets a new name.
- `src/ui/update.ts`: a game left open asks for a worker update each time it returns to the foreground. When a new version takes over, the page reloads into it on Home. Home never holds a board in play (a board left for Home is not kept), so nothing is lost; on any other screen it waits until the player is on Home. A first install never reloads, but a first-visit page left open still picks up the next release (review of PR #33: the gate is `takeoverGate`).

**The check** (`check.cjs`): a local server that sends GitHub Pages' header and swaps release A for release B under a running game, in Chromium on a Pixel 7 viewport. `a-old`/`b-old` are this build with the 0.14.1 worker's plain `fetch(req)`.

| Scenario | Result (`result.json`) |
|---|---|
| Reopen within 10 minutes, 0.14.1 worker | First load: **A** (stale). It only became B because this test build already has the new reload-on-Home code; the live 0.14.1 would have stayed on A |
| Reopen within 10 minutes, new worker | First load: **B** |
| Game left open on Home, back in the foreground | Reloads itself into **B**, on Home |
| Settings open over Home when B arrives (strata-bya) | Stays on A while Settings is open; reloads into **B** when Settings closes (`settings-closed-updated.png`) |
| First visit left open (review of PR #33) | The install does not reload the page (1 load); the next release reloads it into **B** (2 loads) |
| Game left open mid-board (1 pour made) | Not interrupted: still A, the pour count kept. After going Home: **B** |

No page errors in any run. Screenshots: `reopen-old-worker.png`, `reopen-new-worker.png`, `open-on-home-updated.png`, `mid-board-not-interrupted.png`, `mid-board-then-home-updated.png`, `first-visit-left-open-updated.png`.

**Not covered:** the very first visit on a device has no worker yet, so the browser may reuse a page cached in the last 10 minutes. That cannot be changed from the site, since GitHub Pages sets the header.
