# Strata

A calm, phone-first sort puzzle. Pour layers of coloured sand between glass jars at a
sunny seaside stall until every jar holds one colour.

**Play:** https://captainblackwave.github.io/Strata/. On a phone, use *Add to Home Screen*
for a full-screen app icon. Every push to `main` re-runs the tests and redeploys
(`.github/workflows/deploy-pages.yml`).

```bash
npm install
npm run dev      # play at http://localhost:5173  (add ?level=N to jump to a level)
npm test         # 53 unit tests: rules, solver, generator, curve, session, layout, save
npm run build    # static site in dist/
```

**How to play:** tap a jar to lift it, then tap another jar to pour its top layer. You
can pour onto an empty jar or onto the same colour, as far as there's room. Seal every
jar to clear the level. Undo is unlimited, there's one spare **Jar** per level, and
**Hint** asks the solver for a move. **Patterns** adds a texture to each colour for
colour-blind play. Keyboard: `1`–`9`/`0` pick jars, `Z` undo, `R` restart, `H` hint.

## What's in the box

| Path | What |
|---|---|
| `src/core/` | Pure, DOM-free rules: board and pours, DFS solver, seeded generator, difficulty curve, session (undo, restart, extra jar, hint) |
| `src/config/game-config.json` | All tuning: the colour/capacity/burial curve, tall-jar challenge every 10th level, palette |
| `src/ui/` | DOM/CSS renderer, pour animation, layout fitting, strings table, `localStorage` save |
| `tests/unit/core/` | Vitest suites. Levels 1–40 are proven solvable on every run |
| `design/reverse-engineering/magic-sort-teardown.md` | The genre teardown the design is built from |
| `design/game-brief.md` | One-page design record (Game Studios rigor `minimal`) |
| `production/epics/strata/` | The MVP epic and its six stories |
| `production/qa/evidence/` | Screenshots and the play-through log |

## How it was made

1. **Reverse engineering, behaviourally.** Following the evidence-and-limits discipline
   of [REA (Reverse Engineer Anything)](https://github.com/morluto/rea), the genre's rules
   were written down from the Magic Sort! store listing and genre knowledge, each with a
   confidence level. No APK was decompiled. Strata contains no code, levels, art, names or
   characters from any other game: it has its own theme, palette, generator and
   solver.
2. **Studio workflow.** The repo is built on
   [Claude Code Game Studios](https://github.com/Donchitos/Claude-Code-Game-Studios)
   (MIT, framework v1.2.0, see `LICENSE`). It went brief → stories → implementation
   with tests → run-and-observe screenshots. `project.yaml` holds the settings, and
   `/help` in Claude Code names the next step.

### Using REA on this project

REA recommends registering it per-project at Claude Code's **local** scope rather than
committing an `.mcp.json`:

```bash
npx -y rea-agents@latest setup --client claude_code --dry-run   # review, then rerun without --dry-run
```

Use it on targets you're authorised to analyse. Its own disclaimer rules out copying
proprietary code or assets.
