# ADR-0002: A Cloudflare back end for accounts, server-checked saves and purchases

## Status

Proposed

> Who may move this to `Accepted`: the user, or `technical-director` on the user's explicit confirmation.

## Date

2026-11-19

## Last Verified

2026-11-19. The Cloudflare limits, store APIs and provider terms cited here are from knowledge, not
re-read today; each is marked **verify** and must be checked against current documentation before acceptance.

## Decision Makers

Owner (decisions D232–D240, D243, D246, D249; owner interview 2026-11-19). Draft by Claude, for
`technical-director` review.

## Summary

Monetization needs purchases that survive device changes, and the owner requires that players cannot edit
their saves (D233). Strata gets a back end on Cloudflare Workers + D1 in `server/` (D232). The server keeps
each account's save as the truth, rebuilt from an operation log it re-checks with the same `src/core` rules
the game uses. It also verifies store and web purchases, and stores opt-in first-party analytics.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web stack (`docs/engine-reference/web/VERSION.md`) plus Cloudflare Workers (TypeScript) |
| **Domain** | Networking / Core |
| **Layer** | Foundation |
| **Knowledge Risk** | MEDIUM: Cloudflare free-tier limits, store server APIs and sign-in provider SDKs change; none is in the engine reference |
| **References Consulted** | `docs/engine-reference/web/VERSION.md`, `design/gdd/save-data.md`, `design/gdd/economy.md`, `design/gdd/monetization.md`, ADR-0001 |
| **Post-Cutoff APIs Used** | None known. **Verify** every external API version at implementation |
| **Verification Required** | Free-tier limits (requests, CPU per request, D1 reads and writes); the CPU cost of checking one level clear; each store's receipt and refund notification APIs; the sign-in flows inside a Capacitor web view (ADR-0003) |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | None |
| **Enables** | ADR-0003 (the native apps call this back end for sign-in and purchases); future leaderboards (D243) |
| **Blocks** | Every monetization, accounts and cloud-save story |
| **Ordering Note** | Back end first (D253). The company (D248) must exist before live store and merchant-of-record credentials can be issued; development can use sandboxes before then |

## Context

### Problem Statement
Today the save is one JSON object in `localStorage` (`save-data.md`). It can be edited by hand, lives on one
device, and moves only by save code. Selling coins needs a balance that can't be forged and follows the
player. The owner has also decided that the server is the truth for the whole save, not only for purchases (D233).

### Current State
- No server. `src/core/` is DOM-free and runs in Node under Vitest (VERSION.md), so it can run in a Worker.
- Levels are generated from seeds by a solver-checked generator (`level-generation.md`). Generation can be
  expensive: the shuffle's solver budget is tens of thousands of states (game-config `$comment`).
- The game plays fully offline, with a service worker on the web.

### Constraints
- **Cloudflare free tier only** (D232). **Verify** the current limits. From knowledge: about 100,000 Worker
  requests a day, about 10 ms CPU per request, and D1 limits on rows read and written per day.
- Play stays possible offline (D234, D236). Signing in is optional, but required to buy (D234).
- Audience 13+ (D244). Analytics are opt-in everywhere (D239). Data is kept until account deletion (D238).
- No third party sees analytics (D239: first-party).

### Requirements
1. Anonymous account per install; optional sign-in with Apple, Google, Microsoft and email link on every platform (D234).
2. A server-held save, re-checked, with automatic sync and a field-by-field merge across devices (D233, D235).
3. Purchase verification and refund handling for Apple, Google and a merchant of record (D228, D249).
4. Server-clock rules for the daily puzzle, streak and daily goals (D236).
5. One-time import of an old `STRATA1` code for 14 days after launch, accepted as-is (D246).
6. In-app account deletion (D238) and an opt-in newsletter flag (D240).
7. Opt-in first-party analytics, raw events kept 13 months (D239).

## Decision

### 1. Hosting
One Cloudflare Worker (`server/`, TypeScript), one D1 database, and the same repository and CI as the game
(D232). The Worker imports `src/core` directly for rules and rewards, so the server and the game cannot disagree.

