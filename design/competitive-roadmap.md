# Competitive roadmap

**Goal:** make Strata a game people choose over the top liquid-sort apps. It should
match them on feel and core loop, and beat them on respect for the player.
**Evidence:** `design/reverse-engineering/magic-sort-teardown.md` (v1 rules, v2 recording).

## Design decisions

| ID | Decision | Why |
|---|---|---|
| D1 | **No lives or energy.** You can always play the next level | Lives exist to sell refills. Removing them is our clearest advantage |
| D2 | **No IAP or ads.** Coins come only from play | Web distribution, no store fees, and a calm brand promise |
| D3 | **Boosters are limited but earnable.** Charges, then coins | Keeps the decisions and tension that make boosters feel valuable (V2-8) without paywalls |
| D4 | **Perfect = no boosters used**, worth +10 coins | Rewards skill and gives a reason to replay |
| D5 | Original theme only: seaside sand art, no mascots | Hard rule: see the project's CLAUDE.md |

## Sprint 1: done (this change)

| ID | Item | Evidence |
|---|---|---|
| C1 | Feel: 100° tilt with a level sand surface, faster pours, landing splash, cork drop + sparkles, win burst, synthesised SFX/music, haptics | V2-1…V2-7 |
| C2 | Economy: wallet, booster charges and prices, rewards, perfect bonus | V2-8, V2-9 |
| C3 | Shuffle booster: re-deals unsealed jars, solver-checked, undoable | V2-8 |
| C4 | First-launch tutorial with coach ring and captions | V2-10 |
| C5 | Home screen, settings sheet (sound, music, vibration, colour patterns, replay tutorial) | V2-12 |

## Next sprints (proposed)

| ID | Item | Why |
|---|---|---|
| C6 | **Daily puzzle** with a streak counter (seeded by date, the same for everyone, shareable result) | A reason to return every day, with no backend |
| C7 | **Shell collection**: earn a seaside collectible every 5 levels, shown in a cabinet | An original version of the Collection meta (V2-14) |
| C8 | New level mechanics every ~20 levels (frozen jar, locked jar with key colour, mixed capacities) | Long-term variety; competitors add mechanics over time |
| C9 | Offline install (service worker) so the home-screen app works without signal | Phone-first web parity with native |
| C10 | Theme packs (dusk, tide pool) bought with coins | A coin sink once boosters are plentiful |
| C11 | Leaderboard / friends (needs a backend) | Social pull. Only after retention is proven |
