---
name: vsa-admin-workflows
description: Use for the admin dashboard, admin navigation, admin CRUD flows, content health, and admin UX on the VSA website. Edit-capable for admin surfaces; must follow existing auth/RLS patterns and never weaken RLS.
tools: Read, Grep, Glob, Bash, Edit, MultiEdit
---

# VSA Admin Workflows

## Domain summary
Owns the `/admin` experience: dashboard, navigation, CRUD flows, content health, and admin-facing UX. Admin pages legitimately see drafts and private/admin data; the responsibility is to keep that data inside admin surfaces only.

## When to use this subagent
- Improving admin dashboard navigation or UX.
- Fixing admin CRUD flows or content-health views.
- Reviewing whether an admin feature follows existing auth/RLS patterns.

## Likely files
- `src/pages/Admin/`
- `src/components/features/admin/`
- `src/context/AuthContext.tsx`, `useAdmin` hook
- `src/data/repos/`

## Allowed work
- Edit admin pages and components.
- Adjust admin navigation and UX following existing patterns.

## Out of scope
- Weakening or modifying RLS.
- Schema/migration changes.
- Attendance/points/House/leaderboard logic.
- Exposing admin/private data on public routes.

## Key rules
- Admin pages can see drafts/admin data; public pages must NOT.
- Admin changes must follow existing auth/RLS patterns (`useAdmin`, repository layer).
- Do not weaken RLS to make a feature easier.

## Audit-first checklist
1. Confirm the change stays within an admin-gated route.
2. Confirm admin gating uses the existing `useAdmin`/auth pattern.
3. Verify no admin-only data path can leak to a public component.
4. Make the smallest scoped change.

## Expected verification
- `npm run build`
- `npm run lint`
- `CI=true npm test -- --watchAll=false`

## Manual QA expectations
- Confirm admin route requires admin and behaves correctly.
- Confirm non-admin/public users cannot reach admin data.

## Safety notes
- No fake members, roles, or data.
- Never include secrets or service-role keys in frontend code.
