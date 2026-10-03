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

There is no account-points provider. `AuthProvider` supplies sessions only for admin workflows; public points lookup uses the member-based repository without auth.

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

### Retired account routes

`/profile` has been removed and uses the generic 404 page. There are no member signup or account routes. `/signin` remains an alias to `/admin/login` for existing admin bookmarks.

### Admin routes

Everything nested inside the `<Route element={<AdminRoute />}>` wrapper. `AdminRoute` checks `useAdmin()` and redirects to `/admin/login` if the result is false. The current admin routes are:

`/admin`, `/admin/content-calendar`, `/admin/content`, `/admin/resources`, `/admin/events`, `/admin/gallery`, `/admin/vcn`, `/admin/feedback`, `/admin/import`, `/admin/members`, `/admin/photo-requests`, `/admin/houses`, `/admin/merge-suggestions`, `/admin/cabinet`, `/admin/years`, `/admin/points`, `/admin/analytics`, `/admin/settings`, `/admin/ace`, `/admin/interns`, `/admin/uvsa-schools`, `/admin/external-events`, `/admin/ai-knowledge`, `/admin/ai-feedback`, `/admin/applications`, `/admin/launch-checklist`, `/admin/data-rights`.

---

## `useAdmin()` and `AdminRoute`

### What `useAdmin()` does

`useAdmin()` (`src/hooks/useAdmin.ts`) returns `{ isAdmin: boolean, loading: boolean }`. The lookup is a react-query entry keyed `['admin-status', userId]`, fetched through `authRepository.isUserAdmin()` (which reads only `user_profiles.is_admin`). Every consumer (the admin route guard, the user menu, the sign-in page) shares that one entry, so navigating the admin area does not re-query. It is fresh for 10 minutes and re-checks on tab focus after that.

- **Fails closed.** `isAdmin` is `true` only for an explicit `true` for the signed-in user. No user, a failed first lookup, a missing profile row, and a lookup still in flight are all `false`. A failed *background* re-check of an already-verified admin keeps the last verified answer rather than ejecting them mid-edit; RLS is what actually stops a demoted admin.
- **Keyed by user id, not by the `user` object.** supabase-js re-emits `SIGNED_IN` with a fresh object whenever the tab regains focus. Keying on object identity used to make the admin shell flash its loader and remount, discarding unsaved form state.
- **Never shows one account's answer to another.** A different id is a different cache entry, and the cache is emptied when the account changes (below).

### What `AdminRoute` does

`AdminRoute` (`src/routes/AdminRoute.tsx`) consumes `useAdmin()`. If `loading` is true, it shows a spinner. If the session has no user, or if `isAdmin` is false, it redirects to `/admin/login`. Otherwise it renders the child route. The one exception is a session that ends unprompted while an admin is signed in (next section).

### Session lifecycle: sign-out, expiry and re-authentication

| Situation | What happens |
| --- | --- |
| Token refresh succeeds (idle expiry, tab refocus, hourly rotation) | supabase-js swaps the token and emits `TOKEN_REFRESHED` / `SIGNED_IN`. Nothing visible changes: no loader, no remount, no re-query, cache kept. |
| Refresh is rejected (refresh token expired or revoked) or the user signed out in another tab | supabase-js emits `SIGNED_OUT`. `AuthProvider` sets `sessionExpired`, and `AdminRoute` keeps the page mounted behind an opaque **re-authentication prompt** (`SessionExpiredDialog`) instead of redirecting. Unsaved form state survives. The session stays expired until a sign-in is verified as an admin. Then the same account uncovers the page and revalidates its queries, and a different admin gets a fresh page. A sign-in that is turned away (not an admin, or the lookup failed) lands back on the prompt with the reason showing and the page untouched; "Leave admin" discards the page and its cache after the usual unsaved-changes confirmation. |
| Refresh fails for network reasons | supabase-js keeps the session and retries. Nothing is reset; requests fail with ordinary network errors. |
| A request is rejected by the server for an expired JWT while the client still believes its token is valid (clock skew, token revoked server-side) | supabase-js already refreshes a token it *knows* has expired before every request, for repositories, react-query and direct `supabase.from(...)` calls alike (all go through its auth-aware `fetch`). The remaining case is handled once, on the client's single `global.fetch` (`createSessionExpiryFetch` in `src/lib/sessionExpiry.ts`, wired in `src/lib/supabase.ts`): a 400/401/403 whose body is PGRST301 (Data API) or a JWT-expired message (Storage, Edge Functions) triggers one shared refresh, at most once per 30 s, never retried and never for `/auth/v1` traffic. If the refresh token is rejected too, the local session is ended, which raises `SIGNED_OUT` and the prompt above (supabase-js alone would keep a session whose access token still looks valid locally). Callers still receive the server's error unchanged; `toUserMessage` reads PGRST301/302 as "Your session expired. Try again, and sign in again if it keeps failing." |
| Deliberate sign-out (`signOut()`) | Not treated as expiry. User state, `['admin-status', ...]` and the **entire** react-query cache are cleared, even if the server refuses the request. `AdminRoute` redirects to `/admin/login`. |
| A different account signs in without signing out | The whole cache is cleared before the new account's data loads. |

