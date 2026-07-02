import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from local or sibling directories
function loadEnv() {
  const envFiles = [
    path.resolve(process.cwd(), '.env.local'),
    path.resolve(process.cwd(), '.env'),
    path.resolve(process.cwd(), '../vsa-website/.env.local'),
    path.resolve(process.cwd(), '../vsa-website/.env')
  ];
  for (const fullPath of envFiles) {
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

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('\x1b[31mError:\x1b[0m Supabase URL and Service Role Key must be provided.');
  console.error('Ensure REACT_APP_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const BUCKET_NAME = 'member-photo-requests';
const STALE_THRESHOLD_DAYS = 7;

async function runCleanup() {
  const dryRun = process.env.CONFIRM_DELETE !== 'true';
  console.log(`Starting stale photo request cleanup (Dry run: ${dryRun})`);

  // 1. List files in the 'pending' folder
  console.log(`Listing files in storage bucket: ${BUCKET_NAME}/pending/...`);
  const { data: storageFiles, error: storageError } = await supabase.storage
    .from(BUCKET_NAME)
    .list('pending', { limit: 1000 });

  if (storageError) {
    console.error('Error listing storage files:', storageError.message);
    process.exit(1);
  }

  if (!storageFiles || storageFiles.length === 0) {
    console.log('No pending files found in storage.');
    return;
  }

  console.log(`Found ${storageFiles.length} file(s) in pending storage.`);

  // 2. Fetch all matching pending rows from database
  const { data: dbRows, error: dbError } = await supabase
    .from('member_photo_requests')
    .select('id, storage_path_pending, status');

  if (dbError) {
    console.error('Error fetching member_photo_requests:', dbError.message);
    process.exit(1);
  }

  const validPendingPaths = new Set(
    (dbRows ?? [])
      .filter(row => row.status === 'pending')
      .map(row => row.storage_path_pending)
  );

  const now = Date.now();
  const msInDay = 1000 * 60 * 60 * 24;
  const toDelete = [];

  for (const file of storageFiles) {
    // Skip subfolders or placeholder files if any
    if (file.name === '.keep' || !file.created_at) continue;

    const fullPath = `pending/${file.name}`;
    const fileAgeDays = (now - new Date(file.created_at).getTime()) / msInDay;
    const isLinkedToActivePendingRequest = validPendingPaths.has(fullPath);

    if (!isLinkedToActivePendingRequest && fileAgeDays > STALE_THRESHOLD_DAYS) {
      toDelete.push({ name: file.name, path: fullPath, ageDays: fileAgeDays.toFixed(1) });
    }
  }

  if (toDelete.length === 0) {
    console.log('No stale pending files detected (older than 7 days without active request).');
    return;
  }

  console.log(`Identified ${toDelete.length} stale pending file(s) for deletion:`);
  toDelete.forEach(file => {
    console.log(`  - ${file.path} (Age: ${file.ageDays} days)`);
  });

  if (dryRun) {
    console.log('\n[Dry Run] No files were deleted. To perform actual deletion, run:');
    console.log('  CONFIRM_DELETE=true node scripts/cleanup-stale-photo-requests.mjs');
    return;
  }

  console.log('\nDeleting stale files...');
  const pathsToRemove = toDelete.map(file => file.path);
  const { data: removedData, error: removeError } = await supabase.storage
    .from(BUCKET_NAME)
    .remove(pathsToRemove);

  if (removeError) {
    console.error('Error removing files from storage:', removeError.message);
  } else {
    console.log(`Successfully deleted ${removedData?.length ?? 0} file(s) from storage.`);
  }
}

runCleanup().catch(err => {
  console.error('Fatal cleanup error:', err);
  process.exit(1);
});
