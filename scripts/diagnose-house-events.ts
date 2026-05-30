import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
  console.log('--- House Events Diagnostic ---');

  // 1. Check house_events table
  const { data: events, error: eventsError } = await supabase
    .from('house_events')
    .select('*');

  if (eventsError) {
    console.error('Error fetching house_events:', eventsError);
  } else {
    console.log(`Total house_events found: ${events?.length || 0}`);
    
    // Group by year
    const byYear: Record<number, number> = {};
    events?.forEach(e => {
      const year = e.academic_year_start;
      byYear[year] = (byYear[year] || 0) + 1;
    });
    console.log('Events per academic_year_start:', byYear);

    // Show some examples
    if (events && events.length > 0) {
        console.log('\nSample events:');
        events.slice(0, 3).forEach(e => {
            console.log(`- ID: ${e.id}, Title: ${e.title}, Year: ${e.academic_year_start}, Published: ${e.is_published}`);
        });
    }
  }

  // 2. Check house_event_houses table (collab associations)
  const { data: collab, error: collabError } = await supabase
    .from('house_event_houses')
    .select('*');

  if (collabError) {
    console.error('Error fetching house_event_houses:', collabError);
  } else {
    console.log(`\nTotal house_event_houses (associations) found: ${collab?.length || 0}`);
  }

  // 3. Check house_page_assets table
  const { data: assets, error: assetsError } = await supabase
    .from('house_page_assets')
    .select('*');

  if (assetsError) {
    console.error('Error fetching house_page_assets:', assetsError);
  } else {
    console.log(`\nTotal house_page_assets found: ${assets?.length || 0}`);
    const assetsByYear: Record<number, number> = {};
    assets?.forEach(a => {
      const year = a.academic_year_start;
      assetsByYear[year] = (assetsByYear[year] || 0) + 1;
    });
    console.log('Assets per academic_year_start:', assetsByYear);
  }

  // 4. Check specific years
  for (const year of [2024, 2025]) {
      console.log(`\n--- Year ${year} Details ---`);
      const yearEvents = events?.filter(e => e.academic_year_start === year) || [];
      console.log(`Events: ${yearEvents.length}`);
      
      const yearAssets = assets?.filter(a => a.academic_year_start === year) || [];
      console.log(`Assets: ${yearAssets.map(a => a.house).join(', ')}`);
      
      if (yearEvents.length > 0) {
          const eventIds = yearEvents.map(e => e.id);
          const yearCollabs = collab?.filter(c => eventIds.includes(c.house_event_id)) || [];
          console.log(`Associations for these events: ${yearCollabs.length}`);
          
          yearEvents.forEach(e => {
              const eventAssociations = yearCollabs.filter(c => c.house_event_id === e.id);
              console.log(`  Event "${e.title}": ${eventAssociations.length} associations (direct asset ID: ${e.house_profile_id})`);
          });
      }
  }
}

diagnose();
