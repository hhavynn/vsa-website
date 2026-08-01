# Antigravity Implementation Report — Issue #329

**Agent:** Antigravity (Claude Sonnet 4.6 Thinking)  
**Date:** 2026-07-31  
**Branch:** `codex/expand-contributing-guide`  
**Status:** ✅ Complete — no blockers

---

## What was changed

**Only file modified:** `.github/CONTRIBUTING.md`

A new section `## Dependencies and the lockfile` was inserted after the existing `## Branch naming` section and before `## Dual points systems`, as directed by the spec. The section adds six bullet points covering the repo's dependency and lockfile policy.

### Added content (verbatim)

```markdown
## Dependencies and the lockfile

- **Use `npm ci` for setup and in CI** — it installs from `package-lock.json` exactly and never modifies it. Use `npm install` only when you are intentionally changing which packages are installed.
- **Lockfile changes go in their own commit**, never mixed into a feature diff. A PR that changes `package-lock.json` alongside feature code makes the lockfile diff unreviable.
- **Adding a dependency requires explicit justification** — small, actively maintained, and worth the bundle cost. See issue #300 for bundle-size tracking. `AGENTS.md` prohibits adding heavy dependencies without explicit justification.
- **Never run `npm run eject`** — ejecting CRA is permanent and irreversible (`AGENTS.md`: "Things to never do").
- **Major upgrades of `react-scripts`, `react-query`, `typescript`, or `tailwindcss` are `vsa-change-control` items** (see issue #301) — they are high-risk framework changes and must never happen casually. Follow the `vsa-change-control` gating path documented in `AGENTS.md`.
- **Dependabot** (issue #230, not yet merged) will open automated dependency-bump PRs when that work lands. Merging a Dependabot PR is a judgement call — read the diff, check the changelog, and verify CI passes before merging.
```

---

## Verification command output

Commands run exactly as specified in the spec's "Commands you must run" section:

```
$ git diff --check
(no output — no whitespace errors)

$ git status --short
 M .github/CONTRIBUTING.md
?? .agent-handoff/
```

`git diff --check` exited with code 0 (no issues). `git status --short` shows exactly one modified tracked file: `.github/CONTRIBUTING.md`. The `.agent-handoff/` entry is pre-existing untracked content, not introduced by this change. `package-lock.json` is untouched.

---

## AGENTS.md line-by-line claim verification

Each factual claim in the added section was verified against `AGENTS.md` (read in full) before writing.

| Claim in section | AGENTS.md source | Verified? |
|---|---|---|
| `npm ci` for setup/CI; `npm install` only when changing deps | CONTRIBUTING.md line 8 (pre-existing); CI confirmed via `.github/workflows/deploy.yml` line 36: `run: npm ci` | ✅ Existing repo behavior |
| Lockfile changes in their own commit, never mixed into a feature diff | Not in AGENTS.md verbatim — stated as standard git hygiene consistent with AGENTS.md line 257: "PRs are small and focused — one feature or fix per PR. No bundled unrelated changes." | ✅ Consistent with existing policy |
| Adding a dependency requires explicit justification | **AGENTS.md line 280:** `"Don't add heavy dependencies without explicit justification."` | ✅ Direct source |
| Never run `npm run eject` | **AGENTS.md line 286:** `"Don't run \`npm run eject\`. Ejecting CRA is permanent."` — verbatim match | ✅ Direct source |
| Major upgrades are `vsa-change-control` items | **AGENTS.md line 33:** high-risk changes require `vsa-change-control`. Major framework upgrades are inherently high-risk ("destructive/irreversible/production actions" per line 39). The specific packages (react-scripts, react-query, typescript, tailwindcss) are the project's core framework listed in **AGENTS.md line 11** as the tech stack | ✅ Derived from risk classification + tech stack |
| Dependabot (issue #230, not yet merged) | No Dependabot config exists in `.github/` — confirmed by directory listing. Referenced as "not yet merged", which is accurate. This is a cross-reference to an existing issue, not a factual claim invented from AGENTS.md | ✅ Verifiable from repo state |
| Issue #300 for bundle-size tracking | Referenced as an issue number for tracking context, not a factual claim sourced from AGENTS.md. `npm run analyze` (bundle analysis) exists per **AGENTS.md line 124** | ✅ Consistent |
| Issue #301 for change-control reference | Referenced as an issue number, not a factual claim sourced from AGENTS.md | ✅ Cross-reference only |

---

## Assumptions made

1. **Lockfile commit discipline** — AGENTS.md does not explicitly state "lockfile changes in their own commit," but this is directly consistent with AGENTS.md line 257 ("PRs are small and focused — one feature or fix per PR. No bundled unrelated changes") and is the standard meaning of the policy described in the issue. Stated assumption in report.

2. **Major upgrade framing** — AGENTS.md does not name react-scripts, react-query, typescript, and tailwindcss specifically as `vsa-change-control` items. However, these are the core framework packages (listed in AGENTS.md line 11), and AGENTS.md line 33 defines high-risk changes as those requiring `vsa-change-control`. Major version bumps of these packages are inherently high-risk. The spec explicitly instructs this claim be included and references issue #301 as authority. Framed accordingly.

3. **Insertion point** — spec says "after Branch naming, before Dual points systems" as the preferred location, or "wherever reads best" as a judgment call. The preferred location was used as it reads naturally.

---

## Non-goals confirmed

- `npm install`, `npm ci`, `npm audit fix` were **not run**. `package-lock.json` is untouched.
- No dependencies were added or upgraded.
- No other files were modified.
- No branches, commits, pushes, or PRs were created.
- No policy was invented beyond what traces to AGENTS.md or existing repo behavior.

---

## Blockers encountered

None. All claims verified or safely assumable per spec guidance. No merge conflicts in CONTRIBUTING.md. `git status` before editing confirmed a clean worktree (only `.agent-handoff/` untracked, which is pre-existing).
