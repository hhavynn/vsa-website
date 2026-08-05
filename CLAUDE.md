# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## How to work here (adapter)

Root **`AGENTS.md`** is the authoritative governance contract. For any non-trivial task, follow the canonical **`docs/ai/AGENTIC-ENGINEERING-WORKFLOW.md`** — it turns a messy natural-language request into: brief → risk classification → owning skill(s) + playbook(s) → Graphify → Repomix → source → implement → validate → adversarial review → exact-evidence report. The user should never have to name a tool, skill, playbook, or process; you infer them. Scale rigor to risk — tiny tasks stay tiny.

Claude-specific mechanics:
- **Skills** (`.claude/skills/vsa-*`) are trigger-rich and load on demand via the Skill tool. Load the **owning** skill for the fact you need (skill router in the workflow doc §4) — never all 16. For risky work, load the owner explicitly rather than waiting for a trigger.
- **Subagents** (`.claude/agents/vsa-*`) are domain personas — infer and invoke the matching one natively when bounded specialization or independent review materially helps. The user need not name it. Skills ≠ subagents; only claim a subagent ran if you actually invoked one. Follow the cross-harness delegation and context contract in workflow §§5 and 9.
- **Graphify** before broad grep for structural questions; **Repomix** (`npx repomix`) for a narrow slice after scope is known; **Impeccable** (skill) for meaningful UI work, combined with `vsa-design-system-reference`, never replacing it.
- **Superpowers** is installed — route its methods proportionally by task shape and risk per workflow §6; repository governance overrides generic ceremony.
- Preserve protected user files (`.claude/settings.local.json`, `.gitignore` local edits); never route around `vsa-change-control`.
- The nested **`.claude/CLAUDE.md`** is **not** a competing authority — it exists only for scoped Claude Code wiring (the `/graphify` slash-command trigger). This root `CLAUDE.md` and `AGENTS.md` govern; the nested file just wires a tool.

## Commands

```bash
npm start          # Start development server (http://localhost:3000)
npm test           # Run tests (Jest + React Testing Library)
npm test -- --testPathPattern=<file>  # Run a single test file
npm run build      # Build for production
npm run lint       # Lint TypeScript files in src/
npm run format     # Format TypeScript files with Prettier
```

## Environment Setup

Copy `.env.example` to `.env.local` and fill in:

```
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
```

Those two are the only variables required to boot. Analytics vars are optional
and unnecessary for local development.

**Never put an API key in a `REACT_APP_*` variable** — they are compiled into
the public client bundle. The Ask VSA assistant's `GEMINI_API_KEY` is a
**Supabase Edge Function secret**, set server-side and never exposed to the
client. The legacy `secure-ai` function was removed from the repo; no current
repo code consumes `OPENAI_API_KEY`. See `.claude/skills/vsa-config-and-flags/`.

## Architecture

This is a Create React App (TypeScript) project for the Vietnamese Student Association website. The backend is entirely Supabase (PostgreSQL + Auth + Storage).

**Provider hierarchy:** defined in `src/App.tsx` — read it there rather than trusting a copy (it has drifted before). Re-derive the current nesting with `grep -n "Provider" src/App.tsx`.

**Routing** (`src/routes/index.tsx`): React Router v6 with lazy-loaded pages, organized into three tiers — **Public** (e.g. `/`, `/events`, `/leaderboard`), **Protected** (auth required, e.g. `/profile`), and **Admin** (admin flag required, under `/admin/*`). The exact route set changes over time; read `src/routes/index.tsx` for the current list (admin routes: `grep -n "admin/" src/routes/index.tsx`).

**Data layer** (`src/data/`):
- `src/data/repos/` — Repository classes (`EventsRepository`, etc.) that wrap all Supabase queries. Use the exported singleton instances (e.g., `eventsRepository`).
- `src/data/errors.ts` — Custom error classes (`DatabaseError`, `ValidationError`, `NotFoundError`, etc.) and `withErrorHandling()` wrapper used throughout repos.

**Auth** (`src/context/AuthContext.tsx`): Wraps Supabase auth. Admin status is checked separately via `useAdmin()` hook which queries the `user_profiles` table for `is_admin`.

**Supabase client** (`src/lib/supabase.ts`): Singleton pattern. Import `supabase` directly for one-off queries, or use the repository layer for structured access.

**Key Supabase tables**: schema source of truth is `supabase/migrations/` (types mirrored in `src/types/database.ts`). The public leaderboard and the authenticated check-in flow use **different** tables (two coexisting points systems) — see `docs/leaderboard-system.md`. Don't rely on a short table list here; it has been incomplete/misleading before.

**Forms**: react-hook-form + zod schemas (defined in `src/schemas/index.ts`).

**Styling**: Tailwind CSS v3. Utility helpers in `src/lib/utils.ts` (re-exports `clsx`/`tailwind-merge`). Framer Motion used for animations.

**Component organization**:
- `src/components/layout/` — `Layout`, `Header`, `Footer`, navigation shell
- `src/components/features/` — Feature-grouped components (admin, auth, events, points, etc.)
- `src/components/common/` — Shared utilities (ErrorBoundary, LoadingSpinner, Modal, etc.)
- `src/components/ui/` — Base UI primitives (Button, Input, Card, Badge, Alert)

## Graphify: Query-First Workflow

Graphify indexes the codebase into a navigable graph. Use it before doing broad file reads for architecture questions — it saves tokens and surfaces the right files faster.

**Key commands:**

```bash
./scripts/graphify-run query "<question>"              # Answer architecture questions from the graph
./scripts/graphify-run path "<source>" "<target>"      # Trace relationships between two files or symbols
./scripts/graphify-run explain "<file or symbol>"      # Explain what a file/symbol does and its connections
./scripts/graphify-run hook status                     # Check whether the git hook is active
graphify . --update                                    # Refresh the graph if it feels stale (interactive only)
```

**PATH note:** Use `./scripts/graphify-run` instead of bare `graphify` in subagents and hooks — subagent PATH typically excludes `~/.local/bin` where Graphify installs. The wrapper resolves the binary across all common install locations automatically.

**Orientation:** Check `graphify-out/GRAPH_REPORT.md` first when dropped into an unfamiliar part of the codebase.

**What stays local:** `graphify-out/cost.json` and the cache directory are gitignored and must not be committed. Keep graph-output changes (`graphify-out/*.md`, `graph.json`, `graph.html`) in a separate commit (`chore: update graphify graph`) rather than mixing them into feature PRs.

**Workflow rule:** Use `./scripts/graphify-run query` or `path` before broad or architectural search when ownership, relationships, or impact radius are unclear. Directly read known source, instruction, and configuration files; Graphify is not a prerequisite for already-scoped work. Verify graph findings against source. If Graphify is unavailable, fall back to targeted `rg`/direct reads. Do not install or rebuild Graphify inside a feature PR unless the task explicitly asks for it.