On unprompted session loss the cache is not emptied outright: queries nothing is displaying are dropped, but those still mounted are kept, because their rows are already on screen in the page being held open. Emptying them would blank that page and strand its later invalidations. They are revalidated when the same account signs back in and cleared on any other outcome.

While the prompt is open the held page is `inert` and `aria-hidden`, so keyboard focus, find-in-page and screen readers cannot reach admin content behind the cover, focus moves to the password field and is trapped inside the prompt (Tab wraps; focus that escapes is pulled back). Known limits, all UX or hygiene rather than access (the server already denies a signed-out client): content portalled outside the admin page (quick search, preview dialogs) is covered visually and shielded from focus by the trap, but not inerted; and if the Supabase `signOut()` request itself fails (offline), local state is cleared but supabase-js may still hold the stored session and restore it on the next tab refocus. Leaving the admin area while a session is marked expired drops the held page's cached rows.

Session lifetime is a Supabase Auth project setting and is deliberately **not** extended as a fix for expiry UX; that is a security decision for the owner.

### What neither provides

Neither checks RLS. Neither prevents a client from bypassing the browser and calling the Supabase REST API directly with a valid JWT. **For direct table access, RLS on `user_profiles`, `events`, and the other sensitive tables is the actual enforcement.**

RLS is not the only server-side boundary, though. Some paths deliberately bypass table policies, and each relies on its own checks:

- **`SECURITY DEFINER` functions** run as their owner and skip RLS on the tables they touch. The admin data-rights routines, for example, read retained historical records despite the archives' revoked client grants. Their boundary is the EXECUTE grant (`anon` / `authenticated`) plus the caller checks inside the function body.
- **Views** created by the migration role behave like definer objects: their `WHERE` clause and column list, and their grants (revoke-then-grant), are the access control, not the base table's policies.
- **Edge Functions using the service role** bypass RLS entirely. Their boundary is their own auth/secret check before any query.

When auditing or adding any of these, check the grant, filter, or in-function check, not just the table's policies.

The rule of thumb: `AdminRoute` decides what the browser renders; RLS decides what data the database returns.

---

## Member accounts

Member accounts are **formally retired**, by owner decision on 2026-10-02 (#233).
See [member-account-retirement.md](./member-account-retirement.md) for rationale,
preserved data, migration scope, and manual deployment checks.

- Students browse publicly and use `/points` without login.
- `AuthContext` has sign-in and sign-out only. There is no public signup API,
  signup form, profile editor, account dashboard, or legacy account-points provider.
- `/admin/login` remains for **existing/invited approved admins**.
  `SignInForm` verifies `user_profiles.is_admin` and signs out non-admins or
  callers whose admin status cannot be verified. `AdminRoute` repeats the UX gate.
- `user_profiles`, `is_admin_user`, and the auth profile-creation trigger remain:
  invitation provisioning must still create a profile, and admin status is assigned
  through the existing trusted process.
- Public Supabase signup must remain disabled. Both local `enable_signup`
  settings are false; hosted Auth configuration must also be checked manually.
  No public OAuth/anonymous signup channel should be enabled.

Retirement does not delete old Auth users or invalidate every existing JWT.
Existing ordinary accounts may still authenticate directly to Supabase; the
`authenticated` database role must **never** be equated with an approved admin.
RLS and function guards remain mandatory, and the retirement migration denies
ordinary and admin clients alike access to legacy archives and code RPCs.
The public photo-request workflow, approved avatars, historical identity links,
and admin data-rights tooling are preserved.

---

## Points and leaderboard

For the single active member-based points/attendance model and how standings are calculated, see [`docs/leaderboard-system.md`](./leaderboard-system.md). That document is the authoritative source; this page does not restate it.

---

## Related documents

- `docs/rls-verification-checklist.md` — manual checklist for verifying RLS policies are correctly scoped
- `docs/privacy-data-rights-architecture.md` — data privacy model and member data handling
- `docs/security-headers-and-csp.md` — HTTP security headers and Content Security Policy
- `docs/leaderboard-system.md` — points systems and leaderboard calculation
