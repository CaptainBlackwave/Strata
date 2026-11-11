#!/usr/bin/env bash
# Makes Beads (bd, the issue tracker) ready in this checkout. Safe to run any time; it only does
# what is missing. Cloud sessions start in a fresh container, so the issue database is rebuilt
# from the committed export, .beads/issues.jsonl (see CLAUDE.md, "Issue tracking (Beads)").
#   1. Installs the bd CLI (npm package @beads/bd, pinned) if it is not on PATH.
#   2. Rebuilds the local database from .beads/issues.jsonl if it does not exist yet.
# usage: bash tools/beads/ensure.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
BD_VERSION="1.3.4"

if ! command -v bd >/dev/null 2>&1; then
  echo "beads: installing @beads/bd@${BD_VERSION}"
  npm install -g "@beads/bd@${BD_VERSION}" >/dev/null
fi

if [ ! -d .beads/embeddeddolt ]; then
  echo "beads: rebuilding the issue database from .beads/issues.jsonl"
  if [ -s .beads/issues.jsonl ]; then
    bd init --non-interactive --prefix strata --skip-agents --skip-hooks --from-jsonl >/dev/null
  else
    bd init --non-interactive --prefix strata --skip-agents --skip-hooks >/dev/null
  fi
  bd config set export.auto true >/dev/null
  git checkout -- .beads/config.yaml .beads/metadata.json .beads/.gitignore .beads/README.md .gitignore 2>/dev/null || true
fi

echo "beads: ready ($(bd count 2>/dev/null || echo '?') issues)"
