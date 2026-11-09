# Sprint 10: evidence index

Sprint plan: `production/sprints/sprint-10.md`. Each part has its own notes:

| Part | Notes | What it covers |
|---|---|---|
| P0-1 | `tools/release/release.sh`, `.github/workflows/release.yml` | The release workflow (PR #7). The backfill run created tags and GitHub releases v0.5.0–v0.9.1 at the commits in the changelog table |
| P0-2 | `../../device-pass-0.9.1.md`, `device-pass/` | The device checklist run in emulation on the live 0.9.1 site. Every line passes; the one finding became F9 |
| F1, F3, F4 | `README-f1-f3-f4.md`, `f1/`, `f3/` | Sound recipes and per-event peak caps (all under −1 dBFS), the six new events, the volume sliders (save repair, keyboard, screen reader, 100% and 150% text), and the haptics table |
| F2 | `f2/README.md` | Music per scene: offline renders and in-app captures. Loudness spread is under 1 LU, the music is silent while hidden, and the CPU cost is measured. The clips themselves are on the sign-off page, not in git |
| F5 | `f5/README.md` | Seal shimmer, win bloom, coin flight, map touches and cross-fades, before and after. Reduced motion shows no movement; no frame over 50 ms at a 4× throttle |
| F6 | `f6/README.md` | TD-12: the booster, restart and leave confirms and the key mapping as pure logic with 33 tests. Before and after are byte-identical over 60 recorded steps |
| F7 | https://claude.ai/artifact/G71wADBi6rfQw4usdrsoi8 (`tools/audio/capture.cjs`) | **Audio sign-off page** (D67): every sound before and after, each scene's music, a 2-minute loop and a crossfade, with loudness. Awaiting the owner |
| F8 | `close/upgrade-result.txt` | 0.10.0: an older save sees the What's new card once, then Home → map → level → win |
| F9 | `f9/README.md` | Booster badges at large text: they take the icon's place, the toolbar keeps its height, and jar sizes match 0.9.1 |

**Final regression on the merged build (2026-11-09):**
- `npm test`: 689/689 (685 before the review fixes). `npm run typecheck` and `npm run build`: pass.
- Browser scripts, all with no page errors:
  - hint play-through to a win;
  - level 141 instant start, at 100% and 150% text;
  - cold layout at 100% and 150%;
  - two tabs over BroadcastChannel and the storage fallback, with no save lost;
  - the sprint 9 backlog checks;
  - the 0.9.1 fixes: late tab write, the "New" mark, the map title and labels;
  - the 0.10.0 upgrade.
