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
  console.log('============================================================\n');

  const dummyUuid = '00000000-0000-0000-0000-000000000000';
  const testEventId = process.env.RLS_TEST_EVENT_ID || dummyUuid;

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
        reportFail(`anon could select members with sensitive fields present (user_id: ${row.user_id}, email: ${row.email})`);
      } else {
        reportPass('anon cannot select members.user_id or members.email (columns omitted or filtered)');
      }
    } else {
      reportFail('anon select sensitive fields on members succeeded without error but returned empty (unconfirmed privilege state)');
    }

    // Query members table - attempt to select safe public fields
    const { data: memSafeData, error: memSafeError } = await anon
      .from('members')
      .select('id, first_name, last_name, college, year, house, points, events_attended')
      .limit(1);

    if (memSafeError) {
      reportFail(`anon cannot select safe public columns from members: ${memSafeError.message}`);
    } else {
      reportPass('anon can read safe public member fields needed for leaderboard/House pages');
    }

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
      reportSkip('ordinary authenticated user checks (email/password not provided in env)');
    } else {
      const authUser = (await userClient.auth.getUser()).data.user;

      // Attempt to directly insert a row into event_attendance
      const { data: attInsData, error: attInsError } = await userClient
        .from('event_attendance')
        .insert([{
          event_id: testEventId,
          user_id: authUser.id,
          points_earned: 100,
          check_in_type: 'code'
        }]);

      if (attInsError) {
        reportPass(`ordinary user cannot insert event_attendance directly (${attInsError.message || attInsError.code})`);
      } else {
        reportFail('ordinary user inserted event_attendance directly without error!');
      }

      // Attempt to directly update points_earned in event_attendance
      const { data: attUpData, error: attUpError } = await userClient
        .from('event_attendance')
        .update({ points_earned: 999 })
        .eq('event_id', testEventId);

      if (attUpError) {
        reportPass(`ordinary user cannot update event_attendance (${attUpError.message || attUpError.code})`);
      } else if (attUpData && attUpData.length > 0) {
        reportFail('ordinary user updated event_attendance directly!');
      } else {
        reportPass('ordinary user cannot update event_attendance (0 rows updated due to RLS)');
      }

      // Attempt to directly insert nonzero user_points
      const { data: ptsInsData, error: ptsInsError } = await userClient
        .from('user_points')
        .insert([{
          user_id: authUser.id,
          total_points: 100,
          points: 100
        }]);

      if (ptsInsError) {
        reportPass(`ordinary user cannot insert nonzero user_points (${ptsInsError.message || ptsInsError.code})`);
      } else {
        reportFail('ordinary user inserted nonzero user_points directly!');
      }

      // Attempt to update points / total_points in user_points
      const { data: ptsUpData, error: ptsUpError } = await userClient
        .from('user_points')
        .update({ total_points: 9999, points: 9999 })
        .eq('user_id', authUser.id);

      if (ptsUpError) {
        reportPass(`ordinary user cannot update user_points (${ptsUpError.message || ptsUpError.code})`);
      } else if (ptsUpData && ptsUpData.length > 0) {
        reportFail('ordinary user updated user_points directly!');
      } else {
        reportPass('ordinary user cannot update user_points (0 rows updated due to RLS)');
      }

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
      reportSkip('admin checks (email/password not provided in env)');
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

      // Check access to get_data_rights_dependency_preview RPC
      const testReqId = process.env.RLS_TEST_DATA_RIGHTS_REQUEST_ID || dummyUuid;
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
      const allowMutations = process.env.RLS_ALLOW_MUTATION_TESTS === 'true';
      if (!allowMutations) {
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

        // Try direct insert on user_points
        const { data: admPtsData, error: admPtsError } = await adminClient
          .from('user_points')
          .insert([{
            user_id: testUserId,
            total_points: 10
          }])
          .select();

        if (admPtsError && admPtsError.code !== '23505') { // Code 23505 is unique violation, which is a structural pass (RLS allowed it)
          reportFail(`admin direct insert user_points failed: ${admPtsError.message}`);
        } else {
          reportPass('admin can directly insert user_points');
          
          if (admPtsData && admPtsData.length > 0) {
            const { error: admPtsDelError } = await adminClient
              .from('user_points')
              .delete()
              .eq('user_id', testUserId);

            if (admPtsDelError) {
              reportFail(`admin direct delete user_points cleanup failed: ${admPtsDelError.message}`);
            } else {
              reportPass('admin can directly delete user_points (cleanup)');
            }
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
