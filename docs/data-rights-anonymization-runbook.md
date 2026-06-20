# Data-rights anonymization runbook

Use this workflow only for a verified VSA website anonymization request that has been approved by an assigned processor and a different independent reviewer. It preserves operational history while removing the direct identity fields that can be scrubbed safely today. It does not delete an Auth user, member, attendance row, points row, House membership, event record, or Storage object.

## Required order

1. Verify identity through the approved VSA process and save only minimal verification metadata.
2. Record every confirmed Auth user ID and member ID on the admin-only request. Never authorize anonymization from a name or email match.
3. Generate and securely deliver any approved export before changing the subject data.
4. Run `get_data_rights_dependency_preview` and resolve its identity warnings.
5. Set the request type to `anonymization`, verification to `verified`, status to `approved_for_future_action`, and assign both a processor and a different reviewer.
6. Call `preview_data_rights_anonymization` with the request ID and the exact saved subject IDs. A missing identifier is passed as SQL `null`.
7. Stop if `ready_for_anonymization` is false. Do not work around blockers with ad hoc SQL.
8. Compare the dry-run counts with the dependency preview and approval record.
9. Call `anonymize_data_rights_subject` with the same three arguments.
10. Confirm the request status is now `completed` in the tracker (the RPC sets this automatically). Complete any remaining manual follow-ups: Storage object removal, legacy chat and import content review, and external provider/media checks.

The execution function reruns its own preview while holding the request row lock. Both RPCs recheck the caller's admin profile server-side. The explicit Auth and member arguments must exactly match the saved request, and linked identities must agree. Admin subjects are refused because role transfer and revocation need a separate approval workflow.

## Automated changes

For a non-admin explicit Auth subject, the workflow:

- replaces profile first and last name with `Deleted Member`;
- clears the profile avatar reference and optional college, year, Discord identifier, username, and Discord avatar fields when those columns exist;
- preserves profile ID, email, admin flag, and timestamps; and
- detaches direct feedback `user_id`, name, and email while retaining feedback content for separate content/retention review.

For an explicit member subject, the workflow:

- preserves the member UUID;
- replaces first and last name with `Deleted Member`;
- clears college, year, email when present, Auth linkage, and review flag; and
- preserves House display/history, points, event count, timestamps, attendance relationships, and leaderboard/standings inputs.

Each successful execution appends an `anonymization_completed` event containing counts only. It does not copy subject identifiers, contact data, request notes, raw feedback, raw chat, import content, or media URLs into the event or RPC response. Re-running before the request is marked completed is safe: already scrubbed values remain scrubbed and historical rows remain untouched.

## Intentionally preserved

- `members.id`, `members.house`, `members.points`, and `members.events_attended`.
- All `member_event_attendance` rows and point values.
- All `event_attendance` and `user_points` rows linked to the Auth account.
- All `house_memberships` rows and effective dates.
- Event records, aggregate views, import job aggregate counts, and the minimal request/audit trail.
- `user_profiles.is_admin` is never changed. Subjects with an admin profile are blocked.

Preserving Auth-linked attendance and points means the Auth account and profile email remain personal data until a separately approved account workflow resolves login, foreign keys, and retention. Do not delete the Auth user first.

## Manual and deferred work

The RPC deliberately does not:

- delete or rewrite Auth accounts or email addresses;
- delete legacy `chat_logs` or rewrite their raw messages;
- redact `import_job_rows.raw_row`, matching details, or errors;
- delete avatar objects from the `avatars` bucket or any cached/migrated copies;
- identify a person in cabinet, ACE, gallery, event, House, or group media by name alone;
- change external forms, Google Drive, Google Photos, analytics providers, or browser-local state; or
- erase request notes or audit actors.

These categories need separate retention/legal-hold decisions, exact object or provider identifiers, and review that protects records involving other people. Clearing an avatar URL hides the profile reference but does not prove the object or cached copies were removed.

## Post-migration SQL checks

Run these checks in a non-production Supabase environment with synthetic users and members. Never paste real identifiers, emails, request text, or returned private data into tickets or logs.

1. As anon and as an ordinary authenticated user, call both RPCs and confirm PostgreSQL error `42501` with only the generic unavailable message.
2. As an admin, create a synthetic anonymization request. Confirm preview returns blockers for each of: unverified status, unapproved status, missing processor/reviewer, mismatched explicit IDs, ambiguous Auth-member links, and an admin subject.
3. Approve the synthetic request and call preview. Confirm the response contains counts, booleans, blockers, and deferred-action descriptions only—no names, emails, notes, messages, URLs, check-in codes, or raw rows.
4. Record before-counts and sums for member/Auth attendance, member/Auth points, and House memberships. Execute anonymization, then confirm those counts, sums, foreign keys, House values, point totals, and event counts are unchanged.
5. Confirm profile display/avatar/optional Discord fields are scrubbed without changing `id`, `email`, or `is_admin`.
6. Confirm the explicit member remains at the same UUID with `Deleted Member`, null contact/demographic/Auth fields, and unchanged House, points, and event count.
7. Confirm direct feedback identity fields are null and feedback text was not returned by either RPC.
8. Confirm one counts-only `anonymization_completed` event was appended. Confirm the request status was automatically set to `completed`.
9. Run the execution RPC again before completing the request. Confirm the member remains anonymized, no history changes, and the second audit event contains counts only.
10. Mark the request completed through the tracker only after manual media/provider and retention follow-ups are recorded.

## Rollback and incident response

This migration is forward-only. Do not attempt to reconstruct scrubbed identity fields from attendance, points, import rows, logs, or audit metadata. If execution affects the wrong synthetic subject, stop, preserve the request/event audit trail, revoke execute permission on `anonymize_data_rights_subject`, and investigate the saved explicit identifiers and approval chain. Production restoration, if legally and operationally appropriate, must use an approved backup and incident process—not ad hoc copying from other private stores.
