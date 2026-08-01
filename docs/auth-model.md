# Auth model

This document explains how authentication and authorization work in this codebase, and clarifies the exact guarantees each mechanism provides. It is written for a contributor who is reading the code for the first time.

---

## The single most important fact

**`useAdmin()` and `AdminRoute` are UX gates, not security boundaries.**

They control what renders in the browser. They do not prevent a determined client from calling the Supabase API directly. The real enforcement layer is **Postgres Row Level Security (RLS)** on the underlying tables. RLS policies live in `supabase/migrations/` and are enforced server-side regardless of what the client does. See `docs/rls-verification-checklist.md` for the verification process.

A new contributor who reads `useAdmin.ts` or `AdminRoute.tsx` alone and concludes "this is how we protect admin data" has drawn the wrong conclusion. This document exists to prevent that.

---

## Provider hierarchy

Derived live from `src/App.tsx` at the time this document was written. **Do not treat this as a static fact** — re-derive it with:

```bash
grep -n "Provider" src/App.tsx
```

As of the last derivation, the top-level stack is:

```
ErrorBoundary
  QueryClientProvider
    ThemeProvider
      AnalyticsConsentProvider
        AuthProvider
          SiteSettingsProvider
            AppRoutes (+ AnalyticsConsentBanner, Toaster)
```

`PointsProvider` is **not** in the top-level stack. It wraps the route tree one level deeper, inside `src/routes/index.tsx` (imported at L13, applied at L181 and L293). This matters because `PointsProvider` can only be used inside `AppRoutes`, not above it.

---

## Route tiers

Derived from `src/routes/index.tsx`. Re-derive the current list with:

```bash
grep -n "element=" src/routes/index.tsx
```

### Public routes (no authentication required)

All routes rendered as children of `<Layout />` that are **not** inside an `<AdminRoute>` wrapper:

| Path | Page |
|---|---|
| `/` | Home |
| `/events` | Events |
| `/calendar` | Calendar |
| `/leaderboard` | Leaderboard |
| `/cabinet` | Cabinet |
| `/get-involved` | GetInvolved |
| `/gallery` | Gallery |
| `/ace` | Ace |
| `/house` | House |
| `/house/archive` | HouseArchive |
| `/house/archive/:yearSlug` | House |
| `/house/archive/:yearSlug/:houseSlug` | HouseDetail |
| `/house/year/:yearSlug` | House |
| `/house/year/:yearSlug/:houseSlug` | HouseDetail |
| `/house/:houseSlug` | HouseDetail |
| `/house-system` | House |
| `/intern-program` | Internship |
| `/vcn` | Vcn |
| `/vcn/current` | VcnCurrent |
| `/vcn/archive` | VcnArchive |
| `/wild-n-culture` | WildNCulture |
| `/uvsa-network` | UVSANetwork |
| `/admin/login` | SignIn |
| `/points` | Points (public "Find My Points" lookup — no account required) |
| `/feedback` | FeedbackPage |
| `/privacy` | Privacy |

### Parked route

`/profile` renders `<MemberAccountsUnavailable />`. See "Member accounts" below.

### Admin routes

Everything nested inside the `<Route element={<AdminRoute />}>` wrapper. `AdminRoute` checks `useAdmin()` and redirects to `/admin/login` if the result is false. The current admin routes are:

`/admin`, `/admin/content-calendar`, `/admin/content`, `/admin/resources`, `/admin/events`, `/admin/gallery`, `/admin/vcn`, `/admin/feedback`, `/admin/import`, `/admin/members`, `/admin/photo-requests`, `/admin/houses`, `/admin/merge-suggestions`, `/admin/cabinet`, `/admin/years`, `/admin/points`, `/admin/analytics`, `/admin/settings`, `/admin/ace`, `/admin/uvsa-schools`, `/admin/external-events`, `/admin/ai-knowledge`, `/admin/ai-feedback`, `/admin/applications`, `/admin/launch-checklist`, `/admin/data-rights`.

---

## `useAdmin()` and `AdminRoute`

### What `useAdmin()` does

`useAdmin()` (`src/hooks/useAdmin.ts`) reads `user_profiles.is_admin` from Supabase client-side and returns `{ isAdmin: boolean, loading: boolean }`. It fires on every user change. If the query fails, `isAdmin` defaults to `false`.

### What `AdminRoute` does

`AdminRoute` (`src/routes/AdminRoute.tsx`) consumes `useAdmin()`. If `loading` is true, it shows a spinner. If the session has no user, or if `isAdmin` is false, it redirects to `/admin/login`. Otherwise it renders the child route.

### What neither provides

Neither checks RLS. Neither prevents a client from bypassing the browser and calling the Supabase REST API directly with a valid JWT. **RLS on `user_profiles`, `events`, and all other sensitive tables is the actual enforcement.** The Postgres policies are the authoritative source of truth for what data a given authenticated user can read or write.

The rule of thumb: `AdminRoute` decides what the browser renders; RLS decides what data the database returns.

---

## Member accounts

General member accounts are deliberately parked in the current release. This is an intentional product decision, not a missing feature or bug.

History: an admin-only sign-in redesign was introduced, reverted within ~22 hours, and then reintroduced deliberately via PR #28. The current model is:

- Sign-in exists for admins only.
- General members browse publicly and use the `/points` ("Find My Points") page to look up their points without an account.
- `/profile` renders `MemberAccountsUnavailable` — a placeholder component that says "Not currently enabled" and links back to `/`.

If member accounts are re-enabled in the future, `/profile` will need to be wired to a real page and the associated RLS policies will need review before launch.

---

## Points and leaderboard

For the dual-points system (event attendance points vs. house competition points) and how the leaderboard is calculated, see [`docs/leaderboard-system.md`](./leaderboard-system.md). That document is the authoritative source; this page does not restate it.

---

## Related documents

- `docs/rls-verification-checklist.md` — manual checklist for verifying RLS policies are correctly scoped
- `docs/privacy-data-rights-architecture.md` — data privacy model and member data handling
- `docs/security-headers-and-csp.md` — HTTP security headers and Content Security Policy
- `docs/leaderboard-system.md` — points systems and leaderboard calculation
