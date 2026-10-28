import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import {
  checkAdminReadsUserProfiles,
  checkAnonCannotReadMemberPii,
  checkEventsHaveNoReadableCheckInCode,
  checkIsAdminUserHelper,
  checkNoRowsFromProtectedTable,
  checkOrdinaryUserRefusedBySmartMerge,
  checkPublicViewsOmitAuthUserId,
  checkRpcDeniedAtGrant,
  checkUserCannotWriteEventAttendance,
  checkUserCannotWriteUserPoints,
  checkUserProfilesNoRecursion,
  checkUserSeesOnlyOwnRows,
  classifyNoRowsUpdated,
  FAIL,
  PASS,
} from './lib/rlsIncidentChecks.mjs';

// Load environment variables from .env.local or .env if present
function loadEnv() {
  const envFiles = ['.env.local', '.env'];
  for (const envFile of envFiles) {
    const fullPath = path.resolve(process.cwd(), envFile);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const index = trimmed.indexOf('=');
          if (index !== -1) {
            const key = trimmed.substring(0, index).trim();
            const val = trimmed.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
            if (key && !process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\x1b[31mError:\x1b[0m Supabase URL and Anon Key must be provided in the environment or .env.local file.');
  console.error('Expected keys: VITE_SUPABASE_URL or REACT_APP_SUPABASE_URL, and VITE_SUPABASE_ANON_KEY or REACT_APP_SUPABASE_ANON_KEY');
  process.exit(1);
}

// Rollout phase of the member-account / code check-in retirement migration
// (supabase/migrations/20261003000000_retire_member_account_check_in.sql).
// This script runs against the hosted production project, so what it must
// assert depends on whether that migration has been applied there yet:
//   pre-migration  (default) legacy archives still behave as before: RLS keeps
//                  them closed to anon/ordinary users, admins keep their
//                  access, and admin manual check-in writes still work.
//   post-migration the archives and the retired RPCs are revoked from every
//                  API role, admins included. Reads must fail with 42501, and
//                  the ordinary-user and admin credentials are REQUIRED (the
//                  run fails, never skips, without them).
// Everything else is identical in both phases. Flip the phase (repo variable
// RLS_RETIREMENT_PHASE) only after the migration is applied; see
// docs/member-account-retirement.md.
const RETIREMENT_PHASES = ['pre-migration', 'post-migration'];
const retirementPhase = process.env.RLS_RETIREMENT_PHASE || 'pre-migration';
if (!RETIREMENT_PHASES.includes(retirementPhase)) {
  console.error(`\x1b[31mError:\x1b[0m RLS_RETIREMENT_PHASE must be one of ${RETIREMENT_PHASES.join(', ')} (got "${retirementPhase}").`);
  process.exit(1);
}
const retired = retirementPhase === 'post-migration';

// Rollout phase of the admin member lookup RPCs
// (supabase/migrations/20261009232329_admin_member_lookup_rpcs.sql), applied
// to production by hand after merge, like the retirement migration above:
//   pre-migration  (default) admin_lookup_members / admin_search_members may be
//                  absent; a missing function is a SKIP. Present ones are
//                  checked exactly as in post-migration.
//   post-migration both functions are REQUIRED for every audience: missing is
//                  a FAIL, and the ordinary-user and admin credentials are
//                  required (Historical Recovery is unusable without them, so
//                  "admins can call them" has to be proven, not skipped).
// Flip the phase (repo variable RLS_MEMBER_LOOKUP_PHASE) only after the
// migration is applied; see docs/rls-verification-checklist.md.
const lookupPhase = process.env.RLS_MEMBER_LOOKUP_PHASE || 'pre-migration';
if (!RETIREMENT_PHASES.includes(lookupPhase)) {
  console.error(`\x1b[31mError:\x1b[0m RLS_MEMBER_LOOKUP_PHASE must be one of ${RETIREMENT_PHASES.join(', ')} (got "${lookupPhase}").`);
  process.exit(1);
}
const lookupsRequired = lookupPhase === 'post-migration';

// House rollout phases, same two values: RLS_HOUSE_CACHE_PHASE for
// 20261028083000_restrict_public_members_house_cache.sql (#704) and
// RLS_HOUSE_EMBARGO_PHASE for 20261028073000_embargo_public_house_scores.sql
// (#692). Both default to pre-migration. An unknown value must not silently
// fall back to the weaker pre-migration contract.
for (const name of ['RLS_HOUSE_CACHE_PHASE', 'RLS_HOUSE_EMBARGO_PHASE']) {
  if (process.env[name] && !RETIREMENT_PHASES.includes(process.env[name])) {
    console.error(`\x1b[31mError:\x1b[0m ${name} must be one of ${RETIREMENT_PHASES.join(', ')} (got "${process.env[name]}").`);
    process.exit(1);
  }
}

// Fail closed. Before the migration the signed-in sections are optional (they
// SKIP without credentials). After it, "the archives are closed" has to be
// proven for every API audience, so an existing ordinary account and an
// approved admin account are both required: a run that skipped either would
// pass without having tested it. The same holds once the member lookup RPCs
// are required. Never create a public member account for this.
if (retired || lookupsRequired) {
  const requiredCredentials = [
    'RLS_TEST_USER_EMAIL',
    'RLS_TEST_USER_PASSWORD',
    'RLS_TEST_ADMIN_EMAIL',
    'RLS_TEST_ADMIN_PASSWORD',
  ];
  const missingCredentials = requiredCredentials.filter((name) => !process.env[name]);
  if (missingCredentials.length > 0) {
    console.error('\x1b[31mFAIL\x1b[0m post-migration verification requires an existing ordinary authenticated test account AND an approved admin account.');
    console.error(`Missing: ${missingCredentials.join(', ')}`);
    console.error('Provide existing accounts only; do not create a public member account to run this check.');
    process.exit(1);
  }
}

let hasFailed = false;

function reportPass(message) {
  console.log(`\x1b[32mPASS\x1b[0m ${message}`);
}

function reportFail(message) {
  console.log(`\x1b[31mFAIL\x1b[0m ${message}`);
  hasFailed = true;
}

function reportSkip(message) {
  console.log(`\x1b[33mSKIP\x1b[0m ${message}`);
}

// Incident regression checks (#227) live in scripts/lib/rlsIncidentChecks.mjs as
// pure functions that return results; this prints them.
function reportResults(results) {
  for (const { outcome, message } of results) {
    if (outcome === PASS) reportPass(message);
    else if (outcome === FAIL) reportFail(message);
    else reportSkip(message);
  }
}

function createAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function createUserClient() {
  const email = process.env.RLS_TEST_USER_EMAIL;
  const password = process.env.RLS_TEST_USER_PASSWORD;
  if (!email || !password) {
    return null;
  }
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in as ordinary user (${email}): ${error.message}`);
  }
  return client;
}

async function createAdminClient() {
  const email = process.env.RLS_TEST_ADMIN_EMAIL;
  const password = process.env.RLS_TEST_ADMIN_PASSWORD;
  if (!email || !password) {
    return null;
  }
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(`Failed to sign in as admin (${email}): ${error.message}`);
  }
  return client;
}

async function runTests() {
  console.log('============================================================');
  console.log('Running Supabase RLS / Security Hardening Verification');
  console.log(`Target database: ${supabaseUrl}`);
  console.log(`Retirement phase: ${retirementPhase}`);
  console.log(`Member lookup phase: ${lookupPhase}`);
  console.log(`House cache phase: ${process.env.RLS_HOUSE_CACHE_PHASE || 'pre-migration'}`);
  console.log(`House embargo phase: ${process.env.RLS_HOUSE_EMBARGO_PHASE || 'pre-migration'}`);
  console.log('============================================================\n');

  const dummyUuid = '00000000-0000-0000-0000-000000000000';
  // Synthetic probe values only; never a real member's email or name.
  const memberLookupRpcs = [
    ['admin_lookup_members', { p_emails: ['rls-verify-probe@example.invalid'], p_surnames: ['rlsverifyprobe'] }, '20261009232329'],
    ['admin_search_members', { p_query: 'rls-verify-probe', p_limit: 1 }, '20261009232329'],
  ];
  const isMissingFunction = (error) => !!error && (error.code === 'PGRST202' || error.code === '42883');
  // Absent before the migration is expected; absent after it breaks Historical Recovery.
  const reportMissingLookup = (fn, who) => {
    if (lookupsRequired) reportFail(`${fn} is missing for ${who} after the member lookup migration (20261009232329); Historical Recovery lookups fail`);
    else reportSkip(`${fn} is not present yet (migration 20261009232329 not applied)`);
  };
  const testEventId = process.env.RLS_TEST_EVENT_ID || dummyUuid;
  const allowMutations = process.env.RLS_ALLOW_MUTATION_TESTS === 'true';

  // #704: after the coordinated #701 Reveal identity + #704 cache-ACL
  // rollout, prove the retired cache is not exposed even by a guessed API
  // column. Never use a real member ID or export rows in test output.
  const houseCacheRestricted = process.env.RLS_HOUSE_CACHE_PHASE === 'post-migration';
  // The public member projection every client must still be able to read.
  // After #704 the legacy house column leaves it; verifyHouseCacheDenied
  // asserts that column is denied.
  const publicMemberColumns = [
    'id', 'first_name', 'last_name', 'college', 'year',
    ...(houseCacheRestricted ? [] : ['house']), 'points', 'events_attended',
  ].join(', ');
  async function verifyHouseCacheDenied(client, who) {
    if (!houseCacheRestricted) return;
    const { error: cacheError } = await client
      .from('public_members').select('house').limit(1);
    if (cacheError?.code === '42501') {
      reportPass(`${who} cannot read legacy public_members.house (#704)`);
    } else {
      reportFail(`${who} legacy public_members.house is not denied (#704): ${cacheError?.code ?? 'success'}`);
    }
    const { error: safeError } = await client
      .from('public_members').select('id, first_name, last_name, points').limit(1);
    if (safeError) reportFail(`${who} lost safe member projection reads (#704): ${safeError.code}`);
    else reportPass(`${who} retains public member identity and individual points (#704)`);
  }

  // #692 must be applied and verified in staging before enabling this mode.
  // Pre-migration environments retain the old contract until the cutover.
  const houseEmbargoRequired = process.env.RLS_HOUSE_EMBARGO_PHASE === 'post-migration';
  const houseScoreViews = [
    'house_yearly_points', 'house_all_time_points', 'house_recent_activity',
    'house_member_yearly_points', 'house_member_all_time_points',
  ];
  async function verifyHouseEmbargo(client, who) {
    if (!houseEmbargoRequired) return;
    for (const view of houseScoreViews) {
      const { error } = await client.from(view).select('*').limit(1);
      if (error?.code === '42501') reportPass(`${who} cannot SELECT private ${view} (#692)`);
      else reportFail(`${who} can SELECT, or cannot conclusively verify denial on, ${view} (#692): ${error?.code ?? 'success'}`);
    }
    const { error: rpcError } = await client.rpc('admin_private_house_standings', { p_year: 2026 });
    if (rpcError?.code === '42501') reportPass(`${who} cannot call private standings RPC (#692)`);
    else reportFail(`${who} private standings RPC was not denied with 42501 (#692): ${rpcError?.code ?? 'success'}`);
  }

  // Writes through public views (#472). Supabase's default privileges grant
  // ALL on every new view to anon and authenticated. A simple single-table
  // view is auto-updatable and runs as its owner, so a leftover write grant
  // lets clients write past the base table's RLS. With the grant revoked,
  // Postgres rejects the write with 42501 before touching a row.
  //
  // Non-destructive: each write is filtered on a nil key, and the same filter
  // is read first so a match aborts the probe. The base tables have only
  // row-level triggers, so a zero-row write fires nothing. Add new views here.
  const simpleViews = [
    'public_application_links',
    'published_ace_families',
    'published_house_page_assets',
    'published_intern_cohort_members',
    'published_vcn_archives',
    'my_member_photo_requests',
    'public_members',
  ];
  // Not auto-updatable: Postgres rejects writes with 55000 ("cannot update
  // view") before it checks grants, so the probe cannot see their grants and
  // reports them as skipped. If one becomes a simple view, it is probed for real.
  const nonUpdatableViews = [
    ['member_yearly_points', 'member_id'],
    ['house_member_yearly_points', 'member_id'],
    ['house_member_all_time_points', 'member_id'],
    ['house_yearly_points', 'house_profile_id'],
    ['house_all_time_points', 'house_profile_id'],
    ['house_recent_activity', 'event_id'],
    ['published_ace_family_members', 'id'],
    ['member_event_history', 'member_id'],
    ['public_member_avatars', 'member_id'],
  ];

  // withoutSelect: views this role is meant to be unable to read.
  async function expectViewWritesDenied(client, who, { withoutSelect = [] } = {}) {
    const notUpdatable = [];
    const probeTargets = [
      ...simpleViews.map((view) => [view, 'id', true]),
      ...nonUpdatableViews.map(([view, key]) => [view, key, false]),
    ];
    for (const [view, key, isSimple] of probeTargets) {
      const { data: matched, error: readError } = await client
        .from(view)
        .select(key)
        .eq(key, dummyUuid)
        .limit(1);
      if (readError?.code === 'PGRST205' || readError?.code === '42P01') {
        reportSkip(`${who} write probe on ${view} (view does not exist in this database)`);
        continue;
      }
      if (matched && matched.length > 0) {
        reportFail(`${who} write probe on ${view} not run: ${key} = ${dummyUuid} matches a row (#472)`);
        continue;
      }
      // Filtering or returning a column needs SELECT on it, so for a role that
      // cannot read the view a filtered UPDATE/DELETE is denied with 42501
      // whether or not the write grant exists. That 42501 proves nothing.
      const readDenied = readError?.code === '42501';
      if (readDenied && !withoutSelect.includes(view)) {
        reportFail(`${who} cannot read ${view} (42501), so its write grants could not be probed (#472)`);
        continue;
      }

      const writes = [];
      if (readDenied) {
        reportSkip(`${who} UPDATE/DELETE probe on ${view} (no SELECT by design, so a filtered write is denied either way; the signed-in run probes this view)`);
      } else {
        writes.push(
          ['UPDATE', client.from(view).update({ [key]: dummyUuid }).eq(key, dummyUuid).select(key)],
          ['DELETE', client.from(view).delete().eq(key, dummyUuid).select(key)],
        );
      }
      // A successful insert would create a row. A null id violates NOT NULL,
      // but only after BEFORE INSERT triggers run, so it stays gated. It has
      // no filter or RETURNING, so it needs no SELECT.
      if (allowMutations && isSimple) {
        writes.push(['INSERT', client.from(view).insert({ id: null })]);
      }
      if (writes.length === 0) continue;

      const failures = [];
      const denied = [];
      const rejectedAsNotUpdatable = [];
      for (const [verb, request] of writes) {
        const { error } = await request;
        if (error?.code === '42501') {
          denied.push(verb);
        } else if (error?.code === '55000') {
          rejectedAsNotUpdatable.push(verb);
        } else if (!error) {
          failures.push(`${verb} was allowed (matched no row; nothing changed)`);
        } else if (verb === 'INSERT' && error.code === '23502') {
          failures.push('INSERT passed the grant check; only NOT NULL on id stopped it');
        } else {
          failures.push(`${verb} failed for a non-authorization reason, so its grant was not verified: ${JSON.stringify(error)}`);
        }
      }

      if (failures.length > 0) {
        for (const failure of failures) {
          reportFail(`${who} write through ${view}: ${failure} (#472)`);
        }
      } else if (denied.length > 0) {
        reportPass(`${who} cannot ${denied.join('/')} through ${view} (42501, #472)`);
      } else {
        notUpdatable.push(`${view} (${rejectedAsNotUpdatable.join('/')})`);
      }
    }
    if (notUpdatable.length > 0) {
      reportSkip(`${who} write grants on views that are not auto-updatable (55000 is raised before any grant check: no write path, grants not visible): ${notUpdatable.join(', ')}`);
    }
  }

  // Post-migration only: these archives have no API audience, including
  // signed-in admins. A head-only read must be refused with 42501; an empty
  // result would only prove RLS, not the revoked grant. Catalog EXECUTE checks
  // for the retired RPCs belong to docs/member-account-retirement.sql: probing a
  // revoked mutation RPC directly would be unsafe if its grant regressed.
  async function expectRetiredArchivesDenied(client, who) {
    const archives = [
      ['event_attendance', 'id', false],
      ['user_points', 'user_id', false],
      ['event_check_in_secrets', 'event_id', false],
      ['check_in_codes', 'id', true],
      ['check_in_code_usage', 'id', true],
      ['check_ins', 'id', true],
    ];
    for (const [table, column, optional] of archives) {
      const { error } = await client.from(table).select(column, { head: true }).limit(1);
      if (error?.code === '42501') {
        reportPass(`${who} cannot read retired archive ${table}`);
      } else if (optional && ['42P01', 'PGRST205'].includes(error?.code)) {
        reportSkip(`${who} archive ${table} is absent from this database`);
      } else {
        reportFail(`${who} archive ${table} read was not denied: code=${error?.code ?? 'none'}`);
      }
    }
  }

  // ============================================================
  // 1. ANONYMOUS / PUBLIC CLIENT CHECKS
  // ============================================================
  console.log('--- 1. ANONYMOUS CLIENT CHECKS ---');
  try {
    const anon = createAnonClient();

    // Incident #227, 20260619040000_minimize_public_member_exposure.sql: anon read
    // every member's email and auth user_id from members. Each sensitive column
    // is probed on its own; the safe public projection is asserted readable below.
    reportResults(await checkAnonCannotReadMemberPii(anon));

    // Query members table - attempt to select safe public fields
    const { data: memSafeData, error: memSafeError } = await anon
      .from('public_members')
      .select(publicMemberColumns)
      .limit(1);

    if (memSafeError) {
      reportFail(`anon cannot select safe public columns from members: ${memSafeError.message}`);
    } else {
      reportPass('anon can read safe public member fields needed for leaderboard/House pages');
    }

    // Only count checks; values from private member tables never enter logs.
    const { error: quotaReadError, status: quotaReadStatus } = await anon
      .from('member_photo_upload_reservations')
      .select('request_id', { head: true }).limit(1);
    if ([401, 403].includes(quotaReadStatus) || quotaReadError?.code === '42501') {
      reportPass('anon cannot read photo upload reservations');
    } else {
      reportFail(`anon photo reservation SELECT was not denied: HTTP ${quotaReadStatus}, code=${quotaReadError?.code ?? 'none'}`);
    }

    if (retired) {
      await expectRetiredArchivesDenied(anon, 'anon');
    } else {
      // Incident #227, 20260619050000_check_in_code_secrets.sql and
      // 20260620000000_move_check_in_code_to_secrets_table.sql: check-in codes
      // moved into an admin-only table. Anon must get no rows from it.
      reportResults(await checkNoRowsFromProtectedTable(anon, {
        table: 'event_check_in_secrets', columns: 'event_id', who: 'anon',
      }));
    }

    // Incident #227, 20260619040000_minimize_public_member_exposure.sql: the
    // public member/House views carried auth user_id. They must not resolve it.
    reportResults(await checkPublicViewsOmitAuthUserId(anon, { who: 'anon' }));

    // Incident #227, 20260620000000_move_check_in_code_to_secrets_table.sql
    // (after 20260619000000 section C): check-in codes were readable from the
    // events row. The column must not be selectable by anon.
    reportResults(await checkEventsHaveNoReadableCheckInCode(anon, { who: 'anon' }));

    // Incident #227, 20260619000000_emergency_security_hardening.sql (section A):
    // user_profiles carried every email and is_admin flag. Anon gets no rows.
    reportResults(await checkNoRowsFromProtectedTable(anon, {
      table: 'user_profiles', columns: 'id', who: 'anon',
    }));

    // Incident #227, 20260620020000_fix_user_profiles_rls_recursion.sql: the admin
    // policy queried user_profiles from inside user_profiles ("infinite recursion",
    // 42P17). Anon evaluates the same policies and must not hit it.
    reportResults(await checkUserProfilesNoRecursion(anon, { who: 'anon', mustRead: false }));

    // Incident #227, 20260619000000_emergency_security_hardening.sql (section B)
    // and 20260620020000_fix_user_profiles_rls_recursion.sql: neither function is
    // executable by anon. Nil UUID arguments, so a regressed grant finds nothing.
    reportResults(await checkRpcDeniedAtGrant(anon, {
      fn: 'smart_merge_members', args: { p_source_id: dummyUuid, p_target_id: dummyUuid }, who: 'anon',
    }));
    reportResults(await checkRpcDeniedAtGrant(anon, {
      fn: 'is_admin_user', args: { p_user_id: dummyUuid }, who: 'anon',
    }));

    // Legacy archives before the retirement migration. Post-migration the strict
    // 42501 head reads in expectRetiredArchivesDenied replace these.
    if (!retired) {
      // Incident #227, 20260619000000_emergency_security_hardening.sql (section E)
      // and 20260620010000_harden_attendance_rls.sql: event_attendance was
      // "viewable by everyone" (every user UUID and points total); user_points
      // had direct client writes. Anon reads neither. A filtered anon write
      // cannot probe the grant (the filter itself needs SELECT), so the write
      // half is the mutation-gated signed-in probe below.
      reportResults(await checkNoRowsFromProtectedTable(anon, {
        table: 'event_attendance', columns: 'id', who: 'anon',
      }));
      reportResults(await checkNoRowsFromProtectedTable(anon, {
        table: 'user_points', columns: 'user_id', who: 'anon',
      }));
    }

    // content_health_state is admin-only (migration 20261004000000). A missing table means the
    // migration is not applied yet, which is a skip, not a pass. Writes are covered by
    // scripts/verify-content-health.sql on a local or staging database, not probed here.
    {
      const { data: chData, error: chError } = await anon.from('content_health_state').select('subject_key').limit(1);
      if (chError && (chError.code === 'PGRST205' || chError.code === '42P01')) {
        reportSkip('content_health_state is not present yet (migration 20261004000000 not applied)');
      } else if (chError) {
        reportPass(`anon cannot read content_health_state (${chError.message || chError.code})`);
      } else if (chData && chData.length > 0) {
        reportFail('anon read content_health_state successfully (returned rows)');
      } else {
        reportPass('anon cannot read content_health_state (returned empty list due to RLS)');
      }
    }

    // Member identity evidence (migration 20261026075912) holds private email aliases and
    // standings: no anon access at all. Missing tables or the function mean the migration is
    // not applied yet (a skip). Writes, merge and concurrency are covered offline by
    // scripts/test-member-identity.sh.
    {
      const missing = (error) => error && (error.code === 'PGRST205' || error.code === '42P01');
      for (const table of ['member_identity_emails', 'member_year_observations', 'attendance_import_requests']) {
        const { data, error } = await anon.from(table).select('*').limit(1);
        if (missing(error)) reportSkip(`${table} is not present yet (migration 20261026075912 not applied)`);
        else if (error) reportPass(`anon cannot read ${table} (${error.message || error.code})`);
        else if (data && data.length > 0) reportFail(`anon read ${table} successfully (returned rows)`);
        else reportPass(`anon cannot read ${table} (returned empty list due to RLS)`);
      }
      const { error: insertError } = await anon
        .from('member_identity_emails')
        .insert({ member_id: dummyUuid, email: 'rls-probe@example.com', source: 'admin', verification_method: 'admin_entered' });
      if (missing(insertError)) reportSkip('member_identity_emails is not present yet (migration 20261026075912 not applied)');
      else if (insertError) reportPass(`anon cannot add an email alias (${insertError.message || insertError.code})`);
      else reportFail('anon added an email alias');
      const { data: applyData, error: applyError } = await anon.rpc('admin_apply_attendance_import', { p_request: {} });
      if (isMissingFunction(applyError)) reportSkip('admin_apply_attendance_import is not present yet (migration 20261026075912 not applied)');
      else if (applyError) reportPass(`anon cannot run admin_apply_attendance_import (${applyError.message || applyError.code})`);
      else reportFail(`anon ran admin_apply_attendance_import (${JSON.stringify(applyData)})`);
    }

    // House Parent identity links (migration 20261026200000) are admin-only; public pages read
    // House Parents from published_house_page_assets instead. A missing table means not applied.
    {
      const { data: hpData, error: hpError } = await anon.from('house_parents').select('id, member_id').limit(1);
      if (hpError && (hpError.code === 'PGRST205' || hpError.code === '42P01')) reportSkip('house_parents is not present yet (migration 20261026200000 not applied)');
      else if (hpError) reportPass(`anon cannot read house_parents (${hpError.message || hpError.code})`);
      else if (hpData && hpData.length > 0) reportFail('anon read house_parents successfully (returned rows)');
      else reportPass('anon cannot read house_parents (returned empty list due to RLS)');
    }

    // ACE pickup-year evidence (migration 20261027190000) is admin-only; the public tree reads only
    // the approved pickup_* columns through published_ace_family_members. Missing objects = not applied.
    // Constraints, review flow and view projection are covered offline by scripts/test-ace-pickup-year.sh.
    {
      const missing = (error) => error && (error.code === 'PGRST205' || error.code === '42P01');
      const { data: peData, error: peError } = await anon.from('ace_member_pickup_evidence').select('id').limit(1);
      if (missing(peError)) reportSkip('ace_member_pickup_evidence is not present yet (migration 20261027190000 not applied)');
      else if (peError) reportPass(`anon cannot read ace_member_pickup_evidence (${peError.message || peError.code})`);
      else if (peData && peData.length > 0) reportFail('anon read ace_member_pickup_evidence successfully (returned rows)');
      else reportPass('anon cannot read ace_member_pickup_evidence (returned empty list due to RLS)');
      const { data: pyData, error: pyError } = await anon.rpc('set_ace_member_pickup_year', {
        p_ace_member_id: dummyUuid, p_academic_year_start: 2023, p_term: 'FA23', p_evidence_id: null,
      });
      if (isMissingFunction(pyError)) reportSkip('set_ace_member_pickup_year is not present yet (migration 20261027190000 not applied)');
      else if (pyError && (pyError.code === '42501' || pyError.message.includes('permission denied'))) reportPass(`anon cannot call set_ace_member_pickup_year (${pyError.message})`);
      else reportFail(`anon could call set_ace_member_pickup_year or got unexpected error: ${JSON.stringify(pyError || pyData)}`);
    }

    // Atomic House placement override (migration 20261027120000): EXECUTE is for authenticated only.
    {
      const { data: hoData, error: hoError } = await anon.rpc('admin_apply_house_placement_override', { p_batch_id: dummyUuid, p_changes: [], p_reason: 'RLS verify probe' });
      if (isMissingFunction(hoError)) reportSkip('admin_apply_house_placement_override is not present yet (migration 20261027120000 not applied)');
      else if (hoError && (hoError.code === '42501' || hoError.message.includes('permission denied'))) reportPass(`anon cannot call admin_apply_house_placement_override (${hoError.message})`);
      else reportFail(`anon could call admin_apply_house_placement_override or got unexpected error: ${JSON.stringify(hoError || hoData)}`);
    }

    // Historical attendance recovery (migration 20261009000026) is admin-only. A missing table or
    // function means the migration is not applied yet: a skip, not a pass. Writes, rollback and
    // concurrency are covered offline by scripts/test-attendance-recovery.sh, not probed here.
    {
      const { data: raData, error: raError } = await anon.from('import_recovery_actions').select('id').limit(1);
      if (raError && (raError.code === 'PGRST205' || raError.code === '42P01')) {
        reportSkip('import_recovery_actions is not present yet (migration 20261009000026 not applied)');
      } else if (raError) {
        reportPass(`anon cannot read import_recovery_actions (${raError.message || raError.code})`);
      } else if (raData && raData.length > 0) {
        reportFail('anon read import_recovery_actions successfully (returned rows)');
      } else {
        reportPass('anon cannot read import_recovery_actions (returned empty list due to RLS)');
      }

      const recoveryRpcs = [
        ['admin_import_recovery_findings', {}, '20261009000026'],
        ['admin_recover_import_row', { p_request_id: dummyUuid, p_row_id: dummyUuid, p_action: 'dismiss', p_reason_code: 'not_actionable', p_note: 'RLS verify probe' }, '20261009000026'],
        ...memberLookupRpcs,
      ];
      for (const [fn, args, migration] of recoveryRpcs) {
        const { data: rData, error: rError } = await anon.rpc(fn, args);
        if (isMissingFunction(rError) && migration === '20261009232329') {
          reportMissingLookup(fn, 'anon');
        } else if (isMissingFunction(rError)) {
          reportSkip(`${fn} is not present yet (migration ${migration} not applied)`);
        } else if (rError && (rError.code === '42501' || rError.message.includes('permission denied'))) {
          reportPass(`anon cannot call ${fn} (${rError.message})`);
        } else {
          reportFail(`anon could call ${fn} or got unexpected error: ${JSON.stringify(rError || rData)}`);
        }
      }
    }

    // Call get_data_rights_dependency_preview RPC
    const { data: rpc1Data, error: rpc1Error } = await anon.rpc('get_data_rights_dependency_preview', { p_request_id: dummyUuid });
    if (rpc1Error && (rpc1Error.code === '42501' || rpc1Error.message.includes('permission denied') || rpc1Error.message.includes('dependency preview is unavailable'))) {
      reportPass(`anon cannot call get_data_rights_dependency_preview (${rpc1Error.message})`);
    } else {
      reportFail(`anon could call get_data_rights_dependency_preview or got unexpected error: ${JSON.stringify(rpc1Error || rpc1Data)}`);
    }

    // Call generate_data_rights_export RPC
    const { data: rpc2Data, error: rpc2Error } = await anon.rpc('generate_data_rights_export', { p_request_id: dummyUuid });
    if (rpc2Error && (rpc2Error.code === '42501' || rpc2Error.message.includes('permission denied') || rpc2Error.message.includes('export is unavailable'))) {
      reportPass(`anon cannot call generate_data_rights_export (${rpc2Error.message})`);
    } else {
      reportFail(`anon could call generate_data_rights_export or got unexpected error: ${JSON.stringify(rpc2Error || rpc2Data)}`);
    }

    // Query data_rights_requests
    const { data: reqData, error: reqError } = await anon
      .from('data_rights_requests')
      .select('*')
      .limit(1);

    if (reqError) {
      reportPass(`anon cannot read data_rights_requests (${reqError.message || reqError.code})`);
    } else if (reqData && reqData.length > 0) {
      reportFail('anon read data_rights_requests successfully (returned rows)');
    } else {
      reportPass('anon cannot read data_rights_requests (returned empty list due to RLS)');
    }

    // Column/table grants closed by #384 (#379, #380, #382). These are grant
    // revokes, so a regression shows up as the select succeeding, not as rows.
    const deniedReads = [
      ['events', 'check_in_form_url', '#379'],
      ['member_event_attendance', 'id', '#380'],
      ['uvsa_schools', 'verification_notes', '#382'],
      ['uvsa_schools', 'confidence_level', '#382'],
      ['external_events', 'source_notes', '#382'],
      ['external_events', 'confidence_level', '#382'],
      ['external_events', 'show_on_network', '20261002060000'],
    ];
    for (const [table, column, issue] of deniedReads) {
      const { error } = await anon.from(table).select(column).limit(1);
      if (error?.code === '42501') {
        reportPass(`anon cannot select ${table}.${column} (${issue})`);
      } else {
        reportFail(`anon select ${table}.${column} was not denied (${issue}): ${JSON.stringify(error)}`);
      }
    }

    // Applications invariant (#273): the base table is admin-only, and the
    // public view carries a URL only for an open window. Only counts are
    // reported so a leaked URL never lands in a CI log.
    const { data: appBase, error: appBaseError } = await anon.from('application_links').select('id').limit(1);
    if (appBaseError || (appBase && appBase.length === 0)) {
      reportPass('anon cannot read application_links base table (#273)');
    } else {
      reportFail('anon read rows from application_links base table (#273)');
    }

    const { data: appView, error: appViewError } = await anon
      .from('public_application_links')
      .select('status, target_url');
    if (appViewError) {
      reportFail(`anon cannot read public_application_links: ${appViewError.message}`);
    } else {
      const leaked = (appView ?? []).filter((row) => row.status !== 'open' && row.target_url).length;
      if (leaked === 0) {
        reportPass('public_application_links exposes no URL for a non-open window (#273)');
      } else {
        reportFail(`public_application_links exposes ${leaked} URL(s) for non-open windows (#273)`);
      }
    }

    // Check-in stays server-authoritative and signed-in only (#381 / #385).
    const { error: checkInError } = await anon.rpc('check_in_to_event', { p_code: 'RLS-VERIFY-NOT-A-CODE' });
    if (checkInError?.code === '42501') {
      reportPass('anon cannot call check_in_to_event (#381)');
    } else {
      reportFail(`anon call to check_in_to_event was not denied (#381): ${JSON.stringify(checkInError)}`);
    }

    // my_member_photo_requests is readable by signed-in members only.
    await verifyHouseCacheDenied(anon, 'anon');
    await verifyHouseEmbargo(anon, 'anon');
    await expectViewWritesDenied(anon, 'anon', { withoutSelect: [
      'my_member_photo_requests', ...(houseEmbargoRequired ? houseScoreViews : []),
    ] });
  } catch (err) {
    reportFail(`Unexpected error during anon checks: ${err.message}`);
  }

  // ============================================================
  // 2. ORDINARY AUTHENTICATED USER CHECKS
  // ============================================================
  console.log('\n--- 2. ORDINARY AUTHENTICATED USER CHECKS ---');
  try {
    const userClient = await createUserClient();
    if (!userClient) {
      if (retired) reportFail('ordinary authenticated user checks cannot be skipped after the retirement migration');
      else reportSkip('ordinary authenticated user checks (email/password not provided in env)');
    } else {
      if (retired) await expectRetiredArchivesDenied(userClient, 'ordinary user');
      const authUser = (await userClient.auth.getUser()).data.user;

      for (const [table, columns] of [
        ['members', 'id, user_id'],
        ['member_event_attendance', 'id, imported_at'],
      ]) {
        const { count, error, status } = await userClient.from(table)
          .select(columns, { count: 'exact', head: true });
        if ([401, 403].includes(status) || error?.code === '42501' || (!error && count === 0)) {
          reportPass(`ordinary user cannot read raw ${table}`);
        } else {
          reportFail(`ordinary user raw ${table} read was not denied (HTTP ${status}, code=${error?.code ?? 'none'}, count=${count})`);
        }
      }
      const { error: publicMemberError } = await userClient.from('public_members')
        .select(publicMemberColumns, { head: true });
      if (publicMemberError) reportFail(`ordinary user cannot read public member projection: ${publicMemberError.code}`);
      else reportPass('ordinary user can read public member projection');

      if (!allowMutations) {
        reportSkip('ordinary user write probes (RLS_ALLOW_MUTATION_TESTS is not true)');
      } else {
      // Write probes are non-destructive: if RLS wrongly allows a write, the
      // probe still changes nothing. Inserts collide with a constraint that is
      // checked after RLS (unknown event -> 23503, existing row -> 23505), and
      // updates write a row's current values back with .select() so the
      // affected-row count is visible.
      const expectNoRowsUpdated = (label, data, error) => {
        reportResults([classifyNoRowsUpdated('ordinary user', label, data, error)]);
      };

      // Legacy archive write probes; post-migration the head-read check above
      // already proves the grants are gone.
      if (!retired) {
        // Incident #227, 20260619000000_emergency_security_hardening.sql (section D),
        // 20260620000000_move_check_in_code_to_secrets_table.sql and
        // 20260620010000_harden_attendance_rls.sql: users could write their own
        // attendance and points directly, bypassing check_in_to_event.
        reportResults(await checkUserCannotWriteEventAttendance(userClient, { userId: authUser.id, nilId: dummyUuid }));
        reportResults(await checkUserCannotWriteUserPoints(userClient, { userId: authUser.id }));
      }

      // Public tables: readable by everyone, writable only by admins.
      const publicWriteProbes = [
        { table: 'events', column: 'name' },
        { table: 'members', column: 'first_name' },
        { table: 'member_event_attendance', column: 'points_earned' },
      ];
      for (const { table, column } of publicWriteProbes) {
        const { data: rows } = await userClient.from(table).select(`id, ${column}`).limit(1);
        if (!rows || rows.length === 0) {
          reportSkip(`ordinary user ${table} update probe (no readable rows)`);
          continue;
        }
        const { data, error } = await userClient
          .from(table)
          .update({ [column]: rows[0][column] })
          .eq('id', rows[0].id)
          .select('id');
        expectNoRowsUpdated(table, data, error);
      }

      await verifyHouseCacheDenied(userClient, 'ordinary user');
      await verifyHouseEmbargo(userClient, 'ordinary user');
      await expectViewWritesDenied(userClient, 'ordinary user', {
        withoutSelect: houseEmbargoRequired ? houseScoreViews : [],
      });

      }

      // Incident #227, 20260619050000_check_in_code_secrets.sql and
      // 20260620000000_move_check_in_code_to_secrets_table.sql: check-in codes
      // must be unreachable by authenticated non-admins as well as by anon.
      // Post-migration the archive is revoked outright (head read above).
      if (!retired) {
        reportResults(await checkNoRowsFromProtectedTable(userClient, {
          table: 'event_check_in_secrets', columns: 'event_id', who: 'ordinary user',
        }));
      }

      // Incident #227, 20260620000000 (section D): a signed-in user could read
      // live codes from events.check_in_code after only anon was revoked.
      reportResults(await checkEventsHaveNoReadableCheckInCode(userClient, { who: 'ordinary user' }));

      // Incident #227, 20260619000000_emergency_security_hardening.sql (sections A
      // and E) and 20260620010000_harden_attendance_rls.sql: ordinary users see
      // only their own profile, attendance and points rows.
      reportResults(await checkUserSeesOnlyOwnRows(userClient, { table: 'user_profiles', ownerColumn: 'id', userId: authUser.id }));
      if (!retired) {
        reportResults(await checkUserSeesOnlyOwnRows(userClient, { table: 'event_attendance', ownerColumn: 'user_id', userId: authUser.id }));
        reportResults(await checkUserSeesOnlyOwnRows(userClient, { table: 'user_points', ownerColumn: 'user_id', userId: authUser.id }));
      }

      // Incident #227, 20260620020000_fix_user_profiles_rls_recursion.sql: policy
      // evaluation must not recurse, and is_admin_user() answers false for them.
      reportResults(await checkUserProfilesNoRecursion(userClient, { who: 'ordinary user', mustRead: true }));
      reportResults(await checkIsAdminUserHelper(userClient, { who: 'ordinary user', expected: false }));

      // Incident #227, 20260619000000_emergency_security_hardening.sql (section B):
      // smart_merge_members must refuse a non-admin. Nil ids; never real members.
      reportResults(await checkOrdinaryUserRefusedBySmartMerge(userClient, { nilId: dummyUuid }));

      // Attempt to read data-rights request rows
      const { data: userReqData, error: userReqError } = await userClient
        .from('data_rights_requests')
        .select('*')
        .limit(1);

      if (userReqError) {
        reportPass(`ordinary user cannot read data_rights_requests (${userReqError.message || userReqError.code})`);
      } else if (userReqData && userReqData.length > 0) {
        reportFail('ordinary user read data_rights_requests successfully!');
      } else {
        reportPass('ordinary user cannot read data_rights_requests (returned empty list due to RLS)');
      }

      // Attempt to call data-rights preview/export RPCs
      const { data: uRpc1Data, error: uRpc1Error } = await userClient.rpc('get_data_rights_dependency_preview', { p_request_id: dummyUuid });
      if (uRpc1Error && (uRpc1Error.code === '42501' || uRpc1Error.message.includes('permission denied') || uRpc1Error.message.includes('dependency preview is unavailable'))) {
        reportPass(`ordinary user cannot call get_data_rights_dependency_preview (${uRpc1Error.message})`);
      } else {
        reportFail(`ordinary user could call get_data_rights_dependency_preview or got unexpected error: ${JSON.stringify(uRpc1Error || uRpc1Data)}`);
      }

      const { data: uRpc2Data, error: uRpc2Error } = await userClient.rpc('generate_data_rights_export', { p_request_id: dummyUuid });
      if (uRpc2Error && (uRpc2Error.code === '42501' || uRpc2Error.message.includes('permission denied') || uRpc2Error.message.includes('export is unavailable'))) {
        reportPass(`ordinary user cannot call generate_data_rights_export (${uRpc2Error.message})`);
      } else {
        reportFail(`ordinary user could call generate_data_rights_export or got unexpected error: ${JSON.stringify(uRpc2Error || uRpc2Data)}`);
      }

      // Only the function's own refusal proves both halves: authenticated still
      // has EXECUTE (admins depend on it) and the admin check rejected this user.
      // A bare "permission denied for function" means the grant was lost.
      for (const [fn, args] of memberLookupRpcs) {
        const { data: uData, error: uError } = await userClient.rpc(fn, args);
        if (isMissingFunction(uError)) {
          reportMissingLookup(fn, 'ordinary user');
        } else if (uError && uError.code === '42501' && uError.message === 'Only admins can look up members') {
          reportPass(`ordinary user is refused by ${fn}'s admin check (${uError.message})`);
        } else if (uError && uError.code === '42501') {
          reportFail(`ordinary user was refused by ${fn} before its admin check ran; authenticated may have lost EXECUTE: ${uError.message}`);
        } else {
          reportFail(`ordinary user could call ${fn} or got unexpected error: ${JSON.stringify(uError || uData)}`);
        }
      }
    }
  } catch (err) {
    reportFail(`Unexpected error during ordinary user checks: ${err.message}`);
  }

  // ============================================================
  // 3. ADMIN CHECKS
  // ============================================================
  console.log('\n--- 3. ADMIN CHECKS ---');
  try {
    const adminClient = await createAdminClient();
    if (!adminClient) {
      if (retired) reportFail('admin checks cannot be skipped after the retirement migration');
      else reportSkip('admin checks (email/password not provided in env)');
    } else {
      for (const table of ['members', 'member_event_attendance']) {
        const { error } = await adminClient.from(table).select('*', { head: true });
        if (error) reportFail(`admin cannot read raw ${table}: ${error.code}`);
        else reportPass(`admin retains raw ${table} read privileges`);
      }

      // Incident #227, 20260620020000_fix_user_profiles_rls_recursion.sql: the
      // admin policy on user_profiles must evaluate (no 42P17) and the
      // is_admin_user() helper behind it must answer true for an admin.
      reportResults(await checkAdminReadsUserProfiles(adminClient));
      reportResults(await checkUserProfilesNoRecursion(adminClient, { who: 'admin', mustRead: true }));
      reportResults(await checkIsAdminUserHelper(adminClient, { who: 'admin', expected: true }));

      if (retired) {
        await expectRetiredArchivesDenied(adminClient, 'admin');
      } else {
        // Query event_check_in_secrets
        const { data: adminSecData, error: adminSecError } = await adminClient
          .from('event_check_in_secrets')
          .select('*')
          .limit(1);

        if (adminSecError) {
          reportFail(`admin cannot read event_check_in_secrets: ${adminSecError.message}`);
        } else {
          reportPass('admin can read event_check_in_secrets');
        }
      }

      // Query data_rights_requests
      const { data: adminReqData, error: adminReqError } = await adminClient
        .from('data_rights_requests')
        .select('*')
        .limit(1);

      if (adminReqError) {
        reportFail(`admin cannot read data_rights_requests: ${adminReqError.message}`);
      } else {
        reportPass('admin can read data_rights_requests');
      }

      if (houseEmbargoRequired) {
        const { data: privateStandings, error: privateError } = await adminClient.rpc(
          'admin_private_house_standings', { p_year: 2026 }
        );
        if (privateError || !Array.isArray(privateStandings)) {
          reportFail('approved admin cannot read authoritative private House standings (#692)');
        } else reportPass('approved admin can read private House standings (#692)');
      }

      // Read-only; synthetic values, sent in the POST body.
      for (const [fn, args] of memberLookupRpcs) {
        const { data: aData, error: aError } = await adminClient.rpc(fn, args);
        if (isMissingFunction(aError)) {
          reportMissingLookup(fn, 'admin');
        } else if (aError) {
          reportFail(`admin cannot call ${fn}; Historical Recovery lookups fail: ${aError.code} ${aError.message}`);
        } else if (!Array.isArray(aData)) {
          reportFail(`admin call to ${fn} did not return a JSON array: ${JSON.stringify(aData)}`);
        } else {
          reportPass(`admin can call ${fn} (returned an array)`);
        }
      }

      // Exports append an audit event for a real request. The default read-only
      // probe uses only the nil request; real exports require mutation opt-in.
      // Check access to get_data_rights_dependency_preview RPC
      const testReqId = allowMutations
        ? process.env.RLS_TEST_DATA_RIGHTS_REQUEST_ID || dummyUuid
        : dummyUuid;
      const { data: aRpc1Data, error: aRpc1Error } = await adminClient.rpc('get_data_rights_dependency_preview', { p_request_id: testReqId });
      
      if (aRpc1Error && aRpc1Error.code === '42501') {
        reportFail(`admin was blocked from get_data_rights_dependency_preview RPC: ${aRpc1Error.message}`);
      } else {
        reportPass('admin can access get_data_rights_dependency_preview RPC');
      }

      // Check access to generate_data_rights_export RPC
      const { data: aRpc2Data, error: aRpc2Error } = await adminClient.rpc('generate_data_rights_export', { p_request_id: testReqId });
      
      if (aRpc2Error && aRpc2Error.code === '42501') {
        reportFail(`admin was blocked from generate_data_rights_export RPC: ${aRpc2Error.message}`);
      } else {
        reportPass('admin can access generate_data_rights_export RPC');
      }

      // Admin write / mutation permissions (gated by RLS_ALLOW_MUTATION_TESTS=true)
      if (retired) {
        reportSkip('admin legacy manual check-in write probes (retired by the post-migration phase)');
      } else if (!allowMutations) {
        reportSkip('admin write mutation checks (RLS_ALLOW_MUTATION_TESTS is not set to true)');
      } else {
        console.log('\n\x1b[33mWARNING: Running admin mutation tests as RLS_ALLOW_MUTATION_TESTS=true.\x1b[0m');
        const testUserId = process.env.RLS_TEST_MEMBER_ID || dummyUuid;

        // Try direct manual insert on event_attendance
        const { data: admAttData, error: admAttError } = await adminClient
          .from('event_attendance')
          .insert([{
            event_id: testEventId,
            user_id: testUserId,
            points_earned: 5,
            check_in_type: 'manual'
          }])
          .select();

        if (admAttError) {
          reportFail(`admin direct insert event_attendance failed: ${admAttError.message}`);
        } else {
          reportPass('admin can directly insert event_attendance (manual check-in support)');

          // Cleanup direct insert
          const { error: admAttDelError } = await adminClient
            .from('event_attendance')
            .delete()
            .eq('event_id', testEventId)
            .eq('user_id', testUserId);

          if (admAttDelError) {
            reportFail(`admin direct delete event_attendance cleanup failed: ${admAttDelError.message}`);
          } else {
            reportPass('admin can directly delete event_attendance (cleanup)');
          }
        }

        // user_points is server-authoritative: only SECURITY DEFINER code
        // (check_in_to_event, the signup trigger) writes it, so even admins get
        // no client write policy. Probe with the admin's own existing row so an
        // unexpected allow hits the primary key (23505) instead of writing.
        const adminUser = (await adminClient.auth.getUser()).data.user;
        const { data: adminPointsRow } = await adminClient
          .from('user_points')
          .select('user_id')
          .eq('user_id', adminUser.id)
          .maybeSingle();

        if (!adminPointsRow) {
          reportSkip('admin user_points write probe (admin has no user_points row, so the probe could create one)');
        } else {
          const { error: admPtsError } = await adminClient
            .from('user_points')
            .insert([{ user_id: adminUser.id, points: 0 }]);

          if (admPtsError?.code === '42501') {
            reportPass('admin cannot write user_points directly (server-authoritative)');
          } else {
            reportFail(`admin passed RLS inserting user_points: ${JSON.stringify(admPtsError)}`);
          }
        }
      }
    }
  } catch (err) {
    reportFail(`Unexpected error during admin checks: ${err.message}`);
  }

  console.log('\n============================================================');
  if (hasFailed) {
    console.error('\x1b[31mVERIFICATION FAILED.\x1b[0m Some security requirements were not met.');
    process.exit(1);
  } else {
    console.log('\x1b[32mVERIFICATION PASSED.\x1b[0m All audited security checks are correct.');
    process.exit(0);
  }
}

runTests();
