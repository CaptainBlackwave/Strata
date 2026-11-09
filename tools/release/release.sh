#!/usr/bin/env bash
# Tags releases and publishes GitHub releases from production/releases/CHANGELOG.md (D56, D60).
#
#   release.sh current   tag the version in package.json at HEAD (on a push to main that changes it)
#   release.sh backfill  tag every row of the changelog's "Tags to create" table at its commit
#   release.sh notes X.Y.Z   print that version's changelog section (used for the release body)
#
# Existing tags are left alone, so every mode can be re-run safely. Set DRY_RUN=1 to print the
# git and gh commands instead of running them. Needs `gh` (GH_TOKEN) and push rights to tags.
set -euo pipefail
CHANGELOG="${CHANGELOG:-production/releases/CHANGELOG.md}"

run() { if [ "${DRY_RUN:-0}" = 1 ]; then printf 'DRY:'; printf ' %q' "$@"; printf '\n'; else "$@"; fi; }

# The section under "## X.Y.Z (...)" up to the next "## " heading, without the heading.
notes() {
  awk -v v="$1" '
    $0 ~ "^## " { if (on) exit; if (index($0, "## " v " ") == 1) { on = 1; next } }
    on { print }
  ' "$CHANGELOG" | sed -e '/./,$!d'
}

# Asks the remote, not the local clone: a local tag that was never pushed must not stop a release.
tag_exists() { git ls-remote --exit-code --tags origin "refs/tags/$1" >/dev/null 2>&1; }
release_exists() { gh release view "$1" >/dev/null 2>&1; }

# One release: an annotated tag at $2, pushed, then a GitHub release with that version's notes.
release() {
  local version="$1" sha="$2" tag="v$1" body
  body="$(notes "$version")"
  if [ -z "$body" ]; then echo "no changelog section for $version; refusing to release $tag" >&2; return 1; fi
  if tag_exists "$tag"; then
    # Already tagged. If an earlier run pushed the tag but failed before the release, finish it now.
    if release_exists "$tag"; then echo "skip $tag (tagged and released)"; return 0; fi
    echo "$tag is tagged but has no release; creating the release"
  else
    run git tag -f -a "$tag" "$sha" -m "Strata $version" # -f: replaces only an unpushed local tag
    run git push origin "refs/tags/$tag"
  fi
  run gh release create "$tag" --verify-tag --title "Strata $version" --notes "$body"
  echo "released $tag"
}

case "${1:-}" in
  notes) notes "$2" ;;
  current)
    version="$(node -p "require('./package.json').version")"
    release "$version" "$(git rev-parse HEAD)" ;;
  backfill)
    # Rows look like: | v0.8.0 | `05d5be5` (sprint 8, PR #4) |
    grep -E '^\| v[0-9]+\.[0-9]+\.[0-9]+ \| `[0-9a-f]{7,40}`' "$CHANGELOG" | while IFS='|' read -r _ tag sha _; do
      tag="$(echo "$tag" | tr -d ' ')"; sha="$(echo "$sha" | grep -oE '[0-9a-f]{7,40}' | head -1)"
      release "${tag#v}" "$(git rev-parse "$sha^{commit}")"
    done ;;
  *) echo "usage: release.sh current|backfill|notes X.Y.Z" >&2; exit 2 ;;
esac
