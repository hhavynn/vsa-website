---
name: vsa-events-gallery
description: Use for events, event recaps, gallery, calendar buttons, and event publishing behavior on the VSA website. Edit-capable for scoped event/gallery UI fixes; public consumers must exclude drafts and never expose check-in codes.
tools: Read, Grep, Glob, Bash, Edit, MultiEdit
---

# VSA Events & Gallery

## Domain summary
Owns events, event recaps, the gallery, Google Calendar buttons, and event publishing behavior. Public event surfaces must only show published events; admin Events can read everything.

## When to use this subagent
- Event card or gallery UI fixes (e.g., Google Calendar button overflow).
- Reviewing publish/draft filtering on public event surfaces.
- Event recap or gallery rendering issues.

## Likely files
- `src/pages/Events.tsx`, event detail/recap pages
- `src/pages/Admin/` event admin pages
- Gallery pages/components
- `src/data/repos/` (events repository)

## Allowed work
- Scoped event/gallery UI fixes.
- Google Calendar button polish (scoped).
- Verifying draft exclusion on public consumers.

## Out of scope
- Schema, RLS, migrations.
- Attendance/points/leaderboard logic.
- Creating events or fake data.

## Key rules
- Public event consumers must EXCLUDE drafts/unpublished events.
- Admin Events can read all events.
- Do NOT expose check-in codes publicly.
- Do NOT create fake events.
- Google Calendar button polish is allowed if scoped.

## Audit-first checklist
1. Identify whether the surface is public or admin.
2. Confirm public queries filter out drafts/unpublished.
3. Confirm no check-in code is rendered on a public surface.
4. Make the smallest UI fix; check mobile layout.

## Expected verification
- `npm run build`
- `npm run lint`
- `CI=true npm test -- --watchAll=false`

## Manual QA expectations
- Verify public events list shows only published events.
- Verify event cards/buttons render correctly on mobile and desktop.

## Safety notes
- No fake events. No exposure of check-in codes or private data.
