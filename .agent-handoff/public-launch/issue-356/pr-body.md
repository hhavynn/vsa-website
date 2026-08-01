## Problem

The repo went public on 2026-07-31 with no `SECURITY.md` and no private reporting channel. A researcher acting in good faith had exactly two options: open a **public issue** describing a vulnerability in a live app backed by real student data, or say nothing. The first is worse than the second, and it was the default, because the issue tracker was the only visible door.

## Recommended decision made

**GitHub private vulnerability reporting is the primary and only reporting channel.**

The repository and site publish **no email address anywhere** — the footer links only Instagram. Rather than invent an address or leave a `TODO`, this uses GitHub's channel, which needs no address. A fabricated or placeholder contact in a public security policy is worse than none: it silently drops real reports.

**Private vulnerability reporting has already been enabled** on the repository (verified `enabled: true`), so the link in this file is live rather than pointing at a disabled feature. That was a prerequisite, not part of the diff.

Instagram is mentioned only as a last resort to *make contact*, with an explicit instruction not to send vulnerability details there.

## Implementation

One new file, `SECURITY.md` at the repo root (root rather than `.github/` — more discoverable to someone browsing a public repo):

- **No bug bounty**, stated in the first line so nobody invests time expecting payment.
- **Reporting**: direct link to the private advisory form, an explicit "do not open a public issue," and what to include.
- **In scope**: deployed site, Edge Functions, RLS gaps, exposed credentials, authn/authz flaws.
- **Out of scope**, each with a stated *reason* rather than a bare list — including known transitive CRA advisories (pointing at the existing triage rule in `deploy.yml` rather than restating it) and header gaps already tracked in #205/#219/#224.
- **Response expectations**: honest. A volunteer student org with no on-call rotation, acknowledgement best-effort within about a week. Deliberately not a 24/48-hour promise it would not meet.
- **Testing boundaries**: no load testing, no real member accounts, no data exfiltration, no scanning that degrades the site for students.
- **Safe harbour**: short and plain, which is what actually makes researchers willing to report.

No unfixed weakness is described in exploitable detail — out-of-scope items reference issue numbers only, since attackers read this file too.

## Verification performed

```
git status --short
?? SECURITY.md
```

`SECURITY.md` is the only added file. Checked explicitly for invented contacts and placeholders (`mailto:`, `@gmail`, `@ucsd.edu`, `TODO`, `FIXME`, `[insert`) — **no matches**.

Not run and not claimed to pass: `npm test`, `npm run lint`, `npm run build`. One new markdown file at the repo root; none of them are affected.

## Security and privacy considerations

Public file. No secrets, internal URLs, project refs, infrastructure detail, or individuals' names. Written for a stranger reading under time pressure.

## Migration and deployment notes

None. Documentation only; nothing ships to the site.

## Dependencies and merge order

Independent. Safe to merge in any order.

## Does NOT close #356

Remaining criteria from the issue:

- Add a **Security contact link** under Settings → Features → contact links, so the private-report path is visible from the issue-creation screen where someone about to file publicly will see it. Repo setting, not a file.
- Note in `.github/CONTRIBUTING.md` that security reports do not go through normal issues or PRs.
- **Decide who actually receives and triages these reports.** An unmonitored channel is the same as no channel — this is an owner decision and the most important one left.

Refs #356
