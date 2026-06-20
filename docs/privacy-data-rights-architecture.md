# Privacy Data Rights Architecture and Admin Runbook

Last reviewed: 2026-06-19

## Purpose

This document defines a cautious architecture and manual runbook for VSA at UCSD requests to review, correct, export, delete, anonymize, or remove personal data.

It is an implementation guide, not lawyer-approved legal advice. It promises no response deadline or guaranteed deletion and authorizes no destructive operation. VSA leadership must approve the request channel, authorized processors, identity-verification method, retention rules, and exceptions.

This review uses repository migrations, types, data access, pages, and Supabase functions. Migration history does not prove production matches the repository. Future work must inspect live constraints, policies, grants, Storage objects, and providers. Unresolved behavior is marked **needs schema verification** or **needs admin/VSA policy decision**.

## Non-negotiable safety rules

- Do not use the current Admin Members delete/bulk-delete controls for a privacy request. Deleting `members` currently cascades to imported attendance and House history.
- Do not delete an Auth user first. Auth-linked tables mix `CASCADE`, `SET NULL`, and default blocking behavior.
- Never rely on frontend hiding for authorization. Verify every export or mutation caller server-side.
- Never put exports in public Storage, shared frontend state, analytics, or ordinary logs.
- Exclude other users' records, check-in codes, notes, private rosters, payment data, credentials, private links, and unrelated raw AI text.
- Require a dry-run dependency report and independent review before destructive/anonymizing action.
- Never weaken RLS to process a request.

## Material risks in the current architecture

### Dual identity systems

The site has overlapping identity domains:

- Supabase Auth users keyed by `auth.users.id`, with `user_profiles`, `event_attendance`, `user_points`, and legacy `chat_logs`.
- Import/leaderboard members keyed by `members.id`, with `member_event_attendance`, House membership, import references, and public leaderboard views.

`members.user_id` is nullable and coverage is not guaranteed. One person may have no Auth account, duplicate member rows, or an incorrect link. Each request needs an explicit subject map containing the verified Auth ID, all confirmed member IDs, and attributable feedback/media/external records. Never authorize destruction from a name-only match.

### Mixed Auth deletion behavior

Repository migrations indicate:

- `user_profiles`, `user_points`, `event_attendance.user_id`, and legacy `chat_logs.user_id` use cascades in at least one definition.
- `members.user_id` uses `SET NULL`.
- Import/House actor fields generally use `SET NULL`.
- `feedback.user_id`, `event_attendance.checked_in_by`, and historical check-in actor fields may block deletion.
- Historical migrations redefine points/check-in tables.

Effective production behavior **needs schema verification**. A future workflow must inspect live foreign keys and preview dependencies before Auth deletion.

### Existing member deletion is destructive

`src/pages/Admin/Members.tsx` deletes `members` rows individually and in bulk. Migrations define cascades from `member_event_attendance`, `house_memberships`, and merge exclusions; import references use `SET NULL`. Deletion can therefore erase data driving points and House standings. The current control is not a data-rights workflow and needs separate hardening.

### Public access exceeds UI projections

`members` has a public SELECT policy while its schema includes `email` and `user_id`. Frontends usually request narrower projections, but UI projections do not restrict PostgREST/RLS. Public leaderboard views also include stable `user_id` values.

This is a material minimization/exposure risk. Before implementation, a separate security PR should verify production grants and use public views that omit contact fields and Auth identifiers. This PR does not change RLS.

### Sensitive historical data and missing controls

- `import_job_rows` stores raw source rows, CSV contact fields, match details, and errors.
- Legacy `chat_logs` stores raw prompts/responses. Current Ask VSA stores hashed session/IP and usage metadata in `ai_chat_usage_logs`, while Gemini processes prompts/recent context.
- Public buckets and external forms/albums can hold data outside the referencing DB row.
- The admin request tracker and count/warning-only dependency preview are implemented. There is still no retention schedule, export service, destructive-action preview, or completion audit trail.

## Current data inventory

