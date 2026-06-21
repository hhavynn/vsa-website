# VSA Website

The website for the Vietnamese Student Association at UCSD — built with Create React App (TypeScript) and Supabase (PostgreSQL, Auth, Storage, Edge Functions).

## Features

- **Public pages** — home, events, gallery, cabinet, house system, ACE, VCN, Wild N Culture, internship program, UVSA network, leaderboard, and a no-account "Find My Points" lookup
- **Ask VSA** — an AI chat assistant (`src/components/features/ai/VsaAiAssistant.tsx`) backed by the `vsa-ai-assistant` Supabase Edge Function (Gemini), answering only from admin-curated knowledge with a feedback loop for unanswered questions
- **Admin dashboard** (`/admin/*`) — content calendar, events, gallery, cabinet, houses, ACE families, VCN archives, applications, AI knowledge base, AI feedback review, member/merge tools, analytics, data-rights requests, and a launch checklist
- **Points & leaderboard** — attendance import, points calculation, and a public leaderboard
- **House system** — current and archived house years, standings, and per-house detail pages
- **Privacy / data rights** — public feedback form, privacy page, and an admin data-rights anonymization workflow
- **Analytics** — Plausible and/or GA4 via an `analytics-proxy` Edge Function

Member account self-service (`/profile`) is intentionally parked for this release; `/points` remains a public, no-login lookup.

## Tech Stack

- **Frontend**: React 18, TypeScript, Create React App (react-scripts), Tailwind CSS v3, Framer Motion
- **Routing**: React Router v6, lazy-loaded pages
- **Data fetching**: react-query, a repository layer in `src/data/repos/` wrapping Supabase queries
- **Forms**: react-hook-form + zod (`src/schemas/`)
- **Backend**: Supabase — Postgres, Auth, Storage, and Deno Edge Functions (`supabase/functions/`)
- **Deployment**: Vercel (see `vercel.json`)

## Prerequisites

- Node.js 18+
- npm
- A Supabase project (for local development against real data)

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Copy `.env.example` to `.env.local` and fill in:

```env
REACT_APP_SUPABASE_URL=
REACT_APP_SUPABASE_ANON_KEY=
REACT_APP_OPENAI_API_KEY=   # optional, legacy — current Ask VSA assistant runs server-side via Supabase Edge Functions

# Optional analytics
REACT_APP_PLAUSIBLE_DOMAIN=
REACT_APP_GA4_MEASUREMENT_ID=
```

Never commit `.env` or `.env.local` — they're gitignored.

### 3. Database & Edge Functions

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Apply migrations in `supabase/migrations/`
3. Deploy the Edge Functions you need from `supabase/functions/` (notably `vsa-ai-assistant` and `analytics-proxy`) with the Supabase CLI, setting any required secrets (e.g. `GEMINI_API_KEY`)

### 4. Run the dev server

```bash
npm start
```

Opens at [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm start` — start the dev server
- `npm test` — run tests (Jest + React Testing Library); use `-- --testPathPattern=<file>` for a single file
- `npm run build` — production build
- `npm run lint` — lint `src/**/*.{ts,tsx}`
- `npm run format` — format with Prettier
- `npm run analyze` — build then inspect the JS bundle with source-map-explorer (`analyze:css` / `analyze:all` variants also exist)
- `npm run migrate:images:dry` / `migrate:images:apply` — Supabase-Storage-to-public-asset image migration (`scripts/migrate-supabase-images-to-public.ts`); `migrate:house-assets:*` scopes it to house assets

## Project Structure

```
vsa-website/
├── src/
│   ├── components/
│   │   ├── layout/        # Layout, Header/nav, Footer
│   │   ├── features/      # Feature-grouped components (admin, ai, auth, cabinet, events, house, points, ...)
│   │   ├── common/        # Shared utilities (ErrorBoundary, Modal, PageLoader, ...)
│   │   └── ui/             # Base UI primitives (Button, Input, Card, Badge, Alert)
│   ├── pages/              # Route-level pages, incl. pages/Admin/*
│   ├── routes/             # Route table, ProtectedRoute, AdminRoute
│   ├── data/
│   │   ├── repos/          # Repository classes wrapping Supabase queries
│   │   └── errors.ts       # Custom error classes + withErrorHandling()
│   ├── context/             # AuthContext, ThemeContext, PointsContext
│   ├── hooks/               # Custom React hooks
│   ├── schemas/             # zod schemas for react-hook-form
│   └── lib/                 # supabase client singleton, utils
├── supabase/
│   ├── functions/           # Edge Functions (vsa-ai-assistant, analytics-proxy, image migration triggers, ...)
│   └── migrations/          # SQL migrations
├── scripts/                 # graphify-run, image migration, RLS/import verification scripts
└── docs/                    # Runbooks, architecture notes, checklists
```

## Architecture Notes

See [CLAUDE.md](CLAUDE.md) for the authoritative architecture reference (provider hierarchy, route tiers, key tables, styling conventions).

This repo also includes [Graphify](docs/graphify-workflow.md), a generated knowledge graph of the codebase. For architecture questions, prefer:

```bash
./scripts/graphify-run query "<question>"
./scripts/graphify-run path "<source>" "<target>"
./scripts/graphify-run explain "<file or symbol>"
```

## Deployment

Production deploys go through Vercel (`vercel.json` configures build output, security headers, and SPA fallback routing). `.github/workflows/deploy.yml` runs lint/test/build on push and pull request, then builds/pushes a Docker image to GitHub Container Registry and deploys to Vercel on `main` (the Vercel step is skipped if `VERCEL_TOKEN` isn't configured).

### Optional: run in Docker

A `Dockerfile` (multi-stage Node build → nginx) and `docker-compose.yml` are provided for running the production build in a container locally:

```bash
REACT_APP_SUPABASE_URL=... REACT_APP_SUPABASE_ANON_KEY=... docker compose up --build
```

Serves the app at [http://localhost:3000](http://localhost:3000). This isn't required for day-to-day development — `npm start` is faster — but it's useful for verifying the production container build.

## Security

- API keys and secrets live in environment variables / Supabase secrets, never in source
- `.env*` files are gitignored
- Supabase Auth handles authentication; admin access is gated by `is_admin` on `user_profiles` plus Row Level Security policies
- See `docs/security-headers-and-csp.md` and `docs/rls-verification-checklist.md`

## Contributing

1. Create a feature branch (`git checkout -b feature/your-change`)
2. Make your changes, with tests where it makes sense
3. Run `npm run lint` and `npm test` before opening a PR
4. Open a Pull Request against `main`

## License

No LICENSE file is currently checked into this repository.
