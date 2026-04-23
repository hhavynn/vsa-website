# VSA Website

React and Supabase website for the Vietnamese Student Association at UC San Diego.

## Stack

- React 18 with TypeScript and Create React App
- React Router v6 for routing
- React Query for cached Supabase reads
- Supabase for auth, PostgreSQL, storage, RLS, and edge functions
- Tailwind CSS and Framer Motion for UI
- Vercel/Docker/Kubernetes support for deployment

## Features

- Public pages for home, events, cabinet, gallery, programs, and leaderboard
- Supabase authentication
- Member profile, points, event attendance, and feedback flows
- Admin event, gallery, manual check-in, and feedback management
- Supabase storage-backed avatar, event image, and gallery image uploads

## Local Setup

Install dependencies:

```bash
npm install
```

Create `.env.local` from `.env.example`:

```env
REACT_APP_SUPABASE_URL=https://your-project.supabase.co
REACT_APP_SUPABASE_ANON_KEY=your-anon-key
```

Start the development server:

```bash
npm start
```

The app runs at [http://localhost:3000](http://localhost:3000).

## Scripts

- `npm start` - Start the local CRA development server.
- `npm run build` - Build the production static app into `build/`.
- `npm run lint` - Run ESLint against `src`.
- `npm run typecheck` - Run TypeScript without emitting files.
- `npm test -- --watchAll=false` - Run the Jest/React Testing Library suite once.
- `npm run analyze` - Build and inspect JavaScript bundle output.

## Project Structure

```text
src/
  components/      Shared layout, common UI, and feature components
  context/         Auth, points, and theme providers
  data/repos/      Thin Supabase repository wrappers used by hooks
  hooks/           App hooks for auth, events, points, attendance, and admin status
  lib/             Supabase client and shared utilities
  pages/           Route-level pages
  routes/          React Router route declarations and guards
  schemas/         Form validation schemas
  types/           App and Supabase table types
supabase/
  functions/       Supabase edge functions
  migrations/      Database migrations
```

## Deployment

Vercel is the simplest deployment target for the static frontend. Docker, Kubernetes, Terraform, and monitoring files are present for infrastructure-oriented deployments, but the application backend is Supabase rather than an in-repo Node service.
