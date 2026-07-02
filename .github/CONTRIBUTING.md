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

Before opening a PR, include verification results when applicable:

- `npm run build`
- `npm run lint`
- `CI=true npm test -- --watchAll=false`
- `git diff --check`

Do not commit secrets, generated local files, Graphify output, local settings, or unrelated changes.

Do not mutate production Supabase from a PR unless explicitly approved.
