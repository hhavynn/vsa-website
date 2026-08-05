# Implementation plan — issue #356

**Branch:** `codex/issue-356-security-policy` · **Base:** `origin/main` @ `dd2d585c`

## Problem

The repo went public 2026-07-31. There is no `SECURITY.md` and no private way to report a vulnerability. A good-faith researcher's only visible option is a **public issue** — on a repo whose backend is a live Supabase instance holding real student data. That is the worst possible outcome and it is the current default.

## Already done by the controller (do not redo)

**GitHub private vulnerability reporting is now ENABLED** (verified: `gh api repos/hhavynn/vsa-website/private-vulnerability-reporting` → `enabled: true`). The "Report a vulnerability" button exists on the Security tab. `SECURITY.md` can safely link it.

## Recommended decision (DECIDED)

**GitHub private vulnerability reporting is the primary and only reporting channel.**

Reason: the repository and site publish **no email address anywhere** — the footer links only Instagram (`@vsaatucsd`). Do **not** invent, guess, or placeholder an email. A fabricated or `TODO` contact in a public security policy is worse than none: it silently drops reports. GitHub's channel needs no address and is now live.

Mention Instagram DM only as a last-resort way to *make contact*, explicitly not a way to transmit vulnerability details.

## Files to change

Exactly one new file: **`SECURITY.md`** at the repo root. (Root, not `.github/` — GitHub honors both, and root is more discoverable to someone browsing a public repo.)

## Required content

- **How to report:** the GitHub private advisory path, as the primary channel, with the repo's Security-tab link.
- **In scope:** the deployed site (`vsaatucsd.com`), the Supabase Edge Functions, RLS policy gaps, exposed credentials, and authentication/authorization flaws.
- **Out of scope**, each with a *reason*, not just a list:
  - Known transitive CRA dependency advisories — point at the triage rule in `.github/workflows/deploy.yml` (see its comment block) rather than restating it.
  - Missing security headers already tracked in #205, #219, #224.
  - Anything already filed as an open issue.
  - Findings that require physical access, social engineering of members, or account takeover of a real student.
- **Response expectations, stated honestly.** This is a volunteer student organization with no on-call rotation. Say acknowledgement is on a best-effort basis within about a week. **Do not promise 24/48 hours.** An honest slow number beats a fast lie.
- **No bug bounty.** State plainly and early that there is no payment, so nobody invests time expecting one.
- **Testing boundaries:** no load/stress testing, no attempts against real member accounts, no data exfiltration to "prove" a finding, no automated scanning that degrades the site for students. Ask for a minimal proof of concept.
- **Safe harbour:** good-faith research following these rules will not be pursued. Keep it short and plain — this is what makes researchers willing to report at all.

## Non-goals

- Do **not** invent an email address, a phone number, or any individual's name.
- Do **not** enumerate unfixed weaknesses in exploitable detail. Reference issue numbers only. This file is read by attackers too.
- Do **not** edit `.github/CONTRIBUTING.md`, the README, workflows, or any source file.
- Do **not** add a `CODE_OF_CONDUCT.md` (out of scope here).
- No source, test, or migration changes.

## Style

Match the repo's documentation voice: direct, concrete, no corporate boilerplate, no emoji. Short sections with headings. It will be read by strangers under time pressure — optimize for scanability.

## Security considerations

Public file. No secrets, no internal URLs, no project refs, no infrastructure detail beyond what is already public. Do not name individuals.

## Verification Codex must run

```
git --no-pager diff --stat
git status --short
```

Required: `SECURITY.md` is the **only** new/changed file. Nothing else touched.

## Definition of completion

`SECURITY.md` exists at the root with every element above, links the GitHub private advisory channel as primary, contains no invented contact details and no `TODO`, and is the only changed file. `codex-result.md` written.