Repository evidence only; deployed behavior **needs schema verification**.

| Category | Source and likely storage | Visibility/purpose | Export/correction | Delete/anonymize recommendation | Risk |
| --- | --- | --- | --- | --- | --- |
| Auth account | Sign-in/up; `auth.users` and browser session | Private identity/authentication | Export appropriate subject metadata only; approved Auth process for correction | Delete last after role/dependency review | Never export hashes/tokens/provider secrets; mixed FKs |
| Profile/admin role | Profile trigger/edit; `user_profiles` | Own/admin profile and authorization | Export subject fields; control email/role changes separately | Clear optional PII or delete with approved Auth deletion | Never automatically mutate `is_admin` |
| Member identity | Imports/admin; `members` and public views | Names/points public; admin contact/review fields | Export confirmed rows; reviewed corrections/merges | Prefer stable-row anonymization if history remains | Public policy may expose more than UI; display strategy **needs admin/VSA policy decision** |
| Imported attendance | Admin import; `member_event_attendance` and aggregate views | Points, history, standings | Export subject rows plus public event metadata; audited correction | Retain against anonymized member unless policy allows history loss | Member deletion cascades and changes totals |
| Auth attendance | Check-in/admin; `event_attendance` | Own/admin history | Export subject rows; omit secrets/unrelated actors | Future pseudonymous-history or consolidation design | Non-null Auth FK may cascade; actor FK may block |
| Auth points | Check-in logic; `user_points` | Own/admin intended | Export total labeled by source; recalculate for correction | Decide aggregate treatment before Auth deletion | Secondary points system may disagree |
| House history | Admin/import; `house_memberships` and views | Base admin-only; standings public | Export assignment/effective dates, not notes/actors | Retain against anonymized member or detach after tests | Member deletion cascades; notes may contain PII |
| Feedback | Public form; `feedback` | Admin-reviewed submission/contact | Export reliably matched subject rows; correct as needed | Delete row or null Auth/contact and de-identify text | Nullable FK may still block until detached |
| Applications | Admin links; `application_links`; submissions external | Link/window public/admin; answers external | No verified submission table; provider process required | Provider-owner workflow | Ownership/retention **needs admin/VSA policy decision** |
| Current Ask VSA | Widget/function; `ai_chat_usage_logs` and Gemini transit | Hashed abuse/diagnostic metadata | Usually not attributable to a named requester | Short retention; aggregate/delete expiry | Provider handling **needs admin/VSA policy decision** |
| Legacy AI chat | Legacy function; `chat_logs` | Raw own/admin chat text | Export subject rows only if deployed/verified | Delete subject rows after retention review | Unexpected PII; deployment **needs schema verification** |
| Event interest | Buttons; `event_interest_counts` and `localStorage` | Public aggregate/device-local choice | Explain local state; no attributable server export | Clear local key; no individual server deletion | No user ID stored |
| Avatar | Upload; `user_profiles.avatar_url` and public `avatars` bucket | Public image | Export reference/object metadata; coordinated correction | Delete confirmed objects then null URL | Orphans/versions/cache **needs schema verification** |
| Leadership/program profiles | Admin content; `cabinet_members`, `ace_family_members`, public image buckets | Public history/program display | Export/correct confirmed requester record | Correct, unpublish, anonymize, detach lineage, or remove media | Archive/lineage **needs admin/VSA policy decision** |
| Gallery/event media | Admin/external albums; `gallery_events`, `event_recaps`, buckets, Google Photos | Published media public; recaps admin | Export confirmed subject-provided references only | De-link/unpublish and coordinate object/provider removal | Manual identity review; external ownership policy |
| Import audit | Admin import; `import_jobs` and `import_job_rows` | Admin troubleshooting/audit | Exclude others/raw rows by default | Keep aggregate job; redact/delete attributable raw rows after retention | Raw rows duplicate unexpected PII |
| Admin metadata | Editor IDs, House/recap notes, internal links | Admin tables/fields | Exclude by default | Detach actor where safe; retain minimal audit | Never export notes, budgets, private links, unrelated identities |
| Analytics/consent | Consent banner/GA; `localStorage` and GA4 | Local choice/authorized analytics | Explain local choice; provider export only if attributable | Change/clear choice; provider process if applicable | Retention/attribution policy needed |
| Browser state | Theme, Auth, Ask VSA ID, interest, error recovery | `localStorage`/`sessionStorage` | Explain categories, never token contents | Clear locally/sign out | Never ask users to send session tokens |

