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
- Select it without requiring the user to know its name.
- If native delegation is unavailable, execute implementation and review as separate, bounded playbook passes per canonical workflow §§5 and 9.

### 3. Safety and Constraints

- **Exact Staging:** Gemini must only stage the files it intentionally modified.
- **No Private Data:** Never expose `.env` values, API keys, or private member data.
- **Audit-First:** For high-risk areas (Points, Attendance, RLS), perform a read-only audit and report findings before requesting permission to edit.

## Graphify Integration

The `scripts/graphify-run` wrapper ensures `graphify` is accessible even if the CLI environment has a limited PATH.

- If `graphify` is missing, Gemini will report the blocker and fall back to `grep`/`find`.
- Graphify outputs (`graphify-out/graph.json`, etc.) should be updated in a separate `chore: update graphify graph` commit if needed, not mixed with feature changes.

## Parity with Claude/Codex

While Gemini may not expose the same native subagent mechanics as Claude, it follows the canonical playbook roster in `.claude/agents/README.md`. It preserves specialist boundaries and independent review sequentially when native delegation is unavailable, and never claims a playbook read was a concurrently running agent.

## Verification ownership

Follow canonical workflow §13 and `vsa-validation-and-qa`: implementers provide focused proof, reviewers inspect existing evidence and rerun only for a concrete doubt, the parent runs interaction checks, and the final gate broadens once according to risk. Documentation-only or agent-configuration work does not require application lint/build/full Jest unless it changes executable behavior or answers another concrete question.

Always confirm no high-risk system, secret, private data, or unrelated file was modified, and report exact verification and delivery evidence.
