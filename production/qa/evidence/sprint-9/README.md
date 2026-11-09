# Sprint 9: evidence index

Sprint plan: `production/sprints/sprint-9.md`. Each part has its own notes:

| Part | Notes | What it covers |
|---|---|---|
| M1 | `README-m1.md` | Rainbow arc clears the Home title; Winter lights and Aurora night stay out of the HUD (canvas alpha behind the HUD measured 0); brighter Meteor shower and Aurora night seal effects; reduced motion |
| M2 | `README-m2.md`, `m2/` | `main.ts` split by screen (TD-1): DOM, win cards and saved JSON byte-identical before and after |
| M3 | `README-m3.md`, `m3/` | The level map: levels 3, 60 and 201, cleared and locked tap cards, 150% text on 320 px, reduced motion, a replay earning Perfect, the board from the map matching `?level=60` |
| M4 | `README-m4.md`, `m4/` | One active tab: the two-tab run over BroadcastChannel and the storage fallback; no save lost |
| M5 | `README-m5.md`, `m5/` | The 9 open backlog findings, each verified or fixed with a screenshot |
| M6, M7 | `close/` | An 0.8.0 save upgrades to 0.9.0: What's new shown once, `perfect: []` added, Play → map → level → win |

**Final regression on the merged build (2026-11-09):**
- `npm test`: 523/523 across 34 files. `npm run typecheck` and `npm run build`: pass.
- Browser scripts run on the merged build, all with no page errors:
  - `m3/shots.cjs`;
  - `m4/two-tab.cjs` and `m5/m5.cjs`, which now go through the map;
  - `close/upgrade.cjs`;
  - the sprint 8 regressions, also routed through the map:
    - hint clearing: won, with no stale hint marks;
    - cold layout at 150% text: no jar under the toolbar;
    - level 141 start: 223 ms on Pixel 7 and 254 ms on iPhone SE at 150% text, with a 4× CPU throttle. That is timed from the map's Play button, so the map step gives background generation extra time; it is not a like-for-like comparison with sprint 8.
- Fixed during the merge review:
  - the tutorial caption covered the new "tools unlock" note at 150% text on 320 px;
  - equalling your best said "new best".
