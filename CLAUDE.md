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
