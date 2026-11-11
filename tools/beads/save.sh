#!/usr/bin/env bash
# Writes every issue to .beads/issues.jsonl, the copy that git keeps. Run it before committing
# when issues changed: the database itself is not committed, and auto-export can lag by a minute.
# usage: bash tools/beads/save.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
bd export -o .beads/issues.jsonl
