# Admin Role Assignment — review-only first phase (#768)

Route: /admin/member-roles (AdminRoute). Navigation: Programs & People → Role Assignment. Members → Bulk role matching reaches the same tool.

## Available now

1. Select a configured Cabinet academic year and a published source category: Executive/General Board (exact position retained), or Interns (never Board by default).
2. Paste comma-, semicolon- or newline-separated names. Explicit Last, First mode treats each line as one name. Limit: 150 names and 16,000 characters. Raw names remain in temporary tab state, not logs or persistent storage.
3. The existing useMemberDirectory/memberLookupRepository loads the complete safe directory in 1,000-row pages. Exact accent-insensitive matches are suggestions only. Even a unique match requires explicit human selection.
4. Select a real canonical member and existing year-matched Cabinet record. Missing source records cannot be fabricated here. Use manual search for differing names and resolve conflicts in Cabinet or Merge Review.
5. Open the exact Cabinet entry. In the Cabinet editor from PR #767, verify the person, academic year and original position, then save the member link. Verify the matching-year leaderboard from PR #766 after both PRs merge.

All sample names are fictional. Input “Ada Example, Bea Sample; Cai Example” yields three ordered rows. Duplicate “ada example” remains visible for review. Two exact “Bea Sample” candidates require an explicit choice. A source linked to somebody else is a conflict, not an invitation to overwrite. A missing official Board source requires Cabinet Rollover, not an invented Board credential.

## Deliberate boundary: this is NOT bulk Apply

This first slice contains no role mutations, no arbitrary badge table, no batch writes, no new schema, and no private role/House scoring reads. The final saving action remains in the existing authorized Cabinet editor. The search does not infer that someone on a private draft is a public Board member.

House Parent, ACE Fam Head and VCN participants have independent publication gates and approved source editors; those choices remain unavailable here. Intern cohort drafts cannot be treated as published Intern entries.

## Required next phase for true Apply Ready

Design a narrowly scoped administrator-authenticated batch link RPC. Revalidate source IDs, selected year, Board vs Intern category, member existence, expected old link, published status and concurrency on the server at write time; preserve unrelated roles and original roster data. Record bounded audit outcomes and idempotent per-row results. Verify that anon/non-admin cannot invoke it and perform staged SQL/privilege checks before any production rollout. Never implement Apply as a browser loop of unconstrained Cabinet updates.

## QA checklist

- AdminRoute, navigation, quick search, dashboard directory and breadcrumbs resolve to the guarded route.
- Complete directory matches a fictional member after the first 1,000 records; read failures block review.
- Commas/newlines/semicolons, explicit Last, First, duplicate rows, diacritics, same-name candidates and 150-person cap work.
- Switching roles/year clears stale choices; same source selected twice is a conflict; no client writes occur.
- Board source role titles stay exact, Interns are not Board and draft/future sources cannot be published by this UI.
- Test at 320px and desktop in both themes; verify keyboard selection and screen-reader status.
- With #767 and #766 merged, manually confirm that saving a legitimate published link yields a badge on any leaderboard rank for the correct academic year. All-Time deliberately hides year-specific roles.
