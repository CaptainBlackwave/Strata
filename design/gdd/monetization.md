---
status: draft (owner review pending)
source: owner interview 2026-11-18 and 2026-11-19, decisions D218–D254 (`design/gdd/systems-index.md`)
date: 2026-11-19
verified-by: pending owner review
---

# Monetization: Design Document

> **Draft.** Every rule here comes from a numbered owner decision (D218–D254). Anything not yet decided
> is listed under **Open Questions** and marked `OPEN` where it appears. It is not filled in by guesswork.
> Prices, pack sizes and grant amounts are placeholders (`[PRICE]`, `[AMOUNT]`) until the
> economy-designer proposal is approved (D231).

---

## 1. Overview

**Purpose**: Earn money from Strata without breaking the pillars players chose it for. The game never
times play, never sells lives or energy, never uses random rewards, and keeps Undo and Restart free (D223).

**What is sold** (D219): a one-time **Supporter pack**, **coin packs** and **booster bundles**, through
Apple and Google billing in the apps and through a merchant-of-record checkout on the web (D249). There are
**no ads at launch** (D219) and no subscription at launch (D226).

**What is not sold**: no cosmetic is sold directly for money. Cosmetics are earned or bought with coins, and
coins bought with money count (D222). The Supporter pack's own exclusive items are the one exception (D221).

**Scope**: products, the Shop, offers, the founder gift, refunds, platform availability, and the legal and
store obligations purchases bring. Accounts, sync, purchase verification and analytics storage are
specified in ADR-0002. Native packaging is in ADR-0003. Coin flow and prices are in `economy.md`.

---

## 2. Detailed Design

### 2.1 Products

| Product | Kind | Gives | Price | Decision |
|---|---|---|---|---|
| **Supporter pack** | One-time (non-consumable) | An exclusive **new scene**, **new jar style** and **profile frame or badge**; a one-time grant of `[AMOUNT]` coins and `[AMOUNT]` boosters; **no ads if ads are ever added** | `[PRICE]` USD | D221 |
| **Coin packs** | Consumable, repeatable | `[AMOUNT]` coins per pack; number of tiers `OPEN` | `[PRICE]` USD each | D219, D231 |
| **Booster bundles** | Consumable, repeatable | Charges of Shuffle, Extra Jar and Hint; contents `OPEN` | `[PRICE]` USD each | D219, D231 |
| **Starter pack** | One-time, offered to newer players | Contents and who counts as "newer" `OPEN` | `[PRICE]` USD | D225 |

- **Base currency** is US dollars. The stores and the web checkout convert to local prices (D231).
- **Supporter exclusives** are new items made for the pack. They are not existing scenes or styles. The
  three designs are `OPEN` (an art-director proposal).
- **No Family Sharing**: the Supporter pack is not shared through Apple Family Sharing or Google Play
  Family Library (D229).

### 2.2 Rules that do not change

- **Free income is not reduced** (D231). Every faucet in `economy.md` §2.1 keeps its rate.
- **Every level and mode stays free**: levels, daily puzzle, weekly set and seasonal events (D226).
- **Undo and Restart stay free and unlimited** (D19, D223).
- **No random rewards**: every product shows exactly what it gives before purchase (D223).
- **No ads**: there are no ads of any kind at launch. Interstitials may be considered later only by a new
  owner decision, and never for Supporter owners (D220, D221).

### 2.3 Where offers appear (D224)

1. **Shop on Home.** A Shop button on the Home screen opens the Shop sheet, which lists every product
   available on that platform.
2. **When short of coins.** The existing toast "Needs N coins. Clear levels to earn more." gains a link to
   the Shop. Its wording is `OPEN` (UX). It must still say that coins can be earned by playing.

Offers appear nowhere else: not on the win card, not mid-level and not on launch.

### 2.4 Offer tactics (D225)

Allowed:
- A one-time **starter pack** for newer players.
- **Occasional sales** (discounted packs).
- **"Best value" labels** on the pack with the most coins per dollar.
- **Countdown offers**: an offer may show a visible countdown to its end. "No timers" (D223) covers play
  only, so a countdown never appears on the board or in a level.

