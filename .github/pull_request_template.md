## Summary
- 

## Type
- [ ] feat
- [ ] fix
- [ ] chore
- [ ] docs
- [ ] refactor
- [ ] test
- [ ] ci/build
- [ ] security

## Safety / Scope
- [ ] No unrelated files changed
- [ ] No secrets committed
- [ ] No private/admin data exposed
- [ ] No production Supabase mutation
- [ ] RLS/storage/auth changes documented, if applicable

## Supabase / Database
Complete the first item when this section is not applicable. Otherwise complete the remaining items before merge.

- [ ] N/A — no migration, RLS, grants, database function, Storage policy, or auth change
- [ ] Completed `supabase/migrations/MIGRATION_CHECKLIST.md`
- [ ] Recorded staging evidence or blockers from `docs/rls-verification-checklist.md`
- [ ] Confirmed this PR does not apply a migration to production
- [ ] Requested review from a maintainer with migration experience

## Verification
- [ ] npm run build
- [ ] npm run lint
- [ ] CI=true npm test -- --watchAll=false
- [ ] git diff --check
- [ ] Manual QA completed or blockers listed

## Screenshots / Notes
