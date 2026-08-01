## Problem

`vercel.json` sends `Strict-Transport-Security: max-age=0`. `docs/security-headers-and-csp.md` documented the policy as `max-age=31536000; includeSubDomains`. The two disagreed, so nobody reading the repo could tell what the intended transport-security posture actually was.

## The finding: the config was right, the doc was wrong

Issue #219 assumed the header was the defect and asked whether `max-age=0` might have been deliberate. **It was.** Git history settles it:

- Commit `ac484dbd` — *"fix: set HSTS max-age to 0 to prevent captive portal blocking (#187)"*
- **PR #187**, merged 2026-07-08, authored by the repo owner

PR #187's rationale: a cached one-year HSTS policy made browsers reject captive-portal interception on campus Wi-Fi (`UCSD-GUEST`), throwing a fatal `net::ERR_CERT_AUTHORITY_INVALID` and locking students out until they worked around it by visiting something like `neverssl.com`. Setting `max-age=0` clears the cached policy so captive-portal detection works.

Timeline: `2f3a89a1` (2026-06-20) introduced the one-year policy → `ac484dbd` (2026-07-08) replaced it with `max-age=0` → `7f51c43d` (2026-07-10) restructured `vercel.json` and preserved `max-age=0`.

## Recommended decision made

**Keep `max-age=0`. Fix the documentation instead.** Issue #219 explicitly prescribed this branch: *"If it was intentional, the fix is to update the doc and add a dated note explaining why — not to bump the value."*

Reasoning:

1. The current config resolved a real, reproduced outage for the exact population this site serves.
2. HSTS is the most irreversible header on the list — browsers honor the advertised lifetime and it cannot be recalled. Raising it would re-create the #187 lockout with a tail of up to a year.
3. "The doc describes intent, so the config is wrong" is an assumption. A merged PR with a written rationale is evidence.
4. Keeping `max-age=0` and documenting it is the safe, reversible direction.

## Public-launch impact

The repo is now public. A security doc that contradicts shipped config is worse than no doc — an external auditor reading it would believe HSTS is enforced for a year when it is explicitly disabled. This PR makes the repo tell the truth about its transport posture, which is what the `blocks:public-launch` label required here.

## Implementation

One file changed: `docs/security-headers-and-csp.md`.

- The `Strict-Transport-Security` table row now documents `max-age=0` and states plainly that HSTS is **intentionally disabled**, so a reader skimming the table cannot mistake it for enabled.
- A new **"HSTS decision"** section records the decision, PR #187 and its merge date, the captive-portal cause, the accepted tradeoff, and what would have to be true to revisit it. It deliberately mirrors the existing "CSP rollout decision" section's format rather than inventing a new one.

The tradeoff is stated honestly rather than softened: the site does not get HSTS protection against SSL-stripping or downgrade attacks. That is a known, accepted decision — now recorded instead of silent.

## Verification performed

```
git --no-pager diff --stat
 docs/security-headers-and-csp.md | 10 +++++++++-
 1 file changed, 9 insertions(+), 1 deletion(-)

git --no-pager diff -- vercel.json
(empty)

git status --short
 M docs/security-headers-and-csp.md
```

`git diff -- vercel.json` returning empty was the single most important check: **production header behavior is bit-for-bit unchanged.**

Not run, and not claimed to pass: `npm run lint`, `npm test`, `npm run build`. The diff is one markdown file and touches zero TypeScript, so none of them can be affected by it.

`curl -I` on a Vercel preview is listed in the issue's acceptance criteria but is conditional on raising `max-age`. No header value changed, so there is no header behavior to verify.

## Manual testing

Read the document end to end as a new contributor and as an external security auditor. Under both readings the posture is now unambiguous: HSTS is off, on purpose, for a stated reason, with a stated tradeoff.

## Accessibility considerations

None — no UI change.

## Security and privacy considerations

This PR does not change runtime security posture at all; it corrects a security-documentation defect. No secrets, tokens, project refs, or internal URLs were added. Written for an external reader, since the repo is public.

## Migration and deployment notes

None. `vercel.json` is untouched, so there is no deploy-order concern and nothing to promote or verify.

## Dependencies and merge order

None. Independent of every other open `blocks:public-launch` PR and safe to merge in any order.

## Remaining limitations

- The doc still describes `vercel.json` as using a legacy `routes` array; it now uses a `headers` array. That drift is **#220's** scope and was deliberately left untouched to avoid mixing two issues into one PR.
- Whether to reintroduce HSTS at a short, ramped `max-age` validated against campus Wi-Fi remains genuinely open. The new section records it as a revisit condition rather than closing the door.

Closes #219