## Identity resolution and dependency preview — implemented for read-only counts

The admin-only tracker can call `get_data_rights_dependency_preview` for a saved request. It returns versioned counts, identity signals, attribution limits, warnings, and next steps only. It does not return raw rows or private content and does not export, delete, anonymize, or remove media. Name matches are candidate signals only and are not used to attribute downstream attendance, points, House, import, or other records.

The preview covers:

1. Auth ID and admin-role status.
2. `user_profiles` and Auth-linked row counts.
3. Candidate `members` rows and link basis: exact `user_id`, reviewed email candidate, or manual confirmation.
4. Counts for both attendance/points systems, House memberships, feedback, imports, legacy chat, avatars, and public profiles/media.
5. FKs expected to cascade, null, or block.
6. Public views/aggregates expected to change.
7. External systems requiring manual action.
8. Proposed action by category: export, correct, detach, anonymize, delete, aggregate-only, or none.

Email may locate candidates but is not sole destructive proof. Record verification method/result, not identity-document copies.

## Recommended request intake process

1. User contacts an official VSA channel; selection **needs admin/VSA policy decision**.
2. Admin creates a minimal request record with random ID, type, status, processor, and verification state—no full conversation or identity documents.
3. Admin verifies identity using an approved method; **needs admin/VSA policy decision**.
4. Admin classifies review/correction, export, deletion, anonymization, media removal, external application, or browser/analytics help.
5. Admin resolves Auth/member identities, duplicates, dependencies, and external systems.
6. Admin runs a dry-run preview and saves counts/actions, not row contents.
7. An independent authorized reviewer approves destructive actions.
8. Admin uses a purpose-built server workflow, not ad hoc SQL/browser calls or current member delete.
9. Admin verifies data counts, public exposure, standings, and media references.
10. Admin confirms through the official channel and retains only an approved minimal audit record.

## Request tracker architecture

Future PR A should add an admin-only tracker before mutation. Suggested logical fields:

- random request ID, request type, and state;
- verified Auth ID and reviewed member IDs;
- minimal contact-channel reference;
- verification method/result/verifier/time;
- processor and independent reviewer;
- structured action/exception categories;
- dry-run/completion counts and software/schema version;
- timestamps; and
- export hash, never payload/download secret.

RLS must be admin-only with server authorization and append-oriented audit events. Processor roles and retention **needs admin/VSA policy decision**.

## Export architecture

Future PR B should implement a narrow admin-only RPC plus server function or Supabase Edge Function that:

1. requires authentication and verifies approved admin status server-side;
2. requires an approved request and explicit Auth/member IDs;
3. rejects unresolved duplicates/name-only matches;
4. uses fixed column allowlists;
5. returns versioned JSON;
6. audits counts and bundle hash only;
7. never logs payloads; and
8. uses approved private, short-lived delivery.

Never expose a service-role key to frontend code. Do not add public self-service until subject-scoped access/member linking are verified.

Suggested bundle:

```text
manifest: request ID, generated time, schema version, categories, exclusions
account: approved Auth metadata and profile
member_records: confirmed member rows
attendance: subject rows plus public event metadata, separated by source
points: current/yearly totals, labeled by source
house_memberships: assignment/effective dates without notes/actors
feedback: reliably matched subject submissions
media: avatar/public profile/media references
external_systems: provider-owned categories requiring separate action
```

Always exclude other users; check-in codes; admin/import/House notes; raw imports; private rosters; payment/budget data; internal links; credentials; env/tokens/hashes; unrelated raw AI; and unverified external submissions.

