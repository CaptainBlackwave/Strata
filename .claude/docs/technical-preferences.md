# Technical Preferences

<!-- project.yaml at the repo root is the machine-readable source of truth for
     engine, specialists, naming, performance, platform, and testing.framework.
     This file is the human-readable LEGACY FALLBACK: agents and skills resolve
     each key from project.yaml first and fall back here only when the
     project.yaml key is absent. /setup-engine dual-writes both.
     Forbidden patterns and allowed libraries are NOT migrated — they live only
     in this file. Populated by /setup-engine; updated as decisions are made. -->

## Engine & Language

- **Engine**: Web (TypeScript + Vite). Not a template-supported engine, so see CLAUDE.md
- **Language**: TypeScript 5.8 (strict)
- **Rendering**: DOM + CSS, Web Animations API
- **Physics**: None

## Input & Platform

<!-- Written by /setup-engine. Read by /ux-design, /ux-review, /test-setup, /team-ui, and /dev-story -->
<!-- to scope interaction specs, test helpers, and implementation to the correct input methods. -->

- **Target Platforms**: Web (mobile browsers first, desktop browsers)
- **Input Methods**: Touch, Mouse, Keyboard
- **Primary Input**: Touch (tap a jar, tap a target)
- **Gamepad Support**: None (keyboard: 1–9/0 pick jars, Z undo, R restart, H hint, Esc deselect)
- **Touch Support**: Full
- **Platform Notes**: Must fit a 390×664 viewport with no scrolling and respect safe-area insets

## Naming Conventions

- **Classes**: PascalCase
- **Variables**: camelCase
- **Signals/Events**: `SessionEvent` discriminated union, `type` in camelCase
- **Files**: kebab-case `.ts`
- **Scenes/Prefabs**: N/A
- **Constants**: UPPER_SNAKE_CASE

## Performance Budgets

- **Target Framerate**: 60 fps during pour animations
- **Frame Budget**: 16.6 ms. Level generation runs on level start, outside animation (worst seen: 443 ms over 2,000 levels)
- **Draw Calls**: N/A (DOM)
- **Memory Ceiling**: 50 MB JS heap

## Testing

- **Framework**: Vitest
- **Minimum Coverage**: every rule in `src/core/` has a unit test
- **Required Tests**: Balance formulas, gameplay systems, networking (if applicable)

## Forbidden Patterns

<!-- Add patterns that should never appear in this project's codebase -->
- DOM, `window` or storage access inside `src/core/`
- Gameplay numbers hardcoded outside `src/config/game-config.json`
- Any code, level data, art, audio or names taken from another game

## Allowed Libraries / Addons

<!-- Add approved third-party dependencies here -->
- Dev only: typescript, vite, vitest. No runtime dependencies.

## Architecture Decisions Log

<!-- Quick reference linking to full ADRs in docs/architecture/ -->
- [No ADRs yet — use /architecture-decision to create one]

## Engine Specialists

<!-- Written by /setup-engine when engine is configured. -->
<!-- Read by /code-review, /architecture-decision, /architecture-review, and team skills -->
<!-- to know which specialist to spawn for engine-specific validation. -->

- **Primary**: gameplay-programmer (no engine specialist exists for the web stack)
- **Language/Code Specialist**: gameplay-programmer
- **Shader Specialist**: technical-artist (CSS effects)
- **UI Specialist**: ui-programmer
- **Additional Specialists**: level-designer (curve), accessibility-specialist
- **Routing Notes**: `src/core/**` goes to gameplay-programmer, `src/ui/**` to ui-programmer, and `src/config/**` to level-designer

### File Extension Routing

<!-- Skills use this table to select the right specialist per file type. -->
<!-- If a row says [TO BE CONFIGURED], fall back to Primary for that file type. -->

| File Extension / Type | Specialist to Spawn |
|-----------------------|---------------------|
| Game code (primary language) | gameplay-programmer |
| Shader / material files | technical-artist |
| UI / screen files | ui-programmer |
| Scene / prefab / level files | level-designer |
| Native extension / plugin files | N/A |
| General architecture review | Primary |
