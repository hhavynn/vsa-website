# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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
REACT_APP_OPENAI_API_KEY=   # optional, for chat assistant
```

## Architecture

This is a Create React App (TypeScript) project for the Vietnamese Student Association website. The backend is entirely Supabase (PostgreSQL + Auth + Storage).

**Provider hierarchy** (`App.tsx`):
```
ErrorBoundary > QueryClientProvider (react-query) > ThemeProvider > AuthProvider > AppRoutes > PointsProvider
```

**Routing** (`src/routes/index.tsx`): React Router v6 with lazy-loaded pages. Three route tiers:
- Public: `/`, `/events`, `/leaderboard`, `/cabinet`, `/gallery`, etc.
- Protected (auth required): `/profile`, `/points`, `/feedback`
- Admin (admin flag required): `/admin`, `/admin/events`, `/admin/gallery`, `/admin/feedback`

**Data layer** (`src/data/`):
- `src/data/repos/` — Repository classes (`EventsRepository`, etc.) that wrap all Supabase queries. Use the exported singleton instances (e.g., `eventsRepository`).
- `src/data/errors.ts` — Custom error classes (`DatabaseError`, `ValidationError`, `NotFoundError`, etc.) and `withErrorHandling()` wrapper used throughout repos.

**Auth** (`src/context/AuthContext.tsx`): Wraps Supabase auth. Admin status is checked separately via `useAdmin()` hook which queries the `user_profiles` table for `is_admin`.

**Supabase client** (`src/lib/supabase.ts`): Singleton pattern. Import `supabase` directly for one-off queries, or use the repository layer for structured access.

**Key Supabase tables**: `events`, `event_attendance`, `user_profiles`

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

**Workflow rule:** Run `./scripts/graphify-run query` or `./scripts/graphify-run path` before opening files speculatively. Only read source files directly after the graph confirms they are relevant. If Graphify is not installed, fall back to targeted `grep`/`find` searches rather than reading entire directories. Do not install or rebuild Graphify inside a feature PR unless the task explicitly asks for it.
