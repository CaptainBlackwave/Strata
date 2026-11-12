# Sprint 25 U1 + U2: tokens and components, before and after

`src/ui/style.css`, 2026-11-12. Before = the v0.22.0 file the audit measured; after = this change.
Counted with `node production/qa/evidence/sprint-25/css-metrics.cjs src/ui/style.css` (comments stripped;
"literal" means the value uses no `var(--…)`). Screens: `after-u1/shots/` (same names as `audit/shots/`).

## Counts

| Measure | Before | After | Notes |
|---|---|---|---|
| font-size, distinct literal values / uses | 23 / 134 | 6 / 6 | Left: `100%` (html), `0.9em`, `10px` (a tiny name plate), `3.375rem` (the old Home logotype), the two `.plate-sm/-lg` art sizes. Everything else is `--fs-1..6` (129 refs) |
| font-weight, distinct literal / uses | 4 / 94 | 0 / 0 | `--fw-body 600`, `--fw-bold 800` (700 folded in), `--fw-black 900` |
| border-radius, distinct literal (not 50%) / uses | 31 / 105 | 22 / 37 | Left are jar, cork, padlock, stone, swatch-jar and slider art plus 2–3px hairline bars. UI chrome is `--r-s/m/l/pill` (63 refs) |
| box-shadow, distinct fully-literal values / uses | 41 / 47 | 22 / 22 | Left are art insets (sand, corks, plates, glows). Lips, cards, sheets, toasts use `--lip*`, `--sh-1..3` |
| spacing px in padding/margin/gap, distinct / uses | 23 / 418 | 15 / 89 | Left: 1–2px hairline nudges (49 uses) and jar/art spacing. 337 refs to `--sp-1..8` |
| transition durations, distinct literal / uses | 6 / 11 | 4 / 4 | `--dur-1/2/3`; keyframe animations (pop, rise, celebrations) are untouched |
| hex colours, distinct / uses | 121 / 223 | 123 / 220 | Count is flat on purpose: new tokens (bands, gold, danger) are hex inside `:root`. What changed is *where*: `tests/unit/ui/tokens.test.ts` now fails on any hex outside the token blocks and the art allow-list |
| `#2a9d8f` (accent retyped) | 10 | 8 | The 8 left are sand colours in the logo / win / swatch jars (art, must not follow the scene). `--hint`, the "thinking" ring and the map star use `var(--accent)` |
| `#1f776c` (hard-coded primary lip) | 2 | 0 | `--lip-accent` = `color-mix(var(--accent) 66%, #000)` |
| `rgba(90,70,50,…)` daytime brown | 28 | 1 | The one left is the midday default of the `--glass-edge` scene token |
| `rgba(74,59,44,…)` | 9 | 1 | Now the `--buried-mark` token (sand art) |
| rgb/rgba literals, distinct / uses | 166 / 268 | 151 / 229 | Mostly white/black art highlights |
| `color-mix()` | 44 | 74 | |
| `var(--…)` references | 551 | 1,340 | |

## Checks
- `npx tsc --noEmit`: clean. `npm test`: 129 files, all pass (new `tests/unit/ui/tokens.test.ts`, 10 tests; watched fail with an injected `#123456` and `rgba(90, 70, 50, …)`).
- `npm run build && npm run guard:layout`: 48 screens, **0 with overflow**.
- Shots: `after-u1/shots/{tab-play,tab-today,settings,stats,profile,win-card-classic,win-card-real}__{light,dark}-{390,320t150}.png` (28).
