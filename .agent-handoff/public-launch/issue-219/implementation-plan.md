# Implementation plan — issue #219

**Title:** Fix HSTS: vercel.json ships max-age=0 while docs specify a 1-year policy
**Branch:** `codex/issue-219-hsts-doc`
**Worktree:** `C:/Users/xiate/Documents/CS/vsa-worktrees/issue-219`
**Base:** `origin/main` @ `dd2d585c`
**Parent epic:** #205

## User-facing problem

`vercel.json` sends `Strict-Transport-Security: max-age=0`. `docs/security-headers-and-csp.md` documents the policy as `max-age=31536000; includeSubDomains`. The two disagree, so nobody reading the repo can tell what the intended transport-security posture is.

## Public-launch impact

The repo is now public. A stale security doc that contradicts shipped config is worse than no doc: a contributor or auditor reading `docs/security-headers-and-csp.md` will believe HSTS is enforced for a year when it is explicitly disabled. This issue is labeled `blocks:public-launch` for that reason.

## THE CRITICAL FINDING — read before doing anything

**The issue's premise is inverted. `max-age=0` is correct and must NOT be changed.**

Git evidence, conclusive:

- Commit `ac484dbd`, 2026-07-08 — *"fix: set HSTS max-age to 0 to prevent captive portal blocking (#187)"*
- PR #187, **merged** 2026-07-08T20:30:11Z, authored by the repo owner, titled *"fix: clear HSTS max-age to prevent captive portal blocking"*

PR #187's stated rationale, verbatim in substance: a cached 1-year HSTS policy caused browsers to reject captive-portal interception on campus Wi-Fi (`UCSD-GUEST`), throwing a fatal `net::ERR_CERT_AUTHORITY_INVALID` and locking students out until they used a workaround like visiting `neverssl.com`. Setting `max-age=0` clears the cached policy and lets captive-portal detection work.

Prior history for completeness: `2f3a89a1` (2026-06-20) introduced `max-age=31536000; includeSubDomains`; `ac484dbd` (2026-07-08) replaced it with `max-age=0`; `7f51c43d` (2026-07-10) restructured `vercel.json` and preserved `max-age=0`.

Issue #219 anticipated exactly this branch and prescribed the action:

> If it was intentional, the fix is to update the doc and add a dated note explaining why — not to bump the value.

## Recommended product decision (DECIDED — implement this, do not re-open it)

**Keep `max-age=0` in `vercel.json`. Change only `docs/security-headers-and-csp.md` so it matches shipped reality and records why.**

Reasoning:
1. The config resolved a real, reproduced, user-facing outage for the exact population this site serves — UCSD students on campus Wi-Fi.
2. HSTS is the most irreversible header on the list. Browsers honor the advertised lifetime and it cannot be recalled. Raising it re-creates the #187 lockout with a tail of up to a year.
3. "Doc describes intent, therefore config is wrong" is an assumption; the merged PR is evidence. Evidence wins.
4. Keeping `max-age=0` and documenting it is the safe, reversible direction. Raising it is not reversible.

The `blocks:public-launch` requirement is satisfied by *the repo telling the truth about its transport posture*, not by enabling HSTS.

## Confirmed requirements → how this plan satisfies them

| Acceptance criterion from #219 | Resolution |
| --- | --- |
| Determine whether `max-age=0` was deliberate (git blame + owner confirmation), record the answer in the PR | Done above. Owner confirmation is satisfied by the repo owner's own merged PR #187 stating the rationale. Will be restated in the PR body. |
| Confirm every production subdomain serves valid HTTPS **before** raising `max-age` | **N/A — not raising.** |
| If raising: ramp `max-age=300` → verify → `31536000` | **N/A — not raising.** |
| `vercel.json` and `docs/security-headers-and-csp.md` agree | This is the whole change: doc updated to match config. |
| Verified on a Vercel preview with `curl -I` before promoting | **N/A** — no header value changes, so there is no header behavior to verify. Stated explicitly in the PR. |

## Explicit non-goals

