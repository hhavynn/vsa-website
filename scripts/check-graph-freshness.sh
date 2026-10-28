#!/usr/bin/env bash
# Warn when src/ has changed since the committed Graphify manifest was updated.
# This must never block a feature PR or update generated Graphify files.
set -euo pipefail

repo_root="${GRAPHIFY_REPO_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}"
manifest='graphify-out/manifest.json'

warn() {
  echo "Graphify freshness: $1"
  if [[ "${GITHUB_ACTIONS:-}" == 'true' ]]; then
    echo "::warning title=Graphify freshness::$1"
  fi
}

if ! git -C "$repo_root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  warn 'Cannot inspect Git history; graph freshness is unknown.'
  exit 0
fi

if [[ ! -f "$repo_root/$manifest" || ! -f "$repo_root/graphify-out/graph.json" ]]; then
  warn 'Committed graph or manifest is missing. Refresh with ./scripts/graphify-run . --update in a separate graph-only commit.'
  exit 0
fi

baseline="$(git -C "$repo_root" log -1 --format='%H' -- "$manifest")"
if [[ -z "$baseline" ]]; then
  warn 'No committed Graphify manifest baseline. Refresh Graphify in a separate graph-only commit.'
  exit 0
fi

if ! git -C "$repo_root" merge-base --is-ancestor "$baseline" HEAD; then
  warn 'Graph manifest baseline is not an ancestor of this checkout. Freshness unknown; inspect before trusting graph answers.'
  exit 0
fi

changes="$(git -C "$repo_root" rev-list --count "$baseline..HEAD" -- src/)"
if (( changes == 0 )); then
  echo 'Graphify freshness: no committed src/ changes since the graph manifest update.'
elif (( changes <= 5 )); then
  warn "$changes source-changing commit(s) since Graphify refresh. Verify graph answers against current source."
else
  warn "$changes source-changing commits since Graphify refresh (over the 5-commit trust threshold). Query results may be stale; refresh with ./scripts/graphify-run . --update in a separate graph-only commit."
fi
