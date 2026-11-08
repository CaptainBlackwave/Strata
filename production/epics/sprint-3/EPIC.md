# Epic: Sprint 3: jar mechanics and offline

> **Goal**: Something new every 20 levels, and a home-screen app that works without signal.
> **Source**: `production/sprints/sprint-3.md` (tasks T1–T12 with acceptance criteria), decisions S3-1 to S3-6.
> **Status**: Complete. Evidence in `production/qa/evidence/sprint-3/`.

## Stories

| # | Story | Type | Status | Tests |
|---|-------|------|--------|-------|
| T1 | Board model v2 (per-jar capacity, frozen, lock, funnel) | Logic | Complete | `tests/unit/core/mechanics.test.ts` |
| T2 | Mechanic schedule + placement (separate RNG stream, plain levels unchanged) | Logic | Complete | `tests/unit/core/placement.test.ts`, `tests/fixtures/plain-boards.json` |
| T3–T6 | Narrow, Frozen, Locked, Funnel (rules + art + tap explanations) | Logic + UI | Complete | the above + screenshots |
| T7 | Intro cards + Jar guide | UI | Complete | screenshots |
| T8 | Offline install (service worker) | Integration | Complete | `offline-play.png` walkthrough |
| T9 | Saturday daily mechanic (rotating) | Logic | Complete | `placement.test.ts` |
| T10 | Hints and shuffle with mechanics | Logic | Complete | hint-to-win replay on mechanic levels |
| T11 | GitHub Actions bumped (checkout v5, setup-node v5) | Config | Complete | next deploy run |
