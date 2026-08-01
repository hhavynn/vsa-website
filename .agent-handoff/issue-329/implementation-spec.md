# Issue #329 — Document the dependency and lockfile policy

## Objective
Add a short section to `.github/CONTRIBUTING.md` covering the repo's existing (undocumented) dependency and lockfile policy, so a contributor doesn't rewrite the lockfile or add a dependency casually.

## Confirmed requirements (from issue body, verified against AGENTS.md)
- `npm ci` for setup/CI; `npm install` only when intentionally changing dependencies.
- Lockfile changes belong in their own commit, never mixed into a feature diff.
- Adding a dependency needs justification (small, maintained, worth the bundle cost — reference issue #300 for bundle size tracking).
- `npm run eject` is forbidden — confirmed verbatim in `AGENTS.md` under "Things to never do": "Don't run `npm run eject`. Ejecting CRA is permanent."
- Major upgrades of `react-scripts`, `react-query`, `typescript`, or `tailwindcss` are `vsa-change-control` items (reference issue #301) — never casual.
- Note that Dependabot (issue #230, separate work, not yet merged) will open PRs and merging them is a judgement call, not automatic.
- State the Node version requirement: **Node 22** (already verified project-wide and documented elsewhere in this same file — see "Environment setup" section already present).

## Explicit non-goals
- Do NOT run `npm install` or `npm audit fix` — this must not touch `package-lock.json`.
- Do NOT mass-upgrade any dependency.
- Do NOT invent new policy. Every claim must trace to `AGENTS.md` or existing repo behavior (`package-lock.json` is already committed, CI already uses `npm ci` — verify via `.github/workflows/deploy.yml`).
- Do NOT restate other sections of CONTRIBUTING.md that already exist — this is an additive section only.

## Acceptance criteria
- [ ] New section in `.github/CONTRIBUTING.md` covering all six bullet points above.
- [ ] Every claim verified against `AGENTS.md` before writing (grep it, don't assume).
- [ ] `package-lock.json` is untouched (`git status` after the change must show only `.github/CONTRIBUTING.md` modified).
- [ ] Matches this file's existing house style: short, imperative, links to authority rather than restating it (see the existing "Protected domains" and "Never do this" sections in the same file for tone).

## Relevant existing architecture
`.github/CONTRIBUTING.md` already exists and was substantially expanded in this same PR branch (issue #295, not yet merged). It currently has these sections in order: intro, Environment setup, Protected domains, Freeze windows, Never do this, Branch naming, Dual points systems, PR title format, Pull request expectations. This new section should be inserted after "Branch naming" and before "Dual points systems" (or wherever reads best given the current file — use judgment, it's a short additive section, not a rewrite).

## Graphify findings
Not queried — this is a docs-only change with no source-code architecture question; the relevant facts are all in `AGENTS.md` and the issue body itself, not something Graphify's code graph would add to.

## Relevant source files
- `.github/CONTRIBUTING.md` — the only file to change.
- `AGENTS.md` — read-only, source of truth to verify claims against (do not edit).
- `package-lock.json` — must remain untouched (verify, don't edit).
- `.github/workflows/deploy.yml` — read-only, confirms CI already uses `npm ci` (grep for `npm ci`).

## Established implementation patterns to follow
Match the style already in this exact file (all six existing added sections were written in this same PR): short paragraphs or a tight bullet list, bold key terms, one blank line between items, no marketing language, no emoji headers. Look at the "Never do this" section already in the file as the closest style match (a short bulleted policy list).

## Data model or API implications
None. Docs-only.

## Security and privacy considerations
None. No credentials, tokens, or internal URLs are referenced by this issue.

## Expected files to change
- `.github/CONTRIBUTING.md` (the only file)

## Tests to add or update
None — docs-only change, no test suite covers markdown content.

## Commands you must run after making the change
```
git diff --check
git status --short
```
Confirm `git status --short` shows exactly one modified file: `.github/CONTRIBUTING.md`. Do not run `npm install`, `npm ci`, `npm audit fix`, lint, build, or test — none of them exercise markdown content and `npm install`/`npm audit fix` risk touching the lockfile, which is explicitly forbidden by this issue.

## Completion checklist
- [ ] Section added, inserted in a sensible place in the existing file
- [ ] Every factual claim verified against `AGENTS.md` (cite what you checked in your report)
- [ ] `package-lock.json` unchanged
- [ ] `git status --short` shows only `.github/CONTRIBUTING.md`
- [ ] Report written to `antigravity-result.md` summarizing what was added and what was verified

## Assumptions you may safely make
- The exact insertion point within the file (after "Branch naming", before "Dual points systems") can be adjusted slightly if a different order reads more naturally — this is a judgment call, not a hard requirement.
- Section heading wording is your call (e.g. "## Dependencies and the lockfile") as long as it's discoverable and matches the file's existing `##` heading style.

## Conditions that constitute a genuine blocker
- If any claim in the issue body cannot be verified against `AGENTS.md` (i.e., `AGENTS.md` says something different or doesn't mention it), stop and report the discrepancy rather than writing an unverified claim.
- If `.github/CONTRIBUTING.md` has merge conflicts or was changed unexpectedly since this spec was written, stop and report rather than guessing intent.
