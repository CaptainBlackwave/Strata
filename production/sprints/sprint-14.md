# Sprint 14: sharing

> **Status: in progress (2026-11-11).** Design signed off (D120–D124). H1 (link preview) built. Chosen in the owner interview after 0.13.1 (D114, D116–D118 in `design/gdd/systems-index.md`). Target release: **0.14.0**. One PR per item (D80).

## Sprint Goal
Players bring friends (D116): a result worth sending and a link worth opening. Web only (D117) and no server at all (D118): static files, links and pictures made on the device.

## Tasks
| ID | Task | Source | Acceptance Criteria |
|----|------|--------|---------------------|
| H0 | **Design sign-off**: the owner answers the five open questions in `design/gdd/sharing.md`. **Done 2026-11-11** | D114, D120–D124 | Answers recorded as decisions; the GDD status changes to signed off |
| H1 | **Link preview** (PR 1). **Built 2026-11-11**; evidence `production/qa/evidence/sprint-14/h1-link-preview/`: title, description, Open Graph and Twitter tags, one 1200 × 630 preview image rendered by a script | sharing §3.3 | A link-preview check shows title, text and image; the image script is in `tools/` |
| H2 | **Share card image** (PR 2): a pure card plan in `src/ui/logic/`, canvas drawing in `src/ui/`, daily and weekly use it; text stays as the fallback | sharing §3.1 | Card in all scenes with tested contrast; the three fallbacks work; screenshots |
| H3 | **Challenge a friend** (PR 3): `?challenge=N&pours=P`, the three receiver cards, the verdict line, Send it back; the map card and the level win card get their buttons | sharing §3.2 | Launch parsing unit-tested with hostile input; never opens an unreached level; screenshots of each card |
| H4 | **Share moments** (PR 4): Share on a completed shell set, a streak milestone and a new badge | sharing §3.4 | Quiet secondary buttons only; no reward; screenshots |
| R1 | **0.14.0** (last PR): What's new, changelog, version | D56, D60 | Upgrade play-through; tag and release after the merge |

## Carried over
- A phone playtest of levels 20–60 on the gentler curve by the testers who raised the complaint (D115). The 0.13.1 sweep measures solver pours, not feel.

## Out of scope
- Accounts, leaderboards, counting shares or visits, app stores, rewards for sharing.
- New levels, mechanics, scenes or styles.

## Risks
- **Share-sheet support varies.** Sharing a picture works on current iOS Safari and Android Chrome; desktop and in-app browsers often take text only. The fallbacks cover it, and H2 records what each tested browser did.
- **We cannot measure the result.** With no server there is no count of shares or visits (D118). Whether this sprint worked will be judged by what testers and friends say.

## Definition of Done
- `npm test` is green, and new tests were seen failing first.
- Evidence in `production/qa/evidence/sprint-14/`.
- Each PR merged under D61; the live site checked; the v0.14.0 tag and release exist.