`OPEN`: how often sales and countdown offers run, how long they last, and their discount limits.

### 2.5 Buying

- **Sign-in is required to buy** (D234). A guest who taps a product is asked to sign in first (Apple,
  Google, Microsoft or email link, all on every platform). After sign-in, the purchase continues.
- **Spending safeguards**: none beyond the stores' own (D227).
- **Where purchases go**: in the iOS and Android apps, through the store's billing. On the web, through the
  merchant-of-record checkout (D249). On the Microsoft Store, the route is `OPEN` until ADR-0003 verifies
  Microsoft's policy (D245). The itch.io version has no sign-in and no purchases (D245). The frozen
  github.io site has no purchases (D246).
- **Purchases follow the account**, not the device. The server credits them after verifying the receipt
  (ADR-0002), and they appear on every platform the player signs in to.
- **Spending bought coins offline** is allowed and reconciled on sync (D236).
- **Restoring the Supporter pack**: the apps offer the stores' "Restore purchases". Since sign-in is
  required to buy, signing in on a new device also restores everything.

### 2.6 Refunds (D228)

- **Coin pack refunded**: remove the refunded coins, but never below zero. Items already bought with them
  are kept. The balance never goes negative.
- **Booster bundle refunded**: `OPEN`. D228 covers coins only. The proposed reading is the same rule
  applied to charges (remove unused charges down to zero), and it needs owner confirmation.
- **Supporter pack refunded**: revoke its scene, jar style and frame or badge, and end the no-ads promise.
  Its granted coins are removed down to zero like a coin-pack refund. If a revoked item is worn, the player
  falls back to the default (the same fallback as a repaired save, `save-data.md`).
- Refund notices reach the server from Apple, Google and the merchant of record (ADR-0002).

### 2.7 Founder gift (D230, D246)

- **Who**: any account that imports an old save code from the frozen github.io site in the **14 days after
  launch**. Import works once per account and accepts the code **as-is** (the owner accepts the forgery
  risk).
- **What**: a **founder badge** that is never obtainable later, plus `[AMOUNT]` coins and `[AMOUNT]`
  boosters (amounts in the price proposal).
- **When**: granted on the successful import, once per account.

### 2.8 Legal and store obligations

These come with the decisions above. They are not choices. Each is checked against current store rules
before submission (`OPEN: verify`).

- **Seller**: a Nova Scotia numbered corporation trading as **Blackwave Studios**, still to be formed
  (D248). Listings show "Blackwave Studios" wherever each store allows; this is to be verified per store.
- **Privacy policy and terms of sale**: drafted by us and reviewed by a lawyer before launch (D250).
  They cover accounts, email, analytics (opt-in, 13-month retention), purchases, refunds and account
  deletion.
- **Audience**: 13 and over, declared to every store (D244).
- **Store privacy forms** (App Store privacy labels, Google Play data safety) list exactly what ADR-0002
  stores: account identifiers, email (email-link users), purchase history, save data, and opt-in analytics.
- **Account deletion inside the app** (D238; Apple requires it for apps that create accounts).
- **Launch**: worldwide, English only, with support at an email address on the new studio domain (D251, D252).

---

## 3. Formulas

| Formula | Expression | Variables | Example |
|---|---|---|---|
| Coin refund | `coins' = max(0, coins − refundedCoins)` | `coins` ≥ 0: the balance now; `refundedCoins` > 0: the coins that pack granted. Result range: 0 to `coins` | 500 left, a 1,000-coin pack refunded → 0; 1,500 left → 500 |
| Supporter refund (coins) | same as coin refund, with `refundedCoins` = the pack's coin grant | | |
| "Best value" pack | the coin pack with the highest `coins / priceUSD`, compared at the base USD price | | `OPEN` until prices exist |
| Free income | unchanged: every faucet in `economy.md` §3 | | — |

Price-in-levels figures for each pack (`coins / coinsPerLevel`) are part of the economy proposal (D231).

---

## 4. Edge Cases

