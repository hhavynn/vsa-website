# CLAUDE.md

Guidance for coding agents working in this repository.

## Commands

```bash
npm start                         # Start CRA dev server at http://localhost:3000
npm run lint                      # ESLint for src/**/*.ts(x)
npm run typecheck                 # TypeScript check without emitting
npm test -- --watchAll=false      # Run tests once
npm run build                     # Production build
```

## Environment

Copy `.env.example` to `.env.local`:

```env
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
```

## Architecture

This is a Create React App TypeScript frontend for the Vietnamese Student Association website. The backend is Supabase: PostgreSQL, Auth, Storage, RLS, and edge functions.

Provider hierarchy in `src/App.tsx`:

```text
ErrorBoundary > QueryClientProvider > ThemeProvider > AuthProvider > AppRoutes > PointsProvider
```

Routing in `src/routes/index.tsx` uses React Router v6:

- Public routes: `/`, `/events`, `/leaderboard`, `/cabinet`, `/gallery`, and program pages.
- Protected routes: `/profile`, `/points`, `/feedback`.
- Admin routes: `/admin/events`, `/admin/gallery`, `/admin/feedback`; `/admin` redirects to `/admin/events`.

## Data Access

- `src/lib/supabase.ts` owns the typed Supabase client singleton.
- `src/hooks/` contains app-facing hooks.
- `src/data/repos/` contains thin repository wrappers for shared query paths.
- Some admin and feature workflows still call Supabase directly where the query is local to a single flow.

Key tables used by the app: `events`, `event_attendance`, `user_profiles`, `user_points`, `feedback`, and `gallery_events`.

## Structure

- `src/components/common/` - shared loading, error, modal, title, and animation helpers.
- `src/components/layout/` - page layout, footer, navigation, and back-to-top controls.
- `src/components/features/` - feature-specific components for admin, auth, avatar, events, feedback, points, profile, and dashboard.
- `src/pages/` - route-level pages.
- `src/routes/` - route declarations and guards.
- `src/schemas/` - form schemas for active forms.
- `src/types/` - app and Supabase table types.

## Notes

- Do not track generated folders such as `node_modules/`, `build/`, or Supabase local temp state.
- Avoid rewriting historical Supabase migrations unless explicitly requested. Prefer forward migrations after confirming the active database schema.
- The `supabase/functions/secure-ai` edge function exists, but there is no active frontend chat UI wired to it.
