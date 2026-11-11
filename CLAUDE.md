# Claude Code Game Studios -- Game Studio Agent Architecture

Indie game development managed through 49 coordinated Claude Code subagents.
Each agent owns a specific domain, enforcing separation of concerns and quality.

## Technology Stack

- **Game**: Strata, a seaside sand-sort puzzle (`design/game-brief.md`)
- **Engine**: Web: TypeScript 5.8, DOM/CSS rendering, Vite 6 (not one of the template's
  Godot/Unity/Unreal engines, so `engine.name` stays unset and the code root resolves to `src/`)
- **Language**: TypeScript (strict)
- **Tests**: Vitest 3, in `tests/unit/` (`npm test`). Visual evidence is Playwright screenshots in `production/qa/evidence/`
- **Version Control**: Git with trunk-based development
- **Build System**: `npm run build` → `dist/` (static files, so any web host works)
- **Asset Pipeline**: none. All art is CSS/SVG in `src/ui/`, and tuning is in `src/config/game-config.json`

> **Note**: Engine-specialist agents for Godot/Unity/Unreal do not apply here. Use
> `gameplay-programmer` for `src/core/`, `ui-programmer` for `src/ui/`, and
> `level-designer` / `systems-designer` for `src/config/game-config.json`.

## Reverse-engineering reference

`design/reverse-engineering/magic-sort-teardown.md` documents the genre rules Strata is
built against. It is a behavioural teardown. **Never add code, levels, art, audio, names
or characters taken from another game.**

## Project Structure

@.claude/docs/directory-structure.md

## Engine Version Reference

<!-- ENGINE-REFERENCE-IMPORT: the line below is engine-specific. /setup-engine
     rewrites it to @docs/engine-reference/<engine>/VERSION.md for the chosen
     engine, so a Unity or Unreal project stops loading the Godot reference every
     session. It defaults to Godot (the template's example engine); skills that
     need the pinned version read docs/engine-reference/<engine>/VERSION.md on
     demand regardless of this import. -->
@docs/engine-reference/web/VERSION.md


## Technical Preferences

`project.yaml` at the repo root is the primary config store — engine, specialists,
naming, platform, performance, modes. Skills resolve it via `resolve_config`
(see `.claude/docs/config-resolution.md`).

`.claude/docs/technical-preferences.md` is the **legacy fallback**, read on demand
when a key is absent from `project.yaml`. It is not imported here: before
`/setup-engine` runs it is almost entirely `[TO BE CONFIGURED]` placeholders, and
after it runs `project.yaml` holds the real values.

## Coordination Rules

@.claude/docs/coordination-rules.md

## Collaboration Protocol

**User-driven collaboration, not autonomous execution.**
Every task follows: **Question -> Options -> Decision -> Draft -> Approval**

- Agents MUST ask "May I write this to [filepath]?" before using Write/Edit tools
  (exempt: `active.md` appends, agent memory, a subagent's new file at the path
  its orchestrating skill named; see `.claude/rules/agent-memory.md`)
- Agents MUST show drafts or summaries before requesting approval
- Multi-file changes require explicit approval for the full changeset
- No commits without user instruction
- A skipped or dismissed question is not an answer: act on nothing, re-ask in
  plain text and wait
- Started outside this file's folder? Warn first: hooks, deny rules and the
  ask-first mode load only when Claude Code starts here

See `docs/COLLABORATIVE-DESIGN-PRINCIPLE.md` for full protocol and examples.

> **First session?** If the project has no engine configured and no game concept,
> run `/start` to begin the guided onboarding flow.

## Issue tracking (Beads)

Work items, bugs and follow-ups live in **Beads** (`bd`, an issue tracker in the repo). Use it
instead of ad-hoc TODO lists so work survives between sessions.

- **Start of a session:** `bash tools/beads/ensure.sh`. Cloud containers start empty, so it installs
  `bd` and rebuilds the local database from `.beads/issues.jsonl`. Then `bd ready` lists open work
  with nothing blocking it.
- **While working:** `bd create "Title" -t bug|task|feature -p 0-4 -d "..."`, `bd update <id> --status in_progress`,
  `bd close <id> --reason "..."`, `bd dep add <id> <blocks-id>`. Reference the issue id in commits
  (`Issue: strata-xyz`).
- **Before committing:** `bash tools/beads/save.sh` writes every issue to `.beads/issues.jsonl`.
  Commit that file: it is the only copy git keeps (the database in `.beads/embeddeddolt/` is ignored).
- Priorities: 0 critical (broken for players), 1 high, 2 normal, 3 low, 4 backlog.

## Coding Standards

@.claude/docs/coding-standards.md

## Context Management

Read `.claude/docs/context-management.md` on demand — it is a reference, not
session context. Two of its conventions are load-bearing and cited by name
elsewhere in the repo, so they are restated here rather than lost:

- **`production/session-state/active.md` is the session checkpoint.** The file is
  the memory, not the conversation. Read it first after any compaction, crash, or
  `/clear`.
- **Helpers in `.claude/scripts/` emit observations, never verdicts.** A script
  that scores or judges will eventually contradict a mode or override it cannot
  see. (Cited by `artifact-check.sh` and `adr-dep-graph.sh`.)
