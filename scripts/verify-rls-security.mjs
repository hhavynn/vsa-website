import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

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

// Fail closed. Before the migration the signed-in sections are optional (they
// SKIP without credentials). After it, "the archives are closed" has to be
// proven for every API audience, so an existing ordinary account and an
// approved admin account are both required: a run that skipped either would
// pass without having tested it. Never create a public member account for this.
if (retired) {
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
  console.log('============================================================\n');

  const dummyUuid = '00000000-0000-0000-0000-000000000000';
  // Synthetic probe values only; never a real member's email or name.
  const memberLookupRpcs = [
    ['admin_lookup_members', { p_emails: ['rls-verify-probe@example.invalid'], p_surnames: ['rlsverifyprobe'] }, '20261011000000'],
    ['admin_search_members', { p_query: 'rls-verify-probe', p_limit: 1 }, '20261011000000'],
  ];
  const testEventId = process.env.RLS_TEST_EVENT_ID || dummyUuid;
  const allowMutations = process.env.RLS_ALLOW_MUTATION_TESTS === 'true';

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

    // Query members table - attempt to select sensitive fields
    const { data: memSensData, error: memSensError } = await anon
      .from('members')
      .select('id, user_id, email')
      .limit(1);

    if (memSensError) {
      if (memSensError.code === '42501') {
        reportPass('anon cannot select members.user_id or members.email (access denied)');
      } else {
        reportFail(`anon select members failed with unexpected error code ${memSensError.code}: ${memSensError.message}`);
      }
    } else if (memSensData && memSensData.length > 0) {
      const row = memSensData[0];
      if ('user_id' in row || 'email' in row) {
        reportFail('anon could select members with sensitive fields present (values omitted)');
      } else {
        reportPass('anon cannot select members.user_id or members.email (columns omitted or filtered)');
      }
    } else {
      reportFail('anon select sensitive fields on members succeeded without error but returned empty (unconfirmed privilege state)');
    }

    // Query members table - attempt to select safe public fields
    const { data: memSafeData, error: memSafeError } = await anon
      .from('public_members')
      .select('id, first_name, last_name, college, year, house, points, events_attended')
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
      // Query event_check_in_secrets
      const { data: secData, error: secError } = await anon
        .from('event_check_in_secrets')
        .select('*')
        .limit(1);

      if (secError) {
        reportPass(`anon cannot read event_check_in_secrets (${secError.message || secError.code})`);
      } else if (secData && secData.length > 0) {
        reportFail('anon read event_check_in_secrets successfully (returned rows)');
      } else {
        reportPass('anon cannot read event_check_in_secrets (returned empty list due to RLS)');
      }
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
        if (rError && (rError.code === 'PGRST202' || rError.code === '42883')) {
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
    await expectViewWritesDenied(anon, 'anon', { withoutSelect: ['my_member_photo_requests'] });
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
        .select('id, first_name, last_name, college, year, house, points, events_attended', { head: true });
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
      const expectInsertDenied = (label, error) => {
        if (error?.code === '42501') {
          reportPass(`ordinary user cannot insert ${label} (RLS)`);
        } else if (error?.code === '23503' || error?.code === '23505') {
          reportFail(`ordinary user passed RLS inserting ${label}; only a constraint stopped it (${error.code})`);
        } else {
          reportFail(`ordinary user insert into ${label} gave unexpected result: ${JSON.stringify(error)}`);
        }
      };
      const expectNoRowsUpdated = (label, data, error) => {
        // Only an authorization error proves RLS/grants rejected the write. Any
        // other error (schema cache, constraint, trigger, network) means the
        // probe never reached the policy, so it can't count as a pass.
        if (error && error.code === '42501') {
          reportPass(`ordinary user cannot update ${label} (${error.message || error.code})`);
        } else if (error) {
          reportFail(`ordinary user update of ${label} failed for a non-authorization reason, so RLS was not verified: ${JSON.stringify(error)}`);
        } else if (data && data.length > 0) {
          reportFail(`ordinary user updated ${data.length} ${label} row(s) directly (no-op values; nothing changed)`);
        } else {
          reportPass(`ordinary user cannot update ${label} (0 rows updated due to RLS)`);
        }
      };

      // Legacy archive write probes; post-migration the head-read check above
      // already proves the grants are gone.
      if (!retired) {
        const { error: attInsError } = await userClient
          .from('event_attendance')
          .insert([{ event_id: dummyUuid, user_id: authUser.id, points_earned: 0, check_in_type: 'code' }]);
        expectInsertDenied('event_attendance', attInsError);

        const { data: ownAttendance } = await userClient
          .from('event_attendance')
          .select('id, points_earned')
          .eq('user_id', authUser.id)
          .limit(1);
        if (!ownAttendance || ownAttendance.length === 0) {
          reportSkip('ordinary user event_attendance update probe (test user has no attendance rows)');
        } else {
          const { data, error } = await userClient
            .from('event_attendance')
            .update({ points_earned: ownAttendance[0].points_earned })
            .eq('id', ownAttendance[0].id)
            .select('id');
          expectNoRowsUpdated('event_attendance', data, error);
        }

        // Read the caller's own row first. The insert probe is only
        // non-destructive when that row exists: then an RLS bypass hits the
        // primary key (23505) instead of creating a points row.
        const { data: ownPoints } = await userClient
          .from('user_points')
          .select('points')
          .eq('user_id', authUser.id)
          .maybeSingle();
        if (!ownPoints) {
          reportSkip('ordinary user user_points insert probe (no existing row, so the probe could create one)');
        } else {
          const { error: ptsInsError } = await userClient
            .from('user_points')
            .insert([{ user_id: authUser.id, points: 0 }]);
          expectInsertDenied('user_points', ptsInsError);
        }

        if (!ownPoints) {
          reportSkip('ordinary user user_points update probe (test user has no user_points row)');
        } else {
          const { data, error } = await userClient
            .from('user_points')
            .update({ points: ownPoints.points })
            .eq('user_id', authUser.id)
            .select('user_id');
          expectNoRowsUpdated('user_points', data, error);
        }
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

      await expectViewWritesDenied(userClient, 'ordinary user');

      }

      if (!retired) {
        // Attempt to read event_check_in_secrets
        const { data: userSecData, error: userSecError } = await userClient
          .from('event_check_in_secrets')
          .select('*')
          .limit(1);

        if (userSecError) {
          reportPass(`ordinary user cannot read event_check_in_secrets (${userSecError.message || userSecError.code})`);
        } else if (userSecData && userSecData.length > 0) {
          reportFail('ordinary user read event_check_in_secrets successfully!');
        } else {
          reportPass('ordinary user cannot read event_check_in_secrets (returned empty list due to RLS)');
        }
      }

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

      for (const [fn, args, migration] of memberLookupRpcs) {
        const { data: uData, error: uError } = await userClient.rpc(fn, args);
        if (uError && (uError.code === 'PGRST202' || uError.code === '42883')) {
          reportSkip(`${fn} is not present yet (migration ${migration} not applied)`);
        } else if (uError && uError.code === '42501') {
          reportPass(`ordinary user cannot call ${fn} (${uError.message})`);
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