- **Purchase while offline**: the stores need a connection to buy. The Shop shows a "Connect to buy"
  state. Spending coins already owned works offline (D236).
- **Purchase succeeds but the app closes before the server credits it**: the store keeps the transaction
  unfinished until the server confirms it (ADR-0002). It is credited at the next launch.
- **The same receipt is sent twice**: the server credits each store transaction once (ADR-0002).
- **Refund after the coins were spent**: the balance goes to zero, never below, and items are kept (D228).
- **A player signs in on a platform where buying isn't offered** (itch.io has no sign-in; github.io is
  frozen): not reachable. Microsoft Store: `OPEN` until verified.
- **The Supporter pack is bought twice** (e.g. on two stores): `OPEN`. Store billing can't stop a purchase
  made on another store, so the Shop should hide the pack once the account owns it. What happens to a
  duplicate charge (refund or not) needs a decision.
- **A countdown offer ends while the Shop is open**: the offer disappears or turns unavailable when the
  countdown reaches zero, and a purchase already started completes at the price the player saw.
- **The device clock is wrong**: offer times come from the server, not the device (ADR-0002).
- **An imported old code has absurd values**: accepted as-is by decision (D246). This is recorded as an
  accepted risk.

---

## 5. Dependencies

**Design**: `economy.md` (coins, boosters, prices), `scenes.md` and `jar-styles.md` (the Supporter's
scene and style), `player-profile.md` and `badges.md` (Supporter frame or badge, founder badge),
`save-data.md` (server-held save, save code removal, old-code import), `feel-audio-ui.md` (Shop sheet,
Home button, toast link), `daily-puzzle.md` and `daily-goals.md` (count only online, D236).

**Technical**: ADR-0002 (accounts, purchase verification, refunds, analytics), ADR-0003 (store billing
plugins, the native apps, achievements, notifications).

**External**: Apple App Store and Google Play billing, a merchant of record (Paddle or Lemon Squeezy,
ADR-0002), the company's formation (D248), and a lawyer's review (D250).

---

## 6. Acceptance Criteria

- [ ] Every product in §2.1 can be bought on iOS, Android and web, is credited exactly once to the signed-in
      account, and appears on every platform after sign-in.
- [ ] A guest cannot buy without signing in; after sign-in the purchase continues.
- [ ] Every faucet in `economy.md` pays exactly what it paid before monetization (a test pins each rate).
- [ ] Undo and Restart cost nothing at any wallet state, in every build.
- [ ] No ads SDK is in any build.
- [ ] A coin-pack refund leaves the balance at `max(0, coins − refundedCoins)` and keeps every owned item.
- [ ] A Supporter refund removes its three items (worn ones fall back to defaults) and its coin grant down to zero.
- [ ] The Shop opens from Home and from the "Needs N coins" toast, and from nowhere else.
- [ ] No countdown appears anywhere in play.
- [ ] An old save code imports once per account, only within 14 days of launch, and grants the founder gift once.
- [ ] Retained screenshots of the Shop, the sign-in prompt, a countdown offer and the founder grant in `production/qa/evidence/`.

---

## Open Questions

1. **Prices and amounts** (D231): pack tiers, prices, Supporter and founder grant amounts, starter-pack
   contents and eligibility. Owner: economy-designer proposal.
2. **Supporter designs** (D221): the new scene, jar style and frame or badge. Owner: art-director proposal.
3. **Booster-bundle refunds**: confirm the same down-to-zero rule as coins (§2.6).
4. **Duplicate Supporter purchase** across stores (§4).
5. **Sales and countdown cadence**: frequency, length and discount limits (§2.4).
6. **Microsoft Store purchases**: verify Microsoft's policy for games in ADR-0003 (D245).
7. **Operating name on stores**: verify each store's rule for "Blackwave Studios" (D248).
8. **Store name**: "Strata: Sand Sort" availability and trademark check (D252).
9. **Toast wording** for the Shop link (§2.3).

---

## Version History

| Date | Author | Changes |
|------|--------|---------|
| 2026-11-19 | Claude (owner interview) | First draft from D218–D254 |
