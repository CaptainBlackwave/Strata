# ADR-0003: Native apps and store builds

## Status

Proposed

> Who may move this to `Accepted`: the user, or `technical-director` on the user's explicit confirmation.
> The owner asked for a comparison before choosing (D247). The recommendation below is not yet a decision.

## Date

2026-11-19

## Last Verified

2026-11-19. Wrapper versions, plugin maturity and store policies are from knowledge, not re-read today;
each is marked **verify** and must be checked before acceptance.

## Decision Makers

Owner (D241, D242, D245, D247, D254). Draft by Claude, for `technical-director` review.

## Summary

Strata must reach Android, iOS (with tablets and Apple-silicon Macs), itch.io and the Microsoft Store from
one web code base, with store billing, native sign-in, achievements and notifications (D241, D242, D245).
This ADR compares the ways to wrap the existing Vite build and recommends **Capacitor** for Android and
iOS, a **PWA package** for the Microsoft Store, and a **plain web zip** for itch.io, all built from one
source with a build-target flag.

## Engine Compatibility

| Field | Value |
|-------|-------|
| **Engine** | Web stack (`docs/engine-reference/web/VERSION.md`) inside native web views (Android System WebView, iOS WKWebView) |
| **Domain** | Core / Rendering / Input |
| **Layer** | Foundation |
| **Knowledge Risk** | HIGH: wrapper and plugin versions, store rules and web-view WebGL behaviour are not in the engine reference and change often |
| **References Consulted** | `docs/engine-reference/web/VERSION.md`, ADR-0001, ADR-0002, `public/manifest.webmanifest`, `public/sw.js` |
| **Post-Cutoff APIs Used** | Unknown until versions are pinned. **Verify** at implementation and add a `docs/engine-reference/` page for the chosen wrapper |
| **Verification Required** | PixiJS WebGL board in each web view on real devices (ADR-0001's smooth 16-jar pour); safe areas; audio unlock; haptics; sign-in sheets; billing in sandbox |

## ADR Dependencies

| Field | Value |
|-------|-------|
| **Depends On** | ADR-0002 (sign-in and purchase verification) |
| **Enables** | Store submissions |
| **Blocks** | Android, iOS, Microsoft Store and itch.io release stories |
| **Ordering Note** | The Apple and Google Play organisation accounts need the company (D248). The owner is getting a Mac for iOS builds (D254) |

## Context

### Problem Statement
The game is a PWA on GitHub Pages. The stores need native packages with store billing (Apple and Google
take in-app purchases of digital goods through their own billing, **verify** current exceptions), and the
owner wants achievements (D242) and opt-in notifications at launch (D241).

### Current State
- `dist/` is static: HTML, JS (PixiJS board, ADR-0001), CSS and icons. It is portrait-only (`manifest.webmanifest`).
- `public/sw.js` caches for offline play, and `src/ui/update.ts` shows an in-app update prompt.
- Haptics use the web vibration API, which iOS Safari does not support (**verify**).

### Constraints
- Store-review updates only, with no over-the-air content updates (D247).
- One version number on every platform. Store builds are batched every 2–4 weeks (D247).
- Full tablet support (D245), so the portrait layout must be checked and fixed on iPad and Android tablets.
- English only, worldwide (D251).

### Requirements
1. Android (Google Play) and iOS (App Store) apps, with iPad and the iOS app on Apple-silicon Macs (D245).
2. Store billing for the products in `monetization.md`, verified by ADR-0002.
3. Native sign-in sheets for Apple, Google and Microsoft, plus email link (D234).
4. Game Center and Google Play Games achievements mirroring the badges (D242).
5. Opt-in daily-puzzle and streak reminders, asked for after a few sessions (D241).
6. A Microsoft Store package and an itch.io build (D245).

## Decision (recommended)

### 1. Android and iOS: Capacitor
- The Vite `dist/` is copied into a Capacitor project (`apps/native/`, or `ios/` and `android/` at the root,
  as Capacitor's tooling expects; `OPEN`, layout only).
- A build-target flag (`VITE_TARGET=web | native | msstore | itch`) controls platform differences:
  - **native**: no service worker and no update prompt (the store updates the app). Assets are bundled, so
    the app plays offline. Haptics go through the native plugin.
  - **itch**: no sign-in, no Shop, no back-end calls (D245). Earned coins only.
  - **msstore**: as web, with the purchase route `OPEN` (§3).
- **Billing plugin**: `OPEN`. The candidates are an open-source store plugin (e.g. cordova-plugin-purchase,
  which works under Capacitor) and a hosted service SDK (e.g. RevenueCat). A hosted service would see
  purchase data, so this needs an owner decision alongside D239. Receipts always go to our server (ADR-0002).
- **Sign-in**: native Sign in with Apple on iOS and Mac; Google and Microsoft through native or
  system-browser flows, not inside the web view (ADR-0002 Risk 3). **Verify** the plugins.
- **Achievements**: Game Center and Google Play Games plugins. **Verify** maturity; a small custom native
  plugin may be needed.
- **Notifications** (D241): daily and streak reminders as **local notifications**, scheduled on the device, so
  no push server is needed for them. `OPEN`: whether web players also get reminders (web push needs a
  server and, on iOS, an installed PWA).
- **Mac**: allow the iOS app on Apple-silicon Macs in App Store Connect, after a layout check.

### 2. itch.io
An HTML5 zip of the `itch` target, uploaded by a CI step. No sign-in, no purchases, earned coins only, and a
link to the full game (D245).

### 3. Microsoft Store
A PWA package (MSIX, e.g. made with PWABuilder) of the `msstore` target pointing at the game domain.
**Purchases are `OPEN`**: Microsoft's current policy on games taking payment outside Microsoft's billing
must be verified (D245). If outside billing is allowed, use the web checkout (ADR-0002). If it is not,
either integrate Microsoft's billing or ship play-only there (a new owner decision).

### 4. Web
The game moves to the new game domain on Cloudflare (D252). The github.io site stays frozen as today (D246).

## Alternatives Considered

### Alternative 1: Capacitor (recommended)
- **Pros**: wraps the existing build unchanged; one tool for Android and iOS; mature plugin ecosystem
  (billing, haptics, local notifications, sign-in); active maintenance (**verify**).
- **Cons**: a native project per platform to maintain; plugin quality varies.

### Alternative 2: Trusted Web Activity (Android) plus a separate iOS shell
- **Pros**: the Android app is a thin Chrome view of the live site, so it updates without review.
- **Cons**: Android only; needs a verification file at the domain root (no good on github.io, possible on
  the new domain). Updating without review conflicts with D247's store-review-only rule in spirit, and Play
  billing in a TWA needs the Digital Goods API (**verify**). It still leaves iOS unsolved.
- **Rejection reason**: two different wrappers to maintain, and no iOS.

### Alternative 3: Apache Cordova
- **Pros**: the oldest and simplest web-view wrapper; the store plugin above comes from here.
- **Cons**: a slower-moving ecosystem than Capacitor (**verify**).
- **Rejection reason**: Capacitor offers the same model with more current tooling.

### Alternative 4: Tauri 2 (mobile and desktop)
- **Pros**: small binaries; also covers Windows and Mac desktop.
- **Cons**: its mobile support and billing plugins are younger (**verify**); a Rust toolchain is added.
- **Rejection reason**: higher risk for the two platforms that matter most.

### Alternative 5: Port to a game engine or native code
- **Rejection reason**: rewrites working, tested code for no player-visible gain.

## Consequences

### Positive
- One code base for every platform. `src/core` and the board are unchanged.
- The native apps play fully offline from bundled assets.

### Negative
- Native projects, signing keys and store credentials must be kept safe. The Android upload key and Apple
  certificates are permanent responsibilities.
- Store review adds days to every native release (D247 accepts this).
- Tablet layouts are new work (D245).

### Neutral
- The service worker stays for the web build only.

## Risks
1. **WebGL board performance in web views (HIGH).** ADR-0001's gate (a smooth 16-jar pour on a real phone)
   must pass inside the Android System WebView and WKWebView on low-end devices. The DOM board stays the
   fallback. A device plan is needed (D254); there is no iPhone yet.
2. **Apple's "more than a website" rule (MEDIUM).** Bundled assets, offline play, native sign-in, haptics,
   achievements and notifications make the app clearly native, but review outcomes can't be guaranteed.
3. **Permanent identifiers (MEDIUM).** The app bundle ID and Android application ID can never change. They
   wait for the domains (D252) and the company (D248).
4. **Microsoft Store purchases (MEDIUM).** Unverified policy (§3).

## GDD Requirements Addressed

| GDD System | Requirement | How This ADR Addresses It |
|------------|-------------|--------------------------|
| monetization.md | Store billing in apps; no purchases on itch.io | Billing plugin; `itch` target |
| badges.md | Mirrored as platform achievements (D242) | Game Center and Play Games plugins |
| daily-puzzle.md | Opt-in reminders (D241) | Local notifications |
| feel-audio-ui.md | Haptics, safe areas, tablets | Native haptics plugin; tablet layout pass |

## Performance Implications
- **Download**: the app bundles `dist/` (about 235 KB gzipped, ADR-0001) plus the wrapper runtime.
- **Load time**: faster than the web build, with no network on launch.

## Migration Plan
1. Add the build-target flag and the `native` and `itch` differences behind it, with tests.
2. Create the Capacitor projects. Run on the owner's Android phone and tablet, then on the Mac with an
   iPhone from the device plan.
3. Integrate sign-in and billing against ADR-0002 in sandbox.
4. Package the Microsoft Store and itch.io builds once §3 is settled.

## Validation Criteria
- The ADR-0001 performance gate passes in both web views on the device plan's low-end phones.
- A sandbox purchase on each store is credited once by the server.
- Retained screenshots of every screen on a phone and a tablet per platform in `production/qa/evidence/`.

## Related
ADR-0001, ADR-0002, `design/gdd/monetization.md`, decisions D241, D242, D245, D247, D252, D254.
