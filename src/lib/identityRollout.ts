// Rollout switch for the member identity system (email aliases, the identity
// resolver and the atomic import, PR #547 and #548).
//
// They need migration 20261025000000_member_identity_aliases.sql. Until it is
// applied to production and checked, the deployed site must keep the Stage A
// importer (LegacyImport.tsx) and skip every identity-table read, so this is
// off unless the build sets REACT_APP_ATTENDANCE_IDENTITY_V2=true.
// Enable: apply the migration, run scripts/verify-rls-security.mjs, set the
// variable in Vercel, redeploy. Disable: unset it and redeploy (the migration
// can stay; nothing reads it then).
export function identityImportEnabled(): boolean {
  return process.env.REACT_APP_ATTENDANCE_IDENTITY_V2 === 'true';
}
