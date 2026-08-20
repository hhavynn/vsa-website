# Anonymous Supabase Read-Exposure Audit

Last updated: 2026-08-19

This document records the live, read-only audit requested by #226: what a visitor can read using only the Supabase anonymous key. It does not authorize or apply RLS policies, grants, migrations, data changes, or cleanup. Every unexpected item is tracked in a separate gated issue.

## Verdict

The project is **not ready to clear the #226 public-launch gate**. The core protections for member PII, stored check-in codes, data-rights records, import logs, and admin-only content are working, but the audit found four unexpected exposure classes:

1. `events.check_in_form_url` is public and has 2 non-empty live values (#379).
2. All 2,281 `member_event_attendance` rows, including `imported_at`, are public despite the newer allowlisted view (#380).
3. Security-sensitive legacy RPCs are anonymously executable and the live schema has drifted from repository migrations (#381).
4. Public UVSA base tables allow reads of internal review/source-note columns; those columns are currently null (#382).

## Method

The target was the Supabase project configured in the local `.env.local`, treated as production for safety.

Run the reproducible relation audit with:

```bash
node scripts/audit-anon-exposure.mjs
```

The script:

- uses the service-role key only to retrieve PostgREST OpenAPI metadata and exact count-only totals;
- uses the anon key for per-relation and per-column `HEAD` requests;
- retrieves no relation row bodies;
- invokes no RPCs;
- prints names, statuses, counts, column names, and OpenAPI RPC argument schemas, never values or credentials;
- treats unexpected HTTP errors as an incomplete audit and exits nonzero instead of classifying them as access denial.

Supabase rejects OpenAPI discovery using only the current publishable anon key (`401 Secret API key required`), so the metadata-only service request is required to find live-only objects. Reachability is still tested with the anon key.

For the dated audit, non-mutating RPCs were probed with dummy inputs. Mutation-capable RPC grants were tested with invalid UUID strings that fail input parsing before the function body can run. `check_in_to_event(text)` used a guaranteed-nonexistent audit string. No live identifier, code, URL, row value, or function result was printed or retained. These one-off RPC calls are intentionally not automated because a future function-body change could make a formerly safe probe mutate production.

Counts below use `anon-visible rows / service-visible rows`. `0 / N` means the endpoint/columns exist but RLS returned no rows to anon. `denied` means PostgREST returned HTTP 401 with PostgreSQL code `42501`.

## Explicit security assertions

### Check-in secrets

- `event_check_in_secrets`: **denied** to anon; 35 rows exist.
- `events.check_in_code`: absent from the live relation schema.
- Legacy `check_in_codes`, `check_in_code_usage`, and `check_ins`: zero live rows.
- Unexpected: `events.check_in_form_url` is anon-selectable and 2 non-empty values exist (#379).
- Unexpected: `generate_check_in_code()` and `check_in_to_event(text)` are anon-executable (#381). The invalid check-in probe did not award points or retrieve a stored code.

### Member PII

- `members`: anon can read only `id`, name, college, year, House, aggregate points, and events-attended fields.
- `members.email`, `members.user_id`, `members.needs_review`, and audit timestamps return column-level denial.
- `member_yearly_points`, `house_member_yearly_points`, `house_member_all_time_points`, and `member_event_history` expose no email, phone, auth UUID, or admin field.
- `user_profiles`: 0 / 9 rows visible to anon.
- `import_job_rows`: 0 / 368 rows visible; CSV emails and raw import rows are RLS-filtered.
- `member_photo_requests`: 0 / 2 rows visible; submitted email and admin notes are RLS-filtered.
- No live public relation exposes a column named `phone`.
- Unexpected: the raw attendance ledger is public (#380). It contains public member/event IDs rather than email/phone, but it exposes unnecessary import metadata and bypasses the published-event view boundary.

### Draft and unpublished content

- `events`: 0 unpublished rows exist in the live table; therefore none are anon-readable today.
- `house_events`: 0 unpublished rows exist in the live table.
- `external_events`: 0 draft rows exist in the live table.
- `program_content`: 0 / 4 rows are public because no current row is published.
- `public_application_links`: 9 rows are public, but 0 have a non-null `target_url`.
- `ai_knowledge_base`: 46 / 46 current rows are intentionally public and active; 0 private or inactive rows exist.

Because the three event tables currently contain no draft rows, the live run proves current exposure but cannot exercise a populated-draft denial. The repository policies filter drafts/unpublished rows; #292 remains the required regression test for future rows.

### Admin-only configuration and records

The following live records returned no anon rows:

- `application_links`: 0 / 9
- `house_page_assets`: 0 / 27
- `vcn_archives`: 0 / 4
- `feedback`: 0 / 4
- `import_jobs`: 0 / 3
- `import_job_rows`: 0 / 368
- `member_photo_requests`: 0 / 2
- `member_photo_request_events`: 0 / 4
- `merge_exclusions`: 0 / 20
- `user_points`: 0 / 9
- `user_profiles`: 0 / 9
- `ai_chat_usage_logs`: 0 / 41
- `data_rights_requests`, `data_rights_request_events`, and `event_check_in_secrets`: column/table access denied

`site_settings` is intentionally public and contains only logo configuration. `ai_knowledge_base` is intentionally public only for active/public knowledge rows.

Repository migrations for `cabinet_role_descriptions` and `uvsa_network_page_settings` are not deployed in the audited schema, so those tables are not reachable by any PostgREST role there. This is deployment drift, not evidence of a public read.

## Relation inventory

### Tables

| Table | Anon evidence | Classification | Reason |
|---|---:|---|---|
| `academic_terms` | 10 / 10 | expected-public | Public academic-year labels and boundaries. |
| `ace_families` | 0 / 7 | expected-private | Base/editor table; public rows use `published_ace_families`. |
| `ace_family_members` | 0 / 295 | expected-private | Base/editor table; public rows use the published view. |
| `achievements` | 0 / 0 | expected-private | Empty legacy account table; user-linked columns are not a public contract. |
| `ai_chat_usage_logs` | 0 / 41 | expected-private | Hashed usage and rate-limit metadata. |
| `ai_feedback` | 0 / 0 | expected-private | Public may submit; only admins may read. |
| `ai_knowledge_base` | 46 / 46 | expected-public | Active, public grounding rows are intentionally readable. |
| `application_links` | 0 / 9 | expected-private | Admin source table; public view strips unavailable URLs. |
| `cabinet_members` | 373 / 373 | expected-public | Public cabinet directory/profile content. |
| `cabinet_years` | 24 / 24 | expected-public | Public cabinet archive navigation. |
| `check_in_code_usage` | 0 / 0 | expected-private | Legacy check-in usage ledger. |
| `check_in_codes` | 0 / 0 | expected-private | Legacy secret table; empty but still present. |
| `check_ins` | 0 / 0 | expected-private | Legacy user attendance table; empty but still present. |
| `data_rights_request_events` | denied / 0 | expected-private | Privacy-request audit trail. |
| `data_rights_requests` | denied / 0 | expected-private | Privacy-request identity and internal notes. |
| `event_attendance` | 0 / 0 | expected-private | Authenticated server-authoritative check-in records. |
| `event_check_in_secrets` | denied / 35 | expected-private | Stored check-in codes; protection verified. |
| `event_interest_counts` | 0 / 0 | expected-public | Aggregate counts for published public events. |
| `event_recaps` | 0 / 0 | expected-private | Internal notes, budget, risks, and Drive links. |
| `events` | 35 / 35 | **unexpected** | Public event rows are intended; 2 non-empty check-in form URLs are not (#379). |
| `external_events` | 13 / 13 | **unexpected** | Public events are intended, but `source_notes` and `confidence_level` should be admin-only (#382). |
| `feedback` | 0 / 4 | expected-private | Public may submit; only admins may read. |
| `gallery_events` | 15 / 15 | expected-public | Public gallery metadata and album links. |
| `homepage_content` | 1 / 1 | expected-public | Public homepage copy and assets. |
| `house_event_houses` | 0 / 0 | expected-public | Published-event-to-House associations; currently empty. |
| `house_events` | 9 / 9 | expected-public | All current rows are published public events. |
| `house_memberships` | 0 / 0 | expected-private | Admin-managed membership history and internal metadata. |
| `house_page_assets` | 0 / 27 | expected-private | Base/editor rows include internal notes; public uses the published view. |
| `import_job_rows` | 0 / 368 | expected-private | Raw rows, CSV emails, matching details, and errors. |
| `import_jobs` | 0 / 3 | expected-private | Import source/audit metadata. |
| `intern_cohort_members` | 0 / 0 | expected-private | Live-only base/editor table; public uses the published view. |
| `member_event_attendance` | 2,281 / 2,281 | **unexpected** | Raw ledger and `imported_at` are public despite the narrower view (#380). |
| `member_photo_request_events` | 0 / 4 | expected-private | Admin review audit trail. |
| `member_photo_requests` | 0 / 2 | expected-private | Submitted emails, paths, consent, and admin notes. |
| `members` | 720 safe rows / 720 | expected-public | Column-allowlisted public identity/aggregate fields; PII columns denied. |
| `merge_exclusions` | 0 / 20 | expected-private | Admin merge-decision metadata. |
| `program_content` | 0 / 4 | expected-public | Policy exposes published rows only; none are currently published. |
| `resource_links` | 0 / 0 | expected-private | Admin-only operational URLs; table is currently empty. |
| `site_settings` | 1 / 1 | expected-public | Public logo URL and alt text only. |
| `user_points` | 0 / 9 | expected-private | Authenticated check-in points. |
| `user_profiles` | 0 / 9 | expected-private | Auth UUIDs, emails, and admin flags. |
| `uvsa_schools` | 13 / 13 | **unexpected** | Public profiles are intended, but verification metadata is not (#382). |
| `vcn_archives` | 0 / 4 | expected-private | Base/editor rows include internal notes and source docs. |

### Views

| View | Anon evidence | Classification | Reason |
|---|---:|---|---|
| `house_all_time_points` | 0 / 0 | expected-public | Public aggregate standings view. |
| `house_member_all_time_points` | 0 / 0 | expected-public | Public member standings projection. |
| `house_member_yearly_points` | 0 / 0 | expected-public | Public yearly member standings projection. |
| `house_recent_activity` | 0 / 0 | expected-public | Public published-event aggregate activity. |
| `house_yearly_points` | 0 / 0 | expected-public | Public yearly House standings. |
| `member_event_history` | 2,281 / 2,281 | expected-public | Owner-approved published-event history, allowlisted fields only. |
| `member_yearly_points` | 720 / 720 | expected-public | Public leaderboard rows; no auth UUID/email in live columns. |
| `my_member_photo_requests` | denied / 0 | expected-private | Authenticated caller-scoped status view. |
| `public_application_links` | 9 / 9 | expected-public | Public status/messages; all target URLs currently null. |
| `public_member_avatars` | 2 / 2 | expected-public | Approved avatars keyed by public member ID. |
| `published_ace_families` | 7 / 7 | expected-public | Allowlisted published family fields. |
| `published_ace_family_members` | 295 / 295 | expected-public | Published ACE roster/profile fields. |
| `published_house_page_assets` | 27 / 27 | expected-public | Allowlisted active House page content. |
| `published_intern_cohort_members` | 0 / 0 | expected-public | Live-only published projection; currently empty. |
| `published_vcn_archives` | 3 / 3 | expected-public | Allowlisted published VCN archive content. |

## RPC inventory

| RPC | Live OpenAPI arguments | Safe audit input | Anon evidence | Classification | Reason |
|---|---|---|---|---|---|
| `approve_member_photo_request` | request UUID, public URL, optional member UUID, approved path | invalid request UUID; non-secret marker strings | denied (`401/42501`) | expected-private | Admin moderation mutation. |
| `check_in_to_event` | check-in code text | guaranteed-nonexistent audit string | executed (`200`) | **unexpected** | Current migrations revoke anon; live grant/definition differs (#381). |
| `generate_check_in_code` | none | no arguments | executed (`200`) | **unexpected** | Legacy secret-related RPC absent from the current contract (#381). |
| `generate_data_rights_export` | request UUID | zero UUID | denied (`401/42501`) | expected-private | Admin-only data-rights export. |
| `get_data_rights_dependency_preview` | request UUID | zero UUID | denied (`401/42501`) | expected-private | Admin-only data-rights preview. |
| `get_event_points` | event-type enum | valid non-secret enum label | executed (`200`) | expected-public | Harmless legacy event-type lookup; retention should still be documented in #381. |
| `get_user_points` | user UUID | zero UUID | executed (`200`) | **unexpected** | Live-only arbitrary-UID lookup absent from source contract (#381). |
| `is_admin_user` | optional user UUID | zero UUID | denied (`401/42501`) | expected-private | Caller-bound authenticated helper. |
| `match_ai_knowledge_base` | query text, optional match limit | unique audit text with limit 1 | executed, zero matches (`200`) | expected-public | Intended public knowledge search. |
| `recalculate_member_points` | member UUID | invalid UUID string | reached UUID parsing (`400/22P02`) | **unexpected** | Anon has an execution path to a live-only points mutation RPC (#381). |
| `record_event_interest` | event UUID, signal text | invalid UUID string and audit marker | reached UUID parsing (`400/22P02`) | expected-public | Intended public write with published-event and signal validation. |
| `reject_member_photo_request` | request UUID, optional admin note | invalid UUID string; note omitted | denied (`401/42501`) | expected-private | Admin moderation mutation. |
| `remove_member_photo_request` | request UUID, optional admin note | invalid UUID string; note omitted | denied (`401/42501`) | expected-private | Admin moderation mutation. |
| `smart_merge_members` | source UUID, target UUID | two invalid UUID strings | reached UUID parsing (`400/22P02`) | **unexpected** | Current migrations revoke public execution; live grant drift exists (#381). |

The live OpenAPI surface exposes one path per RPC name and does not provide a `pg_proc` grant matrix. The table therefore inventories every anon-facing PostgREST RPC endpoint and its published argument schema, but it cannot prove that no hidden overload exists. #381 owns the overload- and grant-complete database reconciliation.

The repository also defines `preview_data_rights_anonymization` and `anonymize_data_rights_subject`, but neither exists in the live PostgREST schema. They are therefore not reachable in the audited project and are part of #381's deployment-drift reconciliation.

## Schema drift observed

Live relations/RPCs absent from the current TypeScript/migration contract include legacy check-in/account objects, `intern_cohort_members`, `published_intern_cohort_members`, `get_user_points`, and `recalculate_member_points`. Repo-defined `cabinet_role_descriptions`, `uvsa_network_page_settings`, and two anonymization RPCs are absent live. The live `ai_knowledge_base` table also lacks the repo-defined v2 columns `aliases`, `confidence`, `freshness`, `academic_year`, and `valid_until`. `member_event_history` is live and used by the app but missing from `src/types/database.ts`.

This audit does not guess whether each difference should be deployed, retained, or removed. #381 owns the reconciliation so no live object is dropped before caller and usage review.

## Follow-up gate

Do not close #226 until:

- [ ] #379 is resolved and the two check-in form URLs are no longer anon-selectable.
- [ ] #380 is resolved and the base attendance ledger is blocked while public views still work.
- [ ] #381 produces a live RPC/grant matrix and removes unexpected anon execution.
- [ ] #382 replaces public UVSA base-table reads with an allowlisted surface.
- [ ] The full RLS verifier passes against staging and then production in read-only mode.
- [ ] This audit is rerun and every relation/RPC is expected-public or expected-private with no unexpected entries.

## Safety record

- No migrations, grants, policies, rows, Storage objects, or production settings were changed.
- No service-role row body was retrieved.
- No member email, phone, auth UUID, check-in code, form URL, import row, admin note, or private record value was printed or copied into this document.
- The existing public leaderboard/House views were treated as intentional and were not changed.
