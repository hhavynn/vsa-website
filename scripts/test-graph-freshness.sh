#!/usr/bin/env bash
set -euo pipefail
checker="$(cd "$(dirname "$0")" && pwd)/check-graph-freshness.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
cd "$tmp"
git init -q
git config user.name 'Synthetic Test'
git config user.email 'synthetic@example.invalid'
mkdir -p graphify-out src
printf '{}\n' > graphify-out/manifest.json
printf '{}\n' > graphify-out/graph.json
printf 'original\n' > src/one.ts
git add .
git commit -qm baseline
result="$(GRAPHIFY_REPO_ROOT="$tmp" "$checker")"
[[ "$result" == *'no committed src/ changes'* ]]
for i in {1..6}; do
  printf 'version %s\n' "$i" > src/one.ts
  git add src/one.ts
  git commit -qm "source update $i"
  result="$(GRAPHIFY_REPO_ROOT="$tmp" "$checker")"
  if (( i <= 5 )); then
    [[ "$result" == *"$i source-changing commit(s)"* ]]
  else
    [[ "$result" == *'over the 5-commit trust threshold'* ]]
  fi
done
rm graphify-out/graph.json
result="$(GRAPHIFY_REPO_ROOT="$tmp" "$checker")"
[[ "$result" == *'is missing'* ]]
echo 'Graphify freshness tests passed'