Tests must use synthetic subjects, overlapping names, duplicate candidates, and an admin subject; prove no cross-user fields and no payload in logs.

## Delete and anonymization architecture

Deletion is not one SQL statement. Strategies:

- **Delete:** low-risk standalone records with no needed dependency.
- **Anonymize:** preserve stable history while removing identity.
- **Detach:** remove Auth/contact/avatar/external links.
- **Retain aggregate only:** keep approved totals without identity.
- **Unpublish/remove media:** hide references, then remove confirmed copies.
- **Admin review:** leadership archives, ACE lineage, group media, disputed points, audits, and records involving others.

| Store | Default future strategy | Precautions |
| --- | --- | --- |
| `auth.users` | Delete last | Transfer/revoke admin role; resolve blockers/history; **needs schema verification** |
| `user_profiles` | Correct/detach; delete with Auth | Protect role, email, ID, timestamps; handle avatar |
| `members` | Anonymize stable row if preserving history | Add explicit state/display behavior; null contact/Auth/demographic/cache fields; never current delete |
| `member_event_attendance` | Retain with anonymized member by default | Compare member/yearly/House totals |
| `event_attendance` | Future pseudonymous/consolidated design | Non-null Auth FK/actor blocker **needs schema verification** |
| `user_points` | Preserve approved aggregate elsewhere or cascade after policy decision | Label source; test totals |
| `house_memberships` | Retain with anonymized member | Remove unnecessary notes/source PII; test effective dates |
| `feedback` | Delete or detach contact/Auth and de-identify | Null Auth link before account deletion if required |
| `import_jobs` | Retain approved aggregate | Review source URL/actor |
| `import_job_rows` | Redact/delete raw attributable rows after retention | Preserve only nonidentifying counts |
| `chat_logs` | Delete subject raw rows after review | Confirm deployment/holds |
| `ai_chat_usage_logs` | Short retention; aggregate/delete expiry | Hashes may not be attributable |
| Avatars | Delete confirmed objects, null reference | Inventory versions/copies/cache |
| Cabinet/ACE | Correct, unpublish, anonymize, or retain archive | Policy decision required |
| Gallery/event media | De-link/unpublish; remove selected copies/provider data | Manual scope; protect unrelated group data |
| External submissions | Provider workflow | Verify owner, identity, retention |
| Analytics/browser | Change consent/clear locally; provider process if attributable | Do not claim named attribution |
| Audit actors | Detach where safe; retain minimal action | Do not erase accountability |

Exact anonymization columns and labels **needs schema verification** and **needs admin/VSA policy decision**. Invariants:

- retain `members.id` only where approved history needs it;
- remove direct contact/Auth/demographic/import hints;
- never encode original identity in replacement labels;
- omit anonymized people from public views or use approved generic/pseudonymous presentation;
- consider re-identification from small cohorts; and
- preserve aggregates only as approved.

## Media/avatar removal workflow

Future PR D should identify DB/object/external/repo references from explicit records; approve crop/de-link/unpublish/remove scope; hide approved public references; remove only selected objects server-side; coordinate external removal; verify URLs/caching and unrelated data; and audit identifiers/results—not image copies.

Storage ownership, caching, migrated copies, and external permissions **needs schema verification** and **needs admin/VSA policy decision**.

## High-risk systems requiring special review

- Auth identity and `is_admin`.
- Auth-to-member mapping and duplicates.
- Current Admin Members deletion.
- Both points/attendance systems and public leaderboard/member views.
- Check-in secrets and actors.
- Date-effective House membership.
- Raw import rows/source/match/error data.
- Feedback contact/free text.
- Legacy raw chat, current provider processing, hashed logs.
- Public avatar, cabinet, ACE, gallery, event, House, president, and site buckets.
- External forms/albums.
- Admin recap/House/import notes and private links.

## Future implementation plan

### PR A: Admin request tracker and runbook UI, non-destructive — implemented