- **Do not modify `vercel.json`.** Not one character.
- Do not add `preload` anywhere (issue guardrail: deliberately omitted).
- Do not fix the doc's stale description of a "legacy `routes` array" at line 15 — `vercel.json` now uses a `headers` array. That structural drift is **#220's** scope. Touching it here mixes two issues into one PR.
- Do not touch the CSP sections (#221–#224 own those).
- Do not restructure, reformat, or reflow the rest of the document.
- No application source changes. No test changes. No migrations.

## Relevant existing behavior

`vercel.json` (on `origin/main`) sends five global headers on `source: "/(.*)"`: `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` (9 capabilities disabled), `X-Frame-Options: DENY`, `Strict-Transport-Security: max-age=0`. Only the last one is misdocumented.

## Graphify findings

Not applicable and not required. This is a two-file question (`vercel.json`, one doc) already located with certainty via `git log -p --follow`. Per `CLAUDE.md`, Graphify is for structural/ownership questions before broad search; scope here is already known, so broad search would be waste. Codex should still run the version check per standing workflow but must not spend effort on graph queries for this issue.

## Relevant source files

- `docs/security-headers-and-csp.md` — **the only file to change.** HSTS row is line 13; the header table runs roughly lines 8–13.
- `vercel.json` — **read-only reference. Do not edit.**

## Existing patterns to follow

The document is a prose-and-table security policy doc. It already contains a "CSP rollout decision" section (line 17+) that records a deliberate decision and its reasoning. **Mirror that established pattern** for the HSTS decision rather than inventing a new format.

## Domain playbook

`.claude/agents/vsa-docs-acceptance.md` — docs-only, does not change app behavior. Correct owner for this change.

Also consult (guidance, not authority): the `vsa-config-and-flags` skill, named as the owning skill in the issue body.

## Expected files to change

Exactly one: `docs/security-headers-and-csp.md`

## What the change must contain

1. **Update the HSTS row** in the header table so the documented value is `max-age=0` and the description states plainly that HSTS is intentionally disabled — not merely "set to zero". A reader skimming the table must not come away thinking HSTS is on.
2. **Add a dated decision note** in the same style as the existing "CSP rollout decision" section. It must record:
   - The decision: HSTS is intentionally disabled.
   - The date and authority: PR #187, merged 2026-07-08.
   - The reason: cached 1-year HSTS caused `net::ERR_CERT_AUTHORITY_INVALID` on `UCSD-GUEST` captive-portal Wi-Fi, locking students out.
   - The tradeoff, stated honestly: the site does not get HSTS protection against SSL-stripping / downgrade attacks. This is a **known, accepted** tradeoff, not an oversight.
   - What would have to be true to revisit it: a way to keep captive-portal detection working, e.g. a short ramped `max-age` validated against campus Wi-Fi, verified on a Vercel preview first.
   - That `preload` remains deliberately omitted.
3. **Keep it factual.** Do not assert anything about subdomain HTTPS coverage that has not been verified — no such verification was performed and none is needed, because the value is not being raised.

## Database, API, and type implications

None. Documentation only.

## Security and privacy considerations

- This PR **reduces** a security-documentation defect; it does not change runtime security posture at all.
- The accepted tradeoff (no HSTS) must be stated explicitly so it is a recorded decision rather than a silent gap. Do not soften it.
- Do not include any secret, token, project ref, or internal URL in the doc.
- The repo is public. Write for an external reader.

## Accessibility / mobile requirements

None — no UI change.

## Migration / deployment implications

None. No header value changes, so no deploy-order concern and nothing to verify on a preview. `vercel.json` is untouched, so production behavior is bit-for-bit identical.

## Tests to add or update

None. There is no test harness for documentation, and adding one is out of scope.

## Focused verification (Codex must run these in the worktree)

```
git --no-pager diff --stat
git --no-pager diff -- vercel.json
git status --short
```

Required results:
- `git diff --stat` shows **exactly one** changed file: `docs/security-headers-and-csp.md`.
- `git diff -- vercel.json` produces **empty output**. This is the single most important check in this issue.
- No untracked files other than anything under `.agent-handoff/`.

## Broader verification (controller runs)

`npm run lint` and `npm test` are not meaningfully affected by a markdown-only change, but the controller will run the repo's standard checks to confirm the branch is not broken relative to base, and will distinguish any pre-existing failure from a branch-introduced one.

## Manual testing scenarios

Read `docs/security-headers-and-csp.md` top to bottom as (a) a new contributor and (b) an external security auditor. In both readings the transport posture must be unambiguous: HSTS is off, on purpose, for a stated reason, with a stated tradeoff.

## Safe assumptions Codex may make

- PR #187's rationale is accurate and authoritative; do not re-litigate it.
- The doc's existing structure, heading style, and table format are correct and should be preserved.
- Markdown table formatting in the surrounding rows is the style to match.
- The existing "CSP rollout decision" section is the correct stylistic template for the new note.

## Conditions constituting a genuine blocker

- Any indication in the repository that `vercel.json`'s HSTS value has changed since `dd2d585c`.
- Discovering that `docs/security-headers-and-csp.md` does not contain the HSTS row described above.

Anything else — wording, note placement, heading level — is Codex's call within the plan.

## Exact definition of completion

`docs/security-headers-and-csp.md` is the only modified file; its HSTS row states `max-age=0` and describes HSTS as intentionally disabled; a dated decision note records PR #187, the captive-portal reason, the accepted tradeoff, the revisit conditions, and the continued omission of `preload`; `git diff -- vercel.json` is empty; `codex-result.md` is written.