### 2. Identity
- On first connection, the game calls `POST /v1/accounts` and gets an **anonymous account** and a session
  token. It stores the token locally. Play never waits for this (D234).
- **Sign-in links an identity** (Apple, Google, Microsoft or email link) to the current account (D234).
  If that identity already has an account, the two are merged (step 4) and the device switches to it.
- Session tokens are signed by the Worker. Provider tokens are verified server-side against each
  provider's published keys (**verify** each provider's current flow, especially inside a native web view).
- **Email link** needs an email-sending service. `OPEN`: which one, within the free-tier budget (D232).

### 3. The save as an operation log (D233, D235)
The device does not upload its save. It uploads **operations**, and the server applies each one to its own
copy after checking it:

| Operation | Server check |
|---|---|
| `levelCleared { level, moves[] }` | Rebuild the level's start board (see Risk 1), replay `moves` with `src/core` rules, confirm a win; pay `clearReward` |
| `boosterUsed { kind, level }` | A charge or enough coins exists (`spendBooster`) |
| `itemBought { slot, id }` (coins) | Price and balance from `game-config.json` |
| `dailySolved { date, moves[] }` | `date` equals the server's UTC date at receipt; daily, streak and goals count only then (D236) |
| `settingChanged`, `profileChanged`, `styleWorn`, `sceneSelected` | Valid value; last write wins per field |
| `oldCodeImported { code }` | Once per account, within 14 days of launch; accepted as-is (D246); grants the founder gift (D230) |

- **Offline**: operations queue on the device and send in order when online. Bought coins can be spent
  offline; the spend is an ordinary `boosterUsed` or `itemBought` operation, checked on arrival (D236).
  Daily-type operations made offline are rejected for counting (D236).
- **A rejected operation** is dropped, and the server returns its authoritative save, which replaces the
  device cache. The player sees the server's state.
- **Sync timing**: send queued operations shortly after each change (batched, see the performance section)
  and on app close (D235).

### 4. Merging (D235)
Because the server replays operations, two devices or a guest joining an account merge by applying both
operation streams to one account. Order-free fields merge by rule: furthest level, union of shells, items,
badges and seen mechanics, the best (lowest) pours per level, summed stats from their operations. Choice
fields (settings, profile, worn items, selected scene) take the latest write. Coins and charges come from
the ledger (step 5), so nothing earned or bought is lost or doubled.

### 5. Coin ledger and purchases
- Every coin and charge change is a **ledger row** (source, amount, operation or transaction id). The balance
  is the ledger's sum. This makes refunds (D228) and audits exact.
- **Apple**: verify transactions with the App Store Server API, and receive refunds through App Store Server
  Notifications. **Google**: verify with the Google Play Developer API, and receive refunds through Real-time
  Developer Notifications (Cloud Pub/Sub push). **Merchant of record**: its signed webhooks. **Verify** each
  API's current version.
- Each store transaction id is credited **once** (idempotent).
- A purchase needs a signed-in account (D234). The store transaction is finished only after the server has
  credited it.
- Refunds post negative ledger rows clamped so the balance never goes below zero, and Supporter refunds
  revoke its items (D228).
- **Merchant of record**: Paddle or Lemon Squeezy, compared before acceptance on fees, Canadian-seller
  support, rules on game content and webhook signing (D249). `OPEN`.

### 6. Analytics (D239)
- Sent only after the player opts in (everywhere). A random device ID identifies guests; signed-in events
  also carry the account ID.
- Stored first-party in Cloudflare: Workers Analytics Engine if its free-tier availability and retention fit
  13 months (**verify**), otherwise a D1 table with a scheduled job deleting rows older than 13 months.
- The event list is `OPEN` (analytics-engineer), limited to economy and progression tuning.

### 7. Deletion and email
- **In-app account deletion** removes the account, identities, save, ledger and analytics rows tied to it
  (D238). `OPEN` (lawyer, D250): whether purchase records must be kept for tax law after deletion.
