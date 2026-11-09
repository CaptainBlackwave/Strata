# Sprint 10: feel and audio polish

> **Status: done (2026-11-09).** The owner approved the audio as recorded (D71). P0 and F1–F9 are done; 685 tests pass. Evidence index: `production/qa/evidence/sprint-10/README.md`. Chosen in the owner interview after 0.9.1 (D60–D70 in `design/gdd/systems-index.md`). Target release: **0.10.0**.

## Sprint Goal
Make every moment sound and feel as good as it looks, while staying calm. Each scene gets its own music. Sounds become richer and cover the events that have none yet. Haptics are tuned. Seals and wins get a gentle celebration. Players get volume sliders. The UI logic that only screenshots cover today gets unit tests (TD-12).

## Before the sprint (P0)
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| P0-1 | **Release workflow** (D60): when `package.json`'s version changes on `main`, tag the commit and publish a GitHub release whose notes come from that version's changelog section. A manual run backfills v0.5.0–v0.9.1 from the changelog's tag table | D56, D60 | Workflow merged; backfill run triggered and verified (`list_tags`, `list_releases`); the v0.9.1 changelog row reaches `main` |
| P0-2 | **Emulated device pass** (D62) on the live site: each item in `production/qa/device-checklist.md`, in Chromium device emulation (Pixel 7, iPhone SE, iPad, landscape, 150% text, reduced motion, offline) | D58, D62 | `production/qa/device-pass-0.9.1.md` gives each item as passed, failed (fixed or filed) or "real phone only", with screenshots |

## Tasks
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| F1 | **Sound effects:** richer pour, land, seal, win and coin sounds; new events for the map (stone tap, locked stone), an unlock, a shell earned, a scene bought and Play here. All synthesised (no files, nothing sampled) | D64, `feel-audio-ui.md` | Every event in a rendered clip; loudness within a set range and no clipping (measured offline); events routed through `audio.play` |
| F2 | **Music per scene** (D65): one calm generative style, with each scene's own key, tempo, timbre and an optional layer (e.g. rain hiss for Soft rain, a sparkle layer for Aurora night). Crossfades on scene change; pauses when hidden | D65 | Every scene's variation rendered; no audible loop seam at 2 minutes; CPU cost measured; music respects the switch and the slider |
| F3 | **Volume sliders** (D66) for sound and music in Settings, saved and repaired like the other settings; the switches mute | D66, `save-data.md` | Save tests (old saves get defaults); keyboard and screen-reader operable; screenshots at 100% and 150% text |
| F4 | **Haptics:** tune the patterns and add them to the new events (Android; iPhone browsers ignore vibrate) | D64 | Patterns in one table with a test that every event has a pattern or explicit none |
| F5 | **Celebrations and animation** (D68): a soft sand shimmer and a warm chime on seal; a gentle bloom on win; map stone and path touches; screen transitions. Calm and short | D68 | Before and after screenshots and short frame captures; reduced motion removes all motion; frame time measured at 4× throttle |
| F6 | **TD-12:** extract and unit-test the booster arm and confirm, restart and leave confirms and key mapping as F1–F5 touch them | D70 | New tests seen failing first; TD-12 marked done |
| F7 | **Audio sign-off page** (D67): every sound and every scene's music, before and after, as playable clips, with the loudness table | D67 | Published page; **the owner approves before the PR merges** |
| F9 | **Badges at 200% text** (device pass finding): the booster count badges cover the Shuffle, Jar and Hint icons at 200% text | `device-pass-0.9.1.md` | Icons visible at 200% on iPhone SE and Pixel 7; screenshots |
| F8 | **0.10.0:** What's new lines, changelog entry, version bump (tagged by the P0-1 workflow) | D56, D60 | The upgrade play-through passes; the tag and release appear after the merge |

## Out of scope
- The late-game economy (D23) and new puzzle variety: not chosen this time.
- Online features (anti-pillars).

## Definition of Done
- `npm test` is green, and new tests were seen failing first.
- Evidence is in `production/qa/evidence/sprint-10/`.
- The owner has approved the audio clips.
- The PR is merged under D61, the live site is checked, and the tag and release exist.
