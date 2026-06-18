# Gemini CLI Workflow

This document outlines how Gemini CLI integrates with the VSA at UCSD repository, maintaining parity with existing Claude and Codex workflows.

## Workflow Overview

Gemini CLI uses a **Research -> Strategy -> Execution** lifecycle, enhanced by Graphify for discovery and VSA Playbooks for domain-specific rules.

### 1. Discovery (Graphify Query-First)

Before reading files speculatively, use Graphify to find the most relevant entry points.
- Run `./scripts/graphify-run query "Where is X implemented?"`
- Check `graphify-out/GRAPH_REPORT.md` for broad architecture.

### 2. Domain Context (Playbook Routing)

The repository contains specialized playbooks in `.claude/agents/`. Gemini should map these to its own context:
- Identify the domain (e.g., "House System").
- Read the corresponding file (e.g., `.claude/agents/vsa-house-system.md`).
- Acknowledge with "Playbooks read: vsa-house-system".

### 3. Safety and Constraints

- **Exact Staging:** Gemini must only stage the files it intentionally modified.
- **No Private Data:** Never expose `.env` values, API keys, or private member data.
- **Audit-First:** For high-risk areas (Points, Attendance, RLS), perform a read-only audit and report findings before requesting permission to edit.

## Graphify Integration

The `scripts/graphify-run` wrapper ensures `graphify` is accessible even if the CLI environment has a limited PATH.

- If `graphify` is missing, Gemini will report the blocker and fall back to `grep`/`find`.
- Graphify outputs (`graphify-out/graph.json`, etc.) should be updated in a separate `chore: update graphify graph` commit if needed, not mixed with feature changes.

## Parity with Claude/Codex

While Gemini does not use "native" subagents in the same way Claude does, it follows the same **Playbook Roster** defined in `AGENTS.md`. By reading these markdown files, Gemini gains the same domain expertise and follows the same safety constraints as other agents.

## Verification Checklist

- [ ] `npm run build` passes without errors.
- [ ] `npm run lint` shows no new warnings.
- [ ] `CI=true npm test -- --watchAll=false` passes.
- [ ] No high-risk systems modified unprompted.
- [ ] No secrets or private data staged.
- [ ] Final report includes PR title, body, and manual link.