- The newsletter flag is a separate, default-off field (D240).

### 8. Not in scope now
Leaderboards and friends (D243). The operation log and replay check are what fair leaderboards would need later.

## Alternatives Considered

### Alternative 1: Upload whole save snapshots and merge them
- **Pros**: simpler client. **Cons**: can't re-check how values were earned, which breaks D233. Merging
  counters from two snapshots loses or doubles increments.
- **Rejection reason**: D233.

### Alternative 2: Sanity limits instead of replay
- **Pros**: cheap CPU. **Cons**: careful edits pass. The owner chose "server is the truth" over this option (D233).
- **Rejection reason**: D233.

### Alternative 3: Firebase or Supabase
- **Rejection reason**: the owner chose Cloudflare (D232), and analytics must stay first-party (D239).

## Consequences

### Positive
- Purchases and progress follow the account across every platform (D235). Saves can't be forged after the
  first import.
- The shared `src/core` code means the rules and rewards have one definition.

### Negative
- The game gains a network layer, an operation queue and a cache-replace path, all of which need tests.
- The save code goes away (D237). Imports of old codes are accepted as-is for 14 days, and a forged code in
  that window passes (D246, accepted risk).
- Offline daily solves no longer count (D236). This is a behaviour change for current players to announce.
- Running cost must fit the free tier (Risk 2).

### Neutral
- `project.yaml` `platform.online` becomes `true` when this is built.

## Risks

1. **CPU per check (HIGH).** Rebuilding a level's start board runs the generator and solver, which can far
   exceed about 10 ms of CPU. Options, to settle before acceptance:
   (a) at build time, store a hash of every level's start board, so the server only checks the board the
   client sends against the hash, then replays the moves (cheap);
   (b) send the start board, and check it with a generator that skips the solver proof;
   (c) move to a paid Workers plan, which D232 rules out.
   Option (a) is the recommendation, but it needs a bound on how many levels exist (levels are endless) or
   hashes generated on demand.
2. **Free-tier request budget (MEDIUM).** Requests per day ≈ `DAU × batches per player per day`. At 100,000
   a day and, say, 20 batches per player, that is about 5,000 daily players. Batching and a
   "sync paused, will retry" state on hitting the limit are required (D232: degrade gracefully).
3. **Sign-in inside native web views (MEDIUM).** Some providers block sign-in in embedded web views. ADR-0003
   must use each platform's native sign-in or a system browser sheet.
4. **Legal (MEDIUM).** Data location, retention after deletion, and Canadian (PIPEDA, Quebec Law 25), EU and
   UK rules are for the lawyer review (D250). Where D1 stores data is `OPEN`.

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| monetization.md | Purchases follow the account; refunds down to zero | Ledger and store verification (§5) |
| save-data.md | Server is the truth; save code removed; old-code import | Operation log (§3), import operation |
| economy.md | Free income unchanged | Server pays `clearReward` from the same config |
| daily-puzzle.md, daily-goals.md | Count only online | Server-date check (§3) |

## Performance Implications
- **CPU**: one replay per level clear; see Risk 1.
- **Network**: batched operation uploads; a few KB per batch.
- **Client**: an operation queue in `localStorage` alongside the cache.

## Migration Plan
1. Ship the back end and a game build that registers anonymous accounts and syncs, before any purchase exists.
2. Add sign-in, then purchases (D253: the first store release is already monetized).
3. At launch, open the 14-day old-code import window (D246).

## Validation Criteria
- A forged operation (impossible win, overspend) is rejected and the device is corrected to the server state (unit tests in `tests/unit/server/`).
- Two devices playing offline then syncing end with the union of progress and the exact sum of coin changes.
- Each store transaction is credited once under repeated delivery.
- Load test: a level-clear check stays under the CPU limit for the largest boards.

## Related
`design/gdd/monetization.md`, `design/gdd/save-data.md`, `design/gdd/economy.md`, ADR-0003, decisions D232–D240, D243, D246, D249.
