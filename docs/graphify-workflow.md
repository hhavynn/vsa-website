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

After installing, run `graphify . --update` from the repo root to build or refresh the index in an interactive maintenance session, not as feature-work ceremony.

## Calling Graphify from Subagents and Hooks

**Use `./scripts/graphify-run` instead of bare `graphify`** in subagents, hooks, and task prompts. Subagents run with a minimal PATH that typically excludes `~/.local/bin` — where `uv tool install` places the binary. The wrapper resolves the binary across all common install locations before falling back with a clear install message.

```bash
./scripts/graphify-run query "<question>"     # Architecture and dependency questions
./scripts/graphify-run path "<A>" "<B>"       # Trace how two files or symbols relate
./scripts/graphify-run explain "<symbol>"     # Plain-language description of a file's role
./scripts/graphify-run hook status            # Check whether the git hook is active
```

If `./scripts/graphify-run` exits 127, Graphify is not installed on this machine. Continue with targeted `grep`/`find`/`rg` and report the blocker — do not block feature work.

## Key Commands (Interactive / Developer Sessions)

In an interactive terminal where `~/.local/bin` is on your PATH, bare `graphify` works:

```bash
graphify query "<question>"           # Ask an architecture or dependency question
graphify path "<source>" "<target>"   # Trace how two files or symbols relate
graphify explain "<file or symbol>"   # Get a plain-language description of a file's role
graphify . --update                   # Rebuild the graph (run after significant changes)
graphify hook install                 # Install a git hook to auto-update the graph on commit
graphify hook status                  # Check whether the hook is active
```

## Conditional query-first policy

Use Graphify for uncertain subsystem ownership, broad architecture, caller/callee relationships, impact radius, data-flow or authorization tracing, and relationships across unfamiliar modules. Direct reads are allowed and preferred for an exact known file, an obviously owned page/component, instructions/configuration, verification of an identified location, or low-risk narrow work.

Claude and other harnesses run `./scripts/graphify-run query` or `path` when the structural question benefits from graph traversal. They do not need a graph query before every source read. Graphify narrows navigation; the actual source remains authoritative before edits.

Claude also checks `graphify-out/GRAPH_REPORT.md` when first orienting to an unfamiliar area of the codebase. Graphify is used for query-first discovery only — source files still need targeted verification before any edit.

**Claude must not:**
- Install or update Graphify inside a feature PR unless the task explicitly asks.
- Run `graphify .` or `graphify . --update` during a feature PR.
- Mix graph-output changes (`graphify-out/`) into feature PR commits — use a separate `chore: update graphify graph` commit.

## How Codex Uses Graphify

Codex follows the same conditional policy. It may check `graphify-out/GRAPH_REPORT.md` when entering an unfamiliar subsystem, then query specific relationships. For already-scoped work it reads the known files directly. It always verifies implementation-critical graph claims against source.

Codex hooks should reference `./scripts/graphify-run` (or the absolute-path resolved form using `git rev-parse --show-toplevel`) rather than a machine-specific absolute path.

## What Is Committed vs. Local

| Path | Status | Notes |
|---|---|---|
| `graphify-out/GRAPH_REPORT.md` | Committed | Shared orientation reference |
| `graphify-out/graph.json` | Committed if size is reasonable | Main graph data |
| `graphify-out/graph.html` | Committed if size is reasonable | Interactive graph viewer |
| `graphify-out/manifest.json` | Committed | Graph manifest |
| `graphify-out/cost.json` | **Local only** | Never commit — contains cost/usage metadata |
| `graphify-out/cache/` | **Local only** | Never commit — LLM cache |
| `graphify-out/.graphify_*` | **Local only** | Internal state files — never commit |

**Graph output updates belong in a separate commit** from feature work. If you rebuild the graph and the outputs change, commit them as `chore: update graphify graph` — not inside the feature PR.

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

Run `./scripts/graphify-run --version` to check. If it exits 127, Graphify is not installed.

Fall back to standard targeted searches using `grep`, `find`, or `rg`. Do not block feature work on Graphify being available — it is a navigation aid, not a build dependency.

Install when convenient:

```bash
uv tool install graphifyy   # preferred
# or: pipx install graphifyy
graphify hook install        # wire up the post-commit auto-update hook
graphify . --update          # build the initial graph
```

## Important Reminder

Graphify is a navigation tool. It does not replace source inspection, tests, manual QA, or review. Verification is selected proportionally through canonical workflow §13 and `vsa-validation-and-qa`; a Graphify query or refresh is never a completion gate by itself.
