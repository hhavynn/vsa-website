#!/usr/bin/env bash
# check-capabilities.sh — honestly report which agentic-engineering capabilities are
# available in the current environment. Used by AI agents to avoid bluffing about tools.
# See docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md §18.
set -u

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ok()   { printf '  \033[32mOK\033[0m    %s\n' "$1"; }
warn() { printf '  \033[33mN/A\033[0m   %s\n' "$1"; }

echo "Agentic-engineering capabilities:"

# Graphify — structural navigation
if command -v graphify >/dev/null 2>&1 || [ -x "$ROOT/scripts/graphify-run" ]; then
  if [ -f "$ROOT/graphify-out/graph.json" ]; then
    ok "Graphify — installed; graph present at graphify-out/graph.json"
  else
    ok "Graphify — installed; no graph yet (run: graphify . )"
  fi
else
  warn "Graphify — not found; fall back to targeted grep/find"
fi

# Repomix — narrow context packing (zero-install via npx)
if command -v repomix >/dev/null 2>&1; then
  ok "Repomix — on PATH"
elif [ -x "$ROOT/node_modules/.bin/repomix" ]; then
  ok "Repomix — local dependency"
elif command -v npx >/dev/null 2>&1; then
  ok "Repomix — available via 'npx repomix' (not a repo dependency)"
else
  warn "Repomix — unavailable (no npx); read narrow source directly"
fi

# Impeccable — meaningful UI/design work (Claude skill)
if [ -d "$HOME/.claude/skills/impeccable" ]; then
  ok "Impeccable — installed (Claude skill)"
else
  warn "Impeccable — not detected; lean on vsa-design-system-reference"
fi

# Superpowers — methodology plugin (methodology also encoded in the workflow doc)
if grep -qi superpower "$HOME/.claude/plugins/installed_plugins.json" 2>/dev/null \
   || find "$HOME/.claude" -maxdepth 5 -iname '*superpower*' 2>/dev/null | grep -q .; then
  ok "Superpowers — installed"
else
  warn "Superpowers — not installed; methodology encoded in docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md §6"
fi

# Project skills & playbooks
skills=$(find "$ROOT/.claude/skills" -mindepth 1 -maxdepth 1 -type d -name 'vsa-*' 2>/dev/null | wc -l | tr -d ' ')
plays=$(find "$ROOT/.claude/agents" -maxdepth 1 -name 'vsa-*.md' 2>/dev/null | wc -l | tr -d ' ')
ok "Project skills — ${skills} vsa-* skills in .claude/skills/"
ok "Domain playbooks — ${plays} vsa-* playbooks in .claude/agents/"
