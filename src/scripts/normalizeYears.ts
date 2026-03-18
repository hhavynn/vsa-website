import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { normalizeYearInput } from '../lib/yearNormalizer';

// Load environment variables from .env
dotenv.config();

// Try to use Vite env vars if standard ones aren't present
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Ensure .env has VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl!, supabaseKey!);

async function run() {
  console.log('Fetching members...');
  const { data: members, error } = await supabase.from('members').select('id, year');
  
  if (error) {
    console.error('Error fetching members:', error);
    return;
  }
  
  let updatedCount = 0;
  
  for (const m of members) {
    if (!m.year) continue;
    
    const normalized = normalizeYearInput(m.year);
    
    // Some old data might have '1', which is technically valid but the new logic maps to '1st Year'
    if (normalized !== m.year) {
      console.log(`Updating member ${m.id}: "${m.year}" -> "${normalized}"`);
      const { error: updateError } = await supabase
        .from('members')
        .update({ year: normalized })
        .eq('id', m.id);
        
      if (updateError) {
        console.error(`Failed to update member ${m.id}`, updateError);
      } else {
        updatedCount++;
      }
    }
  }
  
  console.log(`Finished normalizing. Updated ${updatedCount} members out of ${members?.length || 0}.`);
}

run();
