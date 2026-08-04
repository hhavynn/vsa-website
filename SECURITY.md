# Security Policy

This project does not run a paid bug bounty program. Please do not spend time on this work expecting payment.

## Reporting a Vulnerability

Use GitHub private vulnerability reporting for this repository:

https://github.com/hhavynn/vsa-website/security/advisories/new

Do not open a public GitHub issue for a vulnerability. Public reports can put member data and the live site at risk.

If GitHub private reporting is unavailable and you only need to make contact, use Instagram `@vsaatucsd` to ask for a maintainer to open a private channel. Do not send vulnerability details over Instagram.

Please include a short summary, the affected surface, a minimal proof of concept, and any screenshots or logs with private data removed.

## In Scope

- The deployed site at `vsaatucsd.com`.
- Supabase Edge Functions used by this project.
- Row Level Security (RLS) policy gaps.
- Exposed credentials or secrets.
- Authentication or authorization flaws.

## Out of Scope

- Known transitive Create React App dependency advisories. Reason: the CI security job already treats recurring transitive CRA advisories as background noise and applies the triage rule documented in `.github/workflows/deploy.yml`.
- Missing security headers already tracked in #205, #219, and #224. Reason: those are known hardening issues, so duplicate reports do not help.
- Anything already filed as an open issue. Reason: maintainers are already tracking it; if you have new sensitive impact information, report privately and reference only the issue number.
- Findings that require physical access, social engineering of members, or account takeover of a real student. Reason: those actions are outside authorized testing and can harm real people.

## Testing Boundaries

Do not run load or stress tests. Do not attempt to access real member accounts. Do not exfiltrate data to prove a finding. Do not run automated scanning that degrades the site for students.

Use the smallest proof of concept that demonstrates the issue without exposing private data.

## Response Expectations

This is a volunteer student organization with no on-call rotation. Acknowledgement is best effort, about a week.

We prioritize reports based on risk to members, the deployed site, and private data.

## Safe Harbor

Good-faith research that follows this policy, stays within scope, avoids privacy harm, and reports privately will not be pursued.
