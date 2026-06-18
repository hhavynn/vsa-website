# Graphify Developer Workflow

This document explains how Graphify is used in the VSA website repo to help contributors and AI agents navigate the codebase efficiently.

## What Graphify Does

Graphify indexes the repository into a code graph — a structured map of files, symbols, imports, and relationships. Instead of reading files speculatively, you (or an AI agent) can query the graph to find which files are relevant before opening them. This reduces noise, keeps context focused, and reduces token usage for AI sessions.

## Installation

Install once, globally:

```bash
# With uv (preferred)
uv tool install graphifyy

# Or with pipx
pipx install graphifyy
```

After installing, run `graphify . --update` from the repo root to build or refresh the index.

## Key Commands

```bash
graphify query "<question>"           # Ask an architecture or dependency question
graphify path "<source>" "<target>"   # Trace how two files or symbols relate
graphify explain "<file or symbol>"   # Get a plain-language description of a file's role
graphify . --update                   # Rebuild the graph (run after significant changes)
graphify hook install                 # Install a git hook to auto-update the graph on commit
graphify hook status                  # Check whether the hook is active
```

## How Claude Uses Graphify

Before reading source files for architecture or relationship questions, Claude runs `graphify query` or `graphify path` to identify which files are actually relevant. This keeps token usage low and avoids reading unrelated code.

Claude also checks `graphify-out/GRAPH_REPORT.md` when first orienting to an unfamiliar area of the codebase.

## How Codex Uses Graphify

Codex follows the same query-first rule. Before any code change, Codex checks `graphify-out/GRAPH_REPORT.md` for orientation, then uses `graphify query` to confirm which files are in scope. Source files are opened only after the graph confirms relevance.

## What Is Committed vs. Local

| Path | Status | Notes |
|---|---|---|
| `graphify-out/GRAPH_REPORT.md` | Committed | Shared orientation reference |
| `graphify-out/graph.json` | Committed if size is reasonable | Main graph data |
| `graphify-out/graph.html` | Committed if size is reasonable | Interactive graph viewer |
| `graphify-out/cost.json` | **Local only** | Never commit — contains cost/usage metadata |
| `graphify-out/cache/` | **Local only** | Never commit — LLM cache |

## Privacy Rules

Graphify must never index secrets or environment values. The following are excluded via `.graphifyignore` and must remain excluded:

- `.env`, `.env.local`, `.env.*` — contains API keys and Supabase credentials
- `supabase/.temp/` — Supabase CLI tokens for the linked project
- `*.local` — any locally scoped config
- `graphify-out/cost.json` and `graphify-out/cache/` — cost metadata and prompt fragments

If you add a new secrets file, confirm it is covered by `.gitignore` **and** `.graphifyignore` before running `graphify . --update`.

## Refreshing After Major Refactors

After large refactors or many new files are added, refresh the graph:

```bash
graphify . --update
```

Or force a full rebuild:

```bash
graphify . --force
```

## Hook Auto-Update

The Graphify git hook keeps the graph current automatically after commits. Each developer needs to install it once after pulling:

```bash
graphify hook install
graphify hook status
```

The hook updates local `.git/hooks` — it is not committed and must be installed per developer.

## If Graphify Is Not Installed

If `graphify` is not on your PATH, fall back to standard targeted searches using `grep`, `find`, or `rg`. Do not block work on Graphify being available — it is a workflow aid, not a build dependency.

Install when convenient and run `graphify . --update` to catch up.

## Important Reminder

Graphify is a navigation tool. It does not replace tests, manual QA, or careful review of source code before submitting changes. Always verify behavior with `npm run lint`, `npm run build`, and `CI=true npm test -- --watchAll=false` before marking a task complete.
