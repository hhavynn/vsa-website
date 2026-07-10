# Contributing

## PR title format

All PR titles must use Conventional Commit style:

`type(scope optional): short description`

Allowed types:

`feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `style`, `perf`, `ci`, `build`, `revert`, `security`

Examples:

- `feat: add public calendar filters`
- `fix: correct leaderboard year selector`
- `chore: update GitHub workflows`
- `docs: update admin runbook`
- `ci: add PR title check`

## Pull request expectations

Keep PRs scoped and reviewable.

Before opening a PR, include proportional verification results. The definitive ownership model, final-gate matrix, acceptable warnings, manual-QA runbooks, and golden-test inventory live in `.claude/skills/vsa-validation-and-qa/SKILL.md`. Run `git diff --check` for every change; run lint, build, broader tests, security checks, and manual QA only when the changed artifacts and risk make them relevant. Do not repeat a successful check unless a later semantic change invalidated its evidence.

Do not commit secrets, generated local files, Graphify output, local settings, or unrelated changes.

Do not mutate production Supabase from a PR unless explicitly approved.
