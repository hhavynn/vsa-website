# GEMINI.md

This file provides instructions to Gemini CLI when working in the VSA at UCSD website repository.

## Project Identity

- **Name:** VSA at UCSD Website
- **Stack:** React + TypeScript + Supabase + Vercel
- **Purpose:** Production member site for event check-ins, points tracking, and house standings.
- **Criticality:** Public and admin pages are in active production use.

## Mandatory Startup Workflow

1. **Check Environment:** Run `git status --short --branch` and `git branch --show-current`.
2. **Read Instructions:** Read `GEMINI.md` (this file) and `AGENTS.md` for shared repo workflows.
3. **Graphify Orientation:** If `graphify-out/graph.json` exists, use the **Graphify Query-First** workflow before broad file reads.
4. **Playbook Routing:** Identify the relevant domain and read the corresponding playbook from `.claude/agents/*.md` before starting work.

## Gemini Playbook Routing

Before modifying files in a specific domain, read the corresponding playbook:

- `vsa-architecture-guardian` → `.claude/agents/vsa-architecture-guardian.md`
- `vsa-public-content` → `.claude/agents/vsa-public-content.md`
- `vsa-admin-workflows` → `.claude/agents/vsa-admin-workflows.md`
- `vsa-events-gallery` → `.claude/agents/vsa-events-gallery.md`
- `vsa-points-attendance-guardian` → `.claude/agents/vsa-points-attendance-guardian.md`
- `vsa-house-system` → `.claude/agents/vsa-house-system.md`
- `vsa-cabinet-leadership` → `.claude/agents/vsa-cabinet-leadership.md`
- `vsa-ai-knowledge` → `.claude/agents/vsa-ai-knowledge.md`
- `vsa-applications-forms` → `.claude/agents/vsa-applications-forms.md`
- `vsa-storage-egress` → `.claude/agents/vsa-storage-egress.md`
- `vsa-testing-qa` → `.claude/agents/vsa-testing-qa.md`
- `vsa-docs-acceptance` → `.claude/agents/vsa-docs-acceptance.md`

**Routing Rule:** Before editing domain-specific files, Gemini must state:
> “Playbooks read: <names>”

## Graphify Query-First Workflow

Graphify provides a navigable graph of the codebase. Use it to orient yourself and find relevant files without reading the entire repository.

- **Query:** `./scripts/graphify-run query "<question>"` (Architecture and dependencies)
- **Path:** `./scripts/graphify-run path "<A>" "<B>"` (Relationships between files/symbols)
- **Explain:** `./scripts/graphify-run explain "<concept>"` (Focus on a specific symbol)

*Note: Graphify is for orientation. Always perform targeted `read_file` on source code before applying edits.*

## High-Risk Protected Systems

Do **NOT** modify the following systems unless explicitly requested and after a thorough audit:
- Attendance import logic
- Points calculation logic
- House membership and standings logic
- Leaderboard calculations
- Supabase migrations, schema, or RLS policies
- Check-in logic and security
- Supabase Storage file deletions
- Exposure of private member/admin data

## PR Workflow

1. **Branch:** Branch from updated `main`.
2. **Audit:** Report the root cause and proposed plan before editing.
3. **Stage:** Stage exact files only. **Never** use `git add .` or `git add -A`.
4. **Safety:** Do not use `gh pr create`.
5. **Finalize:** Push the branch and provide a manual PR title, body, and link.

## Verification

Before marking a task as complete, run:
- `npm run build`
- `npm run lint`
- `CI=true npm test -- --watchAll=false`
- Graphify smoke queries (if relevant to the change)

---

## graphify (Auto-Generated)

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists.
- After modifying code, run `graphify update .` (or `./scripts/graphify-run update .`) to keep the graph current.
