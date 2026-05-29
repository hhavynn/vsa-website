import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const legacyYears = [
  { start: 2023, end: 2024, houseCount: 4, houses: ['Bowser', 'Donkey Kong', 'Toad', 'Boo'] },
  { start: 2024, end: 2025, houseCount: 3, houses: ['Bowser', 'Donkey Kong', 'Toad'] },
];

async function seed() {
  console.log('🌱 Seeding legacy academic years and house profiles...');

  for (const year of legacyYears) {
    console.log(`\nProcessing Academic Year ${year.start}-${year.end}...`);

    // 1. Ensure quarters/terms exist for the year
    const quarters = ['fall', 'winter', 'spring'];
    for (const q of quarters) {
      const calendarYear = q === 'fall' ? year.start : year.end;
      const code = `${q === 'fall' ? 'FA' : q === 'winter' ? 'WI' : 'SP'}${String(calendarYear).slice(-2)}`;
      const label = `${q.charAt(0).toUpperCase() + q.slice(1)} ${calendarYear}`;
      
      const { data: term, error: termError } = await supabase
        .from('academic_terms')
        .upsert({
          code,
          label,
          academic_year_start: year.start,
          academic_year_end: year.end,
          quarter: q,
          is_active: false,
          display_order: year.start * 10 + (q === 'fall' ? 1 : q === 'winter' ? 2 : 3)
        }, { onConflict: 'code' })
        .select()
        .single();

      if (termError) {
        console.error(`Error seeding term ${code}:`, termError.message);
      } else {
        console.log(`✅ Term ${code} (${label}) ensured.`);
      }
    }

    // 2. Seed House Profiles for this year
    for (let i = 0; i < year.houses.length; i++) {
      const houseName = year.houses[i];
      const { error: houseError } = await supabase
        .from('house_page_assets')
        .upsert({
          academic_year_start: year.start,
          academic_year_end: year.end,
          house: houseName,
          house_key: houseName.toLowerCase().replace(/\s+/g, '-'),
          display_name: houseName,
          description: `Legacy profile for ${houseName} House in the ${year.start}-${year.end} year.`,
          is_active: true,
          display_order: i
        }, { onConflict: 'academic_year_start, house_key' });

      if (houseError) {
        console.error(`Error seeding house ${houseName} for ${year.start}:`, houseError.message);
      } else {
        console.log(`✅ House ${houseName} profile ensured.`);
      }
    }
  }

  console.log('\n✨ Seeding complete!');
}

seed().catch(err => {
  console.error('Fatal error during seeding:', err);
  process.exit(1);
});
