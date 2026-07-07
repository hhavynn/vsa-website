#!/usr/bin/env bash
# check-graph-freshness.sh — is the Graphify graph built from the current HEAD?
# Compares the "Built from commit:" line in graphify-out/GRAPH_REPORT.md with
# `git rev-parse HEAD`. Exit 0 = fresh, 1 = stale or report missing.
# No dependencies beyond bash + git. Run from anywhere inside the repo.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "ERROR: not inside a git repository." >&2
  exit 1
}
REPORT="$REPO_ROOT/graphify-out/GRAPH_REPORT.md"

if [[ ! -f "$REPORT" ]]; then
  echo "STALE: $REPORT not found — no graph has been built. Run: graphify . --update" >&2
  exit 1
fi

# Header looks like:  - Built from commit: `a3d7ea60`
GRAPH_COMMIT="$(grep -m1 'Built from commit' "$REPORT" | grep -oE '[0-9a-f]{7,40}' | head -1 || true)"
if [[ -z "$GRAPH_COMMIT" ]]; then
  echo "STALE: could not parse 'Built from commit' from $REPORT (header format may have changed)." >&2
  exit 1
fi

HEAD_FULL="$(git -C "$REPO_ROOT" rev-parse HEAD)"

# Graph records an abbreviated hash; compare by prefix in both directions.
if [[ "$HEAD_FULL" == "$GRAPH_COMMIT"* || "$GRAPH_COMMIT" == "$HEAD_FULL"* ]]; then
  echo "FRESH: graph built from $GRAPH_COMMIT == HEAD (${HEAD_FULL:0:8})"
  exit 0
fi

BEHIND="$(git -C "$REPO_ROOT" rev-list --count "$GRAPH_COMMIT"..HEAD 2>/dev/null || echo '?')"
echo "STALE: graph built from $GRAPH_COMMIT, HEAD is ${HEAD_FULL:0:8} ($BEHIND commit(s) ahead of graph)."
echo "       Graph is blind to: git log --oneline $GRAPH_COMMIT..HEAD"
echo "       Refresh with: graphify . --update   (interactive sessions only)"
exit 1
