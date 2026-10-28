# #704 — Public Events House-lead and legacy-cache privacy

**Status:** reviewed implementation in PR; no staging or production migration applied by this PR.

## Root cause

The archived Memory Wall on `/events` grouped published
`member_event_history` rows by event, selected a batch of member identifiers,
queried `public_members(id,house)`, counted the legacy `members.house` cache
and rendered `<House> led`. That cache is **not effective-dated**. A member who
once belonged to Bowser can cause a 2026–27 event to show `Bowser led` even
though the Houses changed. It can also contain affiliation before an assignment
batch is finally published. Picking the first tied count fabricated a leader.

**Approved privacy policy (#692):** no event House-winner badge, rank, per-House
attendance count, scored activity, or other public House-standings surrogate.
A year-correct public House-identity projection is for approved membership
badges only, **not** restoring House wins on Event cards.

## What's changed

- `src/pages/Events.tsx` requests only event ID and event-level points from
  the existing **published-event** history view. It does not batch attendee
  IDs or read `public_members.house`. Its stats no longer carry a
  `topHouse`, `topHouseCount`, per-House grouping or member roster.
- `PastEventMemoryCard` has no House-leading component even if an old in-memory
  stats object contains one. Normal event name, date, event type,
  non-House points, total attendance, photo links, and public recaps remain.
  Admin **Preview as Public** uses the same component.
- The forward-only `20261028083000_restrict_public_members_house_cache.sql`
  revokes public/anonymous/authenticated table-level SELECT on
  `public_members`, then column-grants only `id`, names, college, year,
  individual points and attendance counts. The `house` column remains in
  the underlying view for existing database dependencies but is not
  selectable through the public/ordinary-user API. This is intentional:
  dropping/recreating the view risks breaking unknown dependent objects.
- `members.house` itself is **not modified**. Existing admin House membership
  writes can still update the legacy internal display cache during a Reveal,
  but that must never create public exposure. New or historical public
  House affiliation can only come from the separate, approved
  `public_house_memberships` view in PR #701 after that year's Publish.

## Rollout dependency and review gates

1. **Coordinate with #701**: the current main-branch
   `src/hooks/useFindMyPoints.ts` reads `public_members.house`. PR #701
   replaces that with the published and year-scoped view. **Do not apply
   the #704 ACL migration before #701's frontend and its
   `20261028060000_public_house_memberships.sql` migration are deployed and
   verified.** Otherwise Find My Points will return 42501 for its old query.
   Also verify no other public client still selects the legacy `house`.
2. **Coordinate with #716 / #692**: private House score views must have their
   client grants revoked; PR #704 intentionally does not duplicate or change
   score math, assignment writes, House view definitions, or scores. PR #701 and
   PR #716 use different migrations with equal timestamp prefixes; ensure
   migration ordering is unambiguous before any production apply.
3. Apply the #704 migration **to staging first**. Using the anon key, run
   `GET /rest/v1/public_members?select=house&limit=1`, and then the same
   as an ordinary signed-in (non-admin) test user. Both **must** fail with
   SQLSTATE `42501` (permission denied), not empty 200. A normal
   `select=id,first_name,last_name,points&limit=1` must still succeed.
   A request for `select=*` may be denied by design because it would
   attempt the blocked House column.
4. Run `RLS_HOUSE_CACHE_PHASE=post-migration
   node scripts/verify-rls-security.mjs` on staging with appropriate test
   credentials; this verifies the API denial and positive safe reads.
   Existing `scripts/verify-rls-security.mjs` also tests public view
   write permissions. No direct SQL execution is performed by the verifier.
5. Smoke test the public Events Memory Wall before and after the migrations:
   2025–26 Mario year versus 2026–27 My Little Pony year, past/current
   events, multiple attendees, same name, membership transfers,
   unrevealed/published assignments, ties, empty events and missing House
   projection. None should show a leading House. Event titles, dates,
   photo albums, public recaps, individual points and event attendance
   continue working. Inspect the Network panel and serialized responses:
   no `public_members.house`, `houseCounts` or House-leading payload.
6. If checks fail, **keep public cache SELECT denied**; roll back the UI
   to a no-House-leader version rather than regranting a privacy leak.
   Avoid introducing a new House-lead badge elsewhere.

## Known inference limitation / separate owner decision

After an authorized House Reveal, published member-to-House identity combined
with public individual points or published attendance records may permit
reconstruction of some House standings. Removing the misleading Event badge
and revoking `public_members.house` stop *these* explicit leaks, but **cannot
prove zero inferential exposure**. #692 and #701 need a coordinated CRC
decision on whether visible individual activity + identified House members
is compatible with GBM-only standings. No change in this PR silently removes
individual point data or approved House identity badges.

**Do not mark the privacy issue fully deployed or close it based only on
static tests and a green GitHub build.** Live RLS/API verification,
cross-PR integration and CRC inference acceptance remain necessary.
