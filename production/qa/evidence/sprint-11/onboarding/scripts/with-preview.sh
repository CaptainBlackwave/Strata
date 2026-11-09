#!/usr/bin/env bash
# Runs one capture script against `vite preview` on port 5520, then stops the server.
# usage (from the repo root, after `npm run build`):
#   bash production/qa/evidence/sprint-11/onboarding/scripts/with-preview.sh <script.cjs> [extra args]
set -u
dir="$(cd "$(dirname "$0")" && pwd)"
out="$(dirname "$dir")"
npx vite preview --port 5520 --strictPort >/dev/null 2>&1 &
server=$!
for _ in $(seq 1 50); do
  curl -s -o /dev/null http://localhost:5520/ && break
  node -e 'setTimeout(()=>{},200)'
done
node "$dir/$1" http://localhost:5520/ "$out" "${@:2}"
status=$?
kill "$server" 2>/dev/null
exit $status