The admin-only `/admin/data-rights` tracker stores minimal request/audit metadata in `data_rights_requests` and append-only `data_rights_request_events`. It supports intake, verification, assignment, review, and decisions without acting on subject data. It stores no documents or payloads and provides no export, deletion, anonymization, or media-removal action.

### PR A.5: Read-only subject dependency preview — implemented

The admin-only RPC and tracker UI return counts, ambiguity warnings, attribution limits, and review steps from explicit request identifiers. The preview is count/warning-only, creates no audit event, and performs no export, deletion, anonymization, media removal, Storage operation, or subject-data mutation. AI usage attribution and stable media/provider ownership remain **needs schema verification** and manual review.

### PR B: Admin-only export function

Add fixed allowlists/versioned JSON, server admin check, approved request/explicit IDs, synthetic leakage tests, and private delivery. Acceptance: no public endpoint or other-user data.

### PR C: Profile/member anonymization workflow

Separate dry-run/execution, define anonymized public behavior, resolve FKs forward-only, remove private fields/Auth IDs from public paths, and prevent bypass through current deletion. Acceptance: approved leaderboard/attendance/House invariants hold.

### PR D: Media/avatar removal workflow

Inventory DB/Storage/repo/external references, preview explicit objects, sequence unpublish/de-link/delete, and test orphan/unrelated assets. Acceptance: only approved media changes.

### PR E: Deletion/anonymization tests and RLS verification

Test cascades/nulls/blockers/triggers/RPCs/views/Storage across anon, ordinary, other-user, admin, revoked-admin, and service roles. Test allowlists, rollback, idempotency, and standings/history. Acceptance: no cross-user action, secret fields, or partial destructive completion.

### PR F: Privacy Notice update

Update public copy only after channel, workflows, retention, and limitations are approved/deployed. Make no legal guarantees or unsupported deletion claims.

## Verification checklist for future implementers

```bash
npm run build
npm run lint
CI=true npm test -- --watchAll=false
git diff --check
```

If future migrations are added, use approved local/staging only:

```bash
supabase db reset
supabase db diff
```

Required checks:

- Inspect live FKs to `auth.users`/`members` and confirm cascade/null/block.
- Verify table/view grants, view security behavior, RLS, and bucket ownership/visibility.
- Anonymous/ordinary users cannot read requests or act on others.
- Admin status is server-checked; revoked admins lose access.
- No service key enters frontend/logs.
- Export emits only verified allowlisted subject fields, handles duplicate names, and never logs payload.
- No check-in code, other-user email, note, roster, payment data, unrelated AI text, secret, or private link appears.
- Preview lists records, objects, providers, cascades, blockers, and expected aggregate changes.
- Failures are transactional/recoverable and reruns idempotent.
- Leaderboard, attendance, and House outcomes match approved expectations.
- Public views no longer expose removed identity/stable Auth IDs.
- Only selected media changes and minimal non-PII audit remains.

## Open questions for Havyn and VSA leadership

1. Which official channel receives requests?
2. Who may verify, process, approve, and independently review them?
3. Should points/attendance be deleted, anonymized with totals, or vary by record/year?
4. How should Auth check-in history be handled before account deletion?
5. Should anonymized members remain generic/pseudonymous publicly or disappear while aggregates remain?
6. How should cabinet, president, intern, House parent, ACE lineage, alumni, and awards archives be handled?
7. Should alumni/history publication be opt-in?
8. How should group photos, Google Photos, and repo-hosted migrated images be handled?
9. Who owns external forms/albums and performs provider-side action?
10. How long should feedback, applications, raw imports, import summaries, legacy chat, AI metadata, requests, and audit hashes remain?
11. Is legacy `secure-ai`/`chat_logs` deployed or retired?
12. Should current member delete/bulk-delete be disabled or replaced?
13. What secure export delivery and expiration are approved?
14. What retention exceptions are allowed and who approves them?

Until live schema and policy questions are resolved, requests should remain manual, review-led operations without ad hoc deletion.
