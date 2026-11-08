# Sprint 8: evidence index

Sprint plan: `production/sprints/sprint-8.md`. Each part has its own notes:

| Part | Notes | What it covers |
|---|---|---|
| P1, P2 | `README-scenes.md` | 8 ladder scenes (screenshots of home, board and win for each; seal reactions; reduced motion), frame-time numbers, the southern-hemisphere switch in June |
| P3, P5 | `README-p3p5.md` | Pinch zoom, jar hit areas ≥ 44 px (tap scan), the AX-14 dialog name, the "What's new" card |
| P3 bug | `README-layout-bug.md` | Jars under the toolbar after a level opened directly at large text; ResizeObserver fix, before and after |
| P4 | `README-p4.md` | Background generation: next level 8–15 ms (was 2.8 s at level 141, 4× CPU throttle); offline play, and the older offline bug it fixed |
| P6 | `../../../docs/tech-debt.md` | Code review register: TD-2, 3, 4, 6, 7, 9, 10, 11, 15 done |
| P6 refactors | `README-refactor.md` | TD-2 and TD-9 before/after: 2,407 label rows and every win-card case identical |
| P7 | `README-p7.md` | The top 20 backlog fixes, each with a screenshot |

**Final regression on the merged build (2026-11-08):**
- `npm test`: 472/472 across 28 files.
- `npm run build`: passes.
- Smoke check:
  - An old save sees "What's new" once.
  - All 16 scenes are listed.
  - Aurora night's win display runs.
  - The southern switch and the What's new button are in Settings.
- Directly opened levels at 100% and 150% text on 320 px all sit above the toolbar.
- Level 141 tapped 150 ms after load on a 4× CPU shows its board in about 0.5 s.
- Level 26 plays to a win with no "?" on sealed jars and no lingering hint marks.
- No page errors anywhere.

**Still needs a real phone:** frame time with a GPU (Winter lights and Aurora night are the heaviest), pinch and double-tap zoom on iOS Safari and Android Chrome, VoiceOver and TalkBack for the new announcements.
